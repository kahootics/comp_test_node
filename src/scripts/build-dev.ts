import { readFile } from "node:fs/promises";
import { buildSelectorOptions } from "./node/server/build-selector-options.js";
import { runServer } from "./node/server/data-server.js";
import { writePage } from "./node/writers/HTML/write-page.js";
import { CLIENT_ID } from "./shared/client-ids.js";
import { isDev } from "./node/process-env.js";
import { IllegalAccessError } from "../errors/common-errors.mjs";
import { bundleJsScripts } from "./node/writers/bundle-js-scripts.js";
import { dictionayResolver } from "../tools/dictionary-resolver.mjs";
import { CUSTOM_TAGS } from "./shared/client-custom-elements-tags.js";

if (!isDev) throw new IllegalAccessError(`Cannot build database and server in build-mode`);

await bundleJsScripts(
    'src/scripts/browser/data-client.{ts,js}',
    'dist', {
    target: ['ES2022'],
    sourcemap: 'external'
});

const tagResolver = dictionayResolver('', CUSTOM_TAGS, { keysToKebab: true });
const cssVarResolver = dictionayResolver('--§', { POSITION_CSS_VAR: '--carousel-translation-offset' })
const idResolver = dictionayResolver('#', CLIENT_ID, { keysToKebab: true, valuePrefix: '#' });
// Read the stylesheet
const styles: string = await Promise.all([
    readFile('src/stylesheets/dev.css', 'utf-8'),
    readFile('src/stylesheets/view.css', 'utf-8'),
    readFile('src/stylesheets/dynamic-selector.css', 'utf-8'),
    readFile('src/stylesheets/false-select.css', 'utf-8'),
    //readFile('src/stylesheets/expandable.css', 'utf-8'),
    //readFile('src/stylesheets/carousel.css', 'utf-8'),
    readFile('src/stylesheets/false-modal.css', 'utf-8'),
]).then(sheets => sheets
    .map(tagResolver)
    .map(cssVarResolver)
    .map(idResolver)
    .join('\n')
);


// Build the loading options
const selector = await buildSelectorOptions();
const {
    loadDBButtonId, addEditableFieldButtonId,
    openAddEditableFieldFormButtonId,
    openLoadDBFormButtonId,
    loadDBFormModalId,
    addEditableFieldFormModalId,
    databaseOperationsFieldsetId,
    containerId, containerTitleId,
    formCollapseControlId,
    optionsFormId, mainMenuId,loggerId
} = CLIENT_ID;
const { falseModal, falseSelect, dynamicSelector, expandable } = CUSTOM_TAGS;

function _buildFalseSelect(name: string, options: string[]) {
    return `<${falseSelect} name="${name}" >`
        + options.map(
            n => `<option value="${n}">${n}</option>`
        ).join('')
        + `</${falseSelect}>`
}
function _buildDynamicSelector(name: string) {
    return `<${dynamicSelector} name="${name}"></${dynamicSelector}>`
}

// STRUCTURE =========================================================

// DB LOADING ========================================================
const loadDBForm =
    `<${falseModal} id="${loadDBFormModalId}" controlledby="${openLoadDBFormButtonId}">`
    + '<p>Pick an option: </p>'
    + `<form id="${optionsFormId}" >`
    // For loading a database or a view
    + selector // pick a DB
    + `<button id="${loadDBButtonId}" type="button">Load Selection</button>`
    + '</form>'
    + `</${falseModal}>`;

// EDITABLE FIELD CREATION ===========================================
const addEditableFieldForm =
    `<${falseModal} id="${addEditableFieldFormModalId}" controlledby="${openAddEditableFieldFormButtonId}">`
    + `<form id="${''}" >`
    + '<p>Pick an option: </p>'
    + `<button disabled id="${addEditableFieldButtonId}" type="button">Add Editable Field to Current DB</button>`
    + '</form>'
    + `</${falseModal}>`;

const mainMenu =
    `<${expandable} open controlledby="${formCollapseControlId}">`
    + `<form id="${mainMenuId}">`
    + '<fieldset><legend>Main Menu</legend>'
    + `<button type="button" id="${openLoadDBFormButtonId}" >Load DataBase</button>`
    + '</fieldset>'
    + `<fieldset disabled id="${databaseOperationsFieldsetId}"><legend>Database Operations</legend>`
    + `<button type="button" id="${openAddEditableFieldFormButtonId}" >Add Editable Field</button>`
    + `<button disabled type="button" id="${''}" >Upload From CSV<br><small>not available</small></button>`
    + `<button disabled type="button" id="${''}" >Save Edits<br><small>not available</small></button>`
    + '</fieldset>'
    + `</form>`
    + `<div id="${loggerId}"></div>`
    + `</${expandable}>`
    + `<button type="button" aria-label="Collapse form" id="${formCollapseControlId}"></button>`
// For adding an editable field to a database



const DBContainer = `<h2 id="${containerTitleId}"></h2><div id="${containerId}"><div/>`;


// ========================
const body =
    mainMenu
    + loadDBForm
    + addEditableFieldForm
    + DBContainer;

// FINALIZE ========================================================
await writePage('Database Viewer', 'dist/index.html',
    body,
    `<script defer src="./data-client.js"></script>`,
    `<style>${styles}</style>`,
    //'<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">'
);
runServer();
