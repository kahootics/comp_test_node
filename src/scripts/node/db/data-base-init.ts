import z from "zod";
import type { DataBaseInit } from "./data-base.js";



export const DBDataInitSchemas: DataBaseInit = {

    MOD_: {
        name: z.string().nullable(),
        oo: z.array(z.object({
            z: z.array(z.string())
        }))
    }

} as const;