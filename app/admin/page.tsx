import type { Metadata } from "next";
import AdminPage from "@/features/admin/AdminPage";
import { getAdminData } from "@/features/admin/getAdminData";
import { getLoopsDoc } from "@/features/admin/loops/getLoopState";
import AdminGate from "./AdminGate";
import { readAdminGate } from "./accessGate";

// Static (no next-intl): this is an operator-only internal tool, not a
// localized public surface — see the boundary note in features/admin/.
export const metadata: Metadata = {
  title: "Admin · Politicas",
  description: "Interní přehled běhu case-loop analytiky (peníze/docházka/zákony) a fronty lidské revize.",
  robots: { index: false },
};

export default async function Admin() {
  // Access first, data second: `getAdminData()` is the point where internal
  // state leaves the store, so nothing may await it before the gate says "ok".
  // `robots: { index: false }` above is a crawler request, not access control.
  const gate = await readAdminGate();
  if (gate !== "ok") return <AdminGate status={gate} />;

  const [data, loops] = await Promise.all([getAdminData(), getLoopsDoc()]);
  return <AdminPage data={data} loops={loops} />;
}
