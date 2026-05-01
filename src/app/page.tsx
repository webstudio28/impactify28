import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-20">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">Impact28</p>
        <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">
          SMS campaigns without the noise.
        </h1>
        <p className="max-w-xl text-lg text-ink-muted">
          Build a linear sequence, pick your audience, send or schedule. Built for small ecommerce teams who want
          speed over complexity.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-hover"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:bg-zinc-50"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
