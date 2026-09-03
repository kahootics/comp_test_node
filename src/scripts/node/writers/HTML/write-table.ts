import { escapeHtml } from "../../../../tools/string-parsers.js";
import type { Brand } from "../../../types/general-types.js";

type tableCell = Brand<string, 'cell'>;
type tableHCell = Brand<string, 'tt'>;
type tableRow = Brand<string, 'row'>;

export function wrapRow(
    cells: tableCell[] | tableHCell[],
    attributes?: Record<string, string>
): tableRow {
    const attrStr = attributes
        ? ` ${Object.entries(attributes).map(([attr, val]) => `${attr}="${escapeHtml(val)}"`).join(' ')} `
        : '';
    return `<tr${attrStr}>${cells.join('')}</tr>` as tableRow;
}

interface header {
    false: tableCell
    true: tableHCell
}
type HeaderKey<B extends boolean> = `${B}`;
type tableTypeCell<B extends boolean> = header[HeaderKey<B>];

export function wrapCell<B extends boolean = false>(
    value: string,
    options?: {
        header?: B,
        rowspan?: number,
        colspan?: number,
        scope?: 'col' | 'row' | 'colgroup' | 'rowgroup'
    }
): tableTypeCell<B> {
    const { rowspan, header, scope } = options ?? {};
    const t = header ? 'th' : 'td';
    return `<${t
        }${(rowspan ?? 0) > 1
            ? (' rowspan="' + rowspan + '" ')
            : ''
        }${scope
            ? ` scope="${scope}" `
            : ''
        }>${value}</${t}>` as tableTypeCell<B>;
}

export class VerticalTable {
    readonly #headerRow: tableRow;
    readonly #bodyRows: tableRow[];

    constructor(headerRow: tableRow, bodyRows?: tableRow[]) {
        this.#headerRow = headerRow;
        this.#bodyRows = bodyRows ?? [];
    }
    addRows(...rows: tableRow[]) {
        this.#bodyRows.push(...rows);
    }
    getHTML() {
        const tHead = `<thead>${this.#headerRow}</thead>`;
    }
}
