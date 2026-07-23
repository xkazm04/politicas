"use client";

/**
 * @catalog Červená linka, která se dokreslí při scrollu — pravítko sekce.
 *
 * Jednorázová entry animace (scaleX 0→1, once), gated přes viewport.
 * Sutnarovský podpis vítězné výtvarné řeči.
 */

import { motion } from "framer-motion";

export default function SectionRule({ className = "" }: { className?: string }) {
  return (
    <motion.div
      aria-hidden
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={`h-1.5 origin-left bg-signal ${className}`}
    />
  );
}
