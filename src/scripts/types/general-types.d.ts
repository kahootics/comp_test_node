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

declare const PathSymbol: unique symbol;
export type pathString = string & { [PathSymbol]: void };

declare const HashSymbol: unique symbol;
export type hashString = string & { [HashSymbol]: void };

declare const DirectorySymbol: unique symbol;
export type directoryString = string & { [DirectorySymbol]: void }

declare const NameSymbol: unique symbol;
export type nameString = string & { [NameSymbol]: void }

export type extType = keyof sharp.FormatEnum;