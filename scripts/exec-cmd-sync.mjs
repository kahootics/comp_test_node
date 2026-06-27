// @ts-check

import { execSync } from 'node:child_process';

/**
 * Runs the provided `git` command and logs it to the console
 * @param {string} command - Command to run
 */
export function execGitSync(command) {
    const gitCommand = 'git ' + command.replaceAll('git ','').trim();
    execCmdSync(gitCommand);
}

/**
 * Runs the provided command and logs it to the console
 * @param {string} command - Command to run
 */
export default function execCmdSync(command) {
    console.log('> ' + command);
    execSync(command, { stdio: 'inherit' });
}