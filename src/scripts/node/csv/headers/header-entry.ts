import { IllegalArgumentError, IllegalStateError, NotFoundError } from "../../../../errors/common-errors.mjs";
import { PrivateConstructorError } from "../../../../errors/specialized-errors.mjs";
import { escapeRegExp } from "../../../../tools/string-parsers.js";
import { CsvOptionalSymbols } from "../csv-optional-symbols.js";
import normalizeCellArray from "../helpers/normalize-cell-array.js";
import normalizeCellIdentifier from "../helpers/normalize-cell-identifier.js";
import normalizeCellValue from "../helpers/normalize-cell-value.js";
import type { HeaderKeys, ValueTypes } from "../headers-types.js";
import type { FlatHeader } from "./flat-header.js";
import type { IndexHeader } from "./index-header.js";
import type { NestedHeader } from "./nested-header.js";

const importers = {
    'index-header': () => import('./index-header.js'),
    'nested-header': () => import('./nested-header.js'),
    'flat-header': () => import('./flat-header.js'),
} as const;

type ModuleKey = keyof typeof importers;
type ModuleOf<K extends ModuleKey> = Awaited<ReturnType<(typeof importers)[K]>>;

export class HeaderEntry {
    /** Token needed to access constructor. */
    static readonly #constructionToken: unique symbol = Symbol();

    readonly #keys: HeaderKeys;
    get keys() { return this.#keys; }

    readonly #columnIndex: number;
    get columnIndex() { return this.#columnIndex; }

    readonly #valueType: keyof ValueTypes;
    get valueType() { return this.#valueType; }

    readonly #flat: string;
    get flat() { return this.#flat; }

    readonly #options: CsvOptionalSymbols;

    protected constructor(token: symbol, label: string, index: number, options: CsvOptionalSymbols) {
        // Privacy of constructor
        if (token !== HeaderEntry.#constructionToken)
            throw new PrivateConstructorError('HeaderEntry', { init: { method: 'of', type: 'factory' } });

        // Validate column index
        if (!Number.isSafeInteger(index))
            throw new IllegalArgumentError(`An array index must be an integer, but ${index} is not`);
        this.#columnIndex = index;

        // Find type of value that should be held
        if (label.endsWith(options.arrayIndicator)) {
            label = options.removeArrayIndicator(label);
            this.#valueType = 'array';
        } else if (label.endsWith(options.idIndicator)) {
            label = options.removeIdIndicator(label);
            this.#valueType = 'identifier';
        } else this.#valueType = 'flat';

        this.#options = options;

        // Unpack object keys
        this.#flat = label;
        const unpackedKeys = label.split(new RegExp(`\\s*${escapeRegExp(options.objectNotation)}\\s*`));
        if (!unpackedKeys[0]?.trim())
            throw new IllegalArgumentError(`${label} has no key for object notation`);
        this.#keys = unpackedKeys as any;
    }

    static #modulesCache = new Map<ModuleKey, ModuleOf<ModuleKey>>();

    static async #ensureModule<K extends ModuleKey>(key: K): Promise<ModuleOf<K>> {
        const cached = this.#modulesCache.get(key);
        if (cached) return cached as ModuleOf<K>;

        const mod = await importers[key]();
        this.#modulesCache.set(key, mod);
        return mod as ModuleOf<K>;
    }

    public static async of(
        label: string,
        index: number,
        options: CsvOptionalSymbols
    ): Promise<IndexHeader | NestedHeader | FlatHeader> {
        label = label.trim();

        if (label.endsWith(options.nestedObjArray)) {
            label = label.replaceAll(options.nestedObjArray, '');
            const { IndexHeader } = await this.#ensureModule('index-header');
            return new IndexHeader(this.#constructionToken, label, index, options);

        } else if (label.includes(options.nestedObjArray + options.objectNotation)) {
            label = label.replaceAll(options.nestedObjArray, '');
            const { NestedHeader } = await this.#ensureModule('nested-header');
            return new NestedHeader(this.#constructionToken, label, index, options);

        } else {
            const { FlatHeader } = await this.#ensureModule('flat-header');
            return new FlatHeader(this.#constructionToken, label, index, options);
        }
    }


    public getParsedValue(value: string) {
        switch (this.valueType) {
            case "flat": return normalizeCellValue(value, this.#options);
            case "array": return normalizeCellArray(value, this.#options);
            case "identifier": return normalizeCellIdentifier(value, this.#options);
            default: throw new IllegalStateError(''); // to do
        }
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



