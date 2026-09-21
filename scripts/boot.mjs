//@ ts-check

import { compileEditableTypes } from '../src/scripts/node/tooling/compile-editable-types.js';
import { writeRulesSchema } from "../src/scripts/node/tooling/write-rules-schema.js";

console.log('Initializing editable fields type declarations document');
await compileEditableTypes();

console.log('Building Assets rules schema');
await writeRulesSchema();