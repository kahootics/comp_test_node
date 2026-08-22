
import { validateSymbolStrings } from './validate-symbol-strings.js';
import type { Brand } from '../../types/general-types.js';
import { IllegalAccessError, IllegalArgumentError, IllegalStateError, NotFoundError, ValidationError } from '../../../errors/common-errors.mjs';
import normalizeCellArray from './normalize-cell-array.js';
import normalizeCellValue from './normalize-cell-value.js';
import { escapeRegExp, formatList, stableStringify } from '../../../tools/string-parsers.js';
import { PrivateConstructorError } from '../../../errors/specialized-errors.mjs';

// Effects[i],Effects[i]_Name

export interface OptionalStringSymbols {
    newLineReplacer?: string,
    arraySeparator?: string,
    arrayIndicator?: string,
    objectNotation?: string,
    nestedObjArray?: string,
}

interface HeaderTypes {
    flat: Brand<string, 'flat'>;
    index: Brand<string, 'index'>;
    nested: Brand<string, 'nested'>;
}
interface ValueTypes {
    flat: ReturnType<typeof normalizeCellValue>;
    array: ReturnType<typeof normalizeCellArray>;
}
type HeaderKeys = HeaderTypes[keyof HeaderTypes][];

function MakeHeaderSchema(csvOptional?: OptionalStringSymbols) {
    const arraySeparator = csvOptional?.arraySeparator ?? '|';
    const arrayIndicator = csvOptional?.arrayIndicator ?? '[]';
    const objectNotation = csvOptional?.objectNotation ?? '_';
    const nestedObjArray = csvOptional?.nestedObjArray ?? '[i]';
    const newLineReplacer = csvOptional?.newLineReplacer;
    validateSymbolStrings(arraySeparator, arrayIndicator, objectNotation, csvOptional?.newLineReplacer ?? '#', nestedObjArray);

    function findNearestIndex(flatLabel: string, self: NestableHeader, indexHeaders: IndexHeader[]) {
        let best;
        for (const candidate of indexHeaders) {
            if (candidate === self) continue;
            if (flatLabel.startsWith(candidate.flat + objectNotation)) {
                if (!best || candidate.flat.length > best.flat.length) best = candidate;
            }
        }
        return best;
    }

    function setPath(target: Record<string, any>, keys: HeaderKeys, value: any) {
        let current = target;
        const lastI = keys.length - 1;
        keys.forEach((key, i) => {
            if (i === lastI) current[key] = value;
            else { current[key] ??= {}; current = current[key]; }
        });
    }

    function ensurePath(target: Record<string, any>, keys: HeaderKeys, defaultValue: any) {
        let current: any = target;
        const lastI = keys.length - 1;
        keys.forEach((key, i) => {
            if (i === lastI) current = (current[key] ??= defaultValue);
            else { current[key] ??= {}; current = current[key]; }
        });
        return current;
    }

    function assertInteger(index: number) {
        if (!Number.isInteger(index))
            throw new ValidationError(`An index value must be an integer, but ${index} is not`);
        return index;
    }

    abstract class HeaderEntry {
        /** Token needed to access constructor. */
        static readonly #constructionToken: unique symbol = Symbol();

        readonly #keys: HeaderKeys;
        get keys() { return this.#keys; }

        abstract get type(): keyof HeaderTypes;

        readonly #columnIndex: number;
        get columnIndex() { return this.#columnIndex; }

        readonly #valueType: keyof ValueTypes;
        get valueType() { return this.#valueType; }

        readonly #flat: string;
        get flat() { return this.#flat; }

        protected constructor(token: symbol, label: string, index: number) {
            // Privacy of constructor
            if (token !== HeaderEntry.#constructionToken)
                throw new PrivateConstructorError('HeaderEntry', { init: { method: 'of', type: 'factory' } });

            // Validate column index
            if (!Number.isSafeInteger(index))
                throw new IllegalArgumentError(`An array index must be an integer, but ${index} is not`);
            this.#columnIndex = index;

            // Find type of value that should be held
            if (label.endsWith(arrayIndicator)) {
                label = label.replaceAll(arrayIndicator, '');
                this.#valueType = 'array';
            } else this.#valueType = 'flat';

            // Unpack object keys
            this.#flat = label;
            const unpackedKeys = label.split(new RegExp(`\\s*${escapeRegExp(objectNotation)}\\s*`));
            if (!unpackedKeys[0]?.trim())
                throw new IllegalArgumentError(`${label} has no key for object notation`);
            this.#keys = unpackedKeys as any;
        }

        public static of(label: string, index: number): IndexHeader | NestedHeader | FlatHeader {
            label = label.trim();
            // Find type of own schema
            if (label.endsWith(nestedObjArray)) {
                label = label.replaceAll(nestedObjArray, '');
                return new IndexHeader(this.#constructionToken, label, index);
            } else if (label.includes(nestedObjArray + objectNotation)) {
                label = label.replaceAll(nestedObjArray, '');
                return new NestedHeader(this.#constructionToken, label, index);
            } else {
                return new FlatHeader(this.#constructionToken, label, index);
            }
        }

        public getParsedValue(value: string) {
            return this.valueType === 'array'
                ? normalizeCellArray(value, arraySeparator, newLineReplacer)
                : normalizeCellValue(value, newLineReplacer);
        }

        public getMatchingColumnValue(row: string[]): string {
            const maybe = row[this.#columnIndex];
            if (maybe !== undefined) return maybe;
            throw new NotFoundError(`column ${this.#columnIndex} of row ${JSON.stringify(row)}`, { type: 'value at' });
        }

        /**
         * getMatchingColumnParsedValue
         */
        public getMatchingColumnParsedValue(row: string[]) {
            const value = this.getMatchingColumnValue(row);
            return this.getParsedValue(value);
        }
    }

    class FlatHeader extends HeaderEntry {
        override get type(): keyof HeaderTypes {
            return 'flat';
        }
        public assignValueFromMatchingColumn(target: Record<string, any>, row: string[]) {
            const parsed = this.getMatchingColumnParsedValue(row);
            setPath(target, this.keys, parsed);
            return parsed;
        }
    }

    abstract class NestableHeader extends HeaderEntry {
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

    class IndexHeader extends NestableHeader {
        override get type(): keyof HeaderTypes {
            return 'index';
        }

        readonly indexChildren: IndexHeader[] = [];
        readonly nestedChildren: NestedHeader[] = [];
        public addNestedChild(child: NestedHeader) {
            this.nestedChildren.push(child);
        }
        public addIndexChild(child: IndexHeader) {
            this.indexChildren.push(child);
        }

        buildPartialRecord(row: string[]) {
            const partial: Record<string, any> = {}
            this.nestedChildren.forEach(nh => {
                nh.assignLocalMatchingValue(partial, row);
            });
            return partial;
        }

        #ensureArray(target: Record<string, any>) {
            return ensurePath(target, this.localKeys, []);
        }


        assignLocalSafePartial(target: Record<string, any>, row: string[]) {
            const i = this.getMatchingColumnParsedValue(row);
            if (typeof i !== 'number')
                throw new IllegalArgumentError(``);
            assertInteger(i);

            const partial = this.buildPartialRecord(row);
            this.#ensureArray(target)[i] = partial;
            return partial;
        }

    }

    class NestedHeader extends NestableHeader {
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

    return class HeadersSchema {
        #headers: HeaderEntry[];

        readonly #length: number;
        get length() { return this.#length; }

        readonly #flatHeaders: FlatHeader[];
        readonly #indexHeaders: IndexHeader[];

        readonly #nesting: boolean;


        readonly #indexTree: IndexHeader[][] = [];

        #childIndexHeaders = new Map<HeaderEntry, HeaderEntry[]>();
        #current: {
            readonly record: Record<string, any>,
            readonly identifier: string
        } | null = null;
        #instanceCache = new Map<string, Record<string, any>>();

        constructor(rawHeaders: string[]) {
            this.#headers = rawHeaders.map((header, i) => HeaderEntry.of(header, i));
            this.#length = this.#headers.length;

            this.#flatHeaders = this.#headers.filter(h => h instanceof FlatHeader);
            this.#indexHeaders = this.#headers.filter(h => h instanceof IndexHeader);
            const nestedFields = this.#headers.filter(h => h instanceof NestedHeader);

            if (
                this.#indexHeaders.length === 0
                && nestedFields.length === 0
            ) {
                if (this.#flatHeaders.length !== this.#length)
                    throw new IllegalArgumentError(`${Math.abs(this.#flatHeaders.length - this.#length)} headers are of unknown type`);
                this.#nesting = false;
            } else {

                this.#nesting = true;

                // Look for nested index headers
                for (const idx of this.#indexHeaders) {
                    const parent = this.#findIndexParent(idx);
                    // If the index header is nested in another array of objects:
                    if (parent) {
                        idx.ancestor = parent;
                        parent.addIndexChild(idx);

                        const siblings = this.#childIndexHeaders.get(idx.ancestor) ?? [];
                        siblings.push(idx);
                        // Register the header among its siblings
                        this.#childIndexHeaders.set(idx.ancestor, siblings);
                    }
                }

                const orphaned = nestedFields.filter(field => {
                    // Find parents of nested fields
                    const owner = this.#findIndexParent(field);

                    if (owner) {
                        field.ancestor = owner;
                        owner.addNestedChild(field);
                        return false;
                        // A nested field must have a parent
                    } else true;
                });

                if (orphaned.length > 0)
                    throw new ValidationError(`${formatList(orphaned.map(h => h.flat))} headers are fields of an object nested into an array, but no index header was provided for such array`);

                // List all the index with no ancestor (at the base of their tree)
                const baseHeaders = this.#indexHeaders.filter(h => !h.ancestor);

                // recursively assign children groups to 
                let headersGroup = baseHeaders;
                let i = 0;
                while (true) {
                    this.#indexTree[i] = headersGroup;
                    // Extract the group of headers children of the previous one.
                    headersGroup = headersGroup
                        .flatMap(h => h.indexChildren);
                }
            }
        }

        /**
         * Builds a partial record of a row's values at the columns under the flat headers.
         * @param row - Row with values to use for building a snapshot of its flat values.
         */
        #buildFlatSnapshot(row: string[]): Record<string, any> {
            const flatSnapshot: Record<string, any> = {};
            this.#flatHeaders.forEach(fh => fh.assignValueFromMatchingColumn(flatSnapshot, row));
            return flatSnapshot;
        }

        /**
         * @param entry - Header to find index header parent of.
         * @returns a `HeaderEntry` of type `index` that owns the specified `self` (if there is one).
         */
        #findIndexParent(entry: NestableHeader) {
            // Iterate through all the index headers to find the one 
            // with the longest flat label that includes `self`'s.
            return findNearestIndex(entry.flat, entry, this.#indexHeaders)
        }

        /**
         * Verifies that a given row has the correct size/number of columns.
         * @param row - Row that needs to be validated.
         */
        #validateRowSize(row: string[]) {
            const { length } = row;
            const { length: expectedLength } = this;
            if (length !== expectedLength)
                throw new ValidationError(
                    `Row's length does not match the expected value:\n`
                    + ((length > expectedLength)
                        ? 'it exceeds it by '
                        : 'it falls short by ')
                    + Math.abs(length - expectedLength) + ' columns'
                );
        }

        #getActiveIndexesBranch(row: string[]) {
            const activeBranch: IndexHeader[] = [];
            let previous: IndexHeader | undefined;
            for (const group of this.#indexTree) {
                const groupActives = group.filter(ih => {
                    const parsed = ih.getMatchingColumnParsedValue(row);
                    if (typeof parsed === 'number') {
                        assertInteger(parsed);
                        return parsed > 0;
                    }
                    else if (!parsed) return false;
                    else throw new IllegalArgumentError(`A header of type index cannot contain a value that is not 'null' or a 'number': ${JSON.stringify(parsed)}`)
                });
                if (groupActives.length > 1)
                    throw new IllegalStateError(`Cannot have two indexes to track for nesting arrays: ${formatList(groupActives.map(h => h.flat))}`);
                if (groupActives.length = 0)
                    throw new IllegalStateError(`Cannot have zero indexes to track for nesting arrays`);
                let current = groupActives[0]!;

                if (previous) {
                    if (current.ancestor !== previous)
                        throw new IllegalStateError(`Missing index for parent array "${current.ancestor?.flat}" required by "${current.flat}"`);
                }
                activeBranch.push(current);
                previous = current;
            }
            /* 
                        // reverse order
                        const result:IndexHeader[] = []
                        const l = activeBranch.length - 1;
                        activeBranch.forEach((idx,i) => {
                            result[l-i] = idx;
                        }) */

            return activeBranch;
        }

        getHeaderEntry(i: number) {
            const header = this.#headers[i];
            if (!header) throw new NotFoundError(String(i), { type: 'header at index' });
            return header;
        }

        #thrownDelayed: any = null;

        parse(row: string[]): Record<string, any> | undefined {

            if(this.#thrownDelayed) throw this.#thrownDelayed;

            this.#validateRowSize(row);

            const flatSnapshot = this.#buildFlatSnapshot(row);

            if (!this.#nesting) return flatSnapshot;

            const identifier = stableStringify(flatSnapshot);

            let finished: Record<string, any> | undefined;
            if (this.#current && this.#current.identifier !== identifier) {
                // this previous current has finished building; 
                // it must be returned and a new one initialized
                finished = this.#current.record;
                this.#current = null;
            }
            if (!this.#current) {
                this.#current = {
                    record: flatSnapshot,
                    identifier
                }
            }

            const record = this.#current.record;
            try {
                const activeIndexesBranch = this.#getActiveIndexesBranch(row);
                let current: Record<string, any> = record;
                for (const activeIndex of activeIndexesBranch) {

                    current = activeIndex.assignLocalSafePartial(current, row);

                }
            } catch (e) {
                if(finished) {
                    this.#thrownDelayed = e;
                } else throw e;
            }

            return finished;
        }

        flush() {
            const last = this.#current?.record;
            this.#current = null;
            return last;
        }
    };
}
