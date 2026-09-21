//@ ts-check

import { compileEditableTypes } from '../src/scripts/node/tooling/compile-editable-types.js';
import { writeRulesSchema } from "../src/scripts/node/tooling/write-rules-schema.js";
import { Log } from "../src/tools/logger.mjs";

Log.hdr('Initializing editable fields type declarations document');
await compileEditableTypes();

Log.hdr('Building Assets rules schema');
await writeRulesSchema();