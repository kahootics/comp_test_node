import path from "path";
import type z from "zod";
import { CropRegister } from "./assets-types.js";



/**
 * Gets the register of assets that have already been cropped with a certain rule
 * @param directory - directory of register
 * @returns an array of objects containing a crop rule and the hashes of assets on which such rule has already been enforced
 */
/* function getCropRegister(directory: string): z.infer<typeof CropRegister> { 
    let cropReg: z.infer<typeof CropRegister> = CropRegister.parse()
    try {
        const maybe = CropRegister.parse(
        JSON.parse(
            fs.readFileSync(
                path.resolve(
                    path.normalize(directory + path.sep + 'crop-register.json')), 
                'utf-8')));
        cropReg = maybe;
    } finally {
        return cropReg;
    }
} */