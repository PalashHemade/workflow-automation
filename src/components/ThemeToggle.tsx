"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    // Sync local state with document class on mount
    const isLight = !document.documentElement.classList.contains("dark");
    setTheme(isLight ? "light" : "dark");
  }, []);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setTheme("light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    }
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 shadow-sm transition-all duration-200 hover:scale-105 active:scale-95"
    >
      <div className="relative h-4.5 w-4.5 flex items-center justify-center overflow-hidden">
        {theme === "dark" ? (
          <Sun className="h-4.5 w-4.5 text-amber-400 rotate-0 scale-100 transition-all duration-300" />
        ) : (
          <Moon className="h-4.5 w-4.5 text-indigo-500 rotate-0 scale-100 transition-all duration-300" />
        )}
      </div>
    </button>
  );
}
