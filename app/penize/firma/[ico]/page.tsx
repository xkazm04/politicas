import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CompanyCaseFilePage from "@/features/money/CompanyCaseFilePage";
import { getCompanyDetail } from "@/features/money/getCompanyDetail";
import { canonicalIco } from "@/features/money/companyId";

/** The page asserts a signature-plausibility bound drawn against a DAY (contracts signed
 *  after "today" are data faults, not dates), so a build-frozen page would slowly start
 *  calling a real 2027 signature impossible. Same window as the other graph surfaces. */
export const revalidate = 86_400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ico: string }>;
}): Promise<Metadata> {
  const { ico } = await params;
  const canonical = canonicalIco(ico);
  return {
    title: `Spis firmy ${canonical ?? ico} · FollowTheMoney`,
    description:
      "Firma jako křižovatka grafu — všichni poslanci s vazbou na ni, jejich třída a stav kontroly, a smlouvy se státem.",
  };
}

export default async function CompanyCaseFileRoute({
  params,
}: {
  params: Promise<{ ico: string }>;
}) {
  const { ico: icoRaw } = await params;
  // A segment that cannot be an IČO at all is a genuine 404 — the loader's null is
  // reserved for "the graph has no such tie", which is a different sentence.
  if (!canonicalIco(icoRaw)) notFound();

  // ONE instant for the whole page (see lib/analysis/plausible-date.ts): reading the
  // clock inside the render would drift SSR against CSR.
  const todayIso = new Date().toISOString().slice(0, 10);
  const data = await getCompanyDetail(icoRaw, todayIso);
  return <CompanyCaseFilePage data={data} />;
}
