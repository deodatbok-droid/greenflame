-- Module RH GreenFlame : employés + livre de bord (ledger)
-- Conçu pour l'informel (paiements journaliers, hebdo, à la prestation)
-- avec couche formelle optionnelle par employé (CNSS, contrat)

-- ── Employés ──────────────────────────────────────────────────────────────────
create table if not exists merchant_employees (
  id           uuid primary key default gen_random_uuid(),
  merchant_id  uuid not null references merchants(id) on delete cascade,
  full_name    text not null,
  role         text,
  phone        text,
  pay_type     text not null default 'daily'
               check (pay_type in ('daily', 'weekly', 'monthly', 'task')),
  base_amount  numeric,        -- montant de base selon pay_type (FCFA)
  notes        text,
  status       text not null default 'active'
               check (status in ('active', 'inactive')),
  -- Couche formelle (opt-in par employé)
  is_formal       boolean not null default false,
  cnss_number     text,
  contract_type   text check (contract_type in ('cdi', 'cdd', 'freelance') or contract_type is null),
  contract_start  date,
  contract_end    date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists merchant_employees_merchant_id_idx on merchant_employees(merchant_id);

-- ── Livre de bord (append-only) ───────────────────────────────────────────────
create table if not exists employee_ledger (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references merchant_employees(id) on delete cascade,
  merchant_id  uuid not null references merchants(id) on delete cascade,
  type         text not null
               check (type in ('work', 'advance', 'payment', 'bonus', 'deduction')),
  date         date not null default current_date,
  amount       numeric,   -- montant FCFA (peut être null pour type=work si calculé)
  units        numeric,   -- jours/heures/prestations pour type='work'
  note         text,
  -- Couche CNSS (opt-in)
  include_cnss         boolean not null default false,
  cnss_part_employee   numeric,   -- part salarié (%)
  cnss_part_employer   numeric,   -- part patronale (%)
  created_at   timestamptz not null default now()
);

create index if not exists employee_ledger_employee_id_idx on employee_ledger(employee_id);
create index if not exists employee_ledger_merchant_id_idx on employee_ledger(merchant_id);
create index if not exists employee_ledger_date_idx        on employee_ledger(date);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table merchant_employees enable row level security;
alter table employee_ledger     enable row level security;

create policy "merchant_employees_self_access" on merchant_employees
  using (
    merchant_id in (select id from merchants where user_id = auth.uid())
  );

create policy "employee_ledger_self_access" on employee_ledger
  using (
    merchant_id in (select id from merchants where user_id = auth.uid())
  );

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function update_merchant_employees_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger merchant_employees_updated_at
  before update on merchant_employees
  for each row execute function update_merchant_employees_updated_at();
