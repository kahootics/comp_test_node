import { describe, test, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRuleRegistry } from '../../src/scripts/node/sharp/rule-registry.js';

/** Relative path from within the rules. */
const RULE_MODULE_URL = '"../rule.js"';

const IMPORTS = `import { AssetRule } from ${RULE_MODULE_URL};` + 'import { z } from "zod";'

const tempDirs: string[] = [];

function makeTempRulesDir(): string {
    const dir = fs.mkdtempSync(
        path.join('src/scripts/node/sharp', '.tmp-rules-')
    );
    tempDirs.push(dir);
    return dir;
}

function writeFixture(dir: string, filename: string, source: string) {
    fs.writeFileSync(path.join(dir, filename), source, 'utf-8');
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('buildRuleRegistry', () => {
    test('returns empty results for a directory with no matching rule files', async () => {
        const dir = makeTempRulesDir();

        const { allRuleClassesMap, rulesetSchema } = await buildRuleRegistry(dir);

        expect(allRuleClassesMap.size).toBe(0);
        expect(rulesetSchema).toEqual({});
    });

    test('registers a single valid rule module', async () => {
        const dir = makeTempRulesDir();
        writeFixture(dir, 'good-rule.mjs', `
            ${IMPORTS}
            export class GoodRule extends AssetRule {
                static ownName = "GoodRule";
                static schema = z.object({});
                static priority = 3;
                enforce(asset, sharpAsset) { return sharpAsset; }
            }
        `);

        expect(fs.existsSync(path.join(dir, 'good-rule.mjs'))).toBe(true);


        const module = await import(pathToFileURL(path.join(dir, 'good-rule.mjs')).href);
        expect(module.GoodRule.ownName).toBe("GoodRule");

        const { allRuleClassesMap, rulesetSchema } = await buildRuleRegistry(pathToFileURL(dir).href);

        expect([...allRuleClassesMap.keys()]).toEqual(['GoodRule']);
        expect(allRuleClassesMap.get('GoodRule')?.priority).toBe(3);
        expect(rulesetSchema).toHaveProperty('GoodRule');
    });

    test('orders registered classes by ascending priority, regardless of file discovery order', async () => {
        const dir = makeTempRulesDir();
        writeFixture(dir, 'low-rule.mjs', `
            ${IMPORTS}
            export class LowPriorityRule extends AssetRule {
                static ownName = "LowPriorityRule";
                static schema = z.object({});
                static priority = 9;
                enforce(asset, sharpAsset) { return sharpAsset; }
            }
        `);
        writeFixture(dir, 'high-rule.mjs', `
            ${IMPORTS}
            export class HighPriorityRule extends AssetRule {
                static ownName = "HighPriorityRule";
                static schema = z.object({});
                static priority = 1;
                enforce(asset, sharpAsset) { return sharpAsset; }
            }
        `);

        const { allRuleClassesMap } = await buildRuleRegistry(dir);

        expect([...allRuleClassesMap.keys()]).toEqual(['HighPriorityRule', 'LowPriorityRule']);
    });

    test('rejects a module that exports no rule class', async () => {
        const dir = makeTempRulesDir();
        writeFixture(dir, 'empty-rule.mjs', `
            export function notARule() {}
        `);

        await expect(buildRuleRegistry(dir)).rejects.toThrow(/exports no rule class/);
    });

    test('rejects a module that exports more than one rule class', async () => {
        const dir = makeTempRulesDir();
        writeFixture(dir, 'double-rule.mjs', `
            ${IMPORTS}
            export class FirstRule extends AssetRule {
                static ownName = "FirstRule";
                static schema = z.object({});
                static priority = 2;
                enforce(asset, sharpAsset) { return sharpAsset; }
            }
            export class SecondRule extends AssetRule {
                static ownName = "SecondRule";
                static schema = z.object({});
                static priority = 2;
                enforce(asset, sharpAsset) { return sharpAsset; }
            }
        `);

        await expect(buildRuleRegistry(dir)).rejects.toThrow(/exports more than one rule class/);
    });

    test('rejects a rule class missing a required static property', async () => {
        const dir = makeTempRulesDir();
        writeFixture(dir, 'incomplete-rule.mjs', `
            ${IMPORTS}
            export class IncompleteRule extends AssetRule {
                static ownName = "IncompleteRule";
                //static schema = z.object({});
                // deliberately missing static priority
                enforce(asset, sharpAsset) { return sharpAsset; }
            }
        `);

        await expect(buildRuleRegistry(dir)).rejects.toThrow();
    });
});