
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

/* export function binToHexFromLeft(bin: string): string {
  
    const sanitized = bin.replace(/[^01]/g, '');
    if (!sanitized) return '';

    const padLength = (4 - (sanitized.length % 4)) % 4;
    const padded = '0'.repeat(padLength) + sanitized;

    return padded
      .match(/.{1,4}/g)!
      .map(b => parseInt(b, 2).toString(16).toUpperCase())
      .join('');
}; */

export function binToHexFromLeft(bin: string) {
  let result = '';

  for (let i = 0; i < bin.length; i += 4) {
    const chunk = bin.slice(i, i + 4);     
    const hex = parseInt(chunk, 2).toString(16);
    result += hex.toUpperCase();
  }

  return result;
}


export const hexToBinFromLeft = (hex: string): string => {
    const sanitized = hex.replace(/[^0-9A-Fa-f]/g, '');
    if (!sanitized) return '';

    return sanitized
      .toUpperCase()
      .split('')
      .map(h => parseInt(h, 16).toString(2).padStart(4, '0'))
      .join('');
};

export function isHex(str: string): boolean {
    return /^[0-9A-Fa-f]+$/.test(str);
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
