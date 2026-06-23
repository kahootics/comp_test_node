import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { glob } from 'glob';
import { toUnitBytes } from '../../../config/companion-util.js';

async function imgToExt(
    filePath: string, 
    format: keyof sharp.FormatEnum, 
    quality: number
): Promise<void> {
    /* const metadata = await sharp(filePath).metadata();
    const { width, height } = metadata; */

    const src = path.resolve(filePath);

    const dir = path.dirname(src);
    const ext = path.extname(src); // .{jpg,png...}
    const name = path.basename(src, ext);

    const outPath = path.resolve(path.join(dir, `${name}.${format}`));

    const res = await sharp(src)
        /* .extract({
            left: Math.floor(width/2),
            top: 0,
            width: Math.floor(width/2),
            height: Math.floor(height*0.92)
        }) */
        .toFormat(format, { quality: quality })
        .toFile(outPath);

    // Delete old file
    fs.unlinkSync(src); 

    //console.log(`Successfully converted ${name} to .webp;`);
    console.log(`File format edited at ${outPath} [${toUnitBytes(res.size)}]`);
}


const images = await glob('src/assets/**/*.{jpeg,jpg,png,gif}');

console.log(`Found ${images.length} images to convert`);

images.forEach((async (imgPath) => 
        await imgToExt(imgPath, 'webp', 82)
    ))
