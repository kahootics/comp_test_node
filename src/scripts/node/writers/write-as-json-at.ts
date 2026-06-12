
import fs from 'node:fs';
import path from 'node:path';

/**
 * Converts data into a JSON format and writes as a .json file at requested path
 * @param data - JSON compatible data to stringify and write in a .json file
 * @param dest - Destination path for the output file
 * @param minified - (optional) Decide if remove all spaces and new lines from output.   
 * Defaults to `false`.
 */
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

