
import path from 'node:path';
import { ReadStream } from 'node:fs';
import fs from 'node:fs';
import config from '../../config/ui-config.mjs';
import { IllegalAccessError, IllegalArgumentError } from '../../errors/common-errors.mjs';



export function getDirname(filePath: string): string {
    return path.basename(path.dirname(filePath));
}
const birthRegister: Map<string, Date> = new Map();
export function getFileBirthTime(filePath: string) {
    const maybe = birthRegister.get(filePath);
    if (maybe) return maybe;
    // else
    const paths = path.resolve(filePath)
    const res = fs.statSync(paths).birthtime;
    birthRegister.set(filePath, res);
    return res;
}



export type $stable = string & { __stable: 'StablePath'; };
/**
 * Normalizes a path and sets the separator to be `/`
 * regardless of system.
 */
export function _stabilizePath<S extends string>(s: S): S & $stable {
    return path.normalize(s).split(path.sep).join('/') as S & $stable;
}


