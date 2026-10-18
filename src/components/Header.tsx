"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const toggleDropdown = (name: string) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#f0f0f0] shadow-xs">
      <div className="max-w-[1200px] mx-auto px-4 h-[80px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/images/logo.png"
            alt="Mandarin Bean"
            width={180}
            height={48}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-1 font-montserrat text-[15px] font-medium text-[#2a302f]">
          <Link
            href="/"
            className="px-3.5 py-6 hover:text-[#cc3366] transition-colors"
          >
            Home
          </Link>

          {/* All Lessons Dropdown */}
          <div className="relative group">
            <Link
              href="/all-lessons/?jsf=epro-loop-builder&tax=category:3"
              className="flex items-center gap-1 px-3.5 py-6 text-[#cc3366] hover:text-[#cc3366] transition-colors"
            >
              All Lessons
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" />
            </Link>
            <div className="absolute left-0 top-[76px] hidden group-hover:block w-48 bg-white border border-[#f0f0f0] rounded-sm shadow-lg py-2 z-50">
              <Link
                href="/all-lessons/?jsf=epro-loop-builder&tax=category:3"
                className="block px-4 py-2 text-sm text-[#cc3366] font-semibold bg-[#fdf2f5]"
              >
                Beginner
              </Link>
              <Link
                href="/all-lessons/?jsf=epro-loop-builder&tax=category:4"
                className="block px-4 py-2 text-sm text-[#707d82] hover:text-[#cc3366] hover:bg-gray-50"
              >
                Intermediate
              </Link>
              <Link
                href="/all-lessons/?jsf=epro-loop-builder&tax=category:5"
                className="block px-4 py-2 text-sm text-[#707d82] hover:text-[#cc3366] hover:bg-gray-50"
              >
                Advanced
              </Link>
            </div>
          </div>

          {/* Grammar Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-3.5 py-6 hover:text-[#cc3366] transition-colors cursor-pointer">
              Grammar
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" />
            </button>
            <div className="absolute left-0 top-[76px] hidden group-hover:block w-64 bg-white border border-[#f0f0f0] rounded-sm shadow-lg py-2 z-50">
              <Link
                href="/grammar-points/"
                className="block px-4 py-2 text-sm text-[#707d82] hover:text-[#cc3366] hover:bg-gray-50"
              >
                All Grammar Points with Exercises
              </Link>
              <Link
                href="/chinese-grammar-test/"
                className="block px-4 py-2 text-sm text-[#707d82] hover:text-[#cc3366] hover:bg-gray-50"
              >
                Grammar Level Tests
              </Link>
            </div>
          </div>

          {/* Test Prep Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-3.5 py-6 hover:text-[#cc3366] transition-colors cursor-pointer">
              Test Prep
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" />
            </button>
            <div className="absolute left-0 top-[76px] hidden group-hover:block w-48 bg-white border border-[#f0f0f0] rounded-sm shadow-lg py-2 z-50">
              <Link
                href="/hsk-chinese-test-online/"
                className="block px-4 py-2 text-sm text-[#707d82] hover:text-[#cc3366] hover:bg-gray-50"
              >
                HSK Sample Tests
              </Link>
              <Link
                href="/online-yct-sample-tests/"
                className="block px-4 py-2 text-sm text-[#707d82] hover:text-[#cc3366] hover:bg-gray-50"
              >
                YCT Sample Tests
              </Link>
            </div>
          </div>

          {/* More Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-3.5 py-6 hover:text-[#cc3366] transition-colors cursor-pointer">
              More
              <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" />
            </button>
            <div className="absolute left-0 top-[76px] hidden group-hover:block w-52 bg-white border border-[#f0f0f0] rounded-sm shadow-lg py-2 z-50">
              <Link
                href="/pinyin/"
                className="block px-4 py-2 text-sm text-[#707d82] hover:text-[#cc3366] hover:bg-gray-50"
              >
                Pinyin Practice
              </Link>
              <Link
                href="/category/confusing-words/"
                className="block px-4 py-2 text-sm text-[#707d82] hover:text-[#cc3366] hover:bg-gray-50"
              >
                Confusing Chinese Words
              </Link>
            </div>
          </div>

          <Link
            href="/premium-service/"
            className="px-3.5 py-6 hover:text-[#cc3366] transition-colors"
          >
            Pricing
          </Link>

          <Link
            href="/login/"
            className="ml-2 px-4 py-2 rounded-sm border border-[#cc3366] text-[#cc3366] hover:bg-[#cc3366] hover:text-white transition-all text-sm font-semibold"
          >
            Login
          </Link>
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 text-[#2a302f] hover:text-[#cc3366] focus:outline-none"
          aria-label="Toggle Navigation"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 font-montserrat text-sm shadow-lg">
          <Link href="/" className="block py-2 text-[#2a302f]">
            Home
          </Link>
          <div>
            <button
              onClick={() => toggleDropdown("lessons")}
              className="flex justify-between items-center w-full py-2 text-[#cc3366] font-semibold"
            >
              All Lessons <ChevronDown className="w-4 h-4" />
            </button>
            {activeDropdown === "lessons" && (
              <div className="pl-4 py-2 space-y-2 border-l-2 border-[#cc3366]">
                <Link href="#" className="block text-[#cc3366]">Beginner</Link>
                <Link href="#" className="block text-gray-600">Intermediate</Link>
                <Link href="#" className="block text-gray-600">Advanced</Link>
              </div>
            )}
          </div>
          <Link href="/premium-service/" className="block py-2 text-[#2a302f]">
            Pricing
          </Link>
          <Link
            href="/login/"
            className="block text-center py-2 border border-[#cc3366] text-[#cc3366] rounded-sm font-semibold"
          >
            Login
          </Link>
        </div>
      )}
    </header>
  );
}
