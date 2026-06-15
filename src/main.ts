
/* 
 * assets/  # must be optimized and copied in dist (same routing)
 * scripts/node/    # execution helpers (transpile for execution only)
 * scripts/ # transpile and route (shipped with routing)
 * static/  # copied directly as they are
 */



import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { buildSrcset } from './scripts/node/sharp/build-srcset.js';
import writeAsJsonAt from './scripts/node/writers/write-as-json-at.js';
import { Log, toPublicUrl } from './config/companion-util.js';
import { pushScripts } from './scripts/node/main/push-scripts.js';


await pushScripts();


const json = await buildSrcset('src/assets/sprites/content-icons-sprite.webp','dist/assets/sprites/',[720,1080], false, true);

writeAsJsonAt(json,'dist/assets/sprites/jennyk.json');