import type { Metadata } from "next";
import AdminPage from "@/features/admin/AdminPage";
import { getAdminData } from "@/features/admin/getAdminData";

// Static (no next-intl): this is a local-operator-only internal tool, not a
// localized public surface — see the boundary note in features/admin/.
export const metadata: Metadata = {
  title: "Admin · Politicas",
  description: "Interní přehled běhu case-loop analytiky (peníze/docházka/zákony) a fronty lidské revize.",
  robots: { index: false },
};

export default async function Admin() {
  const data = await getAdminData();
  return <AdminPage data={data} />;
}
