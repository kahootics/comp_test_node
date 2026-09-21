import {execCmdSync} from "./exec-cmd-sync.mjs";


//execCmdSync("tsc");
process.env.TSX = 'true';
execCmdSync("eslint .")
execCmdSync("node --import tsx --watch src/scripts/build-dev.js");