create or replace function public.update_match_request(
  p_request_id uuid,
  p_requested_date timestamptz,
  p_venue text,
  p_note text,
  p_team_a_user_ids uuid[],
  p_team_b_user_ids uuid[]
)
returns public.match_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.match_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_request
  from public.match_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Match request not found';
  end if;

  if v_request.requested_by <> v_user_id and not public.is_current_user_admin() then
    raise exception 'Only the requester or an admin can edit this match request';
  end if;

  if v_request.status <> 'open' then
    raise exception 'Only open match requests can be edited';
  end if;

  update public.match_requests
  set
    requested_date = p_requested_date,
    venue = nullif(trim(p_venue), ''),
    note = nullif(trim(p_note), ''),
    updated_at = now()
  where id = p_request_id
  returning * into v_request;

  delete from public.match_request_votes
  where request_id = p_request_id;

  delete from public.match_request_participants
  where request_id = p_request_id;

  insert into public.match_request_participants (request_id, user_id, team)
  select p_request_id, user_id, 'team_a'
  from unnest(p_team_a_user_ids) as user_id
  union all
  select p_request_id, user_id, 'team_b'
  from unnest(p_team_b_user_ids) as user_id;

  return v_request;
end;
$$;

grant execute on function public.update_match_request(
  uuid,
  timestamptz,
  text,
  text,
  uuid[],
  uuid[]
) to authenticated;
