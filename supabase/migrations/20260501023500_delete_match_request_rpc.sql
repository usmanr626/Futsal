create or replace function public.delete_match_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_scheduled_match_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1
    from public.user_roles
    where user_id = v_user_id
      and role = 'admin'
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Only admins can delete match requests';
  end if;

  select scheduled_match_id
  into v_scheduled_match_id
  from public.match_requests
  where id = p_request_id
  for update;

  if not found then
    return;
  end if;

  if v_scheduled_match_id is not null then
    update public.match_requests
    set scheduled_match_id = null
    where id = p_request_id;

    delete from public.match_participants
    where match_id = v_scheduled_match_id;

    delete from public.matches
    where id = v_scheduled_match_id;
  end if;

  delete from public.match_request_votes
  where request_id = p_request_id;

  delete from public.match_request_participants
  where request_id = p_request_id;

  delete from public.match_requests
  where id = p_request_id;
end;
$$;

grant execute on function public.delete_match_request(uuid) to authenticated;
