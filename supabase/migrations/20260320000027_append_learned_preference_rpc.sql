-- LIN-525: Atomic JSONB append for writing profile learned_preferences
-- Replaces the read-modify-write race condition in apply-observation endpoint.
--
-- The function appends a new preference entry to learned_preferences atomically.
-- The NOT (@>) predicate provides idempotency: if the observation_id is already
-- present, the UPDATE matches 0 rows and returns an empty set (already_applied).

create or replace function append_learned_preference(
  p_profile_id uuid,
  p_org_id uuid,
  p_entry jsonb
) returns setof user_writing_profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update user_writing_profiles
  set learned_preferences =
    coalesce(learned_preferences, '[]'::jsonb) || jsonb_build_array(p_entry)
  where id = p_profile_id
    and organization_id = p_org_id
    and not (
      coalesce(learned_preferences, '[]'::jsonb) @>
      jsonb_build_array(jsonb_build_object('observation_id', p_entry->>'observation_id'))
    )
  returning *;
end;
$$;
