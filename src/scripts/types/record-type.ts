
import {readonly, z} from 'zod';

// export type LocalFormID = z.infer<typeof zodLocalFormID>;
// import type { LocalFormID } from '?/types/record-types.js';

const hexRegex = /[^0-9A-Fa-f]/g;

/** Record's signature (4 uppercase characters). */
export const zodRecordType = z.string().trim().toUpperCase().regex(/^(ARMO|WEAP|ENCH|MGEF|ALCH|INGR)/g);
/** 1 upper case character that identify a custom viability tier. */
export const zodTier = z.string().trim().toUpperCase().regex(/^(A|B|C|D|E|F|S)/g);
// Identifiers:
/** 
 * 4 upper case HEX characters that identify a plugin. 
 * @remarks 
 * - the identifier is *local to the Companion*
 * - does not depend on plugin version or load order
 */
export const zodCompPluginID = z.string().trim().length(4).regex(hexRegex).toUpperCase();
/** 
 * 4 upper case HEX characters that identify a companion's unique instance of a record. 
 * @remarks
 * - the identifier is *local to the Companion*
 * - simple modifier to distinguish records that have the same
 * local form ID and belong to the same plugin but have different properties
 */
export const zodCompVersionID = z.string().trim().length(4).regex(hexRegex).toUpperCase();
/**
 *  Local Form ID of the record (HEX format)
 * @remarks
 * - last 6 form ID characters for .esp/.esm records
 * - 'FE' + last 3 form ID charcters in case of .esl file records
 */
export const zodLocalFormID = z.hex().trim().toUpperCase().refine(
    id => (id.length === 5 && id.startsWith('FE')) || (id. length === 6),
    { error: "not valid local form ID" }
);

const zodRecordRawBase = z.object({
    pluginId: zodCompPluginID,
    compVersionId: zodCompVersionID,
    localFormId: zodLocalFormID
});

export default {
    compPluginId() { return zodCompPluginID; },
    compVersionId() { return zodCompVersionID; },
    localFormId() { return zodLocalFormID; },
    tier() { return zodTier; },
    recordType() { return zodRecordType; },
    recordBase() { 
        return z.object({
            compPluginId: this.compPluginId(),
            compVersionId: this.compVersionId(),
            localFormId: this.localFormId()
        });
    },
    /**
     * @returns zod object that parses a hexadecimal prefix of 2 or 3
     */
    formIdPrefix: () =>
        z.hex().trim().toUpperCase().refine(
            fid => (fid.length === 2 && (fid !== 'FE')) || (fid.length === 3),
            { error: "invalid form ID prefix" }
        ),
    /**
     * @returns zod object that parses a file extesion
     */
    pluginExt: () =>
        z.string().toLowerCase().length(3), // needs refining
    /**
     * 
     */
}