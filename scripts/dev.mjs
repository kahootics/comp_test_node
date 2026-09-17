import {execCmdSync} from "./exec-cmd-sync.mjs";


execCmdSync("tsc");/*  -p tsconfig.dev.json */

execCmdSync("node --watch build/scripts/node/db/dev/dev.js");