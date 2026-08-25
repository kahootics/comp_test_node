import { IllegalAccessError } from '../../../../errors/common-errors.mjs';
import { NestableHeader } from './nestable-header.js';
import { setPath } from '../helpers/set-path.js';
import type { IndexHeader } from './index-header.js';

export class NestedHeader extends NestableHeader {

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
