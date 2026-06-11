
export function toSafeKebab(string: string) {
    return string
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function fromSafeKebab(string: string) {
    return string
        .split("-")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function toNormalized(string: string) {
    return string
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim();
}

export function extractBetween(
	str: string,
   	start: string,
   	end: string
): string | null {

   	const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

	const regex = new RegExp(`${escapeRegExp(start)}([^\\s]+?)${escapeRegExp(end)}`);
   	const match = str.match(regex);
   	return match && (match[1] ?? '');
}
