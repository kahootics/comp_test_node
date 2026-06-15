// @ts-check

import { execSync } from 'node:child_process';

/**
 * Runs a provided command and logs it to the console
 * @param {string} command - Command to run
 */
export default function execGitSync(command) {
    console.log('$ ' + command);
    execSync(command, { stdio: 'inherit' });
}