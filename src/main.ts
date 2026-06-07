
/* 
 * assets/  # must be optimized and copied in dist (same routing)
 * node/    # execution helpers (transpile for execution only)
 * scripts/ # transpile and route (shipped with routing)
 * static/  # copied directly as they are
 */



import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

/* if (fs.existsSync('./dist')) {
    fs.rmSync('./dist', { recursive: true });
} */


// import SHARED from '../../static/companion-shared-ids.json' with { type: 'json' };

const dest = './dist/json.json';

function getFileName() {}

const scriptFiles = await glob('sync/**/*.js', { cwd: './dist' }); // GOOD

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
