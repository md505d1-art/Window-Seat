-- Row-level security tests for Orbit. Each block raises an exception on failure.
\set ON_ERROR_STOP 1

-- Two users. The auth trigger must create a profile for each.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ada@example.com', '{"display_name":"Ada"}'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@example.com', '{}');

do $$ begin
  if (select count(*) from public.profiles) <> 2 then raise exception 'FAIL: profiles not created by trigger'; end if;
  if (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') <> 'ben' then
    raise exception 'FAIL: display name fallback';
  end if;
end $$;

-- ── Ada creates data ──────────────────────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

insert into public.flip_items (id, sku, title, purchase_price, sale_price, status)
  values ('10000000-0000-0000-0000-000000000001', 'FL-0001', 'levi''s 501 jeans', 8, 32, 'sold');
insert into public.atlas_trips (id, title, start_date, end_date)
  values ('20000000-0000-0000-0000-000000000001', 'Lisbon', '2027-03-01', '2027-03-05');
insert into public.spark_projects (id, name, linked_trip_id)
  values ('30000000-0000-0000-0000-000000000001', 'Travel vlog', '20000000-0000-0000-0000-000000000001');
insert into public.spark_tasks (project_id, title) values ('30000000-0000-0000-0000-000000000001', 'Script episode one');
insert into storage.objects (bucket_id, name) values ('orbit-files', '00000000-0000-0000-0000-00000000000a/flip/photo.jpg');

do $$ begin
  if (select user_id from public.flip_items where sku = 'FL-0001') <> auth.uid() then
    raise exception 'FAIL: user_id should default to auth.uid()';
  end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: Ada can see other profiles'; end if;
end $$;

-- ── Ben cannot see, change or reference Ada's data ───────────────────────────
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';

do $$
declare n int;
begin
  select count(*) into n from public.flip_items;       if n <> 0 then raise exception 'FAIL: Ben sees flip_items'; end if;
  select count(*) into n from public.atlas_trips;      if n <> 0 then raise exception 'FAIL: Ben sees trips'; end if;
  select count(*) into n from public.spark_projects;   if n <> 0 then raise exception 'FAIL: Ben sees projects'; end if;
  select count(*) into n from public.spark_tasks;      if n <> 0 then raise exception 'FAIL: Ben sees tasks'; end if;
  select count(*) into n from storage.objects;         if n <> 0 then raise exception 'FAIL: Ben sees files'; end if;

  update public.flip_items set sale_price = 0 where sku = 'FL-0001';
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL: Ben updated Ada''s item'; end if;
  delete from public.atlas_trips;
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL: Ben deleted Ada''s trip'; end if;
end $$;

-- Ben cannot write a row owned by Ada.
do $$ begin
  begin
    insert into public.flip_items (sku, user_id) values ('FL-9999', '00000000-0000-0000-0000-00000000000a');
    raise exception 'FAIL: Ben inserted a row for Ada';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Ben cannot link his project to Ada's trip, even knowing its id (composite foreign key).
do $$ begin
  begin
    insert into public.spark_projects (name, linked_trip_id) values ('Sneaky', '20000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: Ben linked to Ada''s trip';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Ben cannot add a task to Ada's project.
do $$ begin
  begin
    insert into public.spark_tasks (project_id, title) values ('30000000-0000-0000-0000-000000000001', 'x');
    raise exception 'FAIL: Ben added a task to Ada''s project';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Ben cannot upload into Ada's storage folder, but can upload into his own.
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('orbit-files', '00000000-0000-0000-0000-00000000000a/evil.jpg');
    raise exception 'FAIL: Ben uploaded into Ada''s folder';
  exception when insufficient_privilege then null;
  end;
  insert into storage.objects (bucket_id, name) values ('orbit-files', '00000000-0000-0000-0000-00000000000b/mine.jpg');
end $$;

-- Ben cannot move his own row over to Ada.
insert into public.flip_items (id, sku) values ('10000000-0000-0000-0000-000000000002', 'FL-0001');
do $$ begin
  begin
    update public.flip_items set user_id = '00000000-0000-0000-0000-00000000000a' where id = '10000000-0000-0000-0000-000000000002';
    raise exception 'FAIL: Ben reassigned a row to Ada';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Anonymous visitors get nothing ───────────────────────────────────────────
reset role;
set role anon;
set request.jwt.claim.sub = '';
do $$ begin
  begin
    perform 1 from public.flip_items;
    raise exception 'FAIL: anon can read flip_items';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Cascades and set-null behave per user ────────────────────────────────────
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
delete from public.atlas_trips where id = '20000000-0000-0000-0000-000000000001';
do $$ begin
  if (select linked_trip_id from public.spark_projects where id = '30000000-0000-0000-0000-000000000001') is not null then
    raise exception 'FAIL: deleting a trip should clear the project link';
  end if;
  if (select user_id from public.spark_projects where id = '30000000-0000-0000-0000-000000000001') is null then
    raise exception 'FAIL: set null cleared user_id too';
  end if;
end $$;
delete from public.spark_projects where id = '30000000-0000-0000-0000-000000000001';
do $$ begin
  if exists (select 1 from public.spark_tasks) then raise exception 'FAIL: tasks should cascade with project'; end if;
end $$;

-- Account deletion removes every row the user owns.
select public.delete_my_account() \gset
reset role;
do $$ begin
  if exists (select 1 from public.flip_items where user_id = '00000000-0000-0000-0000-00000000000a') then
    raise exception 'FAIL: account deletion left rows behind';
  end if;
  if not exists (select 1 from public.flip_items where user_id = '00000000-0000-0000-0000-00000000000b') then
    raise exception 'FAIL: account deletion touched another user';
  end if;
end $$;

select 'all RLS assertions passed' as result;
