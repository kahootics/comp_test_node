import { readFile } from "node:fs/promises";
import devConfig from "../../../config/dev-config.mjs";
import { bundleScripts } from "../writers/build-scripts.js";
import { writePage } from "../writers/HTML/write-page.js";
import { buildSelectorOptions } from "./build-selector-options.js";
import { run } from "./data-server.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

await bundleScripts('src/scripts/node/db/dev/data-client.{ts,js}','dist',true);

// Read the stylesheet
const here = path.dirname(fileURLToPath(import.meta.url));
const stPath = path.join(here, 'view.css').replace('build','src');
const styles = await readFile(stPath,'utf-8');

// Build the loading options
const selector = await buildSelectorOptions();

// Structure the body of the document
const body = 
    '<form>'
    // For loading a database or a view
    + `${selector}<button id="${devConfig.loadButtonId}" type="button">Load Selection</button>`
    // For adding an editable field to a database
    + `<button type="button" id="${devConfig.addEditableId}" >Add new Editable Field</button>`
    + `<false-modal id="${devConfig.falseModalId}">`
    + ''
    +'</false-modal>'
    // For saving edits to the currently displayed view/database
    + ''
    +'</form>'
    // Container for the table view
    + `<div id="${devConfig.containerId}"></div>`;

await writePage('Database Viewer','dist/index.html',
    body,
    `<script defer src="./dev.js"></script>`,
    `<style>${styles}</style>`
);


run();