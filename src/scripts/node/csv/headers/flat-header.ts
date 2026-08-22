import { HeaderEntry } from './header-entry.js';
import type { HeaderTypes } from '../rr.js';
import { setPath } from '../helpers/set-path.js';

export class FlatHeader extends HeaderEntry {
    override get type(): keyof HeaderTypes {
        return 'flat';
    }
    public assignValueFromMatchingColumn(target: Record<string, any>, row: string[]) {
        const parsed = this.getMatchingColumnParsedValue(row);
        setPath(target, this.keys, parsed);
        return parsed;
    }
}
