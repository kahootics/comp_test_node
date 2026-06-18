
import fs from 'node:fs';
import path from 'node:path';
import { Log } from '../../../config/companion-util.js';
import hashFile from './hash.js';

/**
 * Options list for writing JSON document.
 */
interface WJOptions {
	/**
	 * Set to `true` to minify the document before writing,
	 * removing all spaces and new lines.
	 */
	minify?: boolean,
	/**
	 * Set to `true` to add a 8 characters length hash
	 * to the filename.
	 */
	hash?: boolean	
}

/**
 * Converts data into a JSON format and writes as a .json file at requested path
 * @param data - JSON compatible data to stringify and write in a .json file
 * @param dest - Destination path for the output file
 * @param [options] - (optional) output options; 
 * see {@link WJOptions} for full list of options.
 * 
 * Defaults to `true` 
 */
export default async function writeAsJsonAt(
	data: unknown, 
	dest: string, 
	options?: WJOptions
): Promise<string> {
	const minify  = options?.minify;
	const hash    = options?.hash;
  	const outPath = path.resolve(dest);
	try {
  		fs.mkdirSync(path.dirname(outPath), { recursive: true });

    	if(minify) {
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

	} catch(err) {
		console.error(`File writing failed at: ${dest}:`, err);
	} finally {
		
		const finalPath = hash ? hashFile(outPath) : outPath;
		Log.file(finalPath);
		return finalPath;
	}
}

