
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