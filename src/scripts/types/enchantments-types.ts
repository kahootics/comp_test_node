
import {record, z} from 'zod';
import c from './record-type.js';
import { ArmoPrice, WeapPrice } from '../sync/enchantments/model.js';

export const RecordType = z.string().regex(/^(ARMO|WEAP)/g);

// ENCHANTMENTS ========================================================================

export const ENCH_Raw = z.object({  
    id: z.string(), // temporary
    name: z.string(),
    effects: z.array(z.string()),
    disenchant: z.array(z.string()).nullable(),
    mod: z.string(),
    restrictions: z.array(z.string()),
    unique: z.boolean(),
    obtain: z.string().nullable(), // temporary
    notes: z.string().nullable(),
    bugs: z.string().nullable(),
    tier: c.tier(),
    recordType: RecordType,
    priceAtZero: z.number().min(0),
    chargesAtHundred: z.number().min(-1)
}).transform(record => {
    const priceAtHundred = record.recordType === 'ARMO'
        ? ArmoPrice.calcValue(100, record.priceAtZero)
        : WeapPrice.calcValue(100, record.chargesAtHundred);
        return {...record, priceAtHundred};
    });

export function parseEnchantsArmorTest(raw: {}[]) {
    return raw.map((record) => ENCH_Raw.parse(record));
}

export function parseENCH_Raw(record: {}) {
    return ENCH_Raw.parse(record);
}

// MAG EFFECTS ===========================

export const magnitude = z.object({
    base: z.number().nullable(),
    atZero: z.number().nullable(),
    atHundred: z.number().nullable(),
    growth: z.number().min(-1).max(100),
})

export const MGEF_Raw = z.object({
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

export const magEffCompleteTest = MGEF_Raw.extend({id: z.string()});

export function parseMagEffsTest(raw: {}[]) {
    return raw.map((record) => parseMGEF_Raw(record));
}

export function parseMGEF_Raw(record: {}) {
    const result = magEffCompleteTest.parse(record);
    if(typeof result.mag.atZero === typeof result.mag.base) 
    {
        return result;
    } else throw new Error(`${result.name} has missing magnitude data`);
}

export function magEffMappify(unmapped: z.infer<typeof magEffCompleteTest>[])
: Map<String, z.infer<typeof MGEF_Raw>>  {
    const result = new Map();
    unmapped.forEach(magEff => {
        if(result.has(magEff.id)) 
            throw new Error(`ID: ${magEff.id} | ${magEff.name} has the same ID as ${result.get(magEff.id)}`)
        result.set(magEff.id,MGEF_Raw.parse(magEff));
    });
    return result;
}