// @ts-check
import tsconfig from '../../tsconfig.json' with {type: 'json'}
import pkg from '../../package.json' with {type: 'json'}
import path from 'path/posix'

const prefix = 'tx-cp'

export default {
    version: pkg.version,
    repo: path.basename(pkg.repository.url, `.${pkg.repository.type}`),
    site: 'https://kahootics.github.io',
    paths: {
        base: 'https://',
        outDir: "dist",
        tsDir: tsconfig.compilerOptions.outDir,

        /** Location of the hash records of the assets. */
        assetsHashLibrary: "src/data/assets/assets-hash-records-library.json",
    },
    prefixes: {
        classes: 'tx-cp-',
    },
    css: {
        /** Identifies something that must be 
         * replaced with something from this field */
        identifierPrefix: '--§',
        classes: {
            EXPANDABLE_OPEN: `${prefix}-is-open`,
            BACKDROP_OPEN: `${prefix}-backdrop-is-open`
        },
        attributes: {},
        vars: {
            
        }
    },
    dd: {
    },
    misc: {}
}

