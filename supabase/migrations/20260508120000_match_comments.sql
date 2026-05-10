create table if not exists public.match_comments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_comments_body_length check (
    length(trim(body)) between 1 and 500
  )
);

create index if not exists match_comments_match_created_idx
on public.match_comments(match_id, created_at desc);

alter table public.match_comments enable row level security;

drop policy if exists "Players can view match comments" on public.match_comments;
create policy "Players can view match comments"
on public.match_comments
for select
to authenticated
using (true);

drop policy if exists "Players can comment on previous matches" on public.match_comments;
create policy "Players can comment on previous matches"
on public.match_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.matches
    where matches.id = match_comments.match_id
      and (
        matches.status = 'completed'
        or matches.match_date <= now()
      )
  )
);

create or replace function public.touch_match_comment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_match_comment_updated_at on public.match_comments;
create trigger touch_match_comment_updated_at
before update on public.match_comments
for each row
execute function public.touch_match_comment_updated_at();
