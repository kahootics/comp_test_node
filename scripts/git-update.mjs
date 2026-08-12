// @ts-check

import readline from 'node:readline/promises';
import {execCmdSync} from './exec-cmd-sync.mjs';

const LN_INPUT = '$' + ' ';

/**
 * @type {Record<string,string>}
 */
const updatesMap = {
    '1': 'patch',
    '2': 'minor',
    '3': 'major',
};
/**
 * 
 * @param {readline.Interface} rl 
 */
export async function pushCurrentBranch(rl) {

// TAKING INPUTS ============================================================

const update = await rl.question(
    'Pick Version Update:\n' +
    '  1) patch (+ 0.0.1)\n' +
    '  2) minor (+ 0.1.#)\n' +
    '  3) major (+ 1.#.#)\n' +
    '  0) undo\n' +
    LN_INPUT
);

if (update === '0') {
    rl.close();
    console.log('Exiting operation.');
    process.exit(0);
}

const bump = updatesMap[update];
if (!bump) {
    rl.close();
    console.error('Invalid choice, operation failed.');
    process.exit(1);
}

const commitMsg = await rl.question(
    'Write commit message:\n' 
    + LN_INPUT
);

const commitDesc = await rl.question(
    'Description (optional, press Enter to skip):\n' 
    + LN_INPUT
);

rl.close();

if (commitMsg === '') {
    console.error('Commit message is not optional, operation failed.');
    process.exit(1);
}

// FINALIZE ====================================================================

// Images first processing

// Clean dist folder
execCmdSync('npm run clear:dist','Emptying dist folder...')

// Update Version
execCmdSync(`npm version ${bump} --no-git-tag-version`,`Updated version to ${bump}`)

// Git add
execCmdSync('git add .');

// Git commit
const commitCommand = commitDesc
    ? `git commit -m "${commitMsg}" -m "${commitDesc}"`
    : `git commit -m "${commitMsg}"`;
execCmdSync(commitCommand);

// Git push
execCmdSync('git push');
}