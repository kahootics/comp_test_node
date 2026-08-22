// @ts-check

const LN_INPUT = '$ ';





import readline from 'node:readline/promises';
import { createBranch, getCurrentBranch, switchBranch } from './exec-cmd-sync.mjs';
import { Log } from '../src/tools/logger.mjs';
import { pushCurrentBranch } from './git-update.mjs';

async function mainMenu() {

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    Log.msg(`Current branch: ${getCurrentBranch()}`);
    Log.hdr('Choose action:')
    Log.msg('1) Switch branch\n' +
        '  2) Create new branch\n' +
        '  3) Push (bump + commit + push)\n' +
        '  4) Merge with other branch\n' +
        '  0) Exit\n')
    const action = await Log.listI(rl, 3,
        /* 'Choose action:\n' +
        '  1) Switch branch\n' +
        '  2) Create new branch\n' +
        '  3) Push (bump + commit + push)\n' +
        '  4) Merge with other branch\n' +
        '  0) Exit\n' + */
        LN_INPUT
    );

    switch (action) {
        case '1': await switchBranch(rl); break;
        case '2': await createBranch(rl); break;
        case '3': await pushCurrentBranch(rl); break;
        case '4': rl.close(); process.exit(0);//await mergeBranch(); break;
        case '0': Log.msg("Exiting process."); rl.close(); process.exit(0);
        default: console.error('Invalid choice.');
    }

    rl.close();
}

await mainMenu();