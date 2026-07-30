/**
 * RuleTester coverage for rules/enforce-reduced-motion-fallback.cjs.
 *
 * Run: `node packages/eslint-plugin-civic-transparency/__tests__/enforce-reduced-motion-fallback.test.mjs`
 */

import { RuleTester } from "eslint";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rule = require("../rules/enforce-reduced-motion-fallback.cjs");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("enforce-reduced-motion-fallback", rule, {
  valid: [
    {
      name: "one-shot entry animation never repeats",
      code: `import { motion } from "framer-motion";
             export const X = () => <motion.div animate={{ opacity: 1 }} transition={{ duration: 0.3 }} />;`,
    },
    {
      name: "looping animation gated by useReducedMotion in the same component",
      code: `import { motion, useReducedMotion } from "framer-motion";
             export function Pulse() {
               const reduced = useReducedMotion();
               return <motion.div animate={reduced ? {} : { scale: [1, 1.1, 1] }} transition={{ repeat: Infinity }} />;
             }`,
    },
    {
      name: "fallback at component top gates a loop inside a map callback",
      code: `import { motion, useReducedMotion } from "framer-motion";
             export function List({ items }) {
               const prefersReducedMotion = useReducedMotion();
               return <div>{items.map((i) => <motion.span key={i} animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity }} />)}</div>;
             }`,
    },
    {
      name: "reduced-motion-ok annotation on the line above",
      code: `import { motion } from "framer-motion";
             export const X = () => (
               // reduced-motion-ok: decorative 2px shimmer, imperceptible loop
               <motion.div animate={{ opacity: [0.6, 1] }} transition={{ repeat: Infinity }} />
             );`,
    },
    {
      name: "repeat: 0 is not a loop",
      code: `import { motion } from "framer-motion";
             export const X = () => <motion.div animate={{ x: 4 }} transition={{ repeat: 0 }} />;`,
    },
    {
      name: "non-motion element with repeat-shaped props is out of scope",
      code: `export const X = () => <Widget animate={{ x: 4 }} transition={{ repeat: 3 }} />;`,
    },
  ],
  invalid: [
    {
      name: "looping transition with no fallback in the file",
      code: `import { motion } from "framer-motion";
             export const X = () => <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity }} />;`,
      errors: [{ messageId: "missingFallback" }],
    },
    {
      name: "repeat nested inside the animate object itself",
      code: `import { motion } from "framer-motion";
             export const X = () => <motion.div animate={{ opacity: [0, 1], transition: { repeat: 2 } }} />;`,
      errors: [{ messageId: "missingFallback" }],
    },
    {
      name: "m.* alias is still a motion element",
      code: `import { m } from "framer-motion";
             export const X = () => <m.span animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity }} />;`,
      errors: [{ messageId: "missingFallback" }],
    },
    {
      name: "one component's fallback does not exempt a sibling component",
      code: `import { motion, useReducedMotion } from "framer-motion";
             export function Gated() {
               const reduced = useReducedMotion();
               return <motion.div animate={reduced ? {} : { scale: [1, 1.05, 1] }} transition={{ repeat: Infinity }} />;
             }
             export function Ungated() {
               return <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity }} />;
             }`,
      errors: [{ messageId: "missingFallback" }],
    },
  ],
});

console.log("PASS enforce-reduced-motion-fallback (RuleTester)");
