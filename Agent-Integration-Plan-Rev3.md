# Agent Integration Plan — Master (Rev 4)

> **Rev 4** — addresses Cursor's technical review. All agent types, permission names, and auth model references now match the actual codebase. Plan split into two tracks: GhostWriters platform changes vs. external Paperclip/OpenClaw bridge.

## Executive Summary

Build an **Agent Bridge** between Paperclip and the GhostWriters platform. Each agent is bound **per-user per-org** with strict isolation by default. Context sharing is opt-in via existing platform toggles. Platform domain data lives in **Supabase**; provider operational state stays external.

**Agent roles (v1):** `scribe` (Content Writer), `strategist` (Content Strategist), `researcher` (Researcher). Uses existing `AgentType` values — no new types.

**Explicitly out of scope:** Kanban board (board-owned), engineering agent roles (`inspector`, `reviewer`), drag-and-drop.

---

## Track A: GhostWriters Platform Changes

Everything in this track lives in this repo and modifies the Supabase schema, Next.js API routes, or frontend components.

### A1. Fix `agentType` Bug (P0 Blocker)

`src/app/api/admin/agents/route.ts:104` passes undefined `agentType` instead of `parsed.data.agent_type`:

```typescript
// Current (broken):
agentType,
// Fix:
agentType: agent_type,
```

One-line fix. Blocks all new commissions.

### A2. Agent Roles for v1

Use existing `AgentType` values. No schema migration needed.

| User-facing title | `AgentType` value | Permission preset |
|---|---|---|
| Content Writer | `scribe` | `writer` preset |
| Content Strategist | `strategist` | `strategist` preset |
| Researcher | `researcher` | `researcher` preset |

The existing presets in `agent-permissions.ts` already define the correct permission sets:

```typescript
// Actual codebase values:
writer:     ["drafts:read", "drafts:write", "comments:read", "comments:write"]
strategist: ["drafts:read", "comments:read", "pillars:read", "pillars:write", "strategy:read", "strategy:write"]
researcher: ["research:read", "research:write", "strategy:read", "drafts:read"]
```

No permission renaming. No new permission types. We use what exists.

### A3. Human Naming Convention

Agents get random human names. The existing `agents.name` field stores the display name shown to users (e.g., "Sarah Chen"). Add `agents.job_title` for the role label.

**Schema change:**

```sql
ALTER TABLE agents ADD COLUMN job_title text;
```

`display_name` is NOT needed as a separate column — `name` already serves this purpose. The internal Paperclip agent name is stored in the existing `provider_agent_ref` column (already in the schema from migration 000012).

**UI display:** "Sarah Chen · Content Writer" — `name` + `job_title`.

### A4. Posts Agent FK Migration

Add proper FK for agent attribution:

```sql
ALTER TABLE posts ADD COLUMN agent_id uuid REFERENCES agents(id) ON DELETE SET NULL;
```

**Backfill strategy:**
1. Match `posts.created_by_agent` against `agents.name` within the same org
2. Where a unique match exists, populate `agent_id`
3. Where ambiguous or no match, leave `agent_id` NULL
4. Keep `created_by_agent` as denormalized display string — do not remove it
5. Update agent API routes (`/api/drafts`) to write both `agent_id` and `created_by_agent` on new posts

### A5. Per-User Agent Isolation

**Hard rule:** One agent instance per user per org. Each commissioned agent is bound to exactly one `(organization_id, user_id)` pair.

**Enforcement model (current, not changing):** The codebase uses **service-role database access + app-layer authorization**, not RLS as the primary boundary. This is the correct model and we keep it:

- `authenticateAgent()` in `agent-auth.ts` resolves `scopeMode` (`user` | `shared_org`) at auth time
- `canAccessAgentUserRecord()` enforces record-level access in route handlers
- Route handlers check `auth.scopeMode` before querying

We are NOT adding RLS-based enforcement. The app-layer model works, is tested, and is the codebase convention.

