'use strict'

let fs = require('fs')
let path = require('path')
let _ = require('lodash')

module.exports = (expressApp, filename) => {

    const COLUMN_WIDTH_TREE = 50
    const COLUMN_WIDTH_PATH = 60
    const TREE_INDENT_SIZE = 5

    let text = []

    function fillWithSpaces(str, len) {
        while (str.length < len) {
            str += ' '
        }
        return str
    }

    function brushIndentation(indentation) {
        return indentation.replace(/─/g, ' ').replace(/├/g, '│').replace(/└/g, ' ')
    }
    
    function getSourceCodeLocation(layer) {
        let location = undefined
        try {
            layer.handle() // handler will need req or res and thus fail
        } catch (err) {
            let stackLines = err.stack.split('\n')
            //var me = stackLines.findIndex(l => l.includes('express-print-routes/lib/index.js:9'));
            //let me = stackLines.findIndex((l) => l.includes('at getSourceCodeLocation'))
            let me = stackLines.findIndex((l) => /at getSourceCodeLocation \(.*express-print-routes\/lib\/index.js/.test(l))
            location = me !== -1 ? stackLines[me - 1] : undefined // eslint-disable-line no-magic-numbers
            if (location) {
                // try to make path relative to cwd
                let m = location.match(/\(([^:]*)(.*)\)/)
                let p = path.relative(process.cwd(), m[1])
                let loc = m[2]
                location = p + loc
            }
        }
        return location
    }

    function printRoutes(layer, indentation) {

        let path = ' '
        if (layer.path) {
            path += layer.path
        } else if (layer.route && layer.route.path) {
            path += layer.route.path
        } else if (layer.regexp) {
            if (layer.regexp.source === '^\\/?$') {
                path += '/'
            } else if (layer.regexp.source === '^\\/?(?=\\/|$)') {
                path += '*'
            } else {
                path += `/${ layer.regexp.source }/`
            }
        }

        let methods = []
        if (layer.method) {
            methods.push(layer.method)
        } else if (layer.route) {
            if (layer.route.methods) {
                methods = _.keys(layer.route.methods)
            } else if (layer.route.method) {
                methods.push(layer.route.method)
            }
        }
        methods = methods.join(', ').toUpperCase()

        let location = getSourceCodeLocation(layer)
        
        let name = location ? `${ layer.name } (${ location })` : layer.name
        
        text.push(`${ indentation + path } - ${ methods } - ${ name }`)

        if (!layer.stack && !(layer.route && layer.route.stack)) {
            if (layer.handle.stack) {
                return printRoutes(layer.handle, brushIndentation(indentation))
            }
            return
        }

        indentation = `${ brushIndentation(indentation) } ├── `

        let stack = layer.stack || layer.route.stack
        for ( let i = 0; i < stack.length; i+=1 ) {
            if (i === stack.length - 1) {
                indentation = `${ indentation.substr(0, indentation.length - TREE_INDENT_SIZE) } └── `
            }
            printRoutes(stack[i], indentation)
        }

        text.push(indentation.substr(0, indentation.length - TREE_INDENT_SIZE))

    }

    printRoutes(expressApp._router, '')

    fs.writeFile(filename, text.join('\n'), (err) => {
        /* istanbul ignore if */
        if (err) {
            console.error(`Failed to print routes to ${ filename }`)
        } else {
            console.log(`Printed routes to ${ filename }`)
        }
    })

}
