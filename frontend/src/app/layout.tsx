import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "LaporUang - Pencatatan Keuangan Pintar",
  description: "Aplikasi fintech pencatatan keuangan premium, pembukuan dompet, dan analisis proyeksi kas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-[#090e17] text-[#f8fafc]">
        {children}
      </body>
    </html>
  );
}
