import { execSync } from 'node:child_process';

export default function execGitSync(command) {
    console.log('$ ' + command);
    execSync(command, { stdio: 'inherit' });
}