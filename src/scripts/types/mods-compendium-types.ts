import { z } from "zod";
import { toNormalized } from "../shared/utilities/string-parsers.js";
import { buildSrcset } from "../node/sharp/build-srcset.js";

const hasId = z.object({
    id: z.string()
});

const addSearchable = z.object({
    /* element: z.any(), */
    searchable: z.string(),
    /* matchCount: z.number(),
    is_location: z.boolean(),
    is_version: z.boolean(),
    is_checked: z.boolean(),
    is_found: z.boolean() */
});

const SchemaMiniModIdless = z.object({
    name: z.object({
        short: z.string(),
        full: z.string(),
        alias: z.array(z.string()).nullable()
    }),
    relatedMods: z.array(z.string()).nullable(),
    creator: z.string(),
    version: z.object({
        added: z.number(),
        available: z.array(z.string())
    }),
    category: z.object({
        name: z.string(),
        order: z.number()
    }),
    length: z.number(),
    displays: z.number(),
    req: z.object({
        level: z.number(),
        misc: z.string().nullable()
    }),
    quest: z.object({
        initial: z.string().nullable(),
        other: z.array(z.string()).nullable()
    })
});

const SchemaMiniMod = hasId.merge(SchemaMiniModIdless);


const SchemaOptionalsMod = z.object({
    enabled: z.boolean(),
    name: z.object({
        short: z.string(),
        alias: z.array(z.string()).nullable()
    }),
    image: z.object({
        int: z.string().nullable(),
        ext: z.url()
    }),
    overview: z.string(),
    link: z.object({
        nexus: z.url(),
        wiki: z.url().nullable(),
        misc: z.object({
            url: z.url().nullable(),
            name: z.string().nullable()
        }),
    }),
    howTo: z.object({
        text: z.string().nullable(),
        title: z.string().nullable()
    }),
    where: z.object({
        desc: z.string().nullable(),
        title: z.string().nullable(),
        image: z.object({
            int: z.string().nullable(),
            ext: z.string().nullable()
        })
    }),
    notes: z.object({
        text: z.string().nullable(),
        title: z.string().nullable()
    }),
    tags: z.object({
        misc: z.array(z.string()).nullable(),
        content: z.array(z.string()).nullable(),
        location: z.array(z.string()).nullable(),
    }),
    icon: z.object({
        A: z.object({
            int: z.number(),
            alt: z.string().nullable()
        }),
        B: z.object({
            int: z.number(),
            alt: z.string().nullable()
        }),
        C: z.object({
            int: z.number(),
            alt: z.string().nullable()
        }),
        D: z.object({
            int: z.number(),
            alt: z.string().nullable()
        }),
        E: z.object({
            int: z.number(),
            alt: z.string().nullable()
        })
    })
});

export const SchemaMod = SchemaOptionalsMod.merge(SchemaMiniMod);


export function validateTypeMiniMod(miniRecord: {}) {
    return SchemaMiniMod.parse(miniRecord);
}

export function validateTypeMod(record: {}) {
    return SchemaMod.parse(record);
}




function pushIfExists(item: string | string[] | null | null[], where: string[]) {
    let d: string[] = [];
    if(typeof item === 'string') {
        where.push(item
            .replaceAll('have acquired','')
            .replaceAll('have progressed','')
            .replaceAll('have completed',''));
    } else if (Array.isArray(item) && (d = z.array(z.string()).parse(item)).length > 0) {
        where.push(d.join(' '));
    }
}



export function validateTypeModMiniMap(
    record: any[]
): [string, z.infer<typeof SchemaMiniModIdless>] {
    return [
        z.string().parse(record[0]),
        SchemaMiniModIdless.parse(record[1])
    ];
}

export type MiniModIdless = z.infer<typeof SchemaMiniModIdless>;

const SchemaUseMap = addSearchable.merge(SchemaMiniModIdless);

export type MiniMod = z.infer<typeof SchemaUseMap>;

export function modMiniMap(record: unknown
): [string, z.infer<typeof SchemaUseMap>] {

    const { id, ...rest} = record as any;

    const modMap = SchemaUseMap.parse(rest);
    const temp = [modMap.name.full, modMap.name.short, modMap.creator];
    pushIfExists(modMap.relatedMods, temp);
    pushIfExists(modMap.name.alias, temp);
    pushIfExists(modMap.quest.initial, temp);
    pushIfExists(modMap.quest.other, temp);
    pushIfExists(modMap.req.misc, temp);
    modMap.searchable = toNormalized(temp.join(' '));

    if(!modMap.searchable) throw new Error(`${JSON.stringify(modMap)}`)
    return [
        z.string().parse(id),
        modMap
    ];
}