**Context sharing (opt-in only):**
- Requires BOTH: `organizations.context_sharing_enabled = true` AND `agents.allow_shared_context = true`
- `resolveAgentScopeMode()` in `agent-auth.ts` already implements this logic
- When both are on, agent gets `shared_org` scope (read across users in org)
- Writing remains scoped to assigned user — enforced by route handlers

**Strategist shared-context provisioning rule:**

The Content Strategist defaults to `allow_shared_context = true` because they need org-wide content visibility for strategy work. Three possible outcomes at provisioning time:

| Org setting | Agent setting | Result |
|---|---|---|
| `context_sharing_enabled = true` | `allow_shared_context = true` | `shared_org` scope — full strategy visibility |
| `context_sharing_enabled = false` | `allow_shared_context = true` | **Auto-downgrade to `user` scope** — agent works but with limited visibility. Log a warning. Do NOT block provisioning. |

**Decision:** Auto-downgrade, not hard-fail. The org admin can enable sharing later and the strategist automatically gets broader scope on next auth. No pending-approval blocker needed.

### A6. Agent Activity Log

```sql
CREATE TABLE agent_activity_log(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  agent_id uuid REFERENCES agents(id),
  post_id uuid REFERENCES posts(id),
  action_type text NOT NULL,  -- 'draft_created', 'draft_updated', 'review_submitted', 'status_changed', 'comment_added'
  metadata jsonb,             -- truncated payload summary (not full content)
  created_at timestamptz DEFAULT now()
);
```

Note: `run_id`, `session_key`, and `duration_ms` are **provider-specific fields** that belong in Track B, not in the platform table. The platform activity log tracks domain actions only.

### A7. User Writing Style Profiles

```sql
CREATE TABLE user_writing_profiles(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid REFERENCES organizations(id),
  tone text,
  voice_notes text,
  sample_post_ids uuid[],
  avoid_topics text[],
  preferred_formats text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id)
);
```

This is how isolated agents read the correct user's writing style. Scoped by `(user_id, organization_id)`.

### A8. Realtime Subscriptions

- `usePostsRealtime()` hook — subscribe to `postgres_changes` on `posts` filtered by `organization_id`
- Dashboard-only for v1
- Agent activity feed: subscribe to `agent_activity_log` inserts
- Notifications: subscribe to `notifications` inserts filtered by `user_id`

### A9. Hiring Request Workflow

The `agent_hiring_requests` table and `invitation_requests` table already exist (migration 000013). The org-admin submission UI is currently a "Coming Soon" stub. This is NOT a hypothetical future feature — the schema is live.

**Decision:** Keep this at P3 priority but acknowledge it is active schema, not greenfield. The bridge provisioning (Track B) can coexist with the existing request workflow:

- **Org-admin path:** User submits hiring request → platform admin approves → agent commissioned
- **Paperclip bridge path:** CEO (Rainmaker) approves hire → bridge provisions agent

Both paths call `commissionAgentWithInitialKey()` — same provisioning function, different trigger.

---

## Track B: External Paperclip/OpenClaw Bridge

Everything in this track involves Paperclip's runtime, OpenClaw adapters, or cross-system coordination. These concepts (`adapterConfig`, `devicePrivateKeyPem`, `x-openclaw-token`, `operator.admin`, `executionRunId`, `sessionKeyStrategy`) do NOT live in this repo.

### B1. Provisioning Source of Truth

**Decision:** **Paperclip approval is the trigger; GhostWriters platform is the system of record.**

- Paperclip manages agent lifecycle (hiring, heartbeats, task assignment)
- GhostWriters platform stores the agent record, permissions, and API keys
- The bridge endpoint translates a Paperclip hire approval into a GhostWriters commissioning call
- **Idempotency key:** `provider_agent_ref` (Paperclip agent UUID). If an agent with the same `provider_agent_ref` already exists in GhostWriters, the bridge returns the existing record instead of creating a duplicate.

### B2. Bridge Provisioning Flow

