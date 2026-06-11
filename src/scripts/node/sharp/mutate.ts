import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { glob } from 'glob';

async function imgToExt(
    filePath: string, 
    format: keyof sharp.FormatEnum, 
    quality: number
): Promise<void> {
    /* const metadata = await sharp(filePath).metadata();
    const { width, height } = metadata; */

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath); // .{jpg,png...}
    const name = path.basename(filePath, ext);

    const outPath = path.join(dir, `${name}.${format}`);

    await sharp(filePath)
        /* .extract({
            left: Math.floor(width/2),
            top: 0,
            width: Math.floor(width/2),
            height: Math.floor(height*0.92)
        }) */
        .toFormat(format, { quality: quality })
        .toFile(outPath);

    fs.unlinkSync(filePath); 
    //console.log(`Successfully converted ${name} to .webp;`);
    console.log(`File format edited at ${outPath}`);
}


const images = await glob('src/assets/**/*.{jpeg,jpg,png,gif}', { cwd: './' });

console.log(`Found ${images.length} images to convert`);

images.forEach((async (imgPath) => 
        await imgToExt(imgPath, 'webp', 82)
    ))
