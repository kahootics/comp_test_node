import type { CsvParserOptions } from '../csv-parser-options.js';
import type { IndexHeader } from '../headers/index-header.js';
import type { NestableHeader } from '../headers/nestable-header.js';

export function findNearestIndex(flatLabel: string, self: NestableHeader, indexHeaders: IndexHeader[], options: CsvParserOptions) {
    let best;
    for (const candidate of indexHeaders) {
        if (candidate === self) continue;
        if (flatLabel.startsWith(candidate.flat + options.objectNotation)) {
            if (!best || candidate.flat.length > best.flat.length) best = candidate;
        }
    }
    return best;
}
