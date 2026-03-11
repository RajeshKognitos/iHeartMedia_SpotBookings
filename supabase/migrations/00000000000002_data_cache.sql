-- Persisted data cache for dashboard (runs, exceptions, customers, line items).
-- Key format: home-{period}, runs, exceptions-{period}, customers-{period}, line_items-{period}

create table if not exists data_cache (
  key text primary key,
  data jsonb not null,
  last_synced_at timestamptz not null default now()
);

comment on table data_cache is 'Cached API data for Spot Bookings; key identifies scope (e.g. home-30d, runs).';
