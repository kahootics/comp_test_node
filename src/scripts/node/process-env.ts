
/**
 * Indicates whether the process occurring is for a 
 * site-build or for the developer environment.
 */
export const isBuild = process.env.BUILD === 'true';
/**
 * Indicates whether the process occurring is for a 
 * site-build or for the developer environment.
 */
export const isDev = !isBuild;

//export const isTsx = process.env.TSX === 'true';