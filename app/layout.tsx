import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

export const metadata: Metadata = {
  title: "Bubinga Market Scanner",
  description: "MAトレンドと3指標で、今見るべき銘柄を最大5件に絞り込むマーケットスキャナー。",
  manifest: "/manifest.webmanifest",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#07110d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
