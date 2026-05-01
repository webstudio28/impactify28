import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "./ui";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">
          ← Back
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-ink-muted">One account represents one business.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
        <SignupForm />
      </Suspense>
      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Sign in
        </Link>
      </p>
    </main>
  );
}
