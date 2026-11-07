-- Orbit — initial schema
-- Every user-owned table carries user_id (defaulting to auth.uid()) and is protected by
-- row-level security so a signed-in user can only read and write their own rows.
-- References between tables are composite (id, user_id) foreign keys, so a row can never
-- point at a record that belongs to someone else, even by guessing an id.
-- Requires PostgreSQL 15+ (ON DELETE SET NULL (column) syntax). Supabase runs 15+.

create extension if not exists pgcrypto;

-- ─── helpers ──────────────────────────────────────────────────────────────────
create or replace function public.orbit_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  currency text not null default 'GBP' check (char_length(currency) = 3),
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  workspaces jsonb not null default '{"flip": true, "spark": true, "atlas": true}'::jsonb,
  dashboard_widgets jsonb not null default '[]'::jsonb,
  onboarded boolean not null default false,
  walkthrough_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create a profile row for every new auth user.
create or replace function public.orbit_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger orbit_on_auth_user_created
  after insert on auth.users
  for each row execute function public.orbit_handle_new_user();

-- ─── Atlas (created first: Spark projects can link to trips) ─────────────────
create table public.atlas_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  destination text not null default '',
  start_date date,
  end_date date,
  description text not null default '',
  budget numeric(12, 2) check (budget is null or budget >= 0),
  currency text not null default 'GBP',
  accommodation_notes text not null default '',
  transport_notes text not null default '',
  favourite boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.atlas_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.atlas_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 300),
  address text not null default '',
  city text not null default '',
  country text not null default '',
  country_code text not null default '',
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  category text not null default 'sight',
  status text not null default 'want' check (status in ('want', 'visited')),
  favourite boolean not null default false,
  notes text not null default '',
  visited_on date,
  photos text[] not null default '{}',
  source text not null default 'custom' check (source in ('search', 'custom')),
  osm_ref text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.atlas_place_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_id uuid not null,
  collection_id uuid not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, collection_id),
  foreign key (place_id, user_id) references public.atlas_places (id, user_id) on delete cascade,
  foreign key (collection_id, user_id) references public.atlas_collections (id, user_id) on delete cascade
);

create table public.atlas_trip_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null,
  place_id uuid not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, place_id),
  foreign key (trip_id, user_id) references public.atlas_trips (id, user_id) on delete cascade,
  foreign key (place_id, user_id) references public.atlas_places (id, user_id) on delete cascade
);

create table public.atlas_stops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null,
  day date,
  position double precision not null default 0,
  title text not null check (char_length(title) between 1 and 300),
  time text check (time is null or time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  kind text not null default 'activity' check (kind in ('activity', 'food', 'transport', 'stay', 'other')),
  place_id uuid,
  notes text not null default '',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, user_id) references public.atlas_trips (id, user_id) on delete cascade,
  foreign key (place_id, user_id) references public.atlas_places (id, user_id) on delete set null (place_id)
);

create table public.atlas_checklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null,
  label text not null check (char_length(label) between 1 and 300),
  done boolean not null default false,
  position double precision not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, user_id) references public.atlas_trips (id, user_id) on delete cascade
);

create table public.atlas_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid,
  place_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  body text not null default '',
  entry_date date not null default current_date,
  tags text[] not null default '{}',
  favourite boolean not null default false,
  photos text[] not null default '{}',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, user_id) references public.atlas_trips (id, user_id) on delete set null (trip_id),
  foreign key (place_id, user_id) references public.atlas_places (id, user_id) on delete set null (place_id)
);

-- ─── Spark ───────────────────────────────────────────────────────────────────
create table public.spark_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  position double precision not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.spark_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  status text not null default 'planning' check (status in ('planning', 'active', 'paused', 'completed', 'archived')),
  kind text not null default 'general' check (kind in ('general', 'reselling', 'travel')),
  color text not null default 'violet',
  start_date date,
  due_date date,
  notes text not null default '',
  favourite boolean not null default false,
  linked_flip boolean not null default false,
  linked_trip_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (linked_trip_id, user_id) references public.atlas_trips (id, user_id) on delete set null (linked_trip_id)
);

create table public.spark_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  folder_id uuid,
  project_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  category text not null default '',
  tags text[] not null default '{}',
  links jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  stage text not null default 'inbox' check (stage in ('inbox', 'exploring', 'promising', 'converted')),
  favourite boolean not null default false,
  archived boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (folder_id, user_id) references public.spark_folders (id, user_id) on delete set null (folder_id),
  foreign key (project_id, user_id) references public.spark_projects (id, user_id) on delete set null (project_id)
);

create table public.spark_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  due_date date,
  done boolean not null default false,
  position double precision not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (project_id, user_id) references public.spark_projects (id, user_id) on delete cascade
);

create table public.spark_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  milestone_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  status text not null default 'todo' check (status in ('backlog', 'todo', 'in_progress', 'in_review', 'completed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  module text not null default 'spark' check (module in ('spark', 'flip', 'atlas', 'general')),
  due_date date,
  position double precision not null default 0,
  completed_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.spark_projects (id, user_id) on delete cascade,
  foreign key (milestone_id, user_id) references public.spark_milestones (id, user_id) on delete set null (milestone_id)
);

create table public.spark_canvases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  name text not null check (char_length(name) between 1 and 200),
  data jsonb not null default '{"nodes": [], "edges": [], "viewport": null}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.spark_projects (id, user_id) on delete cascade
);

