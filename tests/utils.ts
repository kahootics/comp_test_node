import { $stable } from "../src/scripts/node/sharp/tmp-rule";
import { directoryString, extType, hashString, nameString } from "../src/scripts/types/general-types";

/**
 * 
 * @param constructor - The Singleton Constructor 
 * @param instancePropertyName - Name of the property that 
 * returns the class singleton
 * when called (can be a getter)
 */
export function resetSingleton<S extends Object>(
    constructor: new (...args: any[]) => S, 
    instancePropertyName: string
) {
    (constructor as any)[instancePropertyName] = undefined;
}

export const asDir = (s: string) => s as directoryString & $stable;
export const asName = (s: string) => s as nameString;
export const asHash = (s: string) => s as hashString;
export const asExt = (s: string) => s as extType;