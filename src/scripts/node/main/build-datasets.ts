import fetchSheetDataset from '../csv/fetch-sheet-as-dataset.js';

import datasheets from '../../../config/companion-datasheets.json' with { type: 'json' };
import { parseEnchantsArmorTest, parseMagEffsTest } from "../../types/enchantments-types.js";
import writeAsJsonAt from "../writers/write-as-json-at.js";
import { Log } from '../../../tools/console.js';
import hashFile from "../writers/hash.js";
import { SchemaMod } from '../../types/mods-compendium-types.js';


export async function buildDatasets(): Promise<void> {
    const enchantmentsRaw = await fetchSheetDataset(
        datasheets.enchantments.id,
        datasheets.enchantments.gid
    );

    const enchantments = parseEnchantsArmorTest(enchantmentsRaw);

    /* MAGICAL EFFECTS */
    const magEffsRaw = await fetchSheetDataset(
        datasheets.magEff.id,
        datasheets.magEff.gid, { newLineReplacer: '//' }
    );

    const magEffs = parseMagEffsTest(magEffsRaw);

    const enchPath = await writeAsJsonAt(enchantments, 'dist/data/enchantments.json', { minify: true });
    const mgefPath = await writeAsJsonAt(magEffs, 'dist/data/mgef.json');

    const buh = SchemaMod.toJSONSchema();
    await writeAsJsonAt(buh, 'dist/data/theFrog.json');
}
