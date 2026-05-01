# Impact28

Minimal SMS campaign builder for ecommerce: audiences (phone + email lists), multi-step SMS with optional delays, Supabase Auth, and **Guestcap-aligned** primitives (SSR Supabase helpers, Connectix-ready SMS registry, middleware-style session refresh).

## Parity with Guestcap (patterns copied)

| Area | Location |
|------|-----------|
| Browser Supabase (`createBrowserClient` factory) | `src/lib/supabase/client.ts` |
| Barrel re-export (`createClient`) | `src/lib/supabase.ts` |
| Server Supabase (`createServerClient` + cookies `setAll`) | `src/lib/supabase/server.ts` |
| Admin / service-role client (`createAdminClient`, throws if missing key) | `src/lib/supabase/admin.ts` |
| Auth redirects | `redirect` query (legacy `next` still accepted); middleware matches Guestcap `proxy.ts` cookie handling |
| Build without Supabase env | Dashboard uses `dynamic = "force-dynamic"` so `next build` does not prerender DB-backed layouts |
| SMS registry (`sendSms` + `SmsProvider`) | `src/lib/sms/sendSms.ts`, `src/lib/sms/types.ts` |
| Connectix provider | `src/lib/sms/providers/connectix.ts` |
| BudgetSMS provider | `src/lib/sms/providers/budgetsms.ts` |

`src/lib/supabase.ts` only re-exports `createClient()` (no eager `supabase` singleton), so importing the barrel never instantiates Supabase during static shells—similar to Guestcap, with safer defaults for Next 14 builds.

Additional providers in this app: **Twilio** and **Vonage** (`src/lib/sms/providers/`).

## Required external services

1. **Supabase** — Auth (email/password); run SQL migrations from `supabase/migrations/` in order.
2. **SMS** — set `SMS_PROVIDER` to one of `budgetsms`, `connectix`, `twilio`, `vonage` and fill the matching env vars (see `.env.example`).

## Environment variables

Copy `.env.example` to `.env.local`. Use either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Guestcap supports both).

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.

### Google sign-in

In the Supabase dashboard: **Authentication → Providers → Google** — enable and add your Google OAuth client ID and secret.

Under **Authentication → URL configuration**, add redirect URLs that include:

- `http://localhost:3000/auth/callback` (local dev)
- `https://<your-production-domain>/auth/callback` (production)

The app sends users to `/auth/callback` after Google, then exchanges the code and redirects to the `next` query (or `/dashboard`).

## Database setup

In Supabase → SQL:

1. `supabase/migrations/20260101000000_initial.sql`
2. `supabase/migrations/20260101000001_sms_queue.sql`

If the auth trigger errors, try `execute procedure` instead of `execute function` for `handle_new_user`.

## Run locally

```bash
npm install
npm run dev
```

After finalizing a campaign:

- `POST /api/sms/process` (logged-in user; RLS-scoped queue), or  
- `GET /api/cron/process-sms` with `Authorization: Bearer <CRON_SECRET>` (uses `createAdminClient()` to process all due rows).

## SMS architecture

- All providers implement `SmsProvider` (`send(to, message, options?)` → `SmsSendResult`).
- New providers: add `src/lib/sms/providers/<name>.ts` and register in `src/lib/sms/sendSms.ts`.

## Deploy (optional)

Point a cron job at `/api/cron/process-sms` with the Bearer secret so scheduled and delayed steps send reliably.
