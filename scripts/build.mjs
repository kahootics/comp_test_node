import execCmdSync from "./exec-cmd-sync.mjs";

execCmdSync("tsc");
execCmdSync("node dist/main.js");