
/** Converts a binary string to hexadecimal (starting from left) */
export function binToHexFromLeft(bin: string) {
	let result = '';
	for (let i = 0; i < bin.length; i += 4) {
   		const chunk = bin.slice(i, i + 4);     
   		const hex = parseInt(chunk, 2).toString(16);
   		result += hex.toUpperCase();
	}
	return result;
}

/** Converts a hexadecimal string to binary (starting from left) */
export function hexToBinFromLeft(hex: string): string {
   	const sanitized = hex.replace(/[^0-9A-Fa-f]/g, '');
   	if (!sanitized) return '';

	return sanitized
   		.toUpperCase()
   		.split('')
   		.map(h => parseInt(h, 16).toString(2).padStart(4, '0'))
   		.join('');
}

/** Verifies if a string holds a valid hexadecimal value */
export function isHex(str: string): boolean {
   	return /^[0-9A-Fa-f]+$/.test(str);
}

/** Converts a byte to a string representing it in KB (max 2 decimals) */
export function fromBtoKB(bytes: number ): string {
	return `${(bytes/1024).toFixed(2)} KB`;
}
