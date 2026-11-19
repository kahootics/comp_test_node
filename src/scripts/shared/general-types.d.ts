import type { FormatEnum } from "sharp";

export type pathString = Brand<string, 'PathString'>;

export type Brand<T, B extends string> = T & {
    readonly __brand: B;
};

export type hashString = Brand<string, "HashString">;
export type directoryString = Brand<string, "DirectoryString">;

export type nameString = Brand<string,'NameString'>;
/** {@link FormatEnum} */
export type extType = keyof FormatEnum;
