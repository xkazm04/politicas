import type { Metadata } from "next";
import VariantRentgen from "@/features/labs/rentgen/VariantRentgen";

export const metadata: Metadata = {
  title: "Politicas/rentgen — investigativní důkazní terminál",
  description:
    "Archivní výtvarný směr Politicas: rentgen státu — graf peněžní stopy, auditní log a registr zdrojů.",
  robots: { index: false },
};

export default function RentgenPage() {
  return <VariantRentgen />;
}
