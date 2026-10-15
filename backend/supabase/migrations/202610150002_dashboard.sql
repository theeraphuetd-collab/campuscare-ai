create function public.dashboard_summary(p_start timestamptz,p_end timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_end<=p_start or p_end-p_start>interval '2 days' then raise exception 'Invalid date range'; end if;
 return jsonb_build_object(
  'report_count',(select count(*) from public.reports where created_at>=p_start and created_at<p_end),
  'backlog_count',(select count(*) from public.issues where status<>'resolved'),
  'issues',coalesce((select jsonb_agg(jsonb_build_object('severity',severity,'status',status,'category',category)) from public.issues where created_at>=p_start and created_at<p_end),'[]'::jsonb),
  'by_category',coalesce((select jsonb_object_agg(category,total) from (select category,count(*) total from public.issues where status<>'resolved' group by category) c),'{}'::jsonb),
  'by_location',coalesce((select jsonb_agg(row_to_json(l)) from (select location_id,location_text,count(*) total from public.issues where status<>'resolved' group by location_id,location_text order by count(*) desc limit 10) l),'[]'::jsonb)
 );
end; $$;
revoke execute on function public.dashboard_summary(timestamptz,timestamptz) from public,anon;
grant execute on function public.dashboard_summary(timestamptz,timestamptz) to authenticated;
