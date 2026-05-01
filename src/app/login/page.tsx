import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./ui";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">
          ← Back
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-ink-muted">Use your business account.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-ink-muted">
        No account?{" "}
        <Link href="/signup" className="font-medium text-accent hover:text-accent-hover">
          Sign up
        </Link>
      </p>
    </main>
  );
}
