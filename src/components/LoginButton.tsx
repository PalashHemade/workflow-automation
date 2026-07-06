"use client";

import React from "react";
import { signIn } from "next-auth/react";
import { Github } from "lucide-react";

export default function LoginButton() {
  return (
    <button
      onClick={() => signIn("github")}
      className="group relative flex items-center justify-center gap-2.5 rounded-xl bg-white text-black hover:bg-slate-100 px-6 py-3.5 font-semibold transition duration-200 shadow-[0_0_30px_-5px_rgba(99,102,241,0.5)] hover:scale-[1.02] active:scale-[0.98]"
    >
      <Github className="h-5 w-5 fill-current" />
      Connect GitHub Account
    </button>
  );
}
