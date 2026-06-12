import {z} from 'zod';

const hexRegex = /[^0-9A-Fa-f]/g;

/** Record's signature (4 uppercase characters). */
export const RecordType = z.string().trim().toUpperCase().regex(/^(ARMO|WEAP|ENCH|MGEF|ALCH|INGR)/g);
/** 1 upper case character that identify a custom viability tier. */
export const Tier = z.string().trim().toUpperCase().regex(/^(A|B|C|D|E|F|S)/g);
// Identifiers:
/** 
 * 4 upper case HEX characters that identify a plugin. 
 * @remarks 
 * - the identifier is *local to the Companion*
 * - does not depend on plugin version or load order
 */
export const CompPluginID = z.string().trim().length(4).regex(hexRegex).toUpperCase();
/** 
 * 4 upper case HEX characters that identify a companion's unique instance of a record. 
 * @remarks
 * - the identifier is *local to the Companion*
 * - simple modifier to distinguish records that have the same
 * local form ID and belong to the same plugin but have different properties
 */
export const CompVersionID = z.string().trim().length(4).regex(hexRegex).toUpperCase();
/**
 *  Local Form ID of the record (HEX format)
 * @remarks
 * - last 6 form ID characters for .esp/.esm records
 * - 'FE' + last 3 form ID charcters in case of .esl file records
 */
export const LocalFormID = z.string().trim().regex(hexRegex).toUpperCase().refine(
    id => (id.length === 5 && id.startsWith('FE')) || (id. length === 6),
    { error: "not valid local form ID" }
);

