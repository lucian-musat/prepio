-- Content tree: nodes contain child nodes and lessons.
create table nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references nodes (id) on delete cascade,
  title text not null,
  position int not null default 0
);
create index nodes_parent_id_idx on nodes (parent_id);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references nodes (id) on delete cascade,
  title text not null,
  position int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);
create index lessons_node_id_idx on lessons (node_id);

create table cards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  position int not null default 0,
  title text,
  body text not null,
  image_path text,
  image_credit text
);
create index cards_lesson_id_idx on cards (lesson_id);

-- options holds ChoiceOption[] ({id, text, correct}) or OrderItem[] ({id, text, label?}) from @prepio/shared.
create table questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  position int not null default 0,
  type text not null check (type in ('single_choice', 'multiple_choice', 'chronological_order')),
  prompt text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  explanation text,
  options jsonb not null
);
create index questions_lesson_id_idx on questions (lesson_id);

create table writing_exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons (id) on delete cascade,
  position int not null default 0,
  prompt text not null,
  criteria text not null
);
create index writing_exercises_lesson_id_idx on writing_exercises (lesson_id);

create table settings (
  id int primary key check (id = 1),
  welcome_message text not null
);

create table ai_settings (
  id int primary key check (id = 1),
  rules text not null,
  grade_min int not null default 1,
  grade_max int not null default 10,
  model text not null default 'gpt-5-mini',
  check (grade_max > grade_min)
);

create table rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);
