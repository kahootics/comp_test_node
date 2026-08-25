import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";
import { validateSymbolStrings } from "./helpers/validate-symbol-strings.js";
import type { OptionalStringSymbols } from "./headers-types.js";
import { duplicatesOfStringList, formatList } from "../../../tools/string-parsers.js";
import { DuplicateKeyError } from "../../../errors/common-errors.mjs";

export class CsvOptionalSymbols implements OptionalStringSymbols {

    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();

    #csvDelimiter?: string;
    #newLineReplacer?: string;
    #arraySeparator: string;
    #arrayIndicator: string;
    #objectNotation: string;
    #nestedObjArray: string;
    #idIndicator: string;

    private constructor(
        token: symbol,
        csvOptional?: OptionalStringSymbols
    ) {
        // Privacy of constructor
        if (token !== CsvOptionalSymbols.#constructionToken)
            throw new PrivateConstructorError('CsvOptionalSymbols', { init: { method: 'of', type: 'factory' } });

        const csvDelimiter = csvOptional?.csvDelimiter;
        const arraySeparator = csvOptional?.arraySeparator ?? '|';
        const arrayIndicator = csvOptional?.arrayIndicator ?? '[]';
        const objectNotation = csvOptional?.objectNotation ?? '_';
        const nestedObjArray = csvOptional?.nestedObjArray ?? '[i]';
        const idIndicator = csvOptional?.idIndicator ?? 'ID';
        const newLineReplacer = csvOptional?.newLineReplacer;
        this.#verifyDuplicates(csvDelimiter, arraySeparator, arrayIndicator, objectNotation, newLineReplacer, nestedObjArray, csvOptional?.idIndicator)
        validateSymbolStrings(csvDelimiter ?? '#', arraySeparator, arrayIndicator, objectNotation, newLineReplacer ?? '#', nestedObjArray, csvOptional?.idIndicator ?? '#');
        this.#csvDelimiter = csvDelimiter;
        this.#arraySeparator = arraySeparator;
        this.#arrayIndicator = arrayIndicator;
        this.#objectNotation = objectNotation;
        this.#nestedObjArray = nestedObjArray;
        this.#newLineReplacer = newLineReplacer;
        this.#idIndicator = idIndicator;
    }

    /**
     * Factory method to make an options object for a csv parsing operation.
     * 
     * @param [csvOptional] - Optional parameters to use instead of defaults.
     * @param [csvOptional.csvDelimiter] - Separates CSV values; if not given, a default value provided by the module `csv-parse` will be used.
     * @param [csvOptional.newLineReplacer] - Escapes new line in CSV values; all string values will be considered as one-line strings if not provided.
     * @param [csvOptional.arraySeparator] - Separates elements of an array within a single CSV value; defaults to `|`.
     * @param [csvOptional.arrayIndicator] - Marks a header that will hold an array of primitive values; defaults to `[]`.
     * @param [csvOptional.objectNotation] - Separates object keys in a CSV header; defaults to `_`.
     * @param [csvOptional.nestedObjArray] - Marks a CSV index header or one of the nested object's fields; defaults to `[i]`.
     * @param [csvOptional.idIndicator] - Marks a header that will hold an identifier-like `string`; defaults to `ID`.
     * @returns an instance of this class.
     */
    public static of(csvOptional?: OptionalStringSymbols) {
        return new this(this.#constructionToken, csvOptional);
    }

    #verifyDuplicates(...str: (string | undefined)[]) {
        const dupes = duplicatesOfStringList(str.filter(s => s !== undefined));
        if (dupes.size > 0)
            throw new DuplicateKeyError(`${formatList([...dupes])} are duplicates symbols; cannot accept provided arguments`);
    }

    /** Separates CSV values. */
    get csvDelimiter() { return this.#csvDelimiter; }

    // VALUES SYMBOLS ====================================
    /** Marks a new line in a CSV value. */
    get newLineReplacer() { return this.#newLineReplacer; }
    /** Separates elements of an array within a single CSV value. */
    get arraySeparator() { return this.#arraySeparator; }

    // HEADER MARKERS ====================================
    /** Separates object keys in a CSV header. */
    get objectNotation() { return this.#objectNotation; }
    /** 
     * - At the end of a header: 
     * marks a CSV index header that will hold the index of the object nested 
     * into the array with the same name.
     * - Within the keys of an header: marks a field of the nested object.
     */
    get nestedObjArray() { return this.#nestedObjArray; }

    /** 
     * Marks a header thet will hold an array of primitive values.   
     * Always at the end of the last key.
     */
    get arrayIndicator() { return this.#arrayIndicator; }
    /** 
     * Marks a header that will hold an identifier-like `string`.   
     * Always at the end of the last key.
     */
    get idIndicator() { return this.#idIndicator; }

    /** 
     * @returns the given string with the `arrayIndicator`
     * (if present) removed from its end.
     */
    removeArrayIndicator(value: string): string {
        return value.endsWith(this.arrayIndicator)
            ? value.slice(0, -this.arrayIndicator.length)
            : value;
    }
    /** 
     * @returns the given string with the `idIndicator`
     * (if present) removed from its end.
     * 
     * @remarks 
     * If the indicator is `ID`, it will *NOT* be removed.
     */
    removeIdIndicator(value: string): string {
        return (value.endsWith(this.idIndicator) && this.idIndicator !== 'ID')
            ? value.slice(0, -this.idIndicator.length)
            : value;
    }
}