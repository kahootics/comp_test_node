import { isNull } from "./is-null.js";

/**
 * Normalizes a CSV value element into corresponding JS types
 * @param value - Cell content to normalize
 * @param newLineReplacer - (optional) Symbol replaced with `\n` in the output.
 * If omitted, no replacement is performed.
 * @returns normalized content inputted
 */
export default function normalizeCellValue(value: string | number | null, newLineReplacer?: string) {

	if (isNull(value)) return null;
	if (value === 'TRUE') return true;
	if (value === 'FALSE') return false;
	if (!isNaN(
		typeof value === 'number'
			? value
			: Number(value.replace(',','.'))
	)) return Number(value);
	if (typeof value === 'string') return (newLineReplacer ? value.replaceAll(newLineReplacer, '\n').trim() : value.trim());
	return value;

}
