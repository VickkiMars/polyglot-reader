"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled runtime error captured by boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--md-sys-color-surface)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--md-sys-color-surface-container-low)] rounded-3xl p-6 sm:p-8 shadow-lg text-center flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] flex items-center justify-center mb-5">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold font-montserrat text-[var(--md-sys-color-on-surface)] mb-2">
          Unable to display page
        </h1>

        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] leading-relaxed mb-6">
          An unexpected issue occurred while rendering this view. You can reload the reader or return to the main library.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <button
            onClick={() => reset()}
            className="w-full sm:flex-1 py-3 px-5 rounded-full font-medium text-sm bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <a
            href="/"
            className="w-full sm:flex-1 py-3 px-5 rounded-full font-medium text-sm bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </a>
        </div>
      </div>
    </div>
  );
}
