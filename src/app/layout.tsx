import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#b32656",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Polyglot Reader — Graded Chinese & Japanese Reading and Listening",
  description:
    "Immerse yourself in graded East Asian reading and natural neural audio narration. Featuring 206 stories across Mandarin (HSK 1–6) and Japanese (JLPT N5–N1) with interactive ruby annotations and lexical lookups.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PolyglotReader",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col font-roboto antialiased">
        {children}
      </body>
    </html>
  );
}
