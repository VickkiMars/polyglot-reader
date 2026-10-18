"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Headphones } from "lucide-react";
import { Lesson } from "@/types";

interface LessonCardProps {
  lesson: Lesson;
}

export default function LessonCard({ lesson }: LessonCardProps) {
  // Use local downloaded image if exists, else original
  const imageSrc = lesson.localImage
    ? `/${lesson.localImage.replace(/^public\//, "")}`
    : lesson.originalImage;

  return (
    <article className="group bg-white rounded-lg border border-[#f0f0f0] overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        <Image
          src={imageSrc}
          alt={lesson.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-xs text-white p-1.5 rounded-full">
          <Headphones className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 flex flex-col flex-grow justify-between">
        <div>
          <h3 className="font-montserrat font-medium text-[16px] leading-snug text-[#707d82] group-hover:text-[#cc3366] transition-colors mb-2">
            <Link href={lesson.link} className="hover:underline">
              {lesson.title}
            </Link>
          </h3>
        </div>

        {/* Meta badges */}
        <div className="pt-2 border-t border-gray-50 flex items-center justify-between text-xs text-[#7a7a7a] font-roboto">
          <div className="flex flex-wrap gap-1.5 items-center">
            {lesson.meta.map((tag, idx) => (
              <span
                key={idx}
                className="inline-block px-2 py-0.5 bg-gray-100 rounded text-[11px] font-medium text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-[#cc3366] font-medium">Free</span>
        </div>
      </div>
    </article>
  );
}
