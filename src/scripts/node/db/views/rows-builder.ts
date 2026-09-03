import { IllegalArgumentError, IllegalStateError } from "../../../../errors/common-errors.mjs";
import { formatList } from "../../../../tools/string-parsers.js";
import { reservedKeywords } from "../data-base.js";
import { Admitted } from "./helpers/admitted-types.js";
import { _unpackDataSchema } from "./helpers/unpack-data-schema.js";
import { _assertGlobalUniqueness, _collectAllLabels } from "./helpers/assert-global-uniqueness.js";
import { EditableColumnDescriptor } from "./columns/editable-column-descriptor.js";
import { NestableUColumnDescriptor } from "./columns/nestable-u-column-descriptor.js";
import { PrimitiveUColumnDescriptor } from "./columns/primitive-u-column-descriptor.js";
import type z from "zod";
import type { Brand } from "../../../types/general-types.js";
import type { ColumnDescriptor } from "./columns/column-descriptor.js";
import type { FlatRecord } from "./flat-record.js";
import type { EditableFieldDescriptor } from "../editable-field.js";
import type { UnmodifiableColumnDescriptor } from "./columns/unmodifiable-column-descriptor.js";
import type { PrimitivesAdmittedType } from "./helpers/admitted-types.js";
import type { dbRecord, dbType } from "../data-base.js";
import { wrapCell, wrapRow } from "../../writers/HTML/write-table.js";

// PRIVATE HELPERS ==========================================================
/**
 * Sorts unmodifiable column descriptors into primitives and nested.
 * 
 * @param columns - Array of column descriptors for unmodifiable data.
 * @returns an object separating columns for primitive values and columns for nested arrays of objects.
 * 
 * @throws {IllegalArgumentError} If the array to sort contains two or more columns for nesting (only 1 is allowed per layer of nesting).
 * @throws {IllegalStateError} If the array contains a descriptor of an unknown class.
 */
function _sortUnmodifiables(columns: UnmodifiableColumnDescriptor[]) {

    const result: {
        primitive: PrimitiveUColumnDescriptor[];
        nested: NestableUColumnDescriptor | null;
    } = { primitive: [], nested: null };

    columns.forEach(c => {
        if (c instanceof PrimitiveUColumnDescriptor) {
            result.primitive.push(c);
        } else if (c instanceof NestableUColumnDescriptor) {
            if (result.nested !== null)
                throw new IllegalArgumentError(`Multiple nesting arrays are not supported for row displaying`);
            result.nested = c;
        } else
            throw new IllegalStateError('Cannot recognize class of ' + JSON.stringify(c))
    });

    return result;
}

type primitiveString = Brand<string, 'primitive'>;

/**
 * Renders into a single string an admitted primitive value or an array of them.
 * 
 * @param value - A non-undefined value to render.
 * @param type - One of the admitted value types.
 * @returns a flat string containing the value.
 */
function _resolvePrimitive(
    value: {} | null,
    type: PrimitivesAdmittedType,
): primitiveString {

    switch (type) {
        case Admitted.ARRAY_PRIMITIVE:
            return (Array.isArray(value)
                ? formatList(value.map(String))
                : '') as primitiveString;

        case Admitted.PRIMITIVE:
            return ((value === null)
                ? ''
                : String(value)) as primitiveString;

        default:
            throw new IllegalArgumentError(`Value of type ${type.description} canot be resolved to a string`);
    }
}

/**
 * Resolves to string the editable value 
 * at which a certain editable column descriptor refers to.
 * 
 * @param column - Editable column descriptor to find the value for.
 * @param obj - Source for the value.
 * @param buildForm - If `true`, the output will be a form input as specified 
 * by the descriptor; a simple flat string otherwise.
 * @returns a string containing the value or a form input with the 
 * `value` attribute (or equivalent) set to the specified value.
 * 
 * @remarks The value extracted is type safe due to the 
 * known structure of the editable fields.
 */
function _resolveEditable(
    column: EditableColumnDescriptor,
    obj: dbRecord['editables'],
    buildForm: boolean
): string {
    const value = column.getValue(obj);
    if (buildForm) {
        return column.buildInput(value);
    } else return _resolvePrimitive(value, column.type);
}

