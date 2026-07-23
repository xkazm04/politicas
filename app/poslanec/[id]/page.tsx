import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProfilePage from "@/features/profile/ProfilePage";
import { MPS } from "@/lib/civic/data";
import { czech } from "@/lib/format";

export function generateStaticParams() {
  return MPS.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const mp = MPS.find((m) => m.id === id);
  if (!mp) return { title: "Politicas — spis nenalezen" };
  return {
    title: `${mp.name} — spis č. ${mp.rank} · Politicas`,
    description: `Kompozitní skóre ${czech(mp.score)}/100 (${mp.party}, ${mp.region}): pilíře, jmenovitá hlasování a doložené peněžní vazby. Každé číslo cituje svůj otevřený zdroj.`,
  };
}

export default async function PoslanecPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mp = MPS.find((m) => m.id === id);
  if (!mp) notFound();
  return <ProfilePage mp={mp} />;
}
