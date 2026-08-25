import { HeaderEntry } from './header-entry.js';
import { setPath } from '../helpers/set-path.js';

export class FlatHeader extends HeaderEntry {
    
    public assignValueFromMatchingColumn(target: Record<string, any>, row: string[]) {
        const parsed = this.getMatchingColumnParsedValue(row);
        setPath(target, this.keys, parsed);
        return parsed;
    }
}
