import { IllegalArgumentError, ValidationError, IllegalStateError, NotFoundError } from '../../../errors/common-errors.mjs';
import { formatList, stableStringify } from '../../../tools/string-parsers.js';
import type { Brand } from '../../types/general-types.js';
import { CsvOptionalSymbols } from './csv-optional-symbols.js';
import { FlatHeader } from './headers/flat-header.js';
import { HeaderEntry } from './headers/header-entry.js';
import { IndexHeader } from './headers/index-header.js';
import type { NestableHeader } from './headers/nestable-header.js';
import { NestedHeader } from './headers/nested-header.js';
import { assertInteger } from './helpers/assert-integer.js';
import { findNearestIndex } from './helpers/find-nearest-index.js';
import type { OptionalStringSymbols } from './rr.js';


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


class HeadersSchema {
    /** All the headers in the schema in their original order. */
    readonly #headers: HeaderEntry[];

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

    constructor(rawHeaders: string[], csvOptional?: OptionalStringSymbols) {
        const options = CsvOptionalSymbols.of(csvOptional);
        this.#headers = rawHeaders.map((header, i) => HeaderEntry.of(header, i, options));
        this.#length = this.#headers.length;

        this.#flatHeaders = this.#headers.filter(h => h instanceof FlatHeader);
        const indexHeaders = this.#headers.filter(h => h instanceof IndexHeader);
        const nestedFields = this.#headers.filter(h => h instanceof NestedHeader);

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
            for (let i = 0; headersGroup.length === 0; i++) {
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


    #getActiveIndexesLine(row: string[]) {
        const activeBranch: IndexHeader[] = [];
        let previous: IndexHeader | undefined;
        for (const group of this.#indexTree) {
            const groupActives = group.filter(ih => {
                const parsed = ih.getMatchingColumnParsedValue(row);
                if (typeof parsed === 'number') {
                    assertInteger(parsed);
                    return parsed >= 0;
                }
                else if (!parsed) return false;
                else throw new IllegalArgumentError(`A header of type index cannot contain a value that is not 'null' or a 'number': ${JSON.stringify(parsed)}`);
            });
            if (groupActives.length > 1)
                throw new IllegalStateError(`Cannot have two indexes to track for nesting arrays: ${formatList(groupActives.map(h => h.flat))}`);
            if (groupActives.length === 0)
                throw new IllegalStateError(`Cannot have zero indexes to track for nesting arrays`);
            let current = groupActives[0]!;

            if (previous) {
                if (current.ancestor !== previous)
                    throw new IllegalStateError(`Missing index for parent array "${current.ancestor?.flat}" required by "${current.flat}"`);
            }
            activeBranch.push(current);
            previous = current;
        }
        return activeBranch;
    }

    /** Stores a thrown entity when a parsing operation must flush a previous result before exiting. */
    #thrownDelayed: any = null;

    /**
     * 
     */
    #current: {
        readonly record: Record<string, any>;
        readonly identifier: string;
    } | null = null;

    parse(row: string[]): Record<string, any> | undefined {

        if (this.#thrownDelayed) throw this.#thrownDelayed;
        // Each row must match the schema's size.
        this.#validateRowSize(row);

        const flatSnapshot = this.#buildFlatSnapshot(row);
        // Early exit if the schema does not have nesting fields.
        if (!this.#nesting) return flatSnapshot;

        // IF THE SCHEMA HAS NESTING ============================
        // Use the flat part of the record to build an identifier.
        const identifier = stableStringify(flatSnapshot);

        let finished: Record<string, any> | undefined;
        if (this.#current && this.#current.identifier !== identifier) {
            // The previous record has finished building; 
            // it must be returned and a new one initialized:
            finished = this.#current.record; // will be returned
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
            const activeIndexesLine = this.#getActiveIndexesLine(row);
            // Record that has an array of objects as a value to one of
            // its keys
            let currentLayer: Record<string, any> = record;

            activeIndexesLine.forEach((activeIndex) => {
                const arrayIndex = activeIndex.readIndex(row);
                const partial = activeIndex.buildPartialRecord(row);

                // Take the reference to the nesting array
                const nestingArray = activeIndex.ensureArray(currentLayer);

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
            });
        } catch (e) {
            if (finished) {
                this.#thrownDelayed = e;
            } else throw e;
        }
        return finished;
    }

    flush() {
        if (this.#thrownDelayed) throw this.#thrownDelayed;
        const last = this.#current?.record;
        this.#current = null;
        return last;
    }
}
