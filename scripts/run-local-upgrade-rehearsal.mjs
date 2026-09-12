import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createLocalRollbackPlan, safeLocalFailure } from './run-local-database-rollback-proof.mjs';

// Exact ledger SQL, not a replay of historical scheduler or fixture initializers.
const priorPolicy = "drop policy if exists \"participants and case admins read safe evidence\" on public.deal_evidence;\ncreate policy \"participants and case admins read safe evidence\"\non public.deal_evidence\nfor select\nto authenticated\nusing (\n  exists (\n    select 1\n    from public.deals deal\n    where deal.id = deal_evidence.deal_id\n      and (\n        deal.seller_id = (select auth.uid())\n        or deal.buyer_id = (select auth.uid())\n      )\n  )\n  or exists (\n    select 1\n    from public.get_admin_disputes('all') dispute\n    where dispute.deal_id = deal_evidence.deal_id\n  )\n);";
const upgrade = "create or replace function public.can_admin_read_deal_evidence(p_deal_id uuid)\nreturns boolean\nlanguage sql\nstable\nsecurity definer\nset search_path = public, auth, pg_temp\nas $$\n  select public.is_dealsafe_admin()\n    and exists (\n      select 1 from public.deal_disputes dispute\n      where dispute.deal_id = p_deal_id\n    );\n$$;\nrevoke all on function public.can_admin_read_deal_evidence(uuid)\n  from public, anon, authenticated;\ngrant execute on function public.can_admin_read_deal_evidence(uuid)\n  to authenticated, service_role;\ndrop policy if exists \"participants and case admins read safe evidence\" on public.deal_evidence;\ncreate policy \"participants and case admins read safe evidence\"\non public.deal_evidence\nfor select\nto authenticated\nusing (\n  exists (\n    select 1 from public.deals deal\n    where deal.id = deal_evidence.deal_id\n      and (\n        deal.seller_id = (select auth.uid())\n        or deal.buyer_id = (select auth.uid())\n      )\n  )\n  or (select public.can_admin_read_deal_evidence(deal_evidence.deal_id))\n);";
const digest = value => createHash('sha256').update(value).digest('hex');
if (digest(priorPolicy) !== 'c02395392171f6f6e33c67cc88a00e2948e9c7ce5b032355a046f90ed08b8733'
  || digest(upgrade) !== 'e752003abd19b0c2f7f7175be33052538c2d324790e87a450fe562016ade9948') {
  throw new Error('Reviewed upgrade SQL digest changed.');
}
const before = `
begin;
do $guard$
begin
  if current_setting('dealivra.local_fixture_bootstrap', true) is distinct from 'on'
     or (select count(*) from auth.users) <> 4
     or exists (select 1 from auth.users where encrypted_password <> '')
     or exists (select 1 from auth.sessions)
     or (select count(*) from cron.job) <> 2
     or exists (select 1 from cron.job where active or command <> 'select 1')
     or exists (select 1 from net.http_request_queue)
  then raise exception 'Upgrade requires isolated synthetic fixtures'; end if;
end $guard$;

create temp table upgrade_target as
select pg_get_functiondef('public.can_admin_read_deal_evidence(uuid)'::regprocedure) as definition,
       (select pg_get_expr(polqual, polrelid) from pg_policy
        where polrelid='public.deal_evidence'::regclass
          and polname='participants and case admins read safe evidence') as policy;
create temp table upgrade_acl as
select a.grantor, a.grantee, a.privilege_type, a.is_grantable
from pg_proc p, lateral aclexplode(p.proacl) a
where p.oid='public.can_admin_read_deal_evidence(uuid)'::regprocedure;

create function pg_temp.upgrade_rows() returns table(object_name text, fingerprint text)
language plpgsql as $snapshot$
declare item record;
begin
  for item in
    select n.nspname, c.relname from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','dealsafe_private','auth','storage','vault','cron')
      and c.relkind='r'
  loop
    object_name := item.nspname || '.' || item.relname;
    execute format('select md5(coalesce(string_agg(to_jsonb(t)::text, E''\\n'' order by to_jsonb(t)::text), '''')) from %I.%I t', item.nspname,item.relname)
    into fingerprint;
    return next;
  end loop;
end $snapshot$;
create temp table upgrade_rows_before as select * from pg_temp.upgrade_rows();
`;
const boundary = `
drop function public.can_admin_read_deal_evidence(uuid);
do $prior$
begin
  if to_regprocedure('public.can_admin_read_deal_evidence(uuid)') is not null
     or not exists (select 1 from pg_policy
       where polrelid='public.deal_evidence'::regclass
         and polname='participants and case admins read safe evidence'
         and pg_get_expr(polqual,polrelid) like '%get_admin_disputes%')
  then raise exception 'Predecessor boundary was not reconstructed'; end if;
end $prior$;
`;
const after = `
do $verify$
begin
  if (select definition from upgrade_target) is distinct from
       pg_get_functiondef('public.can_admin_read_deal_evidence(uuid)'::regprocedure)
     or (select policy from upgrade_target) is distinct from
       (select pg_get_expr(polqual, polrelid) from pg_policy
         where polrelid='public.deal_evidence'::regclass
           and polname='participants and case admins read safe evidence')
  then raise exception 'Upgrade target definition mismatch'; end if;
  if exists (
    (select * from upgrade_rows_before except select * from pg_temp.upgrade_rows())
    union all
    (select * from pg_temp.upgrade_rows() except select * from upgrade_rows_before)
  ) then raise exception 'Upgrade changed persisted fixture data'; end if;
  if exists (
    (select * from upgrade_acl except
     select a.grantor,a.grantee,a.privilege_type,a.is_grantable
     from pg_proc p,lateral aclexplode(p.proacl) a
     where p.oid='public.can_admin_read_deal_evidence(uuid)'::regprocedure)
    union all
    (select a.grantor,a.grantee,a.privilege_type,a.is_grantable
     from pg_proc p,lateral aclexplode(p.proacl) a
     where p.oid='public.can_admin_read_deal_evidence(uuid)'::regprocedure
     except select * from upgrade_acl)
  ) then raise exception 'Upgrade target ACL mismatch'; end if;
end $verify$;
commit;
`;

