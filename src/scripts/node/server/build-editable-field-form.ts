

// addEditableField<E extends editableType>(label: string, type: E, defVal: any, config: editableConfig<E>) {

import {CLIENT_ID} from "../../shared/client-ids.js";
import { editableTypes } from "../db/editables/editable-field.js";

const {editableLabelInputId, editableTypeSelectId, editableValueInputId} = CLIENT_ID;

function _buildEditableTypeSelector() {
    const edbOptions = editableTypes.map(t => `<option value="${t}">${t}</option>`).join('');
    return `<select id="${editableTypeSelectId}">${edbOptions}</select>`;
}

function _buildEditableConfigAllOptions() {
    
}

export function buildAddEditableFieldForm() {
    const labelInput = `<label>Give a label to the field: <input type="text" id="${editableLabelInputId}" /></label>`
    const typeSelector = `<label>Select a type for the field: ${_buildEditableTypeSelector()}</label>`;
    const valueInput = `<label>Give a default value to the field: <input disabled id="${editableValueInputId}"/></label>`
}