create table if not exists public.match_reminders (
  match_id uuid not null references public.matches(id) on delete cascade,
  reminder_type text not null,
  triggered_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz not null default now(),
  primary key (match_id, reminder_type),
  constraint match_reminders_type_check check (reminder_type in ('24h', '2h'))
);

create index if not exists match_reminders_sent_at_idx
on public.match_reminders(sent_at desc);

alter table public.match_reminders enable row level security;
