-- Berean — initial schema (Phase 1)
--
-- Design notes:
--   - UUIDs are client-generated (crypto.randomUUID()); timestamps client-set.
--     Defaults exist so server-side inserts (e.g. the signup trigger) still work.
--   - Book identity is a static USFM book_number (1-66). No Books table; book
--     metadata lives client-side in src/utils/bibleBooks.ts.
--   - workspace_id is present from day one. Phase 1 only exercises the personal
--     workspace, but Groups later is just new rows — zero policy migration.
--   - RLS uses one pattern everywhere: a row is visible/writable iff its workspace
--     is in the caller's membership set. notes/sessions authorize by joining up to
--     their passage's workspace_id. (select auth.uid()) is used so Postgres caches
--     the value once per statement instead of re-evaluating per row.

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- profiles: 1:1 with auth.users, created by the signup trigger.
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text not null default '',
  onboarding_done    boolean not null default false,
  created_at         timestamptz not null default now()
);

-- workspaces: 'personal' now; 'group' later without migration.
create table public.workspaces (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('personal', 'group')),
  name         text not null default '',
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'owner' check (role in ('owner', 'editor', 'viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.passages (
  id               uuid primary key,
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  book_number      int not null check (book_number between 1 and 66),
  chapter_start    int not null,
  verse_start      int not null,
  chapter_end      int not null,
  verse_end        int not null,
  reference_label  text not null,
  created_at       timestamptz not null default now()
);
create index passages_workspace_idx on public.passages (workspace_id);
create index passages_book_idx on public.passages (workspace_id, book_number);

create table public.sessions (
  id           uuid primary key,
  passage_id   uuid not null references public.passages (id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index sessions_passage_idx on public.sessions (passage_id);

create table public.notes (
  id                       uuid primary key,
  session_id               uuid not null references public.sessions (id) on delete cascade,
  content                  text not null,
  anchor_start_verse       int,
  anchor_end_verse         int,
  anchor_book_override     text,
  anchor_chapter_override  int,
  category                 text check (category in ('observation', 'historical', 'application', 'personal')),
  indent_level             int not null default 0,
  created_by               uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index notes_session_idx on public.notes (session_id);

-- ─── Signup trigger ──────────────────────────────────────────────────────────
-- On a new auth.users row: create the profile, a personal workspace, and the
-- owner membership. SECURITY DEFINER so it runs with the function owner's rights
-- (it writes rows the new user cannot yet write themselves).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  insert into public.workspaces (kind, name, created_by)
  values ('personal', 'Personal', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.workspaces         enable row level security;
alter table public.workspace_members  enable row level security;
alter table public.passages           enable row level security;
alter table public.sessions           enable row level security;
alter table public.notes              enable row level security;

-- profiles: a user sees and edits only their own profile row.
create policy profiles_select on public.profiles
  for select using (id = (select auth.uid()));
create policy profiles_update on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspace_members: a user sees membership rows for workspaces they belong to.
-- The self-referential check is kept simple (own rows) to avoid recursion; that
-- is sufficient for the personal case and for authorizing the joins below.
create policy workspace_members_select on public.workspace_members
  for select using (user_id = (select auth.uid()));

-- workspaces: visible iff the caller is a member.
create policy workspaces_select on public.workspaces
  for select using (
    id in (select workspace_id from public.workspace_members where user_id = (select auth.uid()))
  );

-- passages: full CRUD gated on workspace membership.
create policy passages_all on public.passages
  for all using (
    workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid()))
  ) with check (
    workspace_id in (select workspace_id from public.workspace_members where user_id = (select auth.uid()))
  );

-- sessions: authorize by joining up to the passage's workspace.
create policy sessions_all on public.sessions
  for all using (
    passage_id in (
      select p.id from public.passages p
      where p.workspace_id in (
        select workspace_id from public.workspace_members where user_id = (select auth.uid())
      )
    )
  ) with check (
    passage_id in (
      select p.id from public.passages p
      where p.workspace_id in (
        select workspace_id from public.workspace_members where user_id = (select auth.uid())
      )
    )
  );

-- notes: authorize by joining session -> passage -> workspace.
create policy notes_all on public.notes
  for all using (
    session_id in (
      select s.id from public.sessions s
      join public.passages p on p.id = s.passage_id
      where p.workspace_id in (
        select workspace_id from public.workspace_members where user_id = (select auth.uid())
      )
    )
  ) with check (
    session_id in (
      select s.id from public.sessions s
      join public.passages p on p.id = s.passage_id
      where p.workspace_id in (
        select workspace_id from public.workspace_members where user_id = (select auth.uid())
      )
    )
  );
