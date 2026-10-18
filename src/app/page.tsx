import React from "react";
import Header from "@/components/Header";
import LessonGrid from "@/components/LessonGrid";
import Footer from "@/components/Footer";
import lessonsData from "@/data/lessons.json";
import { Lesson } from "@/types";

export default function HomePage() {
  const lessons: Lesson[] = lessonsData as Lesson[];

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <LessonGrid initialLessons={lessons} />
      </main>
      <Footer />
    </div>
  );
}
