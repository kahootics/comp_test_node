import { IllegalAccessError } from '../../../../errors/common-errors.mjs';
import type { IndexHeader } from './index-header.js';
import { NestableHeader } from './nestable-header.js';
import type { HeaderTypes } from '../rr.js';
import { setPath } from '../helpers/set-path.js';




export class NestedHeader extends NestableHeader {
    override get type(): keyof HeaderTypes {
        return 'nested';
    }

    override get ancestor(): IndexHeader {
        if (super.ancestor) return super.ancestor;
        throw new IllegalAccessError('Ancestor must be set before accessing it');
    }
    override set ancestor(ancestor: IndexHeader) {
        super.ancestor = ancestor;
    }

    public assignLocalMatchingValue(target: Record<string, any>, row: string[]) {
        const parsed = this.getMatchingColumnParsedValue(row);
        setPath(target, this.localKeys, parsed);
        return parsed;
    }
}
