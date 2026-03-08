-- ============================================================================
-- Initial Schema
-- ============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- Tables
-- ============================================================================

-- User profile (basic user information)
create table if not exists public.user_profile (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- User technical details (device info, email preferences, etc.)
create table if not exists public.user_technical_details (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_opt_in boolean not null default true,
  purchase_email text,
  locale text default 'en',
  timezone text,
  platform text,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- User premium (subscription and credits)
create table if not exists public.user_premium (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credits integer not null default 0,
  has_purchased boolean not null default false,
  premium_start timestamptz,
  premium_finish timestamptz,
  next_charge_date timestamptz,
  subscription_tier text,
  billing_period text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- User feedback
create table if not exists public.user_feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  message text not null,
  email text,
  rating integer check (rating >= 1 and rating <= 5),
  bug_category text,
  page_url text,
  user_agent text,
  is_user_premium boolean not null default false,
  created_at timestamptz not null default now()
);

-- User feedback response (admin replies to feedback)
create table if not exists public.user_feedback_response (
  id uuid primary key default uuid_generate_v4(),
  feedback_id uuid not null references public.user_feedback(id) on delete cascade,
  responder_id uuid references auth.users(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Feature flags
create table if not exists public.feature_flags (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  enabled boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Email campaigns (track sent emails)
create table if not exists public.email_campaigns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null,
  email_subtype text,
  template_number integer,
  created_at timestamptz not null default now()
);

-- Scheduled credits (for yearly subscriptions)
create table if not exists public.scheduled_credits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_amount integer not null,
  distribute_on timestamptz not null,
  done boolean not null default false,
  product_id text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

alter table public.user_profile enable row level security;
alter table public.user_technical_details enable row level security;
alter table public.user_premium enable row level security;
alter table public.user_feedback enable row level security;
alter table public.user_feedback_response enable row level security;
alter table public.feature_flags enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.scheduled_credits enable row level security;

-- user_profile policies
create policy "Users can view their own profile"
  on public.user_profile for select
  using (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.user_profile for update
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on public.user_profile for insert
  with check (auth.uid() = user_id);

-- user_technical_details policies
create policy "Users can view their own technical details"
  on public.user_technical_details for select
  using (auth.uid() = user_id);

create policy "Users can update their own technical details"
  on public.user_technical_details for update
  using (auth.uid() = user_id);

create policy "Users can insert their own technical details"
  on public.user_technical_details for insert
  with check (auth.uid() = user_id);

-- user_premium policies
create policy "Users can view their own premium status"
  on public.user_premium for select
  using (auth.uid() = user_id);

-- user_feedback policies
create policy "Users can insert their own feedback"
  on public.user_feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own feedback"
  on public.user_feedback for select
  using (auth.uid() = user_id);

-- user_feedback_response policies
create policy "Users can view responses to their feedback"
  on public.user_feedback_response for select
  using (
    exists (
      select 1 from public.user_feedback
      where user_feedback.id = user_feedback_response.feedback_id
        and user_feedback.user_id = auth.uid()
    )
  );

-- feature_flags policies (read-only for all authenticated users)
create policy "Authenticated users can view feature flags"
  on public.feature_flags for select
  using (auth.role() = 'authenticated');

-- email_campaigns policies
create policy "Users can view their own email campaigns"
  on public.email_campaigns for select
  using (auth.uid() = user_id);

-- scheduled_credits policies
create policy "Users can view their own scheduled credits"
  on public.scheduled_credits for select
  using (auth.uid() = user_id);

-- ============================================================================
-- RPC Functions
-- ============================================================================

create or replace function public.is_user_premium(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_has_purchased boolean;
begin
  select has_purchased into v_has_purchased
  from public.user_premium
  where user_id = p_user_id;

  return coalesce(v_has_purchased, false);
end;
$$;

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists idx_user_profile_user_id on public.user_profile(user_id);
create index if not exists idx_user_technical_details_user_id on public.user_technical_details(user_id);
create index if not exists idx_user_premium_user_id on public.user_premium(user_id);
create index if not exists idx_user_feedback_user_id on public.user_feedback(user_id);
create index if not exists idx_user_feedback_created_at on public.user_feedback(created_at);
create index if not exists idx_email_campaigns_user_id on public.email_campaigns(user_id);
create index if not exists idx_email_campaigns_created_at on public.email_campaigns(created_at);
create index if not exists idx_scheduled_credits_user_id on public.scheduled_credits(user_id);
create index if not exists idx_scheduled_credits_distribute_on on public.scheduled_credits(distribute_on) where done = false;
create index if not exists idx_feature_flags_name on public.feature_flags(name);
