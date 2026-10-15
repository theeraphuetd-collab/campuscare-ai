create extension if not exists pgcrypto;
create table public.staff_allowlist (
 email text primary key check (email = lower(email) and email ~ '^[^@]+@kmitl\.ac\.th$')
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 created_at timestamptz not null default now()
);
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users u where u.id = auth.uid()
 and u.email_confirmed_at is not null
 and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google')
 and (lower(u.email) ~ '^[0-9]{8}@kmitl\.ac\.th$'
 or exists(select 1 from public.staff_allowlist s where s.email=lower(u.email))));
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
 select public.is_member() and exists(select 1 from auth.users u
 join public.staff_allowlist s on s.email=lower(u.email) where u.id=auth.uid());
$$;
create function public.before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(event->'user'->>'email');
begin
 if v_email ~ '^[0-9]{8}@kmitl\.ac\.th$' or exists(select 1 from public.staff_allowlist s where s.email=v_email) then
  return '{}'::jsonb;
 end if;
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use an authorized KMITL Google account'));
end; $$;
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id,email) values(new.id,lower(new.email)); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.locations (
 id uuid primary key default gen_random_uuid(), name text unique not null
);
create table public.issues (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 200),
 location_id uuid references public.locations, location_text text not null,
 category text not null check(category in ('electrical','plumbing','accessibility','cleanliness','safety','other')),
 severity integer not null check(severity between 1 and 5),
 status text not null default 'open' check(status in ('open','in_progress','resolved')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null default auth.uid() references public.profiles,
 client_request_id uuid not null, description text not null default '' check(length(description)<=5000),
 transcript text not null default '' check(length(transcript)<=10000),
 location_id uuid references public.locations, location_text text not null default '' check(length(location_text)<=300),
 issue_id uuid references public.issues,
 processing_status text not null default 'pending' check(processing_status in ('pending','processing','completed','failed')),
 processing_started_at timestamptz, attempt_id uuid,
 created_at timestamptz not null default now(), unique(reporter_id,client_request_id)
);
create table public.report_attachments (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports on delete cascade,
 storage_path text not null unique, kind text not null check(kind in ('image','audio')),
 created_at timestamptz not null default now()
);
create table public.ai_assessments (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references public.reports,
 result jsonb not null, created_at timestamptz not null default now()
);
create index reports_owner on public.reports(reporter_id,created_at desc);
create index issues_priority on public.issues(status,severity desc,created_at desc);
create index reports_issue on public.reports(issue_id);
create index attachments_report on public.report_attachments(report_id);
create index issues_location on public.issues(location_id,status);

alter table public.staff_allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.issues enable row level security;
alter table public.reports enable row level security;
alter table public.report_attachments enable row level security;
alter table public.ai_assessments enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(public.is_member() and (id=auth.uid() or public.is_staff()));
create policy locations_read on public.locations for select to authenticated using(public.is_member());
create policy reports_read on public.reports for select to authenticated using(public.is_member() and (reporter_id=auth.uid() or public.is_staff()));
create policy reports_create on public.reports for insert to authenticated with check(public.is_member() and reporter_id=auth.uid() and issue_id is null and processing_status='pending' and attempt_id is null and processing_started_at is null);
create policy issues_read on public.issues for select to authenticated using(public.is_staff() or (public.is_member() and exists(select 1 from public.reports r where r.issue_id=issues.id and r.reporter_id=auth.uid())));
create policy issues_update on public.issues for update to authenticated using(public.is_staff()) with check(public.is_staff());
create policy attachments_read on public.report_attachments for select to authenticated using(exists(select 1 from public.reports r where r.id=report_id));
create policy assessments_read on public.ai_assessments for select to authenticated using(public.is_staff());
revoke all on public.staff_allowlist,public.profiles,public.locations,public.issues,public.reports,public.report_attachments,public.ai_assessments from anon,authenticated;
grant select on public.profiles,public.locations,public.issues,public.reports,public.report_attachments,public.ai_assessments to authenticated;
grant insert(reporter_id,client_request_id,description,location_id,location_text) on public.reports to authenticated;
grant update(status) on public.issues to authenticated;

create function public.touch_issue() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
create trigger issue_updated before update on public.issues for each row execute function public.touch_issue();

-- Claim once; stale claims can be retried after 3 minutes. attempt_id fences old workers.
create function public.claim_report(p_report uuid,p_attempt uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.reports set processing_status='processing',processing_started_at=now(),attempt_id=p_attempt
 where id=p_report and (processing_status in ('pending','failed') or
 (processing_status='processing' and processing_started_at<now()-interval '3 minutes'));
 return found;
end; $$;
create function public.finish_report(p_report uuid,p_attempt uuid,p_result jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.reports; target uuid; candidate uuid;
begin
 -- Serialize merge decisions, including simultaneous reports for the same issue.
 perform pg_advisory_xact_lock(781204);
 select * into r from public.reports where id=p_report for update;
 if r.attempt_id is distinct from p_attempt or r.processing_status<>'processing' then raise exception 'Stale processing attempt'; end if;
 candidate=nullif(p_result->>'duplicate_issue_id','')::uuid;
 if candidate is not null and (p_result->>'duplicate_confidence')::numeric>=0.95 and r.location_id is not null then
  select id into target from public.issues where id=candidate and location_id=r.location_id
   and status<>'resolved' and category=p_result->>'category';
 end if;
 if target is null then
  insert into public.issues(title,location_id,location_text,category,severity)
  values(p_result->>'title',r.location_id,coalesce(nullif(r.location_text,''),p_result->>'location_text','ไม่ทราบตำแหน่ง'),p_result->>'category',(p_result->>'severity')::integer) returning id into target;
 else
  update public.issues set severity=greatest(severity,(p_result->>'severity')::integer) where id=target;
 end if;
 insert into public.ai_assessments(report_id,result) values(p_report,p_result);
 update public.reports set issue_id=target,processing_status='completed' where id=p_report;
 return target;
end; $$;
revoke execute on function public.claim_report(uuid,uuid),public.finish_report(uuid,uuid,jsonb),public.handle_new_user(),public.touch_issue(),public.before_user_created(jsonb),public.is_member(),public.is_staff() from public,anon,authenticated;
grant execute on function public.is_member(),public.is_staff() to authenticated;
grant execute on function public.claim_report(uuid,uuid),public.finish_report(uuid,uuid,jsonb) to service_role;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('report-media','report-media',false,10485760,array['image/jpeg','image/png','image/webp','audio/webm','audio/mpeg','audio/wav','audio/mp4','audio/ogg']);
-- Upload via the authenticated API; read via short-lived signed URLs issued after ownership checks.
