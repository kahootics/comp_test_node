
import z from "zod";
import fs from 'node:fs'
import { glob } from 'glob';
import path from "node:path";
import { Log } from "../../../config/companion-util.js";
import sharp from "sharp";
import img from "./assets-types.js";
import { createHashFromFile } from "../writers/hash.js";



/**
 * Async function that creates a map of asset directories and relative rules
 * @returns a promise containing a collection of rules + empty asset lists (name + path) indexed by their directory
 * @requires glob
 */
export async function getAssetsRules(): Promise<Map<string, AssetsPathsWithRule>> {

    const allAssetsRulesPaths = await glob('src/assets/**/rules.json');

    return new Map(
        allAssetsRulesPaths.map(rulePath => {
            const directory = path.dirname(rulePath);
            const ruleStr   = fs.readFileSync(rulePath, 'utf-8');
            const ruleRaw   = JSON.parse(ruleStr);
            const rule      = AssetsRule.parse(ruleRaw);

            return [ directory, { rule, assets: [] } ]
        })
    );
}

/**
 * Async function that creates a map of asset directories and relative rules paired with the assets contained in that directory
 * @returns a promise containing a collection of rules + asset lists (name + path) indexed by their directory
 * @requires glob
 */
export async function getAssetsWithRules(): Promise<Map<string, AssetsPathsWithRule>> {
    const allAssetsPathsRaw = await glob('src/assets/**/*.{jpg,jpeg,png,webp,avif}');

    const allAssetsRules = await getAssetsRules();

    allAssetsPathsRaw.forEach(assetPath => {

        const assetDir  = path.dirname(assetPath);
        const assetExt  = path.extname(assetPath); // .{jpg,png...}
        const assetName = path.basename(assetPath, assetExt);
        const assetRuleObj = allAssetsRules.get(assetDir);

        if(!assetRuleObj)
            throw new Error(
                `There is no rule for images in directory: ${assetDir}`
            );

        assetRuleObj.assets.push({ 
            name: assetName,
            path: assetPath 
        });
    })

    return allAssetsRules;
}


// VALIDATION ==============================================================================

function validatAssetsDir(directory: string, aPWR: AssetsPathsWithRule): boolean {
    return aPWR.assets.every(asset => 
        path.resolve(path.dirname(asset.path)) 
        === path.resolve(directory)
    ); 
}

// INIT ===================================

// ENFORCE ==================================
async function enforceAssetsCropRule(
    name: string,
    sharpAsset: sharp.Sharp, 
    rule: z.infer<typeof img.cropType>
) {
    // If not included in croppable list, exit
    if(!name.match(rule.include)) return sharpAsset;

    const { width, height } = await sharpAsset.metadata();

    if(rule.use === 'flat') return sharpAsset.extract(rule.extract);

    else if(rule.use === 'percentage') return sharpAsset.extract({
        top: Math.floor(height*rule.extract.top),
        left: Math.floor(width*rule.extract.left),
        width: Math.floor(width*rule.extract.width),
        height: Math.floor(height*rule.extract.height)
    })

    else throw new Error('A type for extraction parameters must be passed in the rule');
}


function enforceSharpFormat(
    sharp: sharp.Sharp, 
    format: z.infer<typeof img.formatType>, 
    options?: z.infer<typeof img.formatOptionsType>
): sharp.Sharp {
    return sharp.toFormat(format, options);
}

function getAssetFinalName(
    name: string,
    sortedAssetsInRule: AssetNamePath[],
    rule: z.infer<typeof img.renameType>,
    filePath: string
) {
    // include check
    if(!name.match(rule.include)) return name;
    // rename check
    
    let result: string = name;
    if(rule.finalNames) {
        const allNames = sortedAssetsInRule.map(assetsInRule => assetsInRule.name);
        const i = allNames.indexOf(name);
        const maybe = rule.finalNames[i];
        if(!maybe) throw new Error(`${name} not found in rename list`);
        result = maybe;
    }
    
    if(rule.hash) {
        const hash = createHashFromFile(filePath);
        result = `${result}.${hash}`
    }

    return result;
    
}



function sortAssets(assets: AssetNamePath[], sorting: z.infer<typeof img.sortType>) {
    assets.sort(img.sortby[sorting])
}



const assetsWithRules = await getAssetsWithRules();

export const enforceAssetsDir = Object.freeze({

    async LocalRule(directory: string): Promise<void> {

        const pathsAndRule = getPathsAndRule(directory);
        const rule = pathsAndRule.rule.local;

        if(!validatAssetsDir(directory, pathsAndRule))
            throw new Error('Assets and rules are not combined correctly.')
        
        if(rule.rename) {
            if(rule.rename.finalNames 
                && rule.rename.finalNames.length !== pathsAndRule.assets.length)
                throw new Error('Mismatching sizes for names list and assets at dir: '
                    + directory
                );
            sortAssets(pathsAndRule.assets, rule.rename.sort)
            
        }
        


        for(const asset of pathsAndRule.assets) {

            const src  = path.resolve(asset.path);
            const dir  = path.dirname(src);
            const ext  = path.extname(src); // .{jpg,png...} ??
            const name = asset.name;

            let sharpAsset = sharp(src);

            if(ext !== rule.format) {
                // change format
                sharpAsset = enforceSharpFormat(sharpAsset, rule.format, rule.options);
            // If format is correct and no other rule needs to be applied, then exit
            } else if(!(rule.crop || rule.rename)) continue;

            if(rule.crop) 
                sharpAsset = await enforceAssetsCropRule(
                    name, sharpAsset, rule.crop
                );

            const outName = (rule.rename)  
                ? getAssetFinalName(name, pathsAndRule.assets, rule.rename, src)
                : name;

            // Output the file 
            const outPath = path.resolve(path.join(dir, `${outName}.${rule.format}`));
            const res = await sharpAsset.toFile(outPath);

            // Delete old file (if it hasn't been overwritten)
            if(src !== outPath) fs.unlinkSync(src); 

            Log.file(outPath, res.size);
        }
    },

    async ExportRule() {}
});


// HELPERS ===================================================================================

function getPathsAndRule(directory: string): AssetsPathsWithRule {
    const pathsAndRule = assetsWithRules.get(directory);
    // Check rules are referring to images group
    if(!pathsAndRule) throw new Error('At directory "' + 
        directory + '" there are no rules to apply on assets.');
    return pathsAndRule;
}


/* 
function localRuleAssetsPreprocess(
    directory: string, 
    assets: AssetNamePath[], 
    rule: CropAssetsRule
): void {
    if(rule.crop) {
        // Read register
        
        



    }
    if(rule.rename) {
        if(rule.rename.finalNames 
                && rule.rename.finalNames.length !== assets.length)
                throw new Error('Mismatching sizes for names list and assets at dir: '
                    + directory
                );
            sortAssets(assets, rule.rename.sort)
            
        }
} */