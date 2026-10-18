import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chinese Reading and Listening Practice - Mandarin Bean",
  description: "Improve your Chinese reading and listening skills with graded stories, audio narrations, and vocabulary lists.",
  icons: {
    icon: "/images/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-white text-[#2a302f]">
        {children}
      </body>
    </html>
  );
}
