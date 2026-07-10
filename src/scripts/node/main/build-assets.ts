import { glob } from 'glob';
import { getDirname } from "../../../tools/companion-util.js";
import { Log } from '../../../tools/console.js';
import { buildSrcset, type SrcsetOutput } from "../sharp/build-srcset.js";
import path from 'path';

const json = async () => await buildSrcset('src/assets/sprites/content-icons-sprite.webp','dist/assets/sprites/',[720,1080], false, true);

export default json;

interface AssetsMap {
    [dir: string]: {
        [file: string]: string | SrcsetOutput
    }
}

export async function getAssetsMap(): Promise<AssetsMap> {
    const assets = await glob('src/assets/**/*.{webp,png,jpg,avif}');

    const assetsMap: AssetsMap = {};

    assets.forEach(assetPath => {
        const ext = path.extname(assetPath);
        const filename = path.basename(assetPath, `.${ext}`);
        const dirname = getDirname(assetPath);

        if(!assetsMap[dirname]) {
            assetsMap[dirname] = {};
        }
        assetsMap[dirname][filename] = assetPath;
    })
    return assetsMap;
}