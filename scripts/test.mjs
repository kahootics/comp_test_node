// @ts-check
import {execCmdSync} from "./exec-cmd-sync.mjs";

execCmdSync("eslint .")
execCmdSync("vitest run --config vitest.config.ts");