import React from "react";
import "@/app/globals.css";
import { Providers } from "@/components/Providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GitInsight - Real-Time GitHub Analytics",
  description: "Track commits frequencies, pull request cycles, and contributor statistics in real-time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.theme === 'light') {
              document.documentElement.classList.remove('dark');
            } else {
              document.documentElement.classList.add('dark');
            }
          } catch (_) {}
        ` }} />
      </head>
      <body className="h-full bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-200 transition-colors duration-300">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
