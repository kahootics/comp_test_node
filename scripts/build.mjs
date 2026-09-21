import {execCmdSync} from "./exec-cmd-sync.mjs";

execCmdSync("eslint .")
execCmdSync("tsc");
execCmdSync("node build/main.js");