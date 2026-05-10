do $$
declare
  routine record;
begin
  for routine in
    select p.oid::regprocedure::text as identity
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'submit_match_request_vote'
  loop
    execute 'drop function if exists ' || routine.identity;
  end loop;
end $$;

create function public.submit_match_request_vote(
  p_request_id uuid,
  p_vote text
)
returns public.match_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_vote public.match_request_votes.vote%type;
  v_request public.match_requests%rowtype;
  v_required_yes_count integer;
  v_yes_count integer;
  v_match_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_vote not in ('yes', 'no', 'maybe') then
    raise exception 'Invalid vote';
  end if;

  v_vote := p_vote;

  select *
  into v_request
  from public.match_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Match request not found';
  end if;

  if v_request.status <> 'open' then
    return v_request;
  end if;

  insert into public.match_request_votes (request_id, user_id, vote)
  values (p_request_id, v_user_id, v_vote)
  on conflict (request_id, user_id)
  do update set
    vote = excluded.vote,
    updated_at = now();

  select count(distinct user_id)
  into v_required_yes_count
  from public.match_request_participants
  where request_id = p_request_id
    and team in ('team_a', 'team_b');

  select count(distinct vote_rows.user_id)
  into v_yes_count
  from public.match_request_votes vote_rows
  join public.match_request_participants participants
    on participants.request_id = vote_rows.request_id
   and participants.user_id = vote_rows.user_id
  where vote_rows.request_id = p_request_id
    and vote_rows.vote = 'yes'
    and participants.team in ('team_a', 'team_b');

  if v_required_yes_count > 0 and v_yes_count = v_required_yes_count then
    insert into public.matches (
      request_id,
      title,
      match_date,
      venue,
      status,
      team_a_name,
      team_b_name,
      created_by,
      updated_by
    )
    values (
      p_request_id,
      'Futsal Match',
      v_request.requested_date,
      v_request.venue,
      'upcoming',
      'Team A',
      'Team B',
      v_request.requested_by,
      v_user_id
    )
    returning id into v_match_id;

    insert into public.match_participants (match_id, user_id, team)
    select v_match_id, user_id, team
    from public.match_request_participants
    where request_id = p_request_id
      and team in ('team_a', 'team_b');

    update public.match_requests
    set
      status = 'scheduled',
      scheduled_match_id = v_match_id,
      updated_at = now()
    where id = p_request_id
    returning * into v_request;
  else
    select *
    into v_request
    from public.match_requests
    where id = p_request_id;
  end if;

  return v_request;
end;
$$;

grant execute on function public.submit_match_request_vote(uuid, text) to authenticated;
