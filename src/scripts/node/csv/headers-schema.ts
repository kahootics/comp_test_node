import { IllegalArgumentError, ValidationError, IllegalStateError } from '../../../errors/common-errors.mjs';
import { formatList, stableStringify } from '../../../tools/string-parsers.js';
import { CsvOptionalSymbols } from './csv-optional-symbols.js';
import { FlatHeader } from './headers/flat-header.js';
import { HeaderEntry } from './headers/header-entry.js';
import { IndexHeader } from './headers/index-header.js';
import { NestedHeader } from './headers/nested-header.js';
import { assertInteger } from './helpers/assert-integer.js';
import { findNearestIndex } from './helpers/find-nearest-index.js';
import type { OptionalStringSymbols } from './headers-types.js';
import type { NestableHeader } from './headers/nestable-header.js';
import { PrivateConstructorError } from '../../../errors/specialized-errors.mjs';

function isEmpty(value: unknown): boolean {
    return value === null || value === undefined;
}

/**
 * Recursively verifies that two partial records are either 
 * equal or that one is empty of values.
 */
function assertNoConflict(
    existing: Record<string, any>,
    incoming: Record<string, any>,
    context: { headerFlat: string; index: number; path?: string }
): void {
    for (const key of Object.keys(incoming)) {
        const incomingValue = incoming[key];
        const existingValue = existing[key];
        const path = context.path ? `${context.path}.${key}` : key;

        // Allow for empty field for incoming 
        // (automatically covers for empty existing value too)
        if (isEmpty(incomingValue)) continue;

        // Recursively call self if both are objects
        const bothObjects =
            typeof incomingValue === 'object'
            && typeof existingValue === 'object'
            && existingValue !== null;
        if (bothObjects) {
            assertNoConflict(existingValue, incomingValue, { ...context, path });
            continue;
        }
        // Verify equality among primitives only 
        // (if only one is an object this will throw)
        if (incomingValue !== existingValue) {
            throw new ValidationError(
                `Conflicting values for "${context.headerFlat}" at index ${context.index}, field "${path}": `
                + `expected ${JSON.stringify(existingValue)}, got ${JSON.stringify(incomingValue)}`
            );
        }
    }
}


export class HeadersSchema {
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();