let temporary;
try {
  const plan = createLocalRollbackPlan();
  temporary = mkdtempSync(join(tmpdir(), 'dealivra-local-upgrade-'));
  const sqlFile = join(temporary, 'rehearsal.sql');
  writeFileSync(sqlFile, [before, priorPolicy, boundary, upgrade, after].join('\n'), { mode: 0o600 });
  // Reuse the already populated fixture; never bypass or rerun its bootstrap.
  for (const file of [sqlFile, ...plan.files.slice(1)]) {
    const result = spawnSync('psql', [
      '--host=127.0.0.1', '--port=54322', '--username=postgres', '--dbname=postgres',
      '--no-password', '-X', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=verbose',
      '--quiet', '--file=' + file,
    ], { env: plan.env, shell: false, encoding: 'utf8', timeout: 90000,
      maxBuffer: 1048576, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
    if (result.status !== 0 || result.error || result.signal) {
      throw new Error('Local upgrade rehearsal failed. ' + safeLocalFailure(result));
    }
  }
  console.log(JSON.stringify({ status: 'passed', predecessor: '20260810231010',
    upgrade: '20260810232053', scope: 'reconstructed-final-authorization-boundary',
    persisted_rows: 'unchanged', function_policy_acl: 'matched', rollback_suites: 17 }));
} catch (error) {
  console.error(error?.message?.startsWith('Local upgrade rehearsal failed.')
    ? error.message : 'Local upgrade rehearsal rejected; diagnostic output withheld.');
  process.exitCode = 1;
} finally {
  if (temporary && dirname(resolve(temporary)) === resolve(tmpdir())
    && basename(temporary).startsWith('dealivra-local-upgrade-')) {
    rmSync(temporary, { recursive: true, force: true });
  }
}
