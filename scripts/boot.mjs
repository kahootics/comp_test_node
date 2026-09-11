//@ts-check

import { compileEditableTypes } from '../src/scripts/node/db/editables/compile-editable-types.js';

console.log('initializing editable fields type declarations document');
compileEditableTypes();