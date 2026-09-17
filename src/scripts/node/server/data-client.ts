import devConfig from "../../../config/dev-config.mjs";
import { IllegalArgumentError } from "../../../errors/common-errors.mjs";
import { getElementByIdAs } from "../../browser/shared/get-validated-element.js";
import { ExtendibleElement } from "../../browser/ui/components/extendible-element.js";
import { Expandable } from "../../browser/ui/mixins/add_behaviour/expandable.mixin.js";
import { Modal } from "../../browser/ui/mixins/add_behaviour/modal.mixin.js";
import { editableTypes, editableTypeSchema, type editableType } from "../db/editables/editable-field.js";

class FalseModal extends Modal(Expandable(ExtendibleElement, 'open', 'is-open')) { }
customElements.define('false-modal', FalseModal);

/**
 * Registers the data from the inputs within all the rows
 * filter only for rows that have inputs 
 * throw if no storeId type or inv are present
 */
declare function snapshotOriginals(): void

const {
    loadButtonId, selectorOptionsId, containerId,
    addEditableId, falseModalId, editableLabelInputId, editableTypeSelectId, editableValueInputId
} = devConfig;

console.log('Script running..')


// DB-LOADER ================================================================
const load = getElementByIdAs(HTMLButtonElement, loadButtonId);
const selector = getElementByIdAs(HTMLSelectElement, selectorOptionsId);
const container = getElementByIdAs(HTMLElement, containerId);


load.addEventListener('click', async () => {
    const [kind, id] = selector.value.split(':');
    const url = kind === 'db' ? `/db/${id}/records` : `/db/views/${id}`;
    console.log(`fetching ${url}`)
    const res = await fetch(url);

    if (!res.ok) {
        const m = await res.text();
        alert(res.status + m);
        return;
    }
    container.innerHTML = await res.text();
    console.log(`fetched ${url} successfully`)

    snapshotOriginals();
});


// EDITABLE-FIELD HANDLER =====================================================
const addEditableButton = getElementByIdAs(HTMLButtonElement, addEditableId);
const dialog = getElementByIdAs(FalseModal, falseModalId);
dialog.addController(addEditableButton, true)

const editableLabel = getElementByIdAs(HTMLInputElement, editableLabelInputId);
const editableType = getElementByIdAs(HTMLSelectElement, editableTypeSelectId);
const editableValue = getElementByIdAs(HTMLInputElement, editableValueInputId);
//    public async addEditableField<E extends editableType>(label: string, type: E, defVal: any, config: editableConfig<E>) {

function _() {
    const type =  editableTypeSchema.parse(editableType.value);
    const label = editableLabel.value;
    if(label.trim() === '') 
        throw new IllegalArgumentError('Label cannot be blank');

    requestConfig(type)
}

function requestConfig(type: editableType) {
    switch (type)  {
        case "checklist": case "list": {

            break;
        }
        case "value":        case "int": {
            
            break;
        }
        default: return;
    }
}
