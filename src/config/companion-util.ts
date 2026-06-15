
import config from './companion.config.json' with {type: 'json'};

/**
 * 
 * @param {string} filePath - 
 * @returns {string}
 */
export function toPublicUrl(filePath: string): string {
    // take anything after dist/
    const relative = filePath.split('dist/')[1];
    return `${config.site + config.base}/${relative}`;
}
