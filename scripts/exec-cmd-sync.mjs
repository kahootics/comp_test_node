// @ts-check

import { execSync } from 'node:child_process';


/**
 * Runs the provided command and logs it or a provided message to the console.
 * @param {string} command - Command to run on terminal.
 * @param {string} [message] - Message to log in replacement of command.
 */
export default function execCmdSync(command, message) {
    if (message) console.log('> ' + message);
    else console.log('> ' + command);

    execSync(command, { stdio: 'inherit' });
}