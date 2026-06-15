
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

/* if (fs.existsSync('./dist')) {
    fs.rmSync('./dist', { recursive: true });
} */


// import SHARED from '../../static/companion-shared-ids.json' with { type: 'json' };

const dest = './dist/export.json';

const scriptFiles = await glob('dist/scripts/sync/**/*.js'); // GOOD

const out: { [key: string]: string }[] = [];
scriptFiles.forEach(script => {
    const key = path.basename(script, '.js');
    out.push({
        [key]: script
    });
})

const outPath = path.resolve(dest);

fs.mkdirSync(path.dirname(outPath), { recursive: true });

    	
fs.writeFileSync(
    		outPath,
			JSON.stringify(out),
    		'utf-8'
		)

console.log(`File written at: ${outPath} (${fs.statSync(outPath).size} bytes)`);


const json = await buildSrcset('src/assets/sprites/content-icons-sprite.webp','dist/assets/sprites/',[720,1080], false, true);

writeAsJsonAt(json,'dist/assets/sprites/jennyk.json');