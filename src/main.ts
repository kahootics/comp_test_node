
/* 
 * assets/  # must be optimized and copied in dist (same routing)
 * scripts/node/    # execution helpers (transpile for execution only)
 * scripts/ # transpile and route (shipped with routing)
 * static/  # copied directly as they are
 */



import writeAsJsonAt from './scripts/node/writers/write-as-json-at.js';
import buildScripts from './scripts/node/main/build-scripts.js';
import { Log } from './tools/console.js';
import { CopyRule } from './scripts/node/sharp/rules/copy-rule.js';
import { Asset } from './scripts/node/sharp/asset.js';
import { AssetsLibrary } from './scripts/node/sharp/assets-library.js';
import { buildRuleRegistry } from './scripts/node/sharp/rule-registry.js';
import z, { object, regex } from 'zod';
import { writeZodAsSchema } from './scripts/node/writers/write-zod-as-schema.js';
import fetchSheetAsCSV from './scripts/node/csv/fetch-sheet-as-csv.js';
import { writeFile } from 'node:fs/promises';


export const isDev = process.env.BUILD !== 'true';

Log.hdr('building script bundles');
//const scripts = await buildScripts();
Log.msg('mammt')
//const js = await json();

//writeAsJsonAt(js,'dist/assets/sprites/jennyk.json'); 

/* Log.hdr('building data documents');
await buildDatasets();
 */
Log.hdr('test');

//const lib = await AssetsLibrary.build('src/assets',['webp','png','jpeg']);

//await lib.enforceLocalRulesLibraryAt('rules');

//Log.hdr('export test');

//lib.exportLibraryTo('rules','dist' as any)

//await writeZodAsSchema('record',recordStoreSchema)

/* const armo = await fetchSheetDataset('1tUbrxZ1PCwOPsIZcU4G2rrTxfTQ8T6-0027uUxlaJNs','304819383');
const spel = await fetchSheetDataset('1tUbrxZ1PCwOPsIZcU4G2rrTxfTQ8T6-0027uUxlaJNs','1353866329');
const mgef = await fetchSheetDataset('1tUbrxZ1PCwOPsIZcU4G2rrTxfTQ8T6-0027uUxlaJNs','555361896');
const ingr = await fetchSheetDataset('1tUbrxZ1PCwOPsIZcU4G2rrTxfTQ8T6-0027uUxlaJNs','185898759');

const blob = armo.filter(thing => !thing?.overwritten && thing.playable);
const spelBlob = spel.filter(thing => !thing?.overwritten);
const mgefBlob = mgef.filter(thing => !thing?.overwritten);
const ingrBlob = ingr.filter(thing => !thing?.overwritten); */

const r = await fetchSheetAsCSV('1tUbrxZ1PCwOPsIZcU4G2rrTxfTQ8T6-0027uUxlaJNs','185898759');

await writeFile('dist/ingr.txt',r, 'utf-8');/* 
await writeAsJsonAt(blob,'dist/test/armo.json', {minify: false})
await writeAsJsonAt(spelBlob,'dist/test/spel.json', {minify: false})
await writeAsJsonAt(mgefBlob,'dist/test/mgef.json', {minify: false})
await writeAsJsonAt(ingrBlob,'dist/test/ingr.json', {minify: false}) */

//writeAsJsonAt(await csvIntoDataset(r),'dist/armor.json', {minify:false});