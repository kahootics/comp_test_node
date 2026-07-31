import execCmdSync from "./exec-cmd-sync.mjs";

execCmdSync("rm -rf build");
console.log("\nbuild folder deleted\n");

execCmdSync("rm -rf dist");
console.log("\ndist folder deleted\n");