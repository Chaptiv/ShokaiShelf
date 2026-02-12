/**
 * i18n completeness test
 * Ensures de.json has every key that en.json has (no untranslated strings).
 */
import { describe, it, expect } from "vitest";
import en from "./en.json";
import de from "./de.json";

function flatKeys(obj: Record<string, any>, prefix = ""): string[] {
    let keys: string[] = [];
    for (const k of Object.keys(obj)) {
        const full = prefix ? `${prefix}.${k}` : k;
        if (typeof obj[k] === "object" && obj[k] !== null) {
            keys = keys.concat(flatKeys(obj[k], full));
        } else {
            keys.push(full);
        }
    }
    return keys;
}

describe("i18n completeness", () => {
    const enKeys = flatKeys(en);
    const deKeys = new Set(flatKeys(de));

    it("de.json contains every key that en.json has", () => {
        const missing = enKeys.filter((k) => !deKeys.has(k));
        expect(missing).toEqual([]);
    });
});
