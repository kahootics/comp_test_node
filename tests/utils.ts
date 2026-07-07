
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
