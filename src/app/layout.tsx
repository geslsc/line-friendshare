import type { Metadata } from "next";

import "./globals.css";

const publicBaseUrl = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL;

export const metadata: Metadata = {
  title: "LINE 推薦好友工具",
  description: "LINE 推薦好友分享頁 MVP",
  ...(publicBaseUrl ? { metadataBase: new URL(publicBaseUrl) } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