```
Paperclip hire approved
  → CEO heartbeat detects new agent
  → POST /api/agent-bridge/provision
    {
      organization_id,
      user_id,
      name: "Sarah Chen",        ← random human name
      job_title: "Content Writer",
      agent_type: "scribe",      ← existing AgentType value
      provider: "paperclip",
      provider_agent_ref: paperclip_agent_uuid
    }
  → Idempotency check (provider_agent_ref)
  → commissionAgentWithInitialKey()
  → Return API key to Paperclip
  → Paperclip stores key in its own adapter config
```

**Atomic error handling:** If commissioning succeeds but Paperclip fails to store the key, the GhostWriters agent exists but has no working bridge. The bridge endpoint returns the key; Paperclip is responsible for storing it. If Paperclip retries, idempotency returns the same agent (a new key can be generated if needed).

### B3. Credential Security (Paperclip-side)

These are Paperclip operational concerns, not GhostWriters platform changes:

- Move `devicePrivateKeyPem` and `x-openclaw-token` out of plaintext `adapterConfig` to a secrets vault
- Add `keyExpiresAt` for rotation scheduling
- Restrict which agents can read other agents' `adapterConfig`
- Define minimum viable OpenClaw scopes per role (instead of blanket `operator.admin`)

| Agent role | Recommended OpenClaw scope |
|---|---|
| `scribe` (Content Writer) | `operator.write` |
| `strategist` (Content Strategist) | `operator.read` |
| `researcher` (Researcher) | `operator.read` |
| CEO, PM | `operator.admin` |

### B4. Provider-Specific Activity Metadata

For Paperclip-side observability, the bridge can optionally send enriched metadata when logging domain actions via the platform activity log:

```json
{
  "provider_run_id": "X-Paperclip-Run-Id value",
  "provider_session_key": "OpenClaw session key",
  "duration_ms": 1234
}
```

This goes in the `metadata` jsonb field of `agent_activity_log`, not as top-level columns. Keeps the platform schema clean while still supporting cross-system debugging.

---

## Phased Delivery

### Track A (GhostWriters Platform)

| Phase | Scope | Priority | Blocker? |
|---|---|---|---|
| **P0** | Fix `agentType` bug in `route.ts:104` | Critical | Yes |
| **P1** | Add `job_title` column to `agents` table | High | No |
| **P1** | Posts `agent_id` FK migration + backfill | High | No |
| **P2** | Realtime subscriptions (dashboard-only) | Medium | No |
| **P2** | Agent activity log table + server action inserts | Medium | No |
| **P2** | User writing profiles table + basic CRUD | Medium | No |
| **P3** | Hiring request submission UI (schema exists) | Low | No |

### Track B (Paperclip/OpenClaw Bridge)

| Phase | Scope | Priority | Blocker? |
|---|---|---|---|
| **P0** | Credential vault migration (move keys out of plaintext) | Critical | Yes |
| **P0** | Bridge provisioning endpoint with idempotency | Critical | Yes |
| **P1** | Minimum viable OpenClaw scopes per role | High | No |
| **P1** | Key rotation + `keyExpiresAt` | High | No |
| **P2** | Agent busyness check before task assignment | Medium | No |

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Private keys in plaintext adapterConfig | **P0** | Track B: vault migration before new provisioning |
| `agentType` bug blocks commissions | **P0** | Track A: one-line fix |
| Permission name mismatch in integration contracts | High | Plan now uses actual codebase values (`drafts:read` etc.) |
| Orphaned agent on partial bridge failure | High | Idempotency key (`provider_agent_ref`) + retry-safe design |
| Strategist gets limited scope when org sharing is off | Medium | Auto-downgrade with warning; org admin can enable later |
| Dual provisioning paths (org-admin + Paperclip) | Medium | Both call same `commissionAgentWithInitialKey()`, idempotent on `provider_agent_ref` |

---

## Out of Scope (Confirmed)

- **Kanban board** — board-owned
- **Engineering agent roles** (`inspector`, `reviewer`) — not in v1
- **Interactive drag-and-drop** — deferred
- **RLS-based isolation** — app-layer auth model is correct and stays
- **New `AgentType` values** — use existing `scribe`, `strategist`, `researcher`
- **New permission names** — use existing namespace (`drafts:read`, etc.)
- **Full API call logging** — domain actions only via activity log

