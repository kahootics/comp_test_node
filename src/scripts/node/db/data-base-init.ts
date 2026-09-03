import z from "zod";
import type { DataBaseInit } from "./data-base.js";



export const DBDataInitSchemas = {

    MOD_: {
        name: z.string().nullable()
    }

} satisfies DataBaseInit;