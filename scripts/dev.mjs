import {execCmdSync} from "./exec-cmd-sync.mjs";


//execCmdSync("tsc");
execCmdSync("eslint .")
execCmdSync("node --import tsx --watch src/scripts/build-dev.js");