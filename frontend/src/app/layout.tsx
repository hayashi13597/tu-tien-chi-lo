import type { Metadata } from "next";
import {
  Be_Vietnam_Pro,
  Cormorant_Garamond,
  Ma_Shan_Zheng,
} from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const maShan = Ma_Shan_Zheng({
  variable: "--font-mashan",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Serif hiển thị cho các tiêu đề tiếng Việt. Ma Shan Zheng là font chữ Hán,
// không có glyph dấu tiếng Việt (ạ ộ ế ữ …) nên chữ Việt rơi về serif hệ thống
// trông rất lệch — Cormorant Garamond có subset "vietnamese", giữ được nét
// serif cổ điển mà dấu vẫn chuẩn. (ZCOOL XiaoWei — font Hán cũ dùng cho tiêu đề
// Việt — đã gỡ vì không còn chỗ nào cần tới nó.)
const cormorant = Cormorant_Garamond({
  variable: "--font-serif-vi",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
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
      className={`${maShan.variable} ${cormorant.variable} ${beVietnam.variable}`}
    >
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
