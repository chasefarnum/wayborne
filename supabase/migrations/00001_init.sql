-- Wayborne — initial schema
-- Staged 2026-07-10; geography(4326) delta applied 2026-07-14 per
-- research/wayborne-stack-validation-v1.md. Executed against the hosted
-- project (ptfrcvbhokfbjftjxjfn) 2026-07-15; RLS verified as anon / rider /
-- curator, 18/18 checks passed.
-- Design rationale: brief/wayborne-data-model-v1.md (project folder)

create extension if not exists postgis;

-- 1. enums ------------------------------------------------------------------

create type region_status as enum ('planned', 'swept', 'published');
create type review_status as enum ('pending_review', 'keep', 'kill', 'hold');
create type provenance as enum ('researched', 'verified');
create type confidence as enum ('low', 'medium', 'high');
create type content_origin as enum ('curated', 'community');
create type road_character as enum
  ('technical', 'sweepers', 'scenic', 'river_road', 'ridge_run', 'low_traffic', 'forest');
create type stop_category as enum
  ('hangout', 'diner', 'roadhouse', 'bbq', 'dive_bar', 'ice_cream', 'farm_stand',
   'general_store', 'dec_campground', 'private_campground', 'overlook', 'poi',
   'hd_dealer', 'indie_shop');
create type stop_status as enum ('open', 'temporarily_closed', 'closed', 'bad_lead');
create type rider_signal as enum ('strong', 'moderate', 'self_identified', 'none');
create type leg_item_type as enum ('segment', 'stop', 'waypoint');

