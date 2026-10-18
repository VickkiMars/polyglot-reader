import React from "react";
import Link from "next/link";

const FOOTER_LINKS = [
  { text: "About", href: "/about/" },
  { text: "Blog", href: "/category/blog/" },
  { text: "New HSK Vocabulary", href: "/new-hsk-vocabulary/" },
  { text: "Help", href: "/help/" },
  { text: "Privacy Policy", href: "/privacy-policy/" },
  { text: "Terms of Use", href: "/terms-of-use/" },
];

export default function Footer() {
  return (
    <footer className="bg-[#2a302f] text-white py-12 px-4 mt-20">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center gap-6">
        {/* Navigation links */}
        <nav className="flex flex-wrap justify-center gap-6 text-sm font-montserrat text-[#a0aab0]">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.text}
              href={link.href}
              className="hover:text-white transition-colors"
            >
              {link.text}
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="w-full max-w-[600px] h-[1px] bg-gray-700/50" />

        {/* Copyright notice */}
        <p className="text-xs text-[#687379] font-roboto">
          &copy; {new Date().getFullYear()} Mandarin Bean. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
