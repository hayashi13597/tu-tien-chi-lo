import type { Metadata } from "next";
import { Be_Vietnam_Pro, Ma_Shan_Zheng, ZCOOL_XiaoWei } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const maShan = Ma_Shan_Zheng({
  variable: "--font-mashan",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const zcool = ZCOOL_XiaoWei({
  variable: "--font-zcool",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tu Tiên Chi Lộ — Đan Điền Pháp Trận",
  description: "Tu luyện & đột phá cảnh giới",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="vi"
      data-scroll-behavior="smooth"
      className={`${maShan.variable} ${zcool.variable} ${beVietnam.variable}`}
    >
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
