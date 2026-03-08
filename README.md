# Paradox Builders Web App Template

A production-ready full-stack web app template built with Next.js, Supabase, and modern tooling. Designed as a reusable starting point for SaaS products.

## What's in the template

### Frontend (Next.js 16 + React 19)

**Routing & i18n**
- App Router with `[locale]` dynamic routing (8 locales: en, es, de, fr, pt, ja, it, no)
- next-intl for translations with deep-merged marketing messages
- Server-side rendering with `force-static` and `generateStaticParams`
- Root `/` redirects to `/en/` based on saved locale preference

**Pages**
- Landing page (placeholder hero section)
- Pricing page with RevenueCat subscription integration
- Auth pages: login, signup, forgot password, reset password
- Dashboard placeholder (authenticated area at `/app`)
- Email unsubscribe page
- 404 and global error pages
- Dynamic sitemap generation

**Auth & User Management**
- Supabase Auth (email/password, Google OAuth, anonymous users)
- AuthContext with session management and technical details tracking
- PurchasesContext with RevenueCat (subscriptions + one-time credit purchases)
- PaidPageContext for gating premium features

**Analytics & Tracking**
- PostHog analytics integration
- Facebook Pixel + Conversion API tracking
- Google Analytics 4 with UTM/GCLID capture
- Unified tracking layer coordinating FB and GA
- Rewardful affiliate/referral tracking
- Toast notifications with analytics events

**Error Monitoring**
- Sentry (client, server, edge configs)
- Instrumentation files for both server and client
- Auto-reload on chunk load failures

**Feature Flags**
- Supabase-backed feature flags (useFeatureFlags hook)
- InterviewBanner as example feature-flagged component

**Components**
- SurveyModal (contact support, report bug, rate quality)
- FeedbackResponsePopup (staff response display)
- ExponentialProgressBar (smooth progress with configurable timing)
- AutoExpandingTextarea
- PublicHeader, Footer, Logo (generic placeholders)

**Utilities**
- Cookie-based safe storage (no localStorage for sensitive data)
- Supabase client with fetch retry and error monitoring
- Platform detection (Android, iOS, mobile)
- Locale save/restore
- Error logging with network/business logic filtering

### Backend (Supabase Edge Functions — Deno)

**Edge Functions**
- `user-feedback-submit` — feedback submission with user context
- `unsubscribe-email` — email opt-out/opt-in toggle
- `send-campaign-email` — marketing emails via Resend API with HTML templates
- `revenue-cat-webhook` — subscription lifecycle events (renewal, cancellation, billing)

**Shared Utilities**
- CORS headers
- Supabase client factory with auth extraction
- Logging and error alerting (Telegram bot)

**Database Schema** (`backend/sql/001_initial_schema.sql`)
- `user_profile` — basic user info
- `user_technical_details` — tracking data (fbc, UTM params, GCLID, locale, platform)
- `user_premium` — subscription state, credits, billing info
- `user_feedback` + `user_feedback_response` — feedback system
- `feature_flags` — key/value feature toggles
- `email_campaigns` — campaign send tracking
- `scheduled_credits` — deferred credit grants
- Row-level security policies for all tables
- `is_user_premium` RPC function

**Config**
- Dev and prod Supabase configs (`config.toml`)

### Scripts

- `sync_translations.py` — syncs translations across locales using Gemini API
- `.env.dev` / `.env.prod` — environment variable templates (empty values)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4 |
| Auth & DB | Supabase (Auth, Postgres, Edge Functions) |
| Payments | RevenueCat |
| Analytics | PostHog, Facebook Pixel/CAPI, Google Analytics 4 |
| Errors | Sentry |
| Affiliates | Rewardful |
| Emails | Resend |
| Icons | Phosphor Icons |
| i18n | next-intl |
| Backend Runtime | Deno (Supabase Edge Functions) |

## Getting Started

1. Copy `.env.example` to `.env` and fill in your keys
2. `cd frontend && npm install && npm run dev`
3. Set up your Supabase project and run `backend/sql/001_initial_schema.sql`
4. Deploy edge functions from `backend/src/functions/`
