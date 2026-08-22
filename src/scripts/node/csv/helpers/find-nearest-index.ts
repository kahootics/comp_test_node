import type { CsvOptionalSymbols } from '../csv-optional-symbols.js';
import type { IndexHeader } from '../headers/index-header.js';
import type { NestableHeader } from '../headers/nestable-header.js';

export function findNearestIndex(flatLabel: string, self: NestableHeader, indexHeaders: IndexHeader[], options: CsvOptionalSymbols) {
    let best;
    for (const candidate of indexHeaders) {
        if (candidate === self) continue;
        if (flatLabel.startsWith(candidate.flat + options.objectNotation)) {
            if (!best || candidate.flat.length > best.flat.length) best = candidate;
        }
    }
    return best;
}
