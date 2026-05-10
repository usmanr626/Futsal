alter table public.profiles
add column if not exists avatar_updated_at timestamptz;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.enforce_avatar_update_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.avatar_path is distinct from old.avatar_path then
    if not public.is_current_user_admin()
      and old.avatar_updated_at is not null
      and old.avatar_updated_at > now() - interval '24 hours'
    then
      raise exception 'Profile photos can only be changed once every 24 hours.';
    end if;

    new.avatar_updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_avatar_update_limit on public.profiles;
create trigger enforce_avatar_update_limit
before update of avatar_path on public.profiles
for each row
execute function public.enforce_avatar_update_limit();

create or replace function public.enforce_match_request_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin()
    and exists (
      select 1
      from public.match_requests
      where requested_by = new.requested_by
        and created_at > now() - interval '24 hours'
    )
  then
    raise exception 'Players can only request one match every 24 hours.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_match_request_limit on public.match_requests;
create trigger enforce_match_request_limit
before insert on public.match_requests
for each row
execute function public.enforce_match_request_limit();

grant execute on function public.is_current_user_admin() to authenticated;
