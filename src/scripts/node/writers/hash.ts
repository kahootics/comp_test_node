import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface HashOptions {
    algorithm: string,
    length: number
}

/**
 * Hashes a buffer directly.
 * @param buffer - Buffer to hash
 * @param options - Hashing options:
 * @param options.algorithm - Hashing algorithm (defaults to `md5`)
 * @param options.length - Length of the hash (defaults to 8)
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
 */
export function createHashFromFile(
    filePath: string, 
    options?: HashOptions
): string {
    const buffer = fs.readFileSync(filePath);
    return createHashFromBuffer(buffer,options);
}

/**
 * Hashes the content of a file and renames it.
 * @param filePath - Path to the file
 * @param options - Hashing options
 * @returns new file path with hashing
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