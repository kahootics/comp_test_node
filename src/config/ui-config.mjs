// @ts-check
import tsconfig from '../../tsconfig.json' with {type: 'json'}
import pkg from '../../package.json' with {type: 'json'}
import { _stabilizePath } from '../tools/companion-util.js';

const prefix = 'tx-cp';
const repoName = pkg.repository.url.replace(`.${pkg.repository.type}`,'');

const projectRoot = "C:/Github/Repositories/kahootics/comp_test_node";


export default {
    version: pkg.version,
    repo: repoName,
    site: 'https://kahootics.github.io',
    paths: {
        root: projectRoot,
        outDir: "dist",
        tsDir: tsconfig.compilerOptions.outDir,
        srcDir: 'src',

        /** Location of the hash records of the assets in src directory. */
        assetsHashLibrary: "src/data/assets/assets-hash-records-library.json",
        assetsToDelete: "src/data/assets/assets-to-delete.json"
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
            
        },
        customElements: {
            /** @type {'AA-AA'} */
            CAROUSEL_TAG: 'AA-AA'
        }
    },
    dd: {
    },
    misc: {}
}

