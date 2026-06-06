import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

async function pngToJpeg(filePath: string): Promise<void> {
    const metadata = await sharp(filePath).metadata();
    const { width, height } = metadata;
    const dir = path.dirname(filePath);
    const name = path.basename(filePath, '.png');
    const outPath = path.join(dir, `${name}.webp`);

    await sharp(filePath)
        /* .extract({
            left: Math.floor(width/2),
            top: 0,
            width: Math.floor(width/2),
            height: Math.floor(height*0.92)
        }) */
        ['webp']({ quality: 82 })
        .toFile(outPath);

    fs.unlinkSync(filePath); 
}

await pngToJpeg('src/assets/sprites/content-icons-sprite-black.png');