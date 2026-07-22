create extension if not exists pgcrypto;

create type public.deal_status as enum ('draft','published','accepted','completed','cancelled','disputed');
create type public.verification_status as enum ('not_started','pending','verified','failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  verification_status public.verification_status not null default 'not_started',
  verification_provider text,
  verification_reference text,
  created_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null default upper(substr(encode(gen_random_bytes(8),'hex'),1,8)),
  seller_id uuid not null references public.profiles(id),
  buyer_id uuid references public.profiles(id),
  title text not null check (char_length(title) between 3 and 120),
  description text not null,
  price_cents bigint not null check (price_cents > 0),
  currency char(3) not null default 'USD',
  condition text not null,
  serial_last_four text,
  serial_ciphertext text,
  delivery_method text not null,
  status public.deal_status not null default 'draft',
  current_agreement_version integer not null default 0,
  published_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deal_media (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.agreement_versions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  version integer not null,
  terms_json jsonb not null,
  content_hash text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(deal_id, version)
);

create table public.agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  agreement_version_id uuid not null references public.agreement_versions(id),
  signer_id uuid not null references public.profiles(id),
  typed_name text not null,
  consent_text text not null,
  ip_hash text,
  user_agent text,
  accepted_at timestamptz not null default now(),
  unique(agreement_version_id, signer_id)
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  author_id uuid not null references public.profiles(id),
  subject_id uuid not null references public.profiles(id),
  stars smallint not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique(deal_id, author_id),
  check (author_id <> subject_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  deal_id uuid references public.deals(id),
  actor_id uuid references public.profiles(id),
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id),
  reporter_id uuid references public.profiles(id),
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.deals enable row level security;
alter table public.deal_media enable row level security;
alter table public.agreement_versions enable row level security;
alter table public.agreement_acceptances enable row level security;
alter table public.ratings enable row level security;
alter table public.audit_events enable row level security;
alter table public.reports enable row level security;

create policy "profiles self read" on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);
create policy "participants read deals" on public.deals for select using (seller_id = auth.uid() or buyer_id = auth.uid());
create policy "seller inserts deals" on public.deals for insert with check (seller_id = auth.uid());
create policy "seller updates deals" on public.deals for update using (seller_id = auth.uid());

-- Expose published deals through a security-definer RPC or a restricted public view.
-- Do not grant anonymous access to the base table: it contains private participant and serial fields.
-- Add participant policies for media, agreements, acceptances, ratings, audit events and reports
-- only after testing every auth path with automated authorization tests.
