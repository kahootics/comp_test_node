import z from "zod";
import type { DataBaseInit } from "./data-base-types.d.js";



export const DBInitSchemas = {

    /** Content Mods Checklist */
    MODC: {
        data: {
            name: z.string().nullable()
        },
        derived: {}
    },

    /** Load Orders */
    LDOR: {
        data: {
            priority: z.int(),
            active: z.boolean(), // from status
            name: z.string(),
            nexus: z.object({
                URL: z.url(),
                ID: z.string()
            }),
            version: z.string()
        }, 
        derived: {}
    },

    /* ARMO: { data: {}, derived: {} }, // TODO
    WEAP: { data: {}, derived: {} }, // TODO
    ENCH: { data: {}, derived: {} }, // TODO
    MGEF: { data: {}, derived: {} }, // TODO
    SPEL: { data: {}, derived: {} }, // TODO
    INGR: { data: {}, derived: {} }, // TODO */

    TEST: { data: {}, derived: {} } // temp

} satisfies DataBaseInit;


