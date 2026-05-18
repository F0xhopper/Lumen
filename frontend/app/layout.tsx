import type { Metadata } from "next";
import { Inter, Cardo } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const cardo = Cardo({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-cardo",
});

export const metadata: Metadata = {
  title: "Lumen — Summa Theologica",
  description: "Study the Summa Theologica of St. Thomas Aquinas with AI-powered search and retrieval",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${cardo.variable}`}>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
