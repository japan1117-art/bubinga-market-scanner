import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bubinga Market Scanner",
  description: "MAトレンドと3指標で、今見るべき銘柄を最大5件に絞り込むマーケットスキャナー。",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
