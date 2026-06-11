
export function binToHexFromLeft(bin: string) {
	let result = '';
	for (let i = 0; i < bin.length; i += 4) {
   		const chunk = bin.slice(i, i + 4);     
   		const hex = parseInt(chunk, 2).toString(16);
   		result += hex.toUpperCase();
	}
	return result;
}


export function hexToBinFromLeft(hex: string): string {
   	const sanitized = hex.replace(/[^0-9A-Fa-f]/g, '');
   	if (!sanitized) return '';

	return sanitized
   		.toUpperCase()
   		.split('')
   		.map(h => parseInt(h, 16).toString(2).padStart(4, '0'))
   		.join('');
}

export function isHex(str: string): boolean {
   	return /^[0-9A-Fa-f]+$/.test(str);
}