import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import DashboardOverview from "@/components/DashboardOverview";
import LoginButton from "@/components/LoginButton";
import ThemeToggle from "@/components/ThemeToggle";
import { GitBranch, ShieldAlert, Cpu, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);

  // Render dashboard directly if authenticated
  if (session) {
    return <DashboardOverview />;
  }

  // Render premium OAuth landing page if unauthenticated
  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#020617] overflow-hidden flex flex-col justify-between transition-colors duration-500">
      {/* Background Decorative Glows */}
      <div className="absolute top-[-20%] left-[-10%] h-[700px] w-[700px] rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-[120px] pointer-events-none animate-pulse duration-10000" />
      <div className="absolute bottom-[-20%] right-[-10%] h-[700px] w-[700px] rounded-full bg-gradient-to-l from-violet-500/20 to-fuchsia-500/20 blur-[120px] pointer-events-none animate-pulse duration-10000" />
      <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-indigo-500/10 dark:bg-indigo-900/20 blur-[150px] pointer-events-none" />

      {/* Header bar */}
      <header className="border-b border-slate-200 dark:border-slate-900 bg-white/45 dark:bg-slate-950/45 backdrop-blur-md transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500">
              <GitBranch className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="font-bold text-md tracking-tight text-slate-950 dark:text-white">GitInsight</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">System Online</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero section */}
      <main className="flex-1 flex items-center justify-center py-16 px-6">
        <div className="max-w-3xl text-center space-y-8">
          {/* Tag */}

          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/40 px-3 py-1 text-xs text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Introducing Real-Time Repository Audits</span>
          </div>

          <div className="space-y-6 relative z-10">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Engineering Intelligence <br />
              <span className="bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-indigo-600 dark:from-indigo-400 dark:via-fuchsia-300 dark:to-indigo-400 bg-clip-text text-transparent animate-gradient-x">
                Delivered in Real-Time
              </span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Elevate your development workflow. Track commit frequencies, analyze pull request review cycles, and map contributor leaderboards instantly using our secure GitHub integration.
            </p>
          </div>

          {/* Connect Button container */}
          <div className="flex flex-col items-center justify-center gap-4">
            <LoginButton />
            <p className="text-[11px] text-slate-600 dark:text-slate-500 flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              Secured using official GitHub OAuth and SHA-256 signatures
            </p>
          </div>

          {/* Cards for Features */}
          <div className="grid gap-6 sm:grid-cols-3 pt-12 text-left relative z-10">
            <div className="rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-6 space-y-3 shadow-xl shadow-slate-200/20 dark:shadow-none hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-lg font-black shadow-inner">1</div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">Instant Sync</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Auto-populates historical data for the last 100 commits and pull request cycles instantly upon tracking.</p>
            </div>
            <div className="rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-6 space-y-3 shadow-xl shadow-slate-200/20 dark:shadow-none hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 text-lg font-black shadow-inner">2</div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">Live Webhooks</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Instantly process updates and metric recalculations using cryptographically signed GitHub webhooks.</p>
            </div>
            <div className="rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl p-6 space-y-3 shadow-xl shadow-slate-200/20 dark:shadow-none hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">AI Analytics</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Generate actionable summaries and identify code anti-patterns automatically with AI-powered insights.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-600 bg-white/20 dark:bg-slate-950/20 transition-colors duration-300">
        <p>© 2026 GitInsight Dashboard. Production Ready Template. Built with Next.js App Router & Tailwind CSS.</p>
      </footer>
    </div>
  );
}
