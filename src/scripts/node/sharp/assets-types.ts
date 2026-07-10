
import z from 'zod';
import { getFileBirthTime } from '../../../tools/companion-util.js';

export namespace assets {
    /**
     * Sorting function library for assets
     */
    export const sortby = {
        name(a: NamePath, b: NamePath) {
            return sString(a.name, b.name);
        },
        date(a: NamePath, b: NamePath) {
            const c = getFileBirthTime(a.path);
            const d = getFileBirthTime(b.path);
            return sDate(c, d);
        },
        screenshot(c: NamePath, d: NamePath) {
            const a = reorderScreenshotName(c.name);
            const b = reorderScreenshotName(d.name);
            return sString(a, b);
        },
        none(a: NamePath, b: NamePath) { return 0 }
    }
    const sortKeys = Object.keys(sortby) as [keyof typeof sortby, ...(keyof typeof sortby)[]]
    const SortType = z.enum(sortKeys);

    export function format() { return FormatSchema; }
    export type formatType = z.infer<typeof FormatSchema>;
    const FormatSchema = z.enum(['avif', 'jpeg', 'png', 'webp']);

    export function formatOptions() { return FormatOptionsSchema; }
    export type formatOptionsType = z.infer<typeof FormatOptionsSchema>;
    const FormatOptionsSchema = z.object({
        quality: z.number().min(1).max(100).optional(),
        lossless: z.boolean().optional()
    });


    export function crop() { return CropSchema; }
    export type cropType = z.infer<typeof CropSchema>;
    const CropSchema = z.object({
        include: z.instanceof(RegExp),
        use: z.enum(['percentage', 'flat']),
        extract: z.object({
            top: z.number(),
            left: z.number(),
            width: z.number(),
            height: z.number()
        })
    }).refine(
        img => Object.values(img.extract).every(param => (0 <= param && param <= 1)),
        {
            error: 'If using percentage values for extracting sub-image, values of '
                + 'extraction parameters must be within [0;1]'
        }
    );


    export function rename() { return RenameSchema; }
    export type renameType = z.infer<typeof RenameSchema>;
    const RenameSchema = z.object({
        include: z.instanceof(RegExp).default(/.*/s),
        sort: SortType,
        hash: z.boolean().default(false),
        finalNames: z.array(
            z.string().trim().nonempty()
        ).nonempty().optional(),
    });

    
    export function srcset() { return srcsetType; }
    const srcsetType = z.object({
        les: z.null()
    });


    export function localRule() { return LocalRuleSchema; }
    const LocalRuleSchema = z.object({
        format: format(),
        options: formatOptions().optional(),
        crop: crop().optional(),
        rename: rename().optional(),
    });

    export function cropRegister() { return CropRegisterSchema; }
    const CropRegisterSchema = z.array(
        z.object({
            rule: crop(),
            hashes: z.array(z.hash('md5'))
        })
    );

    export function exportRule() { return ExportRuleSchema; }
    const ExportRuleSchema = z.object({
        format: format().optional(),
        options: formatOptions().optional(),
        buildSrcset: srcset().optional() // ? await
    });

    export function rule() { return RuleSchema; }
    export type ruleType = z.infer<typeof RuleSchema>
    const RuleSchema = z.object({
        local: LocalRuleSchema,
        export: ExportRuleSchema
    });


    type LocalRule = z.infer<typeof LocalRuleSchema>

    export interface NamePath {
        name: string,
        path: string
    }

    export interface PathsWithRule {
        rule: ruleType,
        assets: NamePath[]
    }

    declare const DirectorySymbol: unique symbol;
    export type directory = string & { [DirectorySymbol]: void }
}


function reorderScreenshotName(filename: string): string {
    const regex = /^Screenshot (\d{2})_(\d{2})_(\d{4}) (\d{2})_(\d{2})_(\d{2})/;
    const regexFinal = /^Screenshot (\d{4})_(\d{2})_(\d{2}) (\d{2})_(\d{2})_(\d{2})/;
    const match = filename.match(regex);
    if (!match) {
        if (!filename.match(regexFinal))
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

