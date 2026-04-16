create table if not exists reviewers (
  id text primary key,
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists applicants (
  id text primary key,
  name text not null,
  email text,
  applicant_type text,
  organization text,
  portfolio_link text,
  why_select text,
  created_at timestamptz,
  chatgpt_email text,
  assigned_reviewer_id text references reviewers(id) on update cascade on delete set null,
  raw jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default timezone('utc', now())
);

create table if not exists reviews (
  applicant_id text primary key references applicants(id) on delete cascade,
  reviewer_id text not null references reviewers(id) on update cascade on delete cascade,
  decision text not null check (decision in ('approved', 'rejected')),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists applicants_assigned_reviewer_idx on applicants (assigned_reviewer_id, created_at);
create index if not exists reviews_reviewer_idx on reviews (reviewer_id, updated_at desc);
