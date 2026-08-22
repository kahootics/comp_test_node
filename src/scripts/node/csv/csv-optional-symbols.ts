import type { OptionalStringSymbols } from "./csv-to-dataset-test.js";
import { validateSymbolStrings } from "./validate-symbol-strings.js";

export class CsvOptionalSymbols implements OptionalStringSymbols {
    #newLineReplacer?: string;
    #arraySeparator: string;
    #arrayIndicator: string;
    #objectNotation: string;
    #nestedObjArray: string;

    constructor(
        csvOptional?: OptionalStringSymbols
    ) {
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

    get newLineReplacer() { return this.#newLineReplacer; }
    get arrayIndicator() { return this.#arrayIndicator; }
    get arraySeparator() { return this.#arraySeparator; }
    get objectNotation() { return this.#objectNotation; }
    get nestedObjArray() { return this.#nestedObjArray; }

}