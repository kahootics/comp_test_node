import { IllegalArgumentError } from '../../../../errors/common-errors.mjs';
import { NestableHeader } from './nestable-header.js';
import { assertInteger } from '../helpers/assert-integer.js';
import { NestedHeader } from './nested-header.js';
import { ensurePath } from "../helpers/ensure-path.js";

export class IndexHeader extends NestableHeader {

    readonly indexChildren: IndexHeader[] = [];
    readonly nestedChildren: NestedHeader[] = [];
    public addNestedChild(child: NestedHeader) {
        this.nestedChildren.push(child);
    }
    public addIndexChild(child: IndexHeader) {
        this.indexChildren.push(child);
    }

    buildPartialRecord(row: string[]) {
        const partial: Record<string, any> = {};
        this.nestedChildren.forEach(nh => {
            nh.assignLocalMatchingValue(partial, row);
        });
        return partial;
    }

    ensureArray(target: Record<string, any>): Record<string, any>[] {
        return ensurePath(target, this.localKeys, []);
    }

    readIndex(row: string[]): number | null {
        const i = this.getMatchingColumnParsedValue(row);
        if (i === null) return null;
        if (typeof i !== 'number')
            throw new IllegalArgumentError(`An index header cannot contain a value that is not 'null' or a 'number', but ${i} is neither`)
        return assertInteger(i);
    }

}
