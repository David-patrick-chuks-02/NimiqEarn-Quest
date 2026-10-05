import type { Metadata } from "next";
import { AdminShell } from "./_components/shell";

export const metadata: Metadata = {
  title: "Operations — NimiqEarn Quest",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
