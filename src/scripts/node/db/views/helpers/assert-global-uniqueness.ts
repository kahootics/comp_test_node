import { IllegalArgumentError } from "../../../../../errors/common-errors.mjs";
import { NestableUColumnDescriptor } from "../columns/nestable-u-column-descriptor.js";
import type { ColumnDescriptor } from "../columns/column-descriptor.js";
import type { EditableColumnDescriptor } from "../columns/editable-column-descriptor.js";
import type { UnmodifiableColumnDescriptor } from "../columns/unmodifiable-column-descriptor.js";
import type { dataLabel } from "../../data-base.js";

export function _collectAllLabels(columns: UnmodifiableColumnDescriptor[]): dataLabel[] {
    return columns.flatMap(c => c instanceof NestableUColumnDescriptor
        ? [c.label, ..._collectAllLabels(c.children)]
        : [c.label]
    );
} 

export function _assertGlobalUniqueness(base: ColumnDescriptor[], unmodifiables: UnmodifiableColumnDescriptor[], editables: EditableColumnDescriptor[]) {
    const allL = [
        ...base.map(c => c.label),
        ..._collectAllLabels(unmodifiables),
        ...editables.map(c => c.label),
    ];
    const seen = new Set<string>();
    for (const label of allL) {
        if (seen.has(label))
            throw new IllegalArgumentError(`Found name conflict for column headers labels in the table: "${label}"`);
        seen.add(label);
    }
}

