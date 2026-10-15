-- Run once on the existing database AFTER setup.sql. Do not rerun setup.sql.
create function public.guard_attachment_insert() returns trigger
language plpgsql security definer set search_path='' as $$
declare report_status text;
begin
 select processing_status into report_status from public.reports where id=new.report_id for update;
 if report_status is null or report_status not in ('pending','failed') then
  raise exception 'Report is not accepting attachments' using errcode='23514';
 end if;
 if (select count(*) from public.report_attachments where report_id=new.report_id)>=5 then
  raise exception 'Maximum 5 attachments per report' using errcode='23514';
 end if;
 return new;
end; $$;
revoke execute on function public.guard_attachment_insert() from public,anon,authenticated;
create trigger attachment_insert_guard before insert on public.report_attachments
for each row execute function public.guard_attachment_insert();
