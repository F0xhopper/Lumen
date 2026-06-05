import type { Metadata, Viewport } from "next";
import { Inter, Cardo, Lora, EB_Garamond, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import QueryProvider from "@/components/QueryProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { FontPrefsProvider } from "@/components/FontPrefsProvider";

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

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-garamond",
  display: "swap",
});

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-baskerville",
  display: "swap",
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
      className={`${inter.variable} ${cardo.variable} ${lora.variable} ${ebGaramond.variable} ${libreBaskerville.variable}`}
      suppressHydrationWarning
    >
      <body className={`${inter.className} antialiased`}>
        <QueryProvider>
          <AuthProvider>
            <FontPrefsProvider>
              <ThemeProvider>{children}</ThemeProvider>
            </FontPrefsProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
