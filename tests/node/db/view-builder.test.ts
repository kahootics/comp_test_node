import z from "zod";
console.log(z.enum(['a','b']).refine(() => true).def.type);