
import fs from 'node:fs';
import path from 'node:path';

export default async function writeAsJsonAt(data: unknown, dest: string, minified?: boolean) {

	try {

  		const outPath = path.resolve(dest);

  		fs.mkdirSync(path.dirname(outPath), { recursive: true });

    	if(minified) {
  			fs.writeFileSync(
    			outPath,
    			JSON.stringify(data),
    			'utf-8'
  			);
		} else {
    		fs.writeFileSync(
    			outPath,
    			JSON.stringify(data, null, 2),
    			'utf-8'
    		);
  		}

		console.log(`File written at: ${outPath} (${fs.statSync(outPath).size} bytes)`);

	} catch(err) {

		console.error(`File writing failed at: ${dest}:`, err);
		
	}
}

