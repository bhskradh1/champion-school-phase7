import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";

/*
 * PERFORMANCE: fonts are downloaded once at build time and served from
 * your own domain. Before, globals.css used @import to Google Fonts, which
 * made every first page load wait for an extra 2-step network chain
 * (CSS file -> font files) before text could render.
 *
 * The CSS variables below are used in globals.css.
 */
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-dm",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Champion English School",
  description: "School management portal — Dharan-15, Sunsari"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
