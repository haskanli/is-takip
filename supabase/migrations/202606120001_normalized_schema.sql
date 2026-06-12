create extension if not exists pgcrypto;
create extension if not exists citext;

alter table public.app_state add column if not exists version bigint not null default 1;

-- These legacy normalized tables were verified empty before this migration.
drop table if exists public.task_comments cascade;
drop table if exists public.time_entries cascade;
drop table if exists public.project_members cascade;
drop table if exists public.tasks cascade;
drop table if exists public.milestones cascade;
drop table if exists public.projects cascade;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  legacy_id text unique not null,
  email citext unique not null,
  name text not null,
  role_title text not null default '',
  phone text not null default '',
  avatar text not null default '',
  is_admin boolean not null default false,
  whatsapp_enabled boolean not null default true,
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key,
  name text not null,
  description text not null default '',
  status text not null default 'Bekliyor',
  color text not null default '#4A6CF7',
  start_date date,
  end_date date,
  commissioning_tracking boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id text not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  membership_role text not null default 'member',
  stakeholder_role text not null default '',
  created_at timestamptz not null default now(),
  primary key (project_id, profile_id, membership_role, stakeholder_role)
);

create table if not exists public.milestones (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  status text not null default 'Bekliyor',
  start_date date,
  due_date date,
  position integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  project_id text references public.projects(id) on delete cascade,
  milestone_id text references public.milestones(id) on delete cascade,
  task_kind text not null default 'project' check (task_kind in ('project','personal')),
  title text not null,
  status text not null default 'Bekliyor',
  priority text not null default 'Orta',
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  start_date date,
  due_date date,
  position integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.time_entries (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  hours numeric(10,2) not null default 0,
  entry_date date,
  note text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  status text not null default 'Açık',
  priority text not null default 'Orta',
  assigned_to uuid references public.profiles(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  jira_key text,
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tickets_jira_key_unique
  on public.tickets(jira_key) where jira_key is not null and jira_key <> '';

create table if not exists public.project_actions (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  action_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.field_plans (
  id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  project_id text references public.projects(id) on delete set null,
  plan_date date not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commissioning_nodes (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  parent_id text references public.commissioning_nodes(id) on delete cascade,
  node_type text not null check (node_type in ('sector','production_center','workplace','line','machine')),
  name text not null,
  code text not null default '',
  machine_type text check (machine_type is null or machine_type in ('physical','virtual')),
  commissioned boolean not null default false,
  commissioned_at date,
  note text not null default '',
  position integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_notes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  notes text not null default '',
  todos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_tasks (
  id text primary key,
  created_by uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  frequency text not null,
  next_run_date date,
  assignee_ids uuid[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  project_id text references public.projects(id) on delete set null,
  detail text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_meta (
  id integer primary key default 1 check (id = 1),
  state_version bigint not null default 1,
  migrated_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.app_meta(id) values (1) on conflict (id) do nothing;

create table if not exists public.data_migrations (
  name text primary key,
  applied_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb
);

create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public
as $$ select id from public.profiles where id = auth.uid() and active limit 1 $$;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid() and active), false) $$;

create or replace function public.can_access_project(target_project text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_app_admin() or exists (
    select 1 from public.project_members
    where project_id = target_project and profile_id = auth.uid()
  )
$$;

create or replace function public.claim_state_version(expected_version bigint)
returns bigint language plpgsql security definer set search_path = public
as $$
declare next_version bigint;
begin
  update public.app_meta
     set state_version = state_version + 1, updated_at = now()
   where id = 1 and state_version = expected_version
   returning state_version into next_version;
  if next_version is null then
    raise exception 'STATE_VERSION_CONFLICT' using errcode = '40001';
  end if;
  return next_version;
end;
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.time_entries enable row level security;
alter table public.tickets enable row level security;
alter table public.project_actions enable row level security;
alter table public.field_plans enable row level security;
alter table public.commissioning_nodes enable row level security;
alter table public.user_notes enable row level security;
alter table public.notifications enable row level security;
alter table public.recurring_tasks enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_meta enable row level security;

drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles for select to authenticated using (active);
drop policy if exists projects_read_members on public.projects;
create policy projects_read_members on public.projects for select to authenticated using (public.can_access_project(id));
drop policy if exists project_members_read_members on public.project_members;
create policy project_members_read_members on public.project_members for select to authenticated using (public.can_access_project(project_id));
drop policy if exists milestones_read_members on public.milestones;
create policy milestones_read_members on public.milestones for select to authenticated using (public.can_access_project(project_id));
drop policy if exists tasks_read_members on public.tasks;
create policy tasks_read_members on public.tasks for select to authenticated using (
  (project_id is not null and public.can_access_project(project_id)) or assignee_id = auth.uid() or created_by = auth.uid()
);
drop policy if exists comments_read_task on public.task_comments;
create policy comments_read_task on public.task_comments for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id and ((t.project_id is not null and public.can_access_project(t.project_id)) or t.assignee_id = auth.uid() or t.created_by = auth.uid()))
);
drop policy if exists time_entries_read_task on public.time_entries;
create policy time_entries_read_task on public.time_entries for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id and ((t.project_id is not null and public.can_access_project(t.project_id)) or t.assignee_id = auth.uid() or t.created_by = auth.uid()))
);
drop policy if exists tickets_read_members on public.tickets;
create policy tickets_read_members on public.tickets for select to authenticated using (public.can_access_project(project_id));
drop policy if exists actions_read_members on public.project_actions;
create policy actions_read_members on public.project_actions for select to authenticated using (public.can_access_project(project_id));
drop policy if exists field_plans_read on public.field_plans;
create policy field_plans_read on public.field_plans for select to authenticated using (profile_id = auth.uid() or public.is_app_admin());
drop policy if exists commissioning_read_members on public.commissioning_nodes;
create policy commissioning_read_members on public.commissioning_nodes for select to authenticated using (public.can_access_project(project_id));
drop policy if exists user_notes_read_own on public.user_notes;
create policy user_notes_read_own on public.user_notes for select to authenticated using (profile_id = auth.uid());
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated using (profile_id = auth.uid());
drop policy if exists recurring_read on public.recurring_tasks;
create policy recurring_read on public.recurring_tasks for select to authenticated using (public.is_app_admin() or auth.uid() = any(assignee_ids) or created_by = auth.uid());
drop policy if exists audit_read_admin on public.audit_logs;
create policy audit_read_admin on public.audit_logs for select to authenticated using (public.is_app_admin());
drop policy if exists app_meta_read_authenticated on public.app_meta;
create policy app_meta_read_authenticated on public.app_meta for select to authenticated using (true);

revoke all on public.app_state from anon, authenticated;
grant select on public.profiles, public.projects, public.project_members, public.milestones,
  public.tasks, public.task_comments, public.time_entries, public.tickets,
  public.project_actions, public.field_plans, public.commissioning_nodes,
  public.user_notes, public.notifications, public.recurring_tasks,
  public.audit_logs, public.app_meta to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.task_comments;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.tickets;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.project_actions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.commissioning_nodes;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.app_meta;
exception when duplicate_object then null;
end $$;
