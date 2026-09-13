-- v1.014 (#177): server-backed short links for shared workouts/programs.
-- Run once in the Supabase SQL editor (or via the migration tooling).
-- Slugs are client-generated (8 chars, [a-zA-Z0-9]); the payload column
-- holds the existing v2 compressed share-link string. Creation is
-- logged-in-only; reads are public so recipients need no account.
create table if not exists public.share_links (
  slug text primary key,
  kind text not null default 'workout',
  payload text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.share_links enable row level security;
create policy "public read" on public.share_links for select using (true);
create policy "authenticated insert" on public.share_links for insert with check (auth.role() = 'authenticated');
create policy "owner delete" on public.share_links for delete using (auth.uid() = created_by);
