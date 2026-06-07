import readline from 'node:readline/promises';
import { execSync } from 'node:child_process';

const LN_INPUT = '$' + ' ';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const update = await rl.question(
    'Pick Version Update:\n' +
    '  1) patch (+ 0.0.1)\n' +
    '  2) minor (+ 0.1.0)\n' +
    '  3) major (+ 1.0.0)\n' +
    '  0) undo\n' +
    LN_INPUT
);

const updatesMap = {
    '1': 'patch',
    '2': 'minor',
    '3': 'major',
};

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
    'Commit message:\n' 
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

execSync(`npm version ${bump} --no-git-tag-version`, { stdio: 'inherit' });
execSync('git add .', { stdio: 'inherit' });

const commitCommand = commitDesc
    ? `git commit -m "${commitMsg}" -m "${commitDesc}"`
    : `git commit -m "${commitMsg}"`;

execSync(commitCommand, { stdio: 'inherit' });
execSync('git push', { stdio: 'inherit' });

console.log(`Version updated: ${bump}`);