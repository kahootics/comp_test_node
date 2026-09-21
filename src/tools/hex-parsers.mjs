//@ ts-check
/** 
 * Converts a binary string to hexadecimal (starting from left) 
 * 
 * @param {string} bin 
 * @returns {string}
 */
export function binToHexFromLeft(bin) {
	let result = '';
	for (let i = 0; i < bin.length; i += 4) {
   		const chunk = bin.slice(i, i + 4);     
   		const hex = parseInt(chunk, 2).toString(16);
   		result += hex.toUpperCase();
	}
	return result;
}

/** 
 * Converts a hexadecimal string to binary (starting from left) 
 * 
 * @param {string} hex
 * @returns {string} 
 */
export function hexToBinFromLeft(hex) {
   	const sanitized = hex.replace(/[^0-9A-Fa-f]/g, '');
   	if (!sanitized) return '';

	return sanitized
   		.toUpperCase()
   		.split('')
   		.map(h => parseInt(h, 16).toString(2).padStart(4, '0'))
   		.join('');
}

/** 
 * Verifies if a string holds a valid hexadecimal value 
 * 
 * @param {string} str
 * @returns {boolean} 
 */
export function isHex(str) {
   	return /^[0-9A-Fa-f]+$/.test(str);
}
