import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NimiqEarn Quest",
  description:
    "Complete quests in Telegram. Submit proof. Get verified. Earn NIM.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
