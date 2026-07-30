/**
 * RuleTester coverage for rules/no-silent-null-catch.cjs.
 *
 * Run: `node packages/eslint-plugin-civic-transparency/__tests__/no-silent-null-catch.test.mjs`
 */

import { RuleTester } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rule = require("../rules/no-silent-null-catch.cjs");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

tester.run("no-silent-null-catch", rule, {
  valid: [
    {
      name: "fallback return preceded by reportLoaderFailure",
      code: `async function getData() {
        try { return await load(); }
        catch (err) { reportLoaderFailure("getData", err); return null; }
      }`,
    },
    {
      name: "empty-array fallback with reportLoaderFailure",
      code: `async function getRows() {
        try { return await load(); }
        catch (err) { reportLoaderFailure("getRows", err); return []; }
      }`,
    },
    {
      name: "catch that rethrows is out of scope",
      code: `try { load(); } catch (err) { throw err; }`,
    },
    {
      name: "catch returning a real value is not a silent degradation",
      code: `function f() { try { return load(); } catch (err) { return { error: String(err) }; } }`,
    },
    {
      name: "empty catch is the sibling rule's territory, not this one's",
      code: `try { load(); } catch {}`,
    },
    {
      name: "non-empty array return is not the fallback shape",
      code: `function f() { try { return load(); } catch { return [FALLBACK]; } }`,
    },
  ],
  invalid: [
    {
      name: "catch { return null } with no trace",
      code: `function f() { try { return load(); } catch { return null; } }`,
      errors: [{ messageId: "silentNullCatch" }],
    },
    {
      name: "catch { return [] } with no trace",
      code: `function f() { try { return load(); } catch { return []; } }`,
      errors: [{ messageId: "silentNullCatch" }],
    },
    {
      name: "prepended busywork does not bypass the scan",
      code: `function f() { try { return load(); } catch (err) { setLoading(false); return null; } }`,
      errors: [{ messageId: "silentNullCatch" }],
    },
    {
      name: "console.warn alone is not the loader-boundary trace",
      code: `function f() { try { return load(); } catch (err) { console.warn(err); return null; } }`,
      errors: [{ messageId: "silentNullCatch" }],
    },
  ],
});

console.log("PASS no-silent-null-catch (RuleTester)");
