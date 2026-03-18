-- Add job_title column to agents table for human-readable role labels.
-- Display format: "Sarah Chen · Content Writer" (name + job_title).
-- Ref: LIN-150 Plan (Rev 4) — Section A3.

alter table public.agents
  add column if not exists job_title text;

-- Backfill existing agents with a sensible default based on agent_type.
update public.agents set job_title = case agent_type
  when 'scribe'     then 'Content Writer'
  when 'strategist' then 'Content Strategist'
  when 'researcher' then 'Researcher'
  when 'inspector'  then 'Inspector'
  when 'reviewer'   then 'Reviewer'
  else null
end
where job_title is null;
