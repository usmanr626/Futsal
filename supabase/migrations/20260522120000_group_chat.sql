create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_messages_body_length check (
    length(trim(body)) between 1 and 500
  )
);

create index if not exists chat_messages_created_at_idx
on public.chat_messages(created_at desc);

create index if not exists chat_messages_user_id_idx
on public.chat_messages(user_id);

alter table public.chat_messages replica identity full;
alter table public.chat_messages enable row level security;

grant select, insert, delete on public.chat_messages to authenticated;

drop policy if exists "Active players can view chat messages" on public.chat_messages;
create policy "Active players can view chat messages"
on public.chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
  )
);

drop policy if exists "Active players can send chat messages" on public.chat_messages;
create policy "Active players can send chat messages"
on public.chat_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_active = true
  )
);

drop policy if exists "Players can delete own chat messages and admins can delete any" on public.chat_messages;
create policy "Players can delete own chat messages and admins can delete any"
on public.chat_messages
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
  )
);

create or replace function public.touch_chat_message_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_chat_message_updated_at on public.chat_messages;
create trigger touch_chat_message_updated_at
before update on public.chat_messages
for each row
execute function public.touch_chat_message_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
