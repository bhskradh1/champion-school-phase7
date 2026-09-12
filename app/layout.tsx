import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Champion English School",
  description: "School management portal — Dharan-15, Sunsari"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}