-- 2. tables -----------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'rider' check (role in ('rider', 'curator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table regions (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,                      -- region 01, 02, ...
  slug text not null unique,
  name text not null,
  status region_status not null default 'planned',
  is_free boolean not null default true,           -- pay-later entitlement seam
  bounds geography(Polygon, 4326),                 -- nullable until drawn
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table region_entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  region_id uuid not null references regions (id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, region_id)
);

create table road_segments (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references regions (id) on delete cascade,
  sweep_id text,                                   -- r-001 etc from candidate files
  name text not null,
  route_desc text not null,                        -- "NY-23A Palenville to Prattsville"
  endpoints text,
  length_mi numeric(6,1),
  sub_area text,                                   -- grouping from the sweep files
  character road_character[] not null default '{}',
  blurb text,                                      -- editorial voice, rewritten pre-publish
  warnings text,                                   -- enforcement, closures, hazards
  seasonal_notes text,
  geom geography(LineString, 4326),                -- nullable until traced
  review_status review_status not null default 'pending_review',
  review_note text,                                -- why killed / what to check on hold
  provenance provenance not null default 'researched',
  confidence confidence not null default 'medium',
  origin content_origin not null default 'curated',
  source_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table stops (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references regions (id) on delete cascade,
  sweep_id text,                                   -- s-001 etc
  name text not null,
  category stop_category not null,
  town text,
  brand text,                                      -- dealers: 'harley-davidson', etc.
  blurb text,
  rider_signal rider_signal not null default 'none',
  rider_signal_evidence text,
  practicals jsonb not null default '{}',          -- fees, season, booking, parking, walk
  seasonal_notes text,
  status stop_status not null default 'open',      -- closed/bad_lead = do-not-ingest list
  status_note text,                                -- "sold 2025, re-check scene"
  geom geography(Point, 4326),                     -- nullable until geocoded
  google_place_id text,                            -- ID ONLY per Google terms; never store content
  review_status review_status not null default 'pending_review',
  review_note text,
  provenance provenance not null default 'researched',
  confidence confidence not null default 'medium',
  origin content_origin not null default 'curated',
  source_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table routes (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references regions (id) on delete cascade,
  name text not null,
  blurb text,
  warnings text,                                   -- "rides at 200mi not 100; fuel plan"
  review_status review_status not null default 'pending_review',
  provenance provenance not null default 'researched',
  origin content_origin not null default 'curated',
  source_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table route_segments (
  route_id uuid not null references routes (id) on delete cascade,
  segment_id uuid not null references road_segments (id) on delete cascade,
  position int not null,
  primary key (route_id, segment_id),
  unique (route_id, position)
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  region_id uuid references regions (id) on delete set null,
  name text not null,
  start_date date,
  daily_mileage_target int check (daily_mileage_target between 50 and 800),
  is_public boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trip_legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  day_number int not null,
  name text,
  notes text,
  unique (trip_id, day_number)
);

create table trip_leg_items (
  id uuid primary key default gen_random_uuid(),
  leg_id uuid not null references trip_legs (id) on delete cascade,
  position int not null,
  item_type leg_item_type not null,
  segment_id uuid references road_segments (id) on delete set null,
  stop_id uuid references stops (id) on delete set null,
  waypoint_name text,
  waypoint_geom geography(Point, 4326),
  unique (leg_id, position),
  -- exactly one target per item
  check (
    (item_type = 'segment' and segment_id is not null and stop_id is null and waypoint_geom is null) or
    (item_type = 'stop'    and stop_id is not null and segment_id is null and waypoint_geom is null) or
    (item_type = 'waypoint' and waypoint_geom is not null and segment_id is null and stop_id is null)
  )
);

-- 3. indexes ----------------------------------------------------------------

create index on region_entitlements (region_id);
create index on road_segments (region_id, review_status);
create index on stops (region_id, review_status);
create index on stops (category);
create index on routes (region_id, review_status);
create index on route_segments (segment_id);
create index on trips (user_id);
create index on trip_legs (trip_id);
create index on trip_leg_items (leg_id);
create index road_segments_geom_idx on road_segments using gist (geom);
create index stops_geom_idx on stops using gist (geom);
create index regions_bounds_idx on regions using gist (bounds);
create index stops_practicals_idx on stops using gin (practicals);

-- 4. helpers ----------------------------------------------------------------

create or replace function is_curator()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'curator');
$$;

-- free region, or the user holds an entitlement
create or replace function has_region_access(rid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from regions r where r.id = rid and r.status = 'published' and r.is_free
    union
    select 1 from region_entitlements e where e.region_id = rid and e.user_id = auth.uid()
  );
$$;

create or replace function has_trip_access(tid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from trips t where t.id = tid and (t.user_id = auth.uid() or t.is_public)
  );
$$;

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_touch      before update on profiles      for each row execute function touch_updated_at();
create trigger regions_touch       before update on regions       for each row execute function touch_updated_at();
create trigger road_segments_touch before update on road_segments for each row execute function touch_updated_at();
create trigger stops_touch         before update on stops         for each row execute function touch_updated_at();
create trigger routes_touch        before update on routes        for each row execute function touch_updated_at();
create trigger trips_touch         before update on trips         for each row execute function touch_updated_at();

-- 5. RLS --------------------------------------------------------------------

alter table profiles            enable row level security;
alter table regions             enable row level security;
alter table region_entitlements enable row level security;
alter table road_segments       enable row level security;
alter table stops               enable row level security;
alter table routes              enable row level security;
alter table trips               enable row level security;
alter table trip_legs           enable row level security;
alter table trip_leg_items      enable row level security;

-- profiles: own row; curator reads all
create policy "own profile"        on profiles for all    using (auth.uid() = id) with check (auth.uid() = id);
create policy "curator reads all"  on profiles for select using (is_curator());

-- regions: public sees published; curator everything
create policy "public regions"     on regions for select using (status = 'published' or is_curator());
create policy "curator regions"    on regions for all    using (is_curator()) with check (is_curator());

-- entitlements: own rows; curator manages
create policy "own entitlements"     on region_entitlements for select using (user_id = auth.uid() or is_curator());
create policy "curator entitlements" on region_entitlements for all    using (is_curator()) with check (is_curator());

-- curated content: public sees kept content in accessible regions; curator everything
create policy "public segments"  on road_segments for select
  using (is_curator() or (review_status = 'keep' and has_region_access(region_id)));
create policy "curator segments" on road_segments for all
  using (is_curator()) with check (is_curator());

create policy "public stops"     on stops for select
  using (is_curator() or (review_status = 'keep' and status = 'open' and has_region_access(region_id)));
create policy "curator stops"    on stops for all
  using (is_curator()) with check (is_curator());

create policy "public routes"    on routes for select
  using (is_curator() or (review_status = 'keep' and has_region_access(region_id)));
create policy "curator routes"   on routes for all
  using (is_curator()) with check (is_curator());

create policy "public route segments" on route_segments for select
  using (is_curator() or exists (
    select 1 from routes r where r.id = route_id
      and r.review_status = 'keep' and has_region_access(r.region_id)));
create policy "curator route segments" on route_segments for all
  using (is_curator()) with check (is_curator());

-- trips: owner CRUD; public read when shared
create policy "read trips"  on trips for select using (user_id = auth.uid() or is_public);
create policy "own trips"   on trips for insert with check (user_id = auth.uid());
create policy "edit trips"  on trips for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "del trips"   on trips for delete using (user_id = auth.uid());

create policy "read legs"  on trip_legs for select using (has_trip_access(trip_id));
create policy "write legs" on trip_legs for all
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()))
  with check (exists (select 1 from trips t where t.id = trip_id and t.user_id = auth.uid()));

create policy "read items"  on trip_leg_items for select
  using (exists (select 1 from trip_legs l where l.id = leg_id and has_trip_access(l.trip_id)));
create policy "write items" on trip_leg_items for all
  using (exists (select 1 from trip_legs l join trips t on t.id = l.trip_id
                 where l.id = leg_id and t.user_id = auth.uid()))
  with check (exists (select 1 from trip_legs l join trips t on t.id = l.trip_id
                      where l.id = leg_id and t.user_id = auth.uid()));
