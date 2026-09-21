import { describe, expect, test, vi } from "vitest";
import { allRuleClassesMap, rulesetSchema } from "../../../src/scripts/node/sharp/rule-registry";

vi.mock('../../../src/scripts/node/env.js', () => ({ 
    isTsx: 'true'
 }))

describe('mammt', () => {
    test('è troia', () => {
expect(allRuleClassesMap.size).toBe(5)

    })
})