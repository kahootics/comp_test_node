import {execCmdSync} from "./exec-cmd-sync.mjs";

execCmdSync("rm -rf build");
console.log("build folder deleted\n");

execCmdSync("rm -rf dist");
console.log("dist folder deleted\n");