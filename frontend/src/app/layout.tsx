import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tu Tiên Chi Lộ — Đan Điền Pháp Trận",
  description: "Tu luyện & đột phá cảnh giới",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
