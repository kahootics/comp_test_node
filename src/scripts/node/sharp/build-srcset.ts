import sharp from 'sharp';
import path from 'node:path';
import { destPathCorrected } from '../writers/copy-file-to.js';
import hashFile from '../writers/hash.js';
import writeAsJsonAt from '../writers/write-as-json-at.js';

interface newFormat {
    format: keyof sharp.FormatEnum, 
    quality: number
}

async function buildSrcset(
    filePath: string, 
    dest: string,
    widths: number[],
    hash?: boolean,
    newFormat?: newFormat
): Promise<{}> {
    const sImage = sharp(filePath);
    const metadata = await sImage.metadata();
    const { width, height } = metadata;
    

    const corrDest = destPathCorrected(filePath, dest);

    
    const outDir = path.dirname(corrDest);
    const ext = path.extname(corrDest); // .{jpg,png...}
    const name = path.basename(corrDest, ext);
    const newExt = newFormat ? '.' + newFormat.format : ext;


    const image = newFormat 
        ? sImage.toFormat(newFormat.format, { quality: newFormat.quality })
        : sImage;


    const outPath = path.resolve(path.join(outDir, `${name}.${newExt}`));
    const newImg = await image.toFile(outPath);
    const finalPath = hash ? hashFile(outPath) : outPath;
    
    const output: any = {
        name: name,
        src: finalPath,
        width: width,
        height: height,
        srcset: {}
    };
    
    for(const setWidth of widths) {
        const outPath = path.resolve(path.join(outDir, `${name}.${setWidth}.${newExt}`));
        const newImg = await image.resize({ width: setWidth }).toFile(outPath);
        const finalPath = hash ? hashFile(outPath) : outPath;
        output.srcset[`${setWidth}px`] = {
            src: finalPath,
            width: newImg.width,
            height: newImg.height
        };
    }

    return output;

// .then(info => {})
/* info: {
size
height
width
format
} */

}


const json = await buildSrcset('src/assets/sprites/content-icons-sprite.webp','src/assets/sprites/',[720,1080], true);

writeAsJsonAt(json,'src/assets/sprites/jennyk.json')