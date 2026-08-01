import { glob } from "glob/raw";
import path from "node:path";
import type z from "zod";
import { type RuleConstructor, Rule, ruleConstructorStaticShape, type zobject } from "./rule.js";
import { extendsClass } from "../../../tools/encapsulation.js";
import { pathToFileURL } from "node:url";
import type { ZodError } from "zod";
import { ValidationError } from "../../../errors/common-errors.mjs";

// Fetch all available rule classes ===================================================
/**
 * Helper function that searches for `Rule` class concrete derivates within a given folder
 * and returns said classes along with their static properties.
 * 
 * @param rulesDir - Directory where the rule classes are to be searched (file-name must end with -rule.{ts,js,mjs}*).
 * @returns a promise containing (all results are sorted 
 * according to the Rules' `priority` static property):
 * * **`allRuleClassesMap`** a `Map<string, RuleConstructor>` that associates
 * each Rule's `ownName` static property with the class constructor
 * * **`rulesetSchema`** an object that associates each Rule's `ownName` 
 * static property with their `schema` static property
 * 
 * @throws {ValidationError} If a rule module does not export exactly 1 `Rule` class derivate
 * @throws {ZodError} If a rule class is missing any property from its interface
 * 
 * @remarks
 * If a class does not extend `Rule`, then it is not considered;   
 * you can export any number of classes or functions from a rule module,
 * but only one can extend `Rule`.
 */
export async function buildRuleRegistry(rulesDir: string) {

    const pattern = path.join(path.resolve(rulesDir), "*-rule.{ts,js,mjs}")
        .split(path.sep).join('/');

    const allRulesClassesPaths = await glob(pattern);

    const allRuleClassModules = await Promise.all(
        allRulesClassesPaths.map(
            async modulePath => {
                return {
                    path: modulePath,
                    module: await import(pathToFileURL(path.resolve(modulePath)).href)
                }
            }
        ));

    /** Set of all the `Rule` *concrete* derivates. */
    const allRuleClasses = new Set<RuleConstructor>();

    for (const { path, module } of allRuleClassModules) {
        const exportEntries = Object.entries(module as any as Record<string, unknown>);
        const ruleClassesExports = exportEntries
            .map(([, v]) => v)
            // verifies it is a function
            .filter(v => typeof v === 'function')
            // verifies it is a derivate of `Rule`
            .filter(v => extendsClass(v, Rule))
            // check if static properties are actually implemented
            .map(v => ruleConstructorStaticShape.parse(v));

        if (ruleClassesExports.length > 1)
            throw new ValidationError(`Rule module at ${path} exports more than one rule class`);
        if (ruleClassesExports.length < 1)
            throw new ValidationError(`Rule module at ${path} exports no rule class, but its name indicates that it does`);

        allRuleClasses.add(ruleClassesExports[0]!);
    }

    const a = [...allRuleClasses]

    const allRuleClassesMap = new Map<
        RuleConstructor['ownName'],
        RuleConstructor
    >([...allRuleClasses]
        .sort((a, b) => a.priority - b.priority)
        .map(ruleClass => [ruleClass.ownName, ruleClass]));

    const rulesetSchema: { [className: RuleConstructor['ownName']]: z.ZodOptional<zobject>; } = {};
    allRuleClasses.forEach(ruleClass => {
        rulesetSchema[ruleClass.ownName] = ruleClass.schema.optional();
    });
    return { allRuleClassesMap, rulesetSchema };
}

const { allRuleClassesMap, rulesetSchema } = await buildRuleRegistry(path.resolve("./rules"));
export { allRuleClassesMap, rulesetSchema };