/**
 * Resolves all the editable columns values from the editable descriptors.
 * 
 * @param columns - Editable column descriptors to render.
 * @param obj - Source for the values.
 * @param buildForm -  - If `true`, the output for each descriptor 
 * will hold a form input as specified by it; a simple flat string otherwise.
 * @returns the resolved values from the object at each corresponding column
 * in the same order as that of the column descriptors.
 */
function _resolveEditables(
    columns: EditableColumnDescriptor[],
    obj: dbRecord['editables'],
    buildForm: boolean
): string[] {
    return columns.map(c => _resolveEditable(c, obj, buildForm));
}

/**
 * Reads the value associated with the descriptor from the object;
 * throws if no value is found.
 * 
 * @param column - Any column descriptor that is compatible with the object.
 * @param obj - Object from which the value will be read.
 * @returns the value from the object as specified by the descriptor.
 * 
 * @throws {IllegalStateError} If the value is `undefined`:   
 * per construction, an object compatible with the schema 
 * that originated the column descriptor *must* hold a 
 * primitive non-nullish value at the estabilished path 
 * or explicitly hold `null`; `undefined` (the path 
 * is not present in the object) should not be possible.
 */
function _assertGetValue(
    column: ColumnDescriptor,
    obj: object
): {} | null {
    const value = column.getValue(obj);
    if (value === undefined)
        throw new IllegalStateError(`Undefined fields are not allowed, only 'null': ${JSON.stringify(obj)}`);
    // we estabilished undefined is not accepted as value in the database, always null
    return value;
}

/**
 * Resolves all the primitive values holding columns provided
 * on the given object.
 * 
 * @param columns - An array of primitive unmodifiable column descriptors.
 * @param obj - The source of the values for the columns.
 * @returns the array of strings each representing the value 
 * read from the object according to a column descriptor
 * in the same order as that of the descriptors.
 */
function _resolveBatchPrimitives(columns: PrimitiveUColumnDescriptor[], obj: object): primitiveString[] {
    return columns.map(c => _resolvePrimitive(_assertGetValue(c, obj), c.type));
}


/**
 * Provides an empty (filled with blank strings) placeholder row (single)
 * that also recursively fills nested fields (only 1 nested object per array).
 * 
 * @param pColumns - The array of primitive unmodifiable column descriptors.
 * @param nesting - The column descriptor (nullable) for the array of nested objects.
 * @returns a placeholder row of blank strings.
 */
function _emptyPlaceholderRow(
    pColumns: PrimitiveUColumnDescriptor[],
    nesting: NestableUColumnDescriptor | null
): primitiveString[] {
    const result: primitiveString[] = pColumns.map(() => '' as primitiveString);
    if (nesting) {
        result.push('' as primitiveString);
        const { primitive, nested } = _sortUnmodifiables(nesting.children);
        result.push(..._emptyPlaceholderRow(primitive, nested));
    }
    return result;
}

/**
 * 
 * @param pColumns - The array of primitive unmodifiable column descriptors.
 * @param nesting - The column descriptor (nullable) for the array of nested objects.
 * @param obj - The source of the values for the columns of the row.
 * @returns *one or more* rows of strings representing values read from
 * the object according to the corresponding column descriptor.
 * 
 * @remarks 
 * - The returned rows will always have the same length;
 * empty fields are resolved as empty placeholder strings.
 * - Each row will have the same order as the descriptors:   
 * [ all primitive fields ][ index for nesting array ][ fields of nested object ]....
 * - Nesting arrays are resolved recursively.
 */
function _resolveRows(
    pColumns: PrimitiveUColumnDescriptor[],
    nesting: NestableUColumnDescriptor | null,
    obj: object
): primitiveString[][] {
    const primitives = _resolveBatchPrimitives(pColumns, obj);
    if (nesting === null) return [primitives];
    return _resolveNested(nesting, primitives, obj);
}

