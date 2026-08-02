import type sharp from "sharp";
export interface Openable {
    open(): void;
}
export interface Showable {
    show(): void;
}
export interface HasOpen {
    open: boolean;
}
export interface Closeable {
    close(): void;
}


export type pathString = Brand<string, 'PathString'>;

export type Brand<T, B extends string> = T & {
    readonly __brand: B;
};

export type hashString = Brand<string, "HashString">;
export type directoryString = Brand<string, "DirectoryString">;

export type nameString = Brand<string,'NameString'>;

export type extType = keyof sharp.FormatEnum;