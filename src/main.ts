
/* 
 * assets/  # must be optimized and copied in dist (same routing)
 * scripts/node/    # execution helpers (transpile for execution only)
 * scripts/ # transpile and route (shipped with routing)
 * static/  # copied directly as they are
 */



import writeAsJsonAt from './scripts/node/writers/write-as-json-at.js';
import buildScripts from './scripts/node/main/build-scripts.js';
import { Log } from './tools/console.js';
import { buildDatasets } from './scripts/node/main/build-datasets.js';
import { CopyRule } from './scripts/node/sharp/rules/copy-rule.js';
import { Asset } from './scripts/node/sharp/asset.js';
import { AssetsLibrary } from './scripts/node/sharp/assets-library.js';
import { buildRuleRegistry } from './scripts/node/sharp/rule-registry.js';
import z, { object, regex } from 'zod';
import { writeZodAsSchema } from './scripts/node/writers/write-zod-as-schema.js';
import { csvIntoDataset } from './scripts/node/csv/csv-to-dataset.js';
import fetchSheetDataset from './scripts/node/csv/fetch-sheet-as-dataset.js';


export const isDev = process.env.BUILD !== 'true';

//Log.hdr('building script bundles');
//const scripts = await buildScripts();

/* const js = await json();

writeAsJsonAt(js,'dist/assets/sprites/jennyk.json'); */

//Log.hdr('building data documents');
//await buildDatasets();

Log.hdr('test');

//const lib = await AssetsLibrary.build('src/assets',['webp','png','jpeg']);

//await lib.enforceLocalRulesLibraryAt('rules');

//Log.hdr('export test');

//lib.exportLibraryTo('rules','dist' as any)

//await writeZodAsSchema('record',recordStoreSchema)

const stuff = await fetchSheetDataset('1tUbrxZ1PCwOPsIZcU4G2rrTxfTQ8T6-0027uUxlaJNs','304819383');

const blob = stuff.filter(thing => !thing?.overwritten && thing.playable);

writeAsJsonAt(blob,'dist/test/a.json', {minify: false})