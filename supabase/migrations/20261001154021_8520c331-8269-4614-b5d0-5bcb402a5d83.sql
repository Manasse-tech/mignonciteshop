create type public.app_role as enum ('admin', 'moderator', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.documents (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  owner uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index documents_collection_idx on public.documents (collection);

grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update on public.documents to anon;
grant all on public.documents to service_role;
alter table public.documents enable row level security;

-- Lecture
create policy "docs_read" on public.documents for select to anon, authenticated using (
  public.has_role(auth.uid(), 'admin')
  or collection in ('categories', 'settings', 'reviews', 'promos', 'orderLookups')
  or (collection = 'products' and data->>'isActive' = 'true')
  or (collection = 'users' and id = auth.uid()::text)
  or (collection = 'loyalty' and id = auth.uid()::text)
  or (collection like 'loyalty/%/transactions' and split_part(collection, '/', 2) = auth.uid()::text)
  or (collection = 'orders' and auth.uid() is not null and (
        data->>'uid' = auth.uid()::text
        or lower(data->>'email') = lower(auth.jwt()->>'email')))
  or (collection = 'paymentTransactions' and owner is not null and owner = auth.uid())
);

-- Création
create policy "docs_insert" on public.documents for insert to anon, authenticated with check (
  public.has_role(auth.uid(), 'admin')
  or collection in ('messages', 'newsletter', 'stockAlerts', 'analytics', 'emailLogs')
  or (collection = 'users' and id = auth.uid()::text)
  or (collection = 'orders' and data->>'status' = 'pending' and data->>'paymentStatus' = 'unpaid'
        and (auth.uid() is null or data->>'uid' = auth.uid()::text))
  or (collection = 'orderLookups' and data->>'status' = 'pending')
  or (collection = 'loyalty' and id = auth.uid()::text)
  or (collection like 'loyalty/%/transactions' and split_part(collection, '/', 2) = auth.uid()::text)
  or (collection = 'reviews' and auth.uid() is not null and (data->>'isApproved') = 'false')
  or (collection = 'paymentTransactions' and data->>'status' = 'pending')
);

-- Modification
create policy "docs_update" on public.documents for update to anon, authenticated using (
  public.has_role(auth.uid(), 'admin')
  or (collection = 'users' and id = auth.uid()::text)
  or (collection = 'loyalty' and id = auth.uid()::text)
  or collection = 'promos'
) with check (
  public.has_role(auth.uid(), 'admin')
  or (collection = 'users' and id = auth.uid()::text)
  or (collection = 'loyalty' and id = auth.uid()::text)
  or collection = 'promos'
);

-- Suppression
create policy "docs_delete" on public.documents for delete to authenticated using (
  public.has_role(auth.uid(), 'admin')
  or (collection in ('users', 'loyalty') and id = auth.uid()::text)
);

-- Garde-fous et synchronisation des rôles
create or replace function public.documents_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_admin boolean := public.has_role(auth.uid(), 'admin');
  admin_count int;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.owner := old.owner;
    new.created_at := old.created_at;
  end if;

  -- Codes promo : un client ne peut qu'incrémenter usageCount de 1
  if new.collection = 'promos' and tg_op = 'UPDATE' and not is_admin then
    if (new.data - 'usageCount') is distinct from (old.data - 'usageCount')
       or coalesce((new.data->>'usageCount')::numeric, 0) <> coalesce((old.data->>'usageCount')::numeric, 0) + 1 then
      raise exception 'permission-denied';
    end if;
  end if;

  -- Profils : rôle admin réservé
  if new.collection = 'users' then
    if coalesce(new.data->>'role', 'customer') = 'admin' then
      if not is_admin then
        select count(*) into admin_count from public.user_roles where role = 'admin';
        if admin_count > 0 or new.id <> auth.uid()::text then
          raise exception 'permission-denied';
        end if;
      end if;
      insert into public.user_roles (user_id, role) values (new.id::uuid, 'admin')
        on conflict do nothing;
    else
      if tg_op = 'UPDATE' and coalesce(old.data->>'role', 'customer') = 'admin' then
        if not is_admin then raise exception 'permission-denied'; end if;
        delete from public.user_roles where user_id = new.id::uuid and role = 'admin';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger documents_guard_trg before insert or update on public.documents
  for each row execute function public.documents_guard();

alter publication supabase_realtime add table public.documents;