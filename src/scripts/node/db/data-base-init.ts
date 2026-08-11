import z from "zod";
import type { DataBaseInit } from "./data-base.js";



export const DBDataInitSchemas: DataBaseInit = {

    MOD_: {
        name: z.string()
    }

} as const;