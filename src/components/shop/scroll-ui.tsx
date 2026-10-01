"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollUi() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = docHeight > 0 ? Math.min(1, scrollTop / docHeight) : 0;
      setProgress(ratio * 100);
      setVisible(scrollTop > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="fixed top-0 inset-x-0 h-[3px] z-[60] pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-[#C9A961] to-[#E8D5A3] transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <button
        type="button"
        aria-label="Retour en haut de page"
        onClick={scrollToTop}
        className={`fixed right-4 sm:right-6 bottom-20 lg:bottom-6 z-40 w-11 h-11 rounded-full bg-black text-[#C9A961] shadow-lg flex items-center justify-center transition-all duration-300 ${
          visible
            ? "opacity-100"
            : "opacity-0 pointer-events-none translate-y-2"
        }`}
      >
        <ArrowUp className="w-5 h-5" aria-hidden="true" />
      </button>
    </>
  );
}
