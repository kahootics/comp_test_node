
/* 
 * assets/  # must be optimized and copied in dist (same routing)
 * scripts/node/    # execution helpers (transpile for execution only)
 * scripts/ # transpile and route (shipped with routing)
 * static/  # copied directly as they are
 */



import writeAsJsonAt from './scripts/node/writers/write-as-json-at.js';
import buildScripts from './scripts/node/main/build-scripts.js';
import json from './scripts/node/main/build-assets.js';
import { Log } from './config/companion-util.js';
import { buildDatasets } from './scripts/node/main/build-datasets.js';


export const isDev = process.env.BUILD !== 'true';

Log.hdr('building script bundles');
const scripts = await buildScripts();

const js = await json();

writeAsJsonAt(js,'dist/assets/sprites/jennyk.json');

Log.hdr('building data documents');
await buildDatasets();