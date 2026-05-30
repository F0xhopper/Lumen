import type { Metadata, Viewport } from "next";
import { Inter, Cardo } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import QueryProvider from "@/components/QueryProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const cardo = Cardo({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-cardo",
});

export const metadata: Metadata = {
  title: "Lumen",
  description:
    "Study the Summa Theologica of St. Thomas Aquinas with AI-powered search and retrieval",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cardo.variable}`}
      suppressHydrationWarning
    >
      <body className={`${inter.className} antialiased`}>
        <QueryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
