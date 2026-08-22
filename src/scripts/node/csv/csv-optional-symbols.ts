import { PrivateConstructorError } from "../../../errors/specialized-errors.mjs";
import type { OptionalStringSymbols } from "./csv-to-dataset-test.js";
import { validateSymbolStrings } from "./helpers/validate-symbol-strings.js";

export class CsvOptionalSymbols implements OptionalStringSymbols {

    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();

    #newLineReplacer?: string;
    #arraySeparator: string;
    #arrayIndicator: string;
    #objectNotation: string;
    #nestedObjArray: string;

    constructor(
        token: symbol,
        csvOptional?: OptionalStringSymbols
    ) {
        // Privacy of constructor
        if (token !== CsvOptionalSymbols.#constructionToken)
            throw new PrivateConstructorError('CsvOptionalSymbols', { init: { method: 'of', type: 'factory' } });

        const arraySeparator = csvOptional?.arraySeparator ?? '|';
        const arrayIndicator = csvOptional?.arrayIndicator ?? '[]';
        const objectNotation = csvOptional?.objectNotation ?? '_';
        const nestedObjArray = csvOptional?.nestedObjArray ?? '[i]';
        const newLineReplacer = csvOptional?.newLineReplacer;
        validateSymbolStrings(arraySeparator, arrayIndicator, objectNotation, newLineReplacer ?? '#', nestedObjArray);
        this.#arraySeparator = arraySeparator;
        this.#arrayIndicator = arrayIndicator;
        this.#objectNotation = objectNotation;
        this.#nestedObjArray = nestedObjArray;
        this.#newLineReplacer = newLineReplacer;
    }

    public static of(csvOptional?: OptionalStringSymbols) {
        return new this(this.#constructionToken, csvOptional);
    }

    get newLineReplacer() { return this.#newLineReplacer; }
    get arrayIndicator() { return this.#arrayIndicator; }
    get arraySeparator() { return this.#arraySeparator; }
    get objectNotation() { return this.#objectNotation; }
    get nestedObjArray() { return this.#nestedObjArray; }

}