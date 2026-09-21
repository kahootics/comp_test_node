import { describe, it, expect } from "vitest";
import { dictionayResolver } from "../src/tools/dictionary-resolver.mjs"; // adatta il percorso

describe("dictionayResolver - resolve", () => {
    it("replaces a single occurrence of a dictionary term", () => {
        const resolve = dictionayResolver("@", { house: "villa" });
        expect(resolve("I'll go to my @house")).toBe("I'll go to my villa");
    });

    it("replaces multiple occurrences of different terms in a single run", () => {
        const resolve = dictionayResolver("@", { cat: "dog", red: "blue", house: "villa" });
        expect(resolve("The @red @cat is in the @house")).toBe("The blue dog is in the villa");
    });

    it("replaces multiple occurrences of the same term in a single run", () => {
        const resolve = dictionayResolver("@", { house: "villa" });
        expect(resolve("@house then @house")).toBe("villa then villa");
    });

    it("returns the text unchanged if no occurrence of dictionary terms was found", () => {
        const resolve = dictionayResolver("@", { house: "villa" });
        expect(resolve("Nothing to see here")).toBe("Nothing to see here");
        expect(resolve("unprefixed house")).toBe("unprefixed house");
    });

    it("only replaces whole words", () => {
        const resolve = dictionayResolver("@", { mate: "friend" });
        expect(resolve("@classmate is @mate")).toBe("@classmate is friend");
    });

    it("empty prefix is accepted", () => {
        const resolve = dictionayResolver("", { house: "villa" });
        expect(resolve("house househouse à là house.")).toBe("villa househouse à là villa.");
    });

    it("handles special characters in the prefix and dictionary terms", () => {
        const resolve = dictionayResolver("$", { "a.b": "X", "c+d": "Y" });
        expect(resolve("$a.b e $c+d")).toBe("X e Y");
        expect(resolve("$aXb")).toBe("$aXb");
    });

    it("when the dictionary composes of derivate terms, prefers replacing the longest terms first", () => {
        const resolve = dictionayResolver("@", { house: "villa", "house.nova": "castle" });
        expect(resolve("@house.nova and @house")).toBe("castle and villa");
    });

    it("replaces only once (if a replaced result is replaceable, it won't be", () => {
        const resolve = dictionayResolver("@", { a: "@b", b: "@c" });
        expect(resolve("@a")).toBe("@b");
    });

    it("empty replacers are accepted", () => {
        const resolve = dictionayResolver("@", { house: "" });
        expect(resolve("I'll go to my @house!")).toBe("I'll go to my !");
    });

    it("replaces the terms litterally", () => {
        const resolve = dictionayResolver("@", { price: "$&100" });
        expect(resolve("@price")).toBe("$&100");
    });

    it("empty dictionary throws", () => {
        expect(() => dictionayResolver("@", {})).toThrow();
    });

    it("can be used multiple times", () => {
        const resolve = dictionayResolver("@", { house: "villa" });
        expect(resolve("@house")).toBe("villa");
        expect(resolve("@house")).toBe("villa");
        expect(resolve("other @house")).toBe("other villa");
    });
});