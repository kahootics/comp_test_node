
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

/* if (fs.existsSync('./dist')) {
    fs.rmSync('./dist', { recursive: true });
} */

const dest = './dist/json.json';

function getFileName() {}

const scriptFiles = await glob('assets/**/*.js', { cwd: './dist' }); // GOOD

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
