import z from "zod";
import { writeZodAsSchema } from "../writers/write-zod-as-schema.js";
import { rulesetSchema } from "../sharp/rule-registry.js";

export const writeRulesSchema = () => writeZodAsSchema('rules', z.object(rulesetSchema));
