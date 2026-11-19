import { IllegalArgumentError, ValidationError } from "../../errors/common-errors.mjs";
import { getElementByIdAs } from "./utilities/get-validated-element.js";
import { CLIENT_ID } from "../shared/client-ids.js"
import type { editableType } from "../shared/editable-type-config.js";
import { CUSTOM_TAGS } from "../shared/client-custom-elements-tags.js";

// LOGGER ===========================================================



// REFERENCE IDS ==================================================
/* 
 * Ids of elements to use as bridge between server and client
 */

const {
    databaseOperationsFieldsetId,
    loadDBButtonId, openLoadDBFormButtonId, loadDBFormModalId,
    addEditableFieldButtonId, openAddEditableFieldFormButtonId, addEditableFieldFormModalId,


    editableLabelInputId,
    selectorOptionsId, containerId, containerTitleId,
    editableTypeSelectId, editableValueInputId
} = CLIENT_ID;

// CUSTOM ELEMENTS ==================================================

import { FalseModal } from "./ui/components/mixin-elements.js";
import { DynamicSelector } from "./ui/components/false/dynamic-selector.js";
import { FalseSelect } from "./ui/components/false/false-select.js";
import { FalseSelectDropdown } from "./ui/components/false/false-select-dropdown.js";
//import type { Expandable } from "./ui/mixins/add_behaviour/expandable.mixin.js";
//import { Carousel } from "./ui/components/carousel.js";

const { falseSelectDropdown, falseSelect, dynamicSelector, carousel, falseModal } = CUSTOM_TAGS;
/* Other customn elements are defined in mixin-elements.js imported above */
customElements.define(dynamicSelector, DynamicSelector);
customElements.define(falseSelectDropdown, FalseSelectDropdown);
customElements.define(falseSelect, FalseSelect);
//customElements.define(carousel, Carousel);
//log('Custom elements initialized correctly');

// E? =====================

const supportedEdTypes = [
    'check', 'checklist', 'int', 'line', 'list', 'paragraph', 'url', 'value'
] satisfies [editableType, ...editableType[]];

function _assertEditableType(type: string): asserts type is editableType {
    if (!supportedEdTypes.includes(type as editableType))
        throw new ValidationError('');
}

// Complement Log ===============================================
const logger = getElementByIdAs(HTMLDivElement, CLIENT_ID.loggerId);
const currentLog = document.createElement('div');
currentLog.setAttribute('role', 'log');
currentLog.id = 'current-log';
const showFullLogBt = document.createElement('button');
showFullLogBt.textContent = 'Show Full Log';
showFullLogBt.type = 'button';
logger.append(currentLog, showFullLogBt);


const oldLogs = document.createElement('ol');

interface LogEntry {
    time: Date
    message: string
    subject?: Element
}
const Logs: LogEntry[] = [];

function log(message: string, subject?: Element) {

    Logs[Logs.length - 1]?.subject?.removeAttribute('aria-describedby');

    const time = new Date();
    const timestamp = `[${time.getHours() > 9 ? time.getHours() : '0' + time.getHours()
        }:${time.getMinutes() > 9 ? time.getMinutes() : '0' + time.getMinutes()
        }:${time.getSeconds() > 9 ? time.getSeconds() : '0' + time.getSeconds()}]`;
    currentLog.textContent = message;
    subject?.setAttribute('aria-describedby', currentLog.id);

    const newEntry = document.createElement('li');
    const newStamp = document.createElement('span');
    newStamp.textContent = timestamp;
    newEntry.textContent = ` ${message}`;
    newEntry.prepend(newStamp);

    oldLogs.append(newEntry);
    console.log(message);
    Logs.push({ time, message, subject });
}

const fullLog = document.createElement(falseModal);
logger.append(fullLog);

fullLog.append(oldLogs);

fullLog.addController(showFullLogBt, { toggleOnClick: true });


log('Script running...')

// DB-LOADER ================================================================
const load = getElementByIdAs(HTMLButtonElement, loadDBButtonId);
const selector = getElementByIdAs(HTMLSelectElement, selectorOptionsId);
const container = getElementByIdAs(HTMLElement, containerId);
const title = getElementByIdAs(HTMLHeadingElement, containerTitleId);
const loadFormModal = getElementByIdAs(FalseModal, loadDBFormModalId);
const operationsFieldset = getElementByIdAs(HTMLFieldSetElement, databaseOperationsFieldsetId);
/**
 * Registers the data from the inputs within all the rows
 * filter only for rows that have inputs 
 * throw if no storeId type or inv are present
 */
function snapshotOriginals() {
    /* TBD */
    container.querySelectorAll(':scope td > *')
}


function stickifyTableHeaders() {
    const styleEl = document.createElement('style');
    container.append(styleEl);
    let stick: number | null = null;

    container.querySelectorAll(':scope > table thead tr th')
        .forEach(
            (th, i) => th.addEventListener('click', () => {
                if (stick !== i) {
                    styleEl.textContent =
                        `#${containerId} table tr :is(td,th):nth-child(${String(i + 1)})`
                        + '{ position: sticky; left:0; z-index:10; }'
                    stick = i;
                } else {
                    styleEl.textContent = '';
                    stick = null;
                }
            })
        );
}

load.addEventListener('click', async () => {
    const [kind, id] = selector.value.split(':');
    const url = kind === 'db' ? `/db/${id}/records` : `/db/views/${id}`;
    log(`fetching ${url}`)
    const res = await fetch(url);

    if (!res.ok) {
        const m = await res.text();
        alert(res.status + m);
        return;
    }
    title.textContent = id ?? '';
    container.innerHTML = await res.text();
    log(`fetched ${url} successfully`)
    loadFormModal.close().then(
        // enable operations on DB 
        // once a database has been loaded
        () => operationsFieldset.disabled = false
    );
    snapshotOriginals();
    stickifyTableHeaders();
});


// EDITABLE-FIELD HANDLER =====================================================

/* 
const editableLabel = getElementByIdAs(HTMLInputElement, editableLabelInputId);
const editableType = getElementByIdAs(HTMLSelectElement, editableTypeSelectId);
const editableValue = getElementByIdAs(HTMLInputElement, editableValueInputId);
//    public async addEditableField<E extends editableType>(label: string, type: E, defVal: any, config: editableConfig<E>) {

function _() {

    const type = editableType.value;
    _assertEditableType(type);

    const label = editableLabel.value;
    if (label.trim() === '')
        throw new IllegalArgumentError('Label cannot be blank');

    requestConfig(type);
}

function requestConfig(type: editableType) {
    switch (type) {
        case "checklist": case "list": {

            break;
        }
        case "value": case "int": {

            break;
        }
        default: return;
    }
}
 */