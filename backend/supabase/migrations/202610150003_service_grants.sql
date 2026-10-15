-- Explicit privileges rather than relying on project-specific default grants.
grant all on public.staff_allowlist,public.profiles,public.locations,public.issues,
 public.reports,public.report_attachments,public.ai_assessments to service_role;
