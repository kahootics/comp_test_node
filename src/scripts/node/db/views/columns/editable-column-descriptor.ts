import { ColumnDescriptor } from "./column-descriptor.js";
import { _getAdmittedType, type PrimitivesAdmittedType } from "../helpers/admitted-types.js";
import { Admitted } from "../helpers/admitted-types.js";
import type { EditableFieldDescriptor, editableValue } from "../../editable-field.js";
import type { FlatRecord } from "../flat-record.js";


export class EditableColumnDescriptor extends ColumnDescriptor<PrimitivesAdmittedType> {

    #edDesc: EditableFieldDescriptor;

    constructor(editableDescriptor: EditableFieldDescriptor) {
        const type = _getAdmittedType(editableDescriptor.schema);
        if (!(type === Admitted.PRIMITIVE || type === Admitted.ARRAY_PRIMITIVE))
            throw new Error();

        super(editableDescriptor.label, true, type);
        this.#edDesc = editableDescriptor;
    }

    override getValue(editables: FlatRecord['editables']) {
        if (this.label in editables)
            return editables[this.label]!;
        throw new Error();
    };

    buildInput(value: editableValue): string { return this.#edDesc.buildInput(value) }
}
