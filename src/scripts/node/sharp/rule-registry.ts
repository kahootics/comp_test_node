import { Log } from "../../../tools/logger.mjs";
import { buildRuleRegistry } from "./build-rule-registry.js";
import path from "path/posix";

const rulesPath = path.join(path.dirname(import.meta.url), 'rules');

const { rulesetSchema, allRuleClassesMap, } = await buildRuleRegistry(rulesPath);

export { rulesetSchema, allRuleClassesMap };
Log.msg(`Built rulesets from glob pattern ${rulesPath}`);