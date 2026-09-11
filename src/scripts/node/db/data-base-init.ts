import z from "zod";
import type { DataBaseInit } from "./data-base-types.d.js";



export const DBInitSchemas = {

    /** Content Mods Checklist */
    MODC: {
        data: {
            name: z.object({
                short: z.string(),
                full: z.string(),
                alias: z.array(z.string()).nullable(),
            }),
            relatedMods: z.array(z.string()).nullable(),
            creator: z.string(),
            image: z.url(),
            link: z.object({
                nexus: z.url(),
                wiki: z.url().nullable,
                other: z.object({
                    name: z.string(),
                    url: z.url()
                }).nullable()
            }),
            category: z.object({
                name: z.string(),// enum
                order: z.number()
            }),
            requirements: z.object({
                level: z.int().positive(),
                misc: z.string().nullable()
            }),
            quest: z.string().nullable(),
            where: z.string().nullable()
        },
        derived: {
            contentTags: z.array(z.string()),
            icons: z.object({
                A: z.string(),
                B: z.string(),
                C: z.string(),
                D: z.string(),
            }),
        }
    },

    /** Load Orders */
    LDOR: {
        data: {
            priority: z.int(),
            active: z.boolean(), // from status
            separator: z.boolean(),
            name: z.string(),
            nexus: z.object({
                URL: z.url(),
                ID: z.string()
            }).nullable(),
            version: z.string().nullable()
        },
        derived: {}
    },

    /* 
    ARMO: { data: {}, derived: {} }, // TODO
    WEAP: { data: {}, derived: {} }, // TODO
    ENCH: { data: {}, derived: {} }, // TODO
    MGEF: { data: {}, derived: {} }, // TODO
    SPEL: { data: {}, derived: {} }, // TODO
    INGR: { data: {}, derived: {} }, // TODO 
    // */// TBD

    TEST: { data: {}, derived: {} } // temp

} satisfies DataBaseInit;