/**
 * Resolves an array of nested object recursively and returns a set of rows
 * that represent the values read at each field of the columns descriptors and their children.
 * 
 * @param nesting  - The column descriptor for the array of nested objects.
 * @param previousPrimitives - Row of resolved values for primitive descriptors from the previous recursion.
 * @param obj - The source of the values for the columns of the row.
 * @returns an array of rows that expands all the nesting arrays' children:   
 * each row represents the depthmost nested object resolved;
 * objects with a nesting array have their primitive section of row
 * repeated for each of their children (and so on recursively).
 * 
 * @example
 * ```ts
 * const object = {
 *   name: 'Gervasio',
 *   // 1st layer nesting
 *   children: [ 
 *     {
 *       name: 'Michele',
 *       // 2nd layer nesting
 *       children: [
 *         // deepest nested object (3rd layer)
 *         { name: 'Gianmarco' }
 *       ]
 *     }, {
 *       name: 'Annamaria',
 *       // deepest nested object (2nd layer)
 *       children: null
 *     }, {
 *       name: 'Marlena',
 *       // 2nd layer nesting
 *       children: [
 *         // deepest nested object (3rd layer)
 *         { name: 'Gervasio' },
 *         { name: 'Maria Pia' }
 *       ]}]}
 * ```
 * There are 4 objects at their maximum depth, so there will be 4 rows:
 *  name | children[i] | children[i]_name | children[i]_children[i] | children[i]_children[i]_name 
 *  ---- | :---------: | :--------------: | :---------------------: | ----------------------------
 *  Gervasio | 0 | Michele | 0 | Gianmarco 
 *  Gervasio | 1 | Annamaria |  |  | 
 *  Gervasio | 2 | Marlena | 0 | Gervasio 
 *  Gervasio | 2 | Marlena | 1 | Maria Pia 
 * Since Annamaria has no children, her row is filled with placeholders (nothing is left `undefined`)
 */
function _resolveNested(
    nesting: NestableUColumnDescriptor,
    previousPrimitives: primitiveString[],
    obj: object
): primitiveString[][] {
    const array = nesting.getValue(obj) ?? [];
    if (!Array.isArray(array))
        throw new IllegalStateError(`A nestable column is expected to be an array: ${JSON.stringify(array)}`);

    const { primitive, nested } = _sortUnmodifiables(nesting.children);

    if (array.length === 0) {
        return [[...previousPrimitives, '' as primitiveString, ..._emptyPlaceholderRow(primitive, nested)]];
    }

    const rows: primitiveString[][] = [];
    array.forEach((subObj, i) => {
        const subRows = _resolveRows(primitive, nested, subObj);
        subRows.forEach(subRow => {
            rows.push([...previousPrimitives, String(i) as primitiveString, ...subRow]);
        });
    });
    return rows;
}

/**
 * Builder of rows (as html strings) from database records following 
 * the schemas provided by the database.
 */
export class RowsBuilder {
    readonly #dbType: dbType;
    readonly #editableColumns: EditableColumnDescriptor[];
    readonly #primitiveColumns: PrimitiveUColumnDescriptor[];
    readonly #nestedColumn: NestableUColumnDescriptor | null;
    readonly #baseColumns: PrimitiveUColumnDescriptor[];
    readonly #buildForm: boolean;

    // STARTUP =======================================================================================
    /**
     * @param dbType - Identifier for the database providing the schemas.
     * @param unmodifiableDataSchema - Zod schema for the unmodifiable section of each record.
     * @param editableFieldDescriptors - Descriptors for the database-specific editable fields.
     * @param buildForm - Boolean flag: if `true`, editable fields will be rendered as form inputs; as plain values otherwise.
     */
    constructor(dbType: dbType, unmodifiableDataSchema: Record<string, z.ZodType>, editableFieldDescriptors: EditableFieldDescriptor[], buildForm?: true) {
        // Register type of database
        this.#dbType = dbType;
        this.#buildForm = buildForm ?? false;

        // Build the standard parameters (reserved keys)
        this.#baseColumns = this.#buildBase();

        // Unpack the static schema
        const { primitive, nested } = this.#unpackUnmodifiables(unmodifiableDataSchema);
        this.#primitiveColumns = primitive;
        this.#nestedColumn = nested;

        // Build the editable columns
        this.#editableColumns = editableFieldDescriptors.map(e => new EditableColumnDescriptor(e));

        // Verify all labels are unique across all the headers
        _assertGlobalUniqueness(this.#baseColumns, nested ? [...primitive, nested] : primitive, this.#editableColumns);

    }

    /** Unpacks the reserved keywords schema to make column descriptors. */
    #buildBase() {
        const base = _unpackDataSchema(reservedKeywords).map(c => {
            if (c instanceof PrimitiveUColumnDescriptor) return c;
            throw new IllegalStateError(`A record's base fields cannot be nesting`)
        });
        if (base.length < 1)
            throw new IllegalStateError(``);
        return base;
    }

