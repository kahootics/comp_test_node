
import {z} from 'zod';

const SchemaRawFilters = z.array(z.object({
    misc: z.any(),
    content: z.any(),
    location: z.any(),
    version: z.any(),
    category: z.any()
}))

const SchemaFilters = z.object({
    misc: z.set(z.object({
        id: z.string(),
        icons: z.string(),
        name: z.string(),
        matches: z.array(z.string())
    })),
    content: z.set(z.object({
        id: z.string(),
        icons: z.string(),
        name: z.string(),
        matches: z.array(z.string()),
        class: z.string()
    })),
    location: z.set(z.object({
        id: z.string(),
        icons: z.string(),
        matches: z.array(z.string()),
        name: z.string(),
        image: z.object({
            int: z.string().nullable(),
            ext: z.string()
        })
    })),
    version: z.set(z.object({
        id: z.string(),
        matches: z.array(z.string()),
        number: z.string()
    })),
    category: z.set(z.object({
        name: z.string(),
        order: z.number(),
        id: z.string(),
        matches: z.null()
    }))
})

export const SchemaMapFilters = z.object({
    tags: z.array(z.object({
        matches: z.array(z.string()),
        id: z.string()
    })),
    category: z.array(z.object({
        id: z.string(),
        name: z.string(),
        order: z.number()
    }))
})

export function validateTypeArrayFilters(record: {}) {
    return SchemaMapFilters.parse(record);
}

export function parseModsCompendiumFilters(rawData: z.infer<typeof SchemaRawFilters>) {
    const parsedData: z.infer<typeof SchemaFilters> = {
        misc: new Set(),
        content: new Set(),
        location: new Set(),
        version: new Set(),
        category: new Set()
    };
    rawData.forEach((parsable => {
        let proxy: any = parsable['misc'];
        if(proxy !== null) {
            parsedData.misc.add(JSON.parse(JSON.stringify(proxy)));
        } 
        proxy = parsable['content'];
        if(proxy['name'] !== null) {
            parsedData.content.add(JSON.parse(JSON.stringify(proxy)));
        }
        proxy = parsable['location'];
        if(proxy['name'] !== null) {
            parsedData.location.add(JSON.parse(JSON.stringify(proxy)));
        }
        proxy = parsable['version'];
        if(proxy['number'] !== null) {
            parsedData.version.add(JSON.parse(JSON.stringify(proxy)));
        }
        proxy = parsable['category'];
        if(proxy['name'] !== null) {
            parsedData.category.add(JSON.parse(JSON.stringify(proxy)));
        }
    }));
    return {
        misc: [...parsedData.misc],
        content: [...parsedData.content],
        location: [...parsedData.location],
        version: [...parsedData.version],
        category: [...parsedData.category]
    }
}