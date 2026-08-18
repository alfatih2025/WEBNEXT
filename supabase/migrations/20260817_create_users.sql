create table if not exists public.app_users (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  password text not null,
  role text not null default 'user',
  created_at timestamptz default now()
);

insert into public.app_users (username, password, role)
values ('admin', 'admin123', 'admin')
on conflict (username) do nothing;
