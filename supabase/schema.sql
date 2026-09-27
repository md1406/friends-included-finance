-- Friends Included Ltd: source-of-truth schema
-- Run this once in Supabase SQL Editor before configuring the app.

create type employee_role as enum ('manager', 'salesperson', 'expense_reporter');
create type project_code as enum ('A', 'B');
create type expense_category as enum ('Materials', 'Travel', 'Other');
create type expense_allocation as enum ('A', 'B', 'Company overhead');
create type sale_status as enum ('Pending approval', 'Approved');
create type expense_status as enum ('Awaiting allocation', 'Allocated');
create type delivery_status as enum ('Not needed', 'Pending', 'Sent', 'Failed');
create type sync_status as enum ('Pending', 'Synced', 'Failed');

create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role employee_role not null,
  telegram_user_id bigint unique,
  linked_telegram_chat_id bigint,
  created_at timestamptz not null default now()
);

insert into employees (name, role) values
  ('Svetlana de Monte Carlo', 'manager'),
  ('Richard Darling', 'salesperson'),
  ('Anastasia Ferrari', 'salesperson'),
  ('Jean-Claude Bērziņš', 'salesperson'),
  ('Kevin von Whatever', 'expense_reporter');

-- A single registry enforces reference uniqueness across sales and expenses.
create table transaction_references (
  reference text primary key check (reference ~ '^[SE][0-9]{2,}$'),
  kind text not null check (kind in ('sale', 'expense')),
  created_at timestamptz not null default now()
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique references transaction_references(reference),
  submitted_at timestamptz not null default now(),
  salesperson_id uuid not null references employees(id),
  notification_chat_id bigint,
  customer text not null check (length(trim(customer)) > 0),
  project project_code not null,
  description text not null check (length(trim(description)) > 0),
  amount_cents integer not null check (amount_cents > 0),
  proposed_richard_pct numeric(5,2) not null check (proposed_richard_pct between 0 and 100),
  proposed_anastasia_pct numeric(5,2) not null check (proposed_anastasia_pct between 0 and 100),
  proposed_jean_claude_pct numeric(5,2) not null check (proposed_jean_claude_pct between 0 and 100),
  status sale_status not null default 'Pending approval',
  approved_richard_pct numeric(5,2),
  approved_anastasia_pct numeric(5,2),
  approved_jean_claude_pct numeric(5,2),
  richard_commission_cents integer not null default 0 check (richard_commission_cents >= 0),
  anastasia_commission_cents integer not null default 0 check (anastasia_commission_cents >= 0),
  jean_claude_commission_cents integer not null default 0 check (jean_claude_commission_cents >= 0),
  approved_at timestamptz,
  approved_by uuid references employees(id),
  sync_status sync_status not null default 'Pending',
  sync_error text,
  notification_status delivery_status not null default 'Not needed',
  notification_error text,
  constraint proposed_split_is_100 check (proposed_richard_pct + proposed_anastasia_pct + proposed_jean_claude_pct = 100),
  constraint approved_split_is_complete check (
    (status = 'Pending approval' and approved_richard_pct is null and approved_anastasia_pct is null and approved_jean_claude_pct is null)
    or
    (status = 'Approved' and approved_richard_pct + approved_anastasia_pct + approved_jean_claude_pct = 100)
  )
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique references transaction_references(reference),
  submitted_at timestamptz not null default now(),
  reporter_id uuid not null references employees(id),
  notification_chat_id bigint,
  description text not null check (length(trim(description)) > 0),
  category expense_category not null,
  amount_cents integer not null check (amount_cents > 0),
  proposed_allocation expense_allocation not null,
  status expense_status not null,
  final_allocation expense_allocation,
  allocated_at timestamptz,
  allocated_by uuid references employees(id),
  sync_status sync_status not null default 'Pending',
  sync_error text,
  notification_status delivery_status not null default 'Not needed',
  notification_error text,
  constraint allocation_is_consistent check (
    (status = 'Awaiting allocation' and final_allocation is null)
    or
    (status = 'Allocated' and final_allocation is not null)
  )
);

create index sales_status_idx on sales(status);
create index expenses_status_idx on expenses(status);

-- Keep direct database access private. The Next.js server uses the service-role key;
-- browser code never receives it.
alter table employees enable row level security;
alter table transaction_references enable row level security;
alter table sales enable row level security;
alter table expenses enable row level security;
