import { IllegalArgumentError, NotFoundError } from "../../../../errors/common-errors.mjs";
import { PrivateConstructorError } from "../../../../errors/specialized-errors.mjs";
import { escapeRegExp } from "../../../../tools/string-parsers.js";
import { CsvOptionalSymbols } from "../csv-optional-symbols.js";
import normalizeCellArray from "../helpers/normalize-cell-array.js";
import normalizeCellValue from "../helpers/normalize-cell-value.js";
import type { HeaderKeys, HeaderTypes, ValueTypes } from "../rr.js";
import { FlatHeader } from "./flat-header.js";
import { IndexHeader } from "./index-header.js";
import { NestedHeader } from "./nested-header.js";

export abstract class HeaderEntry {
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

        readonly #csvOptions: CsvOptionalSymbols;

        protected constructor(token: symbol, label: string, index: number, csvOptions: CsvOptionalSymbols) {
            // Privacy of constructor
            if (token !== HeaderEntry.#constructionToken)
                throw new PrivateConstructorError('HeaderEntry', { init: { method: 'of', type: 'factory' } });

            // Validate column index
            if (!Number.isSafeInteger(index))
                throw new IllegalArgumentError(`An array index must be an integer, but ${index} is not`);
            this.#columnIndex = index;

            // Find type of value that should be held
            if (label.endsWith(csvOptions.arrayIndicator)) {
                label = label.replaceAll(csvOptions.arrayIndicator, '');
                this.#valueType = 'array';
            } else this.#valueType = 'flat';

            this.#csvOptions = csvOptions;

            // Unpack object keys
            this.#flat = label;
            const unpackedKeys = label.split(new RegExp(`\\s*${escapeRegExp(csvOptions.objectNotation)}\\s*`));
            if (!unpackedKeys[0]?.trim())
                throw new IllegalArgumentError(`${label} has no key for object notation`);
            this.#keys = unpackedKeys as any;
        }

        public static of(label: string, index: number, csvOptions: CsvOptionalSymbols): IndexHeader | NestedHeader | FlatHeader {
            label = label.trim();
            // Find type of own schema
            if (label.endsWith(csvOptions.nestedObjArray)) {
                label = label.replaceAll(csvOptions.nestedObjArray, '');
                return new IndexHeader(this.#constructionToken, label, index, csvOptions);
            } else if (label.includes(csvOptions.nestedObjArray + csvOptions.objectNotation)) {
                label = label.replaceAll(csvOptions.nestedObjArray, '');
                return new NestedHeader(this.#constructionToken, label, index, csvOptions);
            } else {
                return new FlatHeader(this.#constructionToken, label, index, csvOptions);
            }
        }

        public getParsedValue(value: string) {
            return this.valueType === 'array'
                ? normalizeCellArray(value, this.#csvOptions.arraySeparator, this.#csvOptions.newLineReplacer)
                : normalizeCellValue(value, this.#csvOptions.newLineReplacer);
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