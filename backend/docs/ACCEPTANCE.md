# Staging acceptance checklist

Use separate accounts: student A, student B, allowlisted staff, non-KMITL Google, KMITL non-student non-allowlisted. Never test by exposing service-role credentials to the browser.

## Auth and row isolation

- Enable signup hook: deny non-KMITL and unlisted non-student KMITL signup; allow 8-digit KMITL and allowlisted staff.
- API without token/with expired or fabricated token → 401; unrelated Origin → 403; allowed Origin preflight → 204.
- Student A creates report; B cannot GET it, process it, obtain media URL, or read it through PostgREST.
- Student cannot read staff_allowlist, add staff, update profile permissions, write issue_id/severity, set own AI status, or invoke finish_report directly.
- Removing staff from allowlist removes staff access immediately. An 8-digit student remains a student.
- Direct bucket object access fails; signed URL expires; other student cannot request signed URL.

## End-to-end

- Text-only report → receipt → Ubot assessment → issue; no image required.
- Audio-only: create empty report → upload audio → process → stored Thai transcript → issue.
- Image-only: canonical location + image → signed URL sent to vision-capable Ubot → issue.
- Failed transcription/Ubot/TTS: reports remain saved; retry processing after provider fixed; audio receipt failure does not cancel report.
- Same client_request_id posted twice returns same report; distinct UUIDs create distinct reports.
- Concurrent process requests: one claims, other receives 409; retry stale processing after 3 minutes; old attempt cannot finish newer claim.
- AI returns category outside enum, severity 6, or an invented duplicate ID → rejected; report marked failed.
- Same-location/category existing unresolved issue and confidence ≥0.95 → linked; lower confidence or other location → separate issue. Two students' reports must be counted separately.
- Student cannot patch issue; staff can open/in_progress/resolved; updated_at changes.
- Dashboard counts compared with SQL; dates at 16:59:59Z/17:00:00Z cross Bangkok day boundary correctly.
- Briefing JSON and audio agree with database counts; resolved count is new issues for requested day that are currently resolved (not resolution events that day).

## Demo preparation

- Use real authorized Google test accounts; prepare a canonical location and existing issue for duplicate demo.
- Test microphone permission and Thai STT in target browser, then text fallback if microphone denied.
- Test Thai voice/model availability, provider credits, Ubot response latency, and edge execution limit.
- Dashboard shows pending/failed reports and provides manual process/retry; no automatic worker is installed.
- Remove unnecessary private media and demo reports according to team's retention decision.
