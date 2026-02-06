create table if not exists strava_tokens (
  id text primary key default 'primary',
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null,
  athlete_id bigint,
  updated_at timestamptz not null default now()
);

create table if not exists strava_oauth_state (
  state text primary key,
  created_at timestamptz not null default now()
);
