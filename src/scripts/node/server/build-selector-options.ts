import {CLIENT_ID} from "../../shared/client-ids.js";
import { BundlersRegistry } from "../bundlers/bundlers-registry.js";
import { DBInitSchemas } from "../db/data-base-init.js";

const { selectorOptionsId } = CLIENT_ID

export async function buildSelectorOptions(): Promise<string> {
    const dbTypes = Object.keys(DBInitSchemas);
    const viewNames = await BundlersRegistry.getAllAvailableBundlerIds();

    const dbOptions = dbTypes.map(t => `<option value="db:${t}">${t}</option>`).join('');
    const viewOptions = viewNames.map(n => `<option value="view:${n}">${n}</option>`).join('');

    return `<select id="${selectorOptionsId}">${dbOptions}${viewOptions}</select>`;
}

