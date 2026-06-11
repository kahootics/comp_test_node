
import {z} from 'zod';

export const RecordType = z.string().regex(/^(ARMO|WEAP)/g);
const Tier = z.string().regex(/^(A|B|C|D|E|F|S)/g);

// ENCHANTMENTS ===========================

export const enchantArmorTest = z.object({
    id: z.string(),
    name: z.string(),
    effects: z.array(z.string()),
    disenchant: z.array(z.string()).nullable(),
    mod: z.string(),
    restrictions: z.array(z.string()),
    unique: z.boolean(),
    obtain: z.string().nullable(), // temporary
    notes: z.string().nullable(),
    bugs: z.string().nullable(),
    tier: z.string().nullable(), // temporary
    recordType: RecordType,
    priceAtZero: z.number().min(0),
    chargesAtHundred: z.number().min(-1)
});

export function parseEnchantsArmorTest(raw: {}[]) {
    return raw.map((record) => enchantArmorTest.parse(record));
}

export function parseEnchantArmorTest(record: {}) {
    return enchantArmorTest.parse(record);
}

// MAG EFFECTS ===========================

export const magnitude = z.object({
    base: z.number().nullable(),
    atZero: z.number().nullable(),
    atHundred: z.number().nullable(),
    growth: z.number().min(-1).max(100),
})

export const magEffTest = z.object({
    id: z.string(),
    name: z.object({
        og: z.string(),
        main: z.string().nullable()
    }),
    description: z.object({
        og: z.string(),
        main: z.string().nullable()
    }),
    types: z.array(z.string()),
    recordType: RecordType,
    mag: magnitude,
    kwda: z.string().nullable(),
    resist: z.string().nullable()
})

export const magEffCompleteTest = magEffTest.merge(z.object({id: z.string()}));

export function parseMagEffsTest(raw: {}[]) {
    return raw.map((record) => parseMagEffTest(record));
}

export function parseMagEffTest(record: {}) {
    const result = magEffCompleteTest.parse(record);
    if(typeof result.mag.atZero === typeof result.mag.base) 
    {
        return result;
    } else throw new Error(`${result.name} has missing magnitude data`);
}

export function magEffMappify(unmapped: z.infer<typeof magEffCompleteTest>[])
: Map<String, z.infer<typeof magEffTest>>  {
    const result = new Map();
    unmapped.forEach(magEff => {
        if(result.has(magEff.id)) 
            throw new Error(`ID: ${magEff.id} | ${magEff.name} has the same ID as ${result.get(magEff.id)}`)
        result.set(magEff.id,magEffTest.parse(magEff));
    });
    return result;
}