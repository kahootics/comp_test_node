import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** 
 * @param algorithm - Hashing algorithm (defaults to `md5`)
 * @param length - Length of the hash (defaults to 8) 
 */
interface HashOptions {
    algorithm: string,
    length: number
}

/**
 * Hashes a buffer directly.
 * @param buffer - Buffer to hash
 * @param [options] - Hashing options: 
 * @see {@link HashOptions} interface for the list of available options
 * @returns hash string
 */
export function createHashFromBuffer(
    buffer: Buffer,
    options?: HashOptions
): string {
    const hashOptions = options ?? {
        algorithm: 'md5',
        length: 8
    }
    return createHash(hashOptions.algorithm)
            .update(buffer)
            .digest('hex')
            .slice(0, hashOptions.length);
}

/**
 * Hashes the content of a file.
 * @param filePath - Path to the file
 * @param options - Hashing options
 * @returns hash string
 * @remarks the hash depends entirely on the buffer obtained from the file
 */
export function createHashFromFile(
    filePath: string, 
    options?: HashOptions
): string {
    const buffer = fs.readFileSync(filePath);
    return createHashFromBuffer(buffer,options);
}

/**
 * Hashes the content of a file and adds it to its name before the extension.
 * @param filePath - Path to the file
 * @param options - Hashing options:
 * see {@link HashOptions} interface for the list of available options
 * @returns new file path with hashing
 * @see {@link createHashFromFile} for the function that creates the hash
 */
export default function hashFile(
    filePath: string, 
    options?: HashOptions
): string {
    const hash = createHashFromFile(filePath, options);
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath); 
    const name = path.basename(filePath, ext);
    
    const hashedPath = path.join(dir, `${name}.${hash}${ext}`);
    fs.renameSync(filePath,hashedPath);
    return hashedPath;
}