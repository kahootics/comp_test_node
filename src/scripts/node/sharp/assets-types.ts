
import z from 'zod';
import type { AssetNamePath } from './apply-assets-rules.js';
import { getFileBirthTime } from '../../../config/companion-util.js';


const LocalAssetsRule = z.object({
        format: img.format(),
        options: img.formatOptions().optional(),
        crop: img.crop().optional(),
        rename: img.rename().optional(),
    });
const CropRegister = z.array(
        z.object({
            rule: img.crop(),
            hashes: z.array(z.hash('md5'))
        })
    );
const ExportAssetsRule = z.object({
        format: img.format().optional(),
        options: img.formatOptions().optional(),
        buildSrcset: img.srcset().optional() // ? await
    });

const AssetsRule = z.object({
    local: LocalAssetsRule,
    export: ExportAssetsRule    
});

export type AssetsRule = z.infer<typeof AssetsRule>;
type LocalAssetsRule   = z.infer<typeof LocalAssetsRule>

export interface AssetNamePath {
    name: string, 
    path: string
}

interface AssetsPathsWithRule {
    rule: AssetsRule,
    assets: AssetNamePath[]
}


function reorderScreenshotName(filename: string): string {
    const regex = /^Screenshot (\d{2})_(\d{2})_(\d{4}) (\d{2})_(\d{2})_(\d{2})/;
    const regexFinal = /^Screenshot (\d{4})_(\d{2})_(\d{2}) (\d{2})_(\d{2})_(\d{2})/;
    const match = filename.match(regex);
    if (!match) {
        if(!filename.match(regexFinal))
            throw new Error(`${filename} cannot be sorted by screenshot name due to wrong formatting`);
        // return if already correctly formatted
        return filename;
    };
    
    const [, dd, mm, yyyy, hh, min, ss] = match;
    return filename.replace(
        regex,
        `Screenshot ${yyyy}_${mm}_${dd} ${hh}_${min}_${ss}`
    );    
}

function sString(a: string, b: string) {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
}
function sDate(a: Date, b: Date) {
    return a > b ? 1 : a < b ? -1 : 0
}
/**
 * ttt
 */
const sortby = {
    name(a: AssetNamePath, b: AssetNamePath) {
        return sString(a.name,b.name);
    },
    date(a: AssetNamePath, b: AssetNamePath) {
        const c = getFileBirthTime(a.path);
        const d = getFileBirthTime(b.path);
        return sDate(c,d);
    },
    screenshot(c: AssetNamePath, d: AssetNamePath) {
        const a = reorderScreenshotName(c.name);
        const b = reorderScreenshotName(d.name);
        return sString(a,b);
    },
    none(a: AssetNamePath, b: AssetNamePath) { return 0 }
}
const sortKeys = Object.keys(sortby) as [keyof typeof sortby, ...(keyof typeof sortby)[]]
const SortType = z.enum(sortKeys);

export default Object.freeze({
    

    format() { return this.formatType; },
    formatType: z.enum(['avif','jpeg','png','webp']),

    formatOptions() { return this.formatOptionsType; },
    formatOptionsType: z.object({
        quality: z.number().min(1).max(100).optional(),
        lossless: z.boolean().optional()
    }),

    crop() { return this.cropType },
    cropType: z.object({
        include: z.instanceof(RegExp),
        use: z.enum(['percentage','flat']),
        extract: z.object({
            top: z.number(),
            left: z.number(),
            width: z.number(),
            height: z.number()
        })
    }).refine(
        img => Object.values(img.extract).every(param => (0 <= param && param <= 1) ), 
        { error: 'If using percentage values for extracting sub-image, values of '
            + 'extraction parameters must be within [0;1]'
        }
    ),

    sortType: SortType,
    sortby,

    rename() { return this.renameType; },
    renameType: z.object({
        include: z.instanceof(RegExp).default(/.*/s),
        sort: SortType,
        hash: z.boolean().default(false),
        finalNames: z.array(
            z.string().trim().nonempty()
        ).nonempty().optional(),
    }),

    srcset: () => z.object({
        les: z.null()
    })
});