-- ─── Flip ────────────────────────────────────────────────────────────────────
create table public.flip_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sku text not null check (char_length(sku) between 1 and 40),
  title text not null default '',
  brand text not null default '',
  category text not null default '',
  size text not null default '',
  colour text not null default '',
  condition text not null default '',
  status text not null default 'draft' check (status in ('draft', 'ready', 'listed', 'reserved', 'sold', 'archived')),
  archived_from text check (archived_from is null or archived_from in ('draft', 'ready', 'listed', 'reserved', 'sold')),
  platform text not null default '',
  purchase_price numeric(12, 2) check (purchase_price is null or purchase_price >= 0),
  listing_price numeric(12, 2) check (listing_price is null or listing_price >= 0),
  sale_price numeric(12, 2) check (sale_price is null or sale_price >= 0),
  seller_fees numeric(12, 2) not null default 0 check (seller_fees >= 0),
  shipping_cost numeric(12, 2) not null default 0 check (shipping_cost >= 0),
  other_expenses numeric(12, 2) not null default 0 check (other_expenses >= 0),
  purchase_date date,
  listed_date date,
  sold_date date,
  measurements text not null default '',
  notes text not null default '',
  photos text[] not null default '{}',
  listing jsonb,
  favourite boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sku)
);

-- ─── shared: files, activity, notifications ─────────────────────────────────
create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  module text not null check (module in ('flip', 'spark', 'atlas', 'orbit')),
  entity_type text not null,
  entity_id uuid not null,
  path text not null,
  name text not null,
  mime text not null default 'application/octet-stream',
  size bigint not null default 0 check (size >= 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  module text not null check (module in ('flip', 'spark', 'atlas', 'orbit')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  title text not null default '',
  link text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  module text not null check (module in ('flip', 'spark', 'atlas', 'orbit')),
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  dedupe_key text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

-- ─── indexes ────────────────────────────────────────────────────────────────
create index on public.flip_items (user_id, status);
create index on public.flip_items (user_id, sold_date);
create index on public.spark_ideas (user_id, archived);
create index on public.spark_tasks (user_id, project_id, status);
create index on public.spark_tasks (user_id, due_date);
create index on public.spark_milestones (user_id, project_id);
create index on public.spark_canvases (user_id, project_id);
create index on public.atlas_places (user_id, status);
create index on public.atlas_stops (user_id, trip_id, day);
create index on public.atlas_checklist (user_id, trip_id);
create index on public.atlas_journal (user_id, entry_date);
create index on public.files (user_id, entity_type, entity_id);
create index on public.activity (user_id, created_at desc);
create index on public.notifications (user_id, created_at desc);
-- indexes backing composite foreign keys (cascades stay fast)
create index on public.spark_ideas (project_id, user_id);
create index on public.spark_ideas (folder_id, user_id);
create index on public.spark_projects (linked_trip_id, user_id);
create index on public.spark_tasks (milestone_id, user_id);
create index on public.atlas_place_collections (collection_id, user_id);
create index on public.atlas_place_collections (place_id, user_id);
create index on public.atlas_trip_places (place_id, user_id);
create index on public.atlas_stops (place_id, user_id);
create index on public.atlas_journal (trip_id, user_id);
create index on public.atlas_journal (place_id, user_id);

-- ─── updated_at triggers + row-level security ───────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'atlas_trips', 'atlas_collections', 'atlas_places', 'atlas_place_collections',
    'atlas_trip_places', 'atlas_stops', 'atlas_checklist', 'atlas_journal', 'spark_folders',
    'spark_projects', 'spark_ideas', 'spark_milestones', 'spark_tasks', 'spark_canvases',
    'flip_items', 'files', 'activity', 'notifications'
  ] loop
    execute format('create trigger orbit_touch before update on public.%I for each row execute function public.orbit_touch_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  foreach t in array array[
    'atlas_trips', 'atlas_collections', 'atlas_places', 'atlas_place_collections',
    'atlas_trip_places', 'atlas_stops', 'atlas_checklist', 'atlas_journal', 'spark_folders',
    'spark_projects', 'spark_ideas', 'spark_milestones', 'spark_tasks', 'spark_canvases',
    'flip_items', 'files', 'activity', 'notifications'
  ] loop
    execute format('create policy "own rows: select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

create policy "own profile: select" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own profile: insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "own profile: update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Let a user delete their own account (and, by cascade, every row they own).
-- Storage objects are removed by the client first (see Settings → Delete account).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ─── storage: one private bucket, one folder per user ───────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('orbit-files', 'orbit-files', false, 20971520)
on conflict (id) do nothing;

create policy "orbit files: read own" on storage.objects for select to authenticated
  using (bucket_id = 'orbit-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "orbit files: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'orbit-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "orbit files: update own" on storage.objects for update to authenticated
  using (bucket_id = 'orbit-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'orbit-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "orbit files: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'orbit-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
