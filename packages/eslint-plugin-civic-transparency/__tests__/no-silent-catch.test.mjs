/**
 * RuleTester coverage for rules/no-silent-catch.cjs.
 *
 * Run: `node packages/eslint-plugin-civic-transparency/__tests__/no-silent-catch.test.mjs`
 * (RuleTester throws AssertionError on the first failing case; a clean run
 * prints PASS — plain node, no runner dependency.)
 */

import { RuleTester } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rule = require("../rules/no-silent-catch.cjs");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

tester.run("no-silent-catch", rule, {
  valid: [
    {
      name: "catch that logs leaves a trace",
      code: `try { risky(); } catch (err) { console.warn("[ingest]", err); }`,
    },
    {
      name: "catch that rethrows is not silent",
      code: `try { risky(); } catch (err) { throw new Error("wrapped", { cause: err }); }`,
    },
    {
      name: "comment-only catch still counts as handled statements? no — but a real statement does",
      code: `try { risky(); } catch { fallback(); }`,
    },
    {
      name: "promise .catch with a handling body",
      code: `p.catch((err) => { console.warn("[sync]", err); });`,
    },
    {
      name: "promise .catch with an expression-body arrow is not an empty block",
      code: `p.catch((err) => console.warn("[sync]", err));`,
    },
    {
      name: "computed .catch access is not the promise idiom",
      code: `obj["catch"](() => {});`,
    },
    {
      name: "unrelated method named catchAll",
      code: `obj.catchAll(() => {});`,
    },
  ],
  invalid: [
    {
      name: "empty catch block",
      code: `try { risky(); } catch (err) {}`,
      errors: [{ messageId: "emptyCatch" }],
    },
    {
      name: "empty catch block without binding",
      code: `try { risky(); } catch {}`,
      errors: [{ messageId: "emptyCatch" }],
    },
    {
      name: "comment-only catch block is still empty",
      code: `try { risky(); } catch { /* deliberately ignored */ }`,
      errors: [{ messageId: "emptyCatch" }],
    },
    {
      name: "promise .catch(() => {}) swallows",
      code: `p.catch(() => {});`,
      errors: [{ messageId: "emptyCatch" }],
    },
    {
      name: "promise .catch(function () {}) swallows",
      code: `p.catch(function () {});`,
      errors: [{ messageId: "emptyCatch" }],
    },
  ],
});

console.log("PASS no-silent-catch (RuleTester)");
