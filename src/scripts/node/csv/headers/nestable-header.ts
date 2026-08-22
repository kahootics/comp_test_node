import { IllegalArgumentError } from '../../../../errors/common-errors.mjs';
import type { IndexHeader } from './index-header.js';
import type { HeaderKeys } from '../rr.js';
import { HeaderEntry } from './header-entry.js';




export abstract class NestableHeader extends HeaderEntry {
    #ancestor: IndexHeader | undefined;
    get ancestor(): IndexHeader | undefined {
        return this.#ancestor;
    }
    set ancestor(ancestor: IndexHeader) {
        if (!this.#ancestor) {
            this.#ancestor = ancestor;
        } else {
            throw new IllegalArgumentError('Ancestor can only be set once');
        }
    }

    get localKeys(): HeaderKeys {
        return this.ancestor ? this.keys.slice(this.ancestor.keys.length) : this.keys;
    };
}
