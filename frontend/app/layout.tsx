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

// Runs synchronously before first paint to apply stored font prefs without
// a flash. Values must stay in sync with the maps in FontPrefsProvider.tsx.
const FONT_INIT_SCRIPT = `(function(){try{
  var p=JSON.parse(localStorage.getItem('lumen-font-prefs')||'{}');
  var r=document.documentElement;
  var ff={cardo:"var(--font-cardo),Georgia,serif",lora:"var(--font-lora),Georgia,serif",garamond:"var(--font-garamond),'EB Garamond',Garamond,serif",baskerville:"var(--font-baskerville),'Libre Baskerville',Georgia,serif",georgia:"Georgia,'Times New Roman',serif",inter:"var(--font-inter),system-ui,sans-serif"};
  var fs={sm:'13.5px',md:'14.5px',lg:'16.5px',xl:'19px'};
  var lh={compact:'1.70',normal:'1.95',relaxed:'2.25'};
  var ls={tight:'-0.01em',normal:'0em',loose:'0.025em'};
  var fw={regular:'400',medium:'500'};
  if(ff[p.fontFamily])r.style.setProperty('--reading-font',ff[p.fontFamily]);
  if(fs[p.fontSize])r.style.setProperty('--reading-size',fs[p.fontSize]);
  if(lh[p.lineHeight])r.style.setProperty('--reading-leading',lh[p.lineHeight]);
  if(ls[p.letterSpacing])r.style.setProperty('--reading-tracking',ls[p.letterSpacing]);
  if(fw[p.fontWeight])r.style.setProperty('--reading-weight',fw[p.fontWeight]);
}catch(e){}})();`;

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
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: FONT_INIT_SCRIPT }} />
      </head>
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