    readonly #length: number;
    /** Length of the schema (number of headers/columns). */
    get length() { return this.#length; }

    /** All the headers that do not require multi-row resolution. */
    readonly #flatHeaders: FlatHeader[];

    /** Boolean flag indicating whether the schema has nesting fields (`true`) or is fully flat. */
    readonly #nesting: boolean;

    /** 
     * Structure of the nesting tree:
     * - The outer array determines the nesting order of the indexes.
     * - Each layer (inner array) indicates a group of index headers with the same nesting depth.
     * 
     * Within each layer of nesting, there must be exactly one
     * active index at a time (no more, no less).   
     * Active indexes between layers must be related according
     * to the nesting order (at the base of the structure, there is a layer
     * of index headers that have no ancestor).
     */
    readonly #indexTree: IndexHeader[][] = [];

    private constructor(token: symbol, headers: HeaderEntry[], options: CsvOptionalSymbols) {
        // Privacy of constructor
        if (token !== HeadersSchema.#constructionToken)
            throw new PrivateConstructorError('HeadersSchema', { init: { method: 'from', type: 'factory' } });

        this.#length = headers.length;

        this.#flatHeaders = headers.filter(h => h instanceof FlatHeader);
        const indexHeaders = headers.filter(h => h instanceof IndexHeader);
        const nestedFields = headers.filter(h => h instanceof NestedHeader);

        if (indexHeaders.length === 0
            && nestedFields.length === 0
        ) {
            if (this.#flatHeaders.length !== this.#length)
                throw new IllegalArgumentError(`${Math.abs(this.#flatHeaders.length - this.#length)} headers are of unknown type`);
            this.#nesting = false;
        } else {

            /**
             * @param entry - Header to find index header parent of.
             * @returns a `HeaderEntry` of type `index` that owns the specified `self` (if there is one).
             */
            function _findIndexParent(entry: NestableHeader) {
                // Iterate through all the index headers to find the one 
                // with the longest flat label that includes `self`'s.
                return findNearestIndex(entry.flat, entry, indexHeaders, options);
            }

            this.#nesting = true;

            // Look for nested index headers
            for (const idx of indexHeaders) {
                const parent = _findIndexParent(idx);
                // If the index header is nested in another array of objects:
                if (parent) {
                    idx.ancestor = parent;
                    parent.addIndexChild(idx);
                }
            }

            const orphaned = nestedFields.filter(field => {
                // Find parents of nested fields
                const parent = _findIndexParent(field);

                if (parent) {
                    field.ancestor = parent;
                    parent.addNestedChild(field);
                    return false;
                    // A nested field must have a parent
                } else return true;
            });

            if (orphaned.length > 0)
                throw new ValidationError(`${formatList(orphaned.map(h => h.flat))} headers are fields of an object nested into an array, but no index header was provided for such array`);

            // List all the index with no ancestor (at the base of their tree)
            const baseHeaders = indexHeaders.filter(h => !h.ancestor);

            // recursively assign children groups to 
            let headersGroup = baseHeaders;
            for (let i = 0; headersGroup.length > 0; i++) {
                this.#indexTree[i] = headersGroup;
                // Extract the group of headers children of the previous one.
                headersGroup = headersGroup
                    .flatMap(h => h.indexChildren);
            }
        }
    }

    /**
     * Factory method to build a scheama from a row of headers.
     * 
     * @param rawHeaders - An array of strings reprenting the headers.
     * @param options - Options object for parsing the headers and following rows.
     * @returns a promise containing the schema extracted from the headers.
     */
    static async from(rawHeaders: string[], options: CsvOptionalSymbols) {
        const headers = await Promise.all(
            rawHeaders.map((header, i) => HeaderEntry.of(header, i, options))
        );
        return new this(this.#constructionToken, headers, options);
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
     * Verifies that a given row has the correct size/number of columns.
     * @param row - Row that needs to be validated.
     */
    #validateRowSize(row: string[]) {
        const { length } = row;
        const { length: expectedLength } = this;
        if (length !== expectedLength)
            throw new ValidationError(
                "Row's length does not match the expected value:\n"
                + ((length > expectedLength)
                    ? 'it exceeds it by '
                    : 'it falls short by ')
                + Math.abs(length - expectedLength) + ' columns'
            );
    }

    /**
     * @param row - Row holding the values.
     * @returns an array of active (holds positive index) 
     * index headers ordered from the eldest (no ancestor) to youngest.
     */
    #getActiveIndexesLine(row: string[]) {
        const activeLine: IndexHeader[] = [];
        let previous: IndexHeader | null = null;
        let stop: number = 0; // Signals whether another active index is expected at the next layer
        for (const group of this.#indexTree) {
            const groupActives = group.filter(ih => {
                const parsed = ih.readIndex(row);
                if (parsed === null) return false;
                else {
                    return parsed >= 0;
                }
            });
            // Ensure only track 1 index at a time
            if (groupActives.length > 1)
                throw new IllegalStateError(`Cannot have two indexes to track for nesting arrays: ${formatList(groupActives.map(h => h.flat))}`);
            else if (groupActives.length === 0) {
                // If the line is interrupted, 
                // it means no other index
                // in a following layer must be active
                stop++;
                previous = null;
            } else {
                const current = groupActives[0]!;

                if (stop)
                    throw stop > 1
                        ? new IllegalStateError(
                            `Current active indexes line is missing members from ${stop} layers before "${current.flat}"`
                        )
                        : new IllegalStateError(
                            `Active index "${current.flat}" requires an active parent, but previous layer was empty`
                        );

                if (previous && current.ancestor !== previous)
                    throw new IllegalStateError(
                        `Active index ${current.flat} requires an active parent, but "${current.ancestor?.flat}" required by "${current.flat}"`
                    );

                activeLine.push(current);
                previous = current;
            }
        }
        return activeLine;
    }
    /** Stores a thrown entity when a parsing operation must flush a previous result before exiting. */
    #thrownDelayed: any = null;

    /** All the identifiers of entirely parsed records. */
    #history = new Set<string>();
    /**
     * Holds the record that is being currently processed
     * if the schema has nesting fields.
     */
    #current: {
        readonly record: Record<string, any>;
        readonly identifier: string;
    } | null = null;


    /**
     * 
     * @param row - Row to parse according to schema.
     * @returns the parsed object or `undefined` if it's nesting;   
     * in that case, the object will be returned only once
     * a row with a different flat identifier is found.
     */
    parse(row: string[]): Record<string, any> | undefined {

        if (this.#thrownDelayed) throw this.#thrownDelayed;
        // Each row must match the schema's size.
        this.#validateRowSize(row);

        const flatSnapshot = this.#buildFlatSnapshot(row);

        // Use the flat part of the record to build an identifier.
        const identifier = stableStringify(flatSnapshot);

        // Check against duplictes
        if (this.#history.has(identifier))
            throw new ValidationError(`Duplicate object ${identifier}`);
        // Early exit if the schema does not have nesting fields.
        if (!this.#nesting) {
            this.#history.add(identifier);
            return flatSnapshot;
        };

        // IF THE SCHEMA HAS NESTING FIELDS ============================

        let finished: Record<string, any> | undefined;
        // If previous record has finished parsing:
        if (this.#current && this.#current.identifier !== identifier) {
            // The previous record has finished building; 
            // it must be returned and a new one initialized:
            finished = this.#current.record; // will be returned
            // Add to history
            this.#history.add(this.#current.identifier);
            this.#current = null; // reset current record
        }
        // Initialize new record:
        if (!this.#current) {
            this.#current = {
                record: flatSnapshot,
                identifier
            };
        }

        // Resolve nesting:
        const { record } = this.#current;
        try {
            // Get the list of indexes to check
            // Guarantees all indexes numbers are positive integers
            const activeIndexesLine = this.#getActiveIndexesLine(row);
            // Record that has an array of objects as 
            // a value to one of its keys
            let currentLayer: Record<string, any> = record;

            for (const activeIndex of activeIndexesLine) {
                const arrayIndex = activeIndex.readIndex(row);
                if (arrayIndex === null)
                    throw new IllegalArgumentError(`An active header of type index cannot contain 'null', but ${activeIndex.flat} does`);
                const partial = activeIndex.buildPartialRecord(row);

                // Take the reference to the nesting array
                const nestingArray = activeIndex.ensureArray(currentLayer);


                // Verify the previous element in the  array is filled and we are not skipping it
                if ((arrayIndex > 0) && (nestingArray[arrayIndex - 1] === undefined))
                    throw new ValidationError(
                        `Skipping indexes is not allowed: ${activeIndex.flat} at index ${arrayIndex - 1} is undefined`
                        + '\n' + JSON.stringify(record, null, 4)
                    );

                // Read the array at the currently active position;
                // the result is a previously build partial or undefined
                if (nestingArray[arrayIndex] === undefined) {
                    // This is the first iteration of this layer at this index 
                    nestingArray[arrayIndex] = partial;

                } else {
                    // Not the first iteration, which means 
                    // another inner nesting array is being filled

                    // Assess for conflicts
                    assertNoConflict(nestingArray[arrayIndex], partial, { headerFlat: activeIndex.flat, index: arrayIndex });
                    // if partial introduces new data this will throw
                }
                // Move to next layer
                currentLayer = nestingArray[arrayIndex];
            }
            // Check if nesting was incomplete
            const missingLayers = this.#indexTree.length - activeIndexesLine.length;
            if (missingLayers > 0) {
                const lastActiveIndex = activeIndexesLine[activeIndexesLine.length - 1];
                const missingLayer = this.#indexTree[this.#indexTree.length - missingLayers]!;
                for (const emptyIndex of missingLayer) {
                    if (lastActiveIndex && emptyIndex.ancestor !== lastActiveIndex)
                        continue;
                    emptyIndex.ensureArray(currentLayer)
                }
            }
        } catch (e) {
            if (finished) {
                this.#thrownDelayed = e;
            } else throw e;
        }
        return finished;
    }

    // End of parsing
    flush() {
        if (this.#thrownDelayed) throw this.#thrownDelayed;
        const last = this.#current?.record;
        this.#current = null;
        return last;
    }
}
