"use client";

import { signIn } from "next-auth/react";
import {
  GitBranch,
  Link2,
  Sparkles,
  ArrowRight,
  GitCommit,
  GitPullRequest,
  Clock,
  BarChart2,
  BookOpen,
  ShieldCheck,
  Users,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { GitInsightLogo, GitInsightMark } from "@/components/GitInsightLogo";
import LoginButton from "@/components/LoginButton";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/core/utils";

const NAV_LINKS = ["Product", "Features", "How It Works", "Integrations", "About"];

const FEATURES = [
  {
    icon: Layers,
    title: "Unified Project Dashboard",
    description: "One place to understand the current state of the project — repositories, activity, and risk at a glance.",
    color: "indigo",
  },
  {
    icon: GitBranch,
    title: "Repository Intelligence",
    description: "Track repositories, commits, pull requests, and contributors as they happen, not after the fact.",
    color: "sky",
  },
  {
    icon: Clock,
    title: "Project Activity Timeline",
    description: "A chronological record of the project's life — commits, PRs, reviews, and Jira activity in one feed.",
    color: "violet",
  },
  {
    icon: BookOpen,
    title: "Project Knowledge",
    description: "Architecture organized around real modules — Auth, API, Database, Infrastructure — not just files.",
    color: "amber",
  },
  {
    icon: BarChart2,
    title: "Module Health",
    description: "Status, health, risk, and ownership for every subsystem, derived from real activity.",
    color: "emerald",
  },
  {
    icon: Link2,
    title: "Cross-Platform Context",
    description: "Commits and pull requests linked back to the Jira stories they actually resolve.",
    color: "rose",
  },
] as const;

const FEATURE_COLOR_STYLES: Record<string, { card: string; icon: string }> = {
  indigo: {
    card: "hover:border-indigo-500/40 hover:shadow-indigo-500/10 bg-indigo-500/[0.03] dark:bg-indigo-500/[0.05]",
    icon: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  sky: {
    card: "hover:border-sky-500/40 hover:shadow-sky-500/10 bg-sky-500/[0.03] dark:bg-sky-500/[0.05]",
    icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  violet: {
    card: "hover:border-violet-500/40 hover:shadow-violet-500/10 bg-violet-500/[0.03] dark:bg-violet-500/[0.05]",
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  amber: {
    card: "hover:border-amber-500/40 hover:shadow-amber-500/10 bg-amber-500/[0.03] dark:bg-amber-500/[0.05]",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  emerald: {
    card: "hover:border-emerald-500/40 hover:shadow-emerald-500/10 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05]",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  rose: {
    card: "hover:border-rose-500/40 hover:shadow-rose-500/10 bg-rose-500/[0.03] dark:bg-rose-500/[0.05]",
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
};

const STEPS = [
  { title: "Connect", description: "Link your GitHub repository and, when you're ready, your Jira project." },
  { title: "Understand", description: "GitInsight organizes commits, pull requests, events, and modules into one model." },
  { title: "Analyze", description: "Correlation and AI insights surface what's actually happening beneath the activity." },
  { title: "Explore", description: "Navigate the project through dashboards, timelines, and module views — together." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Decorative background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-violet-500/10 blur-[120px]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <GitInsightLogo />
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => signIn("github")}>
              Log in
            </Button>
            <Button size="sm" onClick={() => signIn("github")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pb-20 pt-20 text-center sm:pt-28">
          <div className="mx-auto mb-6 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Project Intelligence for Modern Development Teams
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
            Understand Your Project.
            <br />
            <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-clip-text text-transparent">
              Not Just Your Code.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            GitInsight brings repositories, commits, pull requests, project activity, modules, and Jira context
            together into one intelligent workspace your whole team shares.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <LoginButton />
            <Button variant="outline" size="lg" asChild>
              <a href="#features">
                Explore GitInsight
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>

          {/* Git/Jira -> GitInsight visual */}
          <div className="mx-auto mt-20 flex max-w-xl items-center justify-center gap-6 sm:gap-10">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                <GitBranch className="h-6 w-6 text-foreground" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">GitHub</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-border via-primary/50 to-primary" />
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 p-3 shadow-lg shadow-primary/30">
                <GitInsightMark />
              </div>
              <span className="text-xs font-bold text-foreground">GitInsight</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-border via-violet-500/50 to-violet-500" />
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                <Link2 className="h-6 w-6 text-foreground" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">Jira</span>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-t border-border bg-secondary/30 py-20">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold sm:text-3xl">Your Project Lives in Too Many Places</h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                GitHub holds the code. Jira holds the plan. Neither, on its own, tells you the whole story — and
                keeping that story straight across a team makes it worse.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <p className="text-sm font-bold text-foreground">Code tells you</p>
                <p className="mt-1 text-xs text-muted-foreground">what changed.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <p className="text-sm font-bold text-foreground">Tickets tell you</p>
                <p className="mt-1 text-xs text-muted-foreground">what was planned.</p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center">
                <p className="text-sm font-bold text-primary">GitInsight connects</p>
                <p className="mt-1 text-xs text-muted-foreground">the story — for everyone on the team.</p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">How GitInsight Works</h2>
            </div>
            <div className="mt-14 grid gap-8 sm:grid-cols-4">
              {STEPS.map((step, i) => {
                const stepColors = [
                  "bg-indigo-500 shadow-indigo-500/30",
                  "bg-sky-500 shadow-sky-500/30",
                  "bg-violet-500 shadow-violet-500/30",
                  "bg-amber-500 shadow-amber-500/30",
                ];
                return (
                  <div key={step.title} className="group relative">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white shadow-lg transition-transform duration-200 group-hover:scale-110",
                        stepColors[i]
                      )}
                    >
                      {i + 1}
                    </div>
                    <p className="mt-4 text-base font-bold text-foreground">{step.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border bg-secondary/30 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">Everything Your Project Needs, One Place</h2>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => {
                const styles = FEATURE_COLOR_STYLES[f.color];
                return (
                  <div
                    key={f.title}
                    className={cn(
                      "group rounded-2xl border border-border bg-card p-8 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl",
                      styles.card
                    )}
                  >
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110", styles.icon)}>
                      <f.icon className="h-6 w-6" />
                    </div>
                    <p className="mt-5 text-lg font-bold text-foreground">{f.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Collaboration */}
        <section className="py-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Built for Teams, Not Just Individuals</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              A GitInsight project is shared. When a teammate is added, they see the same live activity you do —
              the same commits, the same pull requests, the same project knowledge — kept in sync automatically.
            </p>
          </div>
        </section>

        {/* Integrations */}
        <section className="border-t border-border bg-secondary/30 py-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">Where the Information Comes From</h2>
            <div className="mx-auto mt-10 flex max-w-md items-center justify-center gap-8">
              <div className="group flex flex-col items-center gap-2.5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-sky-500/[0.05] text-sky-600 shadow-sm transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-105 dark:text-sky-400">
                  <GitCommit className="h-7 w-7" />
                </div>
                <span className="text-sm font-semibold text-foreground">GitHub</span>
                <Badge variant="success">Supported</Badge>
              </div>
              <div className="group flex flex-col items-center gap-2.5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-violet-500/[0.05] text-violet-600 shadow-sm transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-105 dark:text-violet-400">
                  <GitPullRequest className="h-7 w-7" />
                </div>
                <span className="text-sm font-semibold text-foreground">Jira</span>
                <Badge variant="success">Supported</Badge>
              </div>
              <div className="group flex flex-col items-center gap-2.5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-amber-500/[0.05] text-amber-600 shadow-sm transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-105 dark:text-amber-400">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <span className="text-sm font-semibold text-foreground">More soon</span>
                <Badge variant="secondary">Planned</Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">See Your Project as One Connected System</h2>
            <div className="mt-8 flex justify-center">
              <LoginButton />
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Secured using official GitHub OAuth and signed webhooks
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <GitInsightLogo markClassName="h-6 w-6" />
          <p className="text-xs text-muted-foreground">© 2026 GitInsight. Project intelligence for modern development teams.</p>
        </div>
      </footer>
    </div>
  );
}
