// @ts-check

import { execSync } from 'node:child_process';

/**
 * Runs the provided command and logs it or a provided message to the console.
 * @param {string} command - Command to run on terminal.
 * @param {string} [message] - Message to log in replacement of command.
 */
export function execCmdSync(command, message) {
    if (message) console.log('> ' + message);
    else console.log('> ' + command);

    return execSync(command, { stdio: 'inherit', encoding: 'utf-8' });
}

export function getCurrentBranch() {
    return execSyncQuiet('git branch --show-current').trim();
}

export function getLocalBranches() {
    return execSyncQuiet('git branch --format="%(refname:short)"')
        .split('\n')
        .map(b => b.trim())
        .filter(Boolean);
}

/**
 * Runs the provided command without logging it.
 * @param {string} command - Command to run on terminal.
 */
export function execSyncQuiet(command) {
    return execSync(command, { encoding: 'utf-8' });
}

/** @typedef {import('node:readline/promises').Interface} readlineInterface */

const LN_INPUT = '$ ';
/**
 * 
 * @param {readlineInterface} rl 
 * @returns 
 */
export async function switchBranch(rl) {
    const branches = getLocalBranches();
    const menu = branches.map((b, i) => `  ${i + 1}) ${b}`).join('\n');
    const choice = await rl.question(`Choose branch:\n${menu}\n${LN_INPUT}`);
    const target = branches[Number(choice) - 1];
    if (!target) { console.error('Invalid choice.'); return; }
    execCmdSync(`git checkout ${target}`, `Switching to ${target}`);
}

/**
 * 
 * @param {readlineInterface} rl 
 * @returns 
 */
export async function createBranch(rl) {
    const name = await rl.question('New branch name:\n' + LN_INPUT);
    if (!name) { console.error('Name is required.'); return; }

    execCmdSync(`git checkout -b ${name}`, `New local Branch: ${name}`);

    const pushRemote = await rl.question('Push to remote? (y/n)\n' + LN_INPUT);
    if (pushRemote.toLowerCase() === 'y') {
        execCmdSync(`git push -u origin ${name}`, `Push iniziale di ${name}`);
    }
}