    /** 
     * Unpacks the unmodifiable data schema to make column descriptors
     * for flat values and nested objects;   
     * the result is split into `primitive` and `nested`.
     */
    #unpackUnmodifiables(unmodifiableDataSchema: Record<string, z.ZodType>) {
        const unmodifiables = _unpackDataSchema(unmodifiableDataSchema);
        return _sortUnmodifiables(unmodifiables);
    }


    // PUBLIC SIDE =====================================================

    #cachedHeaderRow: ReturnType<typeof wrapRow> | null = null;
    /**
     * Builds an html string with the header row of the table.
     * 
     * @returns the row of column headers as a string of html.
     */
    public getHeaderRow() {
        if(this.#cachedHeaderRow) return this.#cachedHeaderRow;
        const hRow = this.#baseColumns.map(c => wrapCell(c.label, { header: true, scope: 'col' }));
        const hEdb = this.#editableColumns.map(c => wrapCell(c.label, { header: true, scope: 'col' }));
        const hPrim = _collectAllLabels(
            this.#nestedColumn
                ? [...this.#primitiveColumns, this.#nestedColumn]
                : this.#primitiveColumns
        ).map(l => wrapCell(l, { header: true, scope: 'col' }));
        return this.#cachedHeaderRow = wrapRow([...hRow, ...hPrim, ...hEdb]);
    }

    /**
     * Builds html strings of table rows from the fields of the record provided.
     * 
     * @param record - A *flat* record from the database this instance refers to.
     * @yields the rows obtained from the record by reading its values at the 
     * paths specified by the descriptors built after the schemas of the database;   
     * - only the first row yield will hold the values for base 
     * (common to any record, regardless of database) and editable fields,
     * - only said row will be yield if the database does not include nesting arrays
     * or if it does but the record has only layer of nesting,
     * - at least one row will be yield per record.
     * 
     * @throws {IllegalArgumentError} If the record given does not belong to the database this instance refers to.
     * @throws {IllegalStateError} If there isn't at least 1 row to yield.
     */
    public *makeRows(record: FlatRecord) {
        // Early check to ensure the record belongs to the database and 
        // has therefore been validated for the schema this instance has received
        if (record.type !== this.#dbType)
            throw new IllegalArgumentError(`Records for this table must have dbType '${this.#dbType}', but this record does not: ${JSON.stringify(record)}`);

        // Resolve each row sub-section
        const base = _resolveBatchPrimitives(this.#baseColumns, record);
        const rows = _resolveRows(this.#primitiveColumns, this.#nestedColumn, record.data);
        const editables = _resolveEditables(this.#editableColumns, record.editables, this.#buildForm);

        // There should be at least 1 row for the unmodifiable fields
        if (rows.length < 1)
            throw new IllegalStateError('_resolveRows rows must always return at least one row');

        // Wrap in td elements the data
        const basePart = base.map(c => wrapCell(c, { rowspan: rows.length }));
        const editablesPart = editables.map(c => wrapCell(c, { rowspan: rows.length }));

        let isFirst = true;
        for (const row of rows) {
            const rowPart = row.map(c => wrapCell(c));
            yield isFirst
                // only the first row will hold the base and editables parts;
                // their size is adjusted with the rowspan attribute
                ? wrapRow([...basePart, ...rowPart, ...editablesPart], {
                    'data-db-type': this.#dbType,
                    'data-store-id': record.storeId,
                    'data-record-inv': record.inv,
                })
                : wrapRow(rowPart);
            isFirst = false;
        }
    }

}