import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://frdteknikelektro.github.io/farid-inawan.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Farid Inawan",
  description:
    "Personal site of Farid Inawan — an interactive particle intro that morphs a globe through to the text as you scroll.",
  authors: [{ name: "Farid Inawan" }],
  keywords: ["Farid Inawan", "portfolio", "three.js", "particles", "Next.js"],
  openGraph: {
    title: "Farid Inawan",
    description:
      "Personal site of Farid Inawan — an interactive particle intro built with three.js.",
    url: siteUrl,
    siteName: "Farid Inawan",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Farid Inawan",
    description:
      "Personal site of Farid Inawan — an interactive particle intro built with three.js.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
