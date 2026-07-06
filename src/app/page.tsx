import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import DashboardOverview from "@/components/DashboardOverview";
import LoginButton from "@/components/LoginButton";
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
    <div className="relative min-h-screen bg-[#020617] overflow-hidden flex flex-col justify-between">
      {/* Background Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-indigo-950/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-violet-950/15 blur-[120px] pointer-events-none" />

      {/* Header bar */}
      <header className="border-b border-slate-900 bg-slate-950/45 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500">
              <GitBranch className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="font-bold text-md tracking-tight text-white">GitInsight</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-semibold text-emerald-400">System Online</span>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <main className="flex-1 flex items-center justify-center py-16 px-6">
        <div className="max-w-3xl text-center space-y-8">
          {/* Tag */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-950/40 px-3 py-1 text-xs text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Introducing Real-Time Repository Audits</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Real-Time GitHub <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent">
                Repository Analytics
              </span>
            </h1>
            <p className="text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
              Track commit frequencies, analyze pull request review cycles, map contributor leaderboards, and process updates instantly via verified cryptographic webhooks.
            </p>
          </div>

          {/* Connect Button container */}
          <div className="flex flex-col items-center justify-center gap-4">
            <LoginButton />
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              Secured using official GitHub OAuth and SHA-256 signatures
            </p>
          </div>

          {/* Cards for Features */}
          <div className="grid gap-4 sm:grid-cols-3 pt-10 text-left">
            <div className="rounded-xl border border-slate-900 bg-slate-950/30 p-5 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-sm font-bold">1</div>
              <h3 className="font-semibold text-white text-sm">Instant REST Sync</h3>
              <p className="text-xs text-slate-500">Auto-populates historical data for the last 100 commits and pull request cycles upon tracking.</p>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-950/30 p-5 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 text-sm font-bold">2</div>
              <h3 className="font-semibold text-white text-sm">Webhook Updates</h3>
              <p className="text-xs text-slate-500">Instantly update statistics using cryptographically signed GitHub webhooks on push and PR triggers.</p>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-950/30 p-5 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-sm font-bold">
                <Cpu className="h-4.5 w-4.5" />
              </div>
              <h3 className="font-semibold text-white text-sm">Flexible Polling</h3>
              <p className="text-xs text-slate-500">Track third-party creator repositories with automated fallback background polling sync.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600 bg-slate-950/20">
        <p>© 2026 GitInsight Dashboard. Production Ready Template. Built with Next.js App Router & Tailwind CSS.</p>
      </footer>
    </div>
  );
}
