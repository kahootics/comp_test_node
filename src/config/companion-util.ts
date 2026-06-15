
import config from './companion.config.json' with {type: 'json'};

/**
 * 
 * @param {string} filePath - 
 * @returns {string}
 */
export function toPublicUrl(filePath: string): string {
    // take anything after dist/
    return filePath.split('dist/')[1] ?? filePath;
   // return `${config.site + config.base}/${relative}`;
}

