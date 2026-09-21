import { readFile } from "node:fs/promises";
import { buildSelectorOptions } from "./node/server/build-selector-options.js";
import { runServer } from "./node/server/data-server.js";
import { writePage } from "./node/writers/HTML/write-page.js";
import { CLIENT_ID } from "./shared/client-ids.js";
import { isDev } from "./node/process-env.js";
import { IllegalAccessError } from "../errors/common-errors.mjs";
import { bundleJsScripts } from "./node/writers/bundle-js-scripts.js";

if (!isDev) throw new IllegalAccessError(`Cannot build database and server in build-mode`);

await bundleJsScripts(
    'src/scripts/browser/data-client.{ts,js}', 
    'dist', {
    target: ['ES2022'],
    sourcemap: 'external'
});

// Read the stylesheet
const styles = await readFile('src/stylesheets/view.css', 'utf-8');
// Build the loading options
const selector = await buildSelectorOptions();
const { loadButtonId, addEditableId, falseModalId, containerId, optionsFormId } = CLIENT_ID;
// Structure the body of the document
const body = `<form id="${optionsFormId}" >`
    // For loading a database or a view
    + `${selector}<button id="${loadButtonId}" type="button">Load Selection</button>`
    // For adding an editable field to a database
    + `<button type="button" id="${addEditableId}" >Add Editable Field</button>`
    + `<false-modal id="${falseModalId}">`
    + ''
    + '</false-modal>'
    // For saving edits to the currently displayed view/database
    + ''
    + '</form>'
    // Container for the table view
    + `<div id="${containerId}"></div>`;
await writePage('Database Viewer', 'dist/index.html',
    body,
    `<script defer src="./data-client.js"></script>`,
    `<style>${styles}</style>`
);
runServer(); 
 