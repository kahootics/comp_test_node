// @ts-check
import tsconfig from '../../tsconfig.json' with {type: 'json'}
import pkg from '../../package.json' with {type: 'json'}
import path from 'path/posix'
import { _stabilizePath } from '../tools/companion-util.js';

const prefix = 'tx-cp';
const repoName = path.basename(pkg.repository.url, `.${pkg.repository.type}`);

const toPkg = path.resolve(`./app-config.mjs`);
console.log(toPkg)
const repoRoot = toPkg.split(repoName)[0];
console.log(repoRoot)
if(!repoRoot) throw new Error()

const projectRoot = _stabilizePath(path.join(repoRoot,repoName));


export default {
    version: pkg.version,
    repo: repoName,
    site: 'https://kahootics.github.io',
    paths: {
        root: projectRoot,
        outDir: "dist",
        tsDir: tsconfig.compilerOptions.outDir,

        /** Location of the hash records of the assets in src directory. */
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

