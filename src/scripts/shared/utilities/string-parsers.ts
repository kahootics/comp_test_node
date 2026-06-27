/** Converts string to kebab case */
export function toSafeKebab(string: string) {
    return string
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
/** Converts string from kebab case */
export function fromSafeKebab(string: string) {
    return string
        .split("-")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * @param string - String to normalize
 * @returns normalized string
 */
export function toNormalized(string: string) {
    return string
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim();
}

export function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


/**
 * Extracts a portion of string between two provided substrings
 * @param str - The entire string to extract from
 * @param start - String to start the extraction from
 * @param end - String to end the extraction at
 * @returns the extracted string or `null`
 */
export function extractBetween(
	str: string,
   	start: string,
   	end: string
): string | null {

	const regex = new RegExp(`${escapeRegExp(start)}([^\\s]+?)${escapeRegExp(end)}`);
   	const match = str.match(regex);
   	return match && (match[1] ?? '');
}

/**
 * Formats an array of values into a CSV and swaps the last comma with an "and"
 * @param joiners - Array of strings to join into a comma separated list
 * @param and - (optional) Swapped in place of last comma   
 * Defaults to `"and"`
 * @returns formatted list
 */
export function formatList(joiners: string[], and?: string): string {
    return joiners.join(', ').replace(/, ([^,]+)$/g, ` ${and} $1`);
}