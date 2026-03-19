# Agent Setup Guide: Scribe & Strategist

A complete walkthrough to commission your agents, connect them to the platform, and get them creating content.

---

## Part 1: Commission Your Agents

You need to create (commission) your Scribe and Strategist agents first. There are two ways to do this.

### Option A: Request via Team Page (Recommended)

1. Go to `/team` in your dashboard.
2. Scroll to **"Request Agent Team"**.
3. Select the **user** the agents should write for (each agent is bound to one user).
4. Choose the **Editorial Core** preset — this gives you:
   - **Brand Writer** (Scribe) — creates and edits drafts
   - **Content Strategist** (Strategist) — plans pillars and strategy docs
   - **Review Inspector** — reviews and approves drafts
5. Optionally check **"Enable shared org context"** to let agents read content across your whole org (writes stay scoped to the assigned user).
6. Click **Submit**. A platform admin will approve the request.
7. Once fulfilled, your agents appear on the `/team` page with **Active** status and their API keys are generated.

### Option B: Direct Commission (Platform Admin)

1. Go to `/settings/agents`.
2. Click **"Commission Agent"** and fill in:

| Field | Scribe | Strategist |
|---|---|---|
| Name | e.g. "Brand Writer" | e.g. "Content Strategist" |
| Agent Type | `scribe` | `strategist` |
| Provider | `ghostwriters` | `ghostwriters` |
| Organization | Your org | Your org |
| User | Who they write for | Who they plan for |

3. Click save. **Copy the API key immediately** — it looks like `gw_agent_...` and cannot be retrieved again.
4. Repeat for the second agent.

---

## Part 2: Connect Your Agents

Every API call your agent makes uses its API key as a Bearer token:

```
Authorization: Bearer gw_agent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

Your base URL is your Ghostwriters instance (e.g. `https://your-instance.ghostwritersinc.com`).

---

## Part 3: Put Scribe to Work — Creating Drafts

Scribe creates LinkedIn post drafts via the API.

### Create a draft

```bash
curl -X POST /api/drafts \
  -H "Authorization: Bearer gw_agent_YOUR_SCRIBE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "3 lessons I learned from launching a product in 30 days:\n\n1. Ship before you are ready...",
    "content_type": "text",
    "pillar": "Thought Leadership",
    "suggested_publish_at": "2026-03-24T09:00:00Z"
  }'
```

**Required fields:** `content` (the post text, minimum 1 character).

**Optional fields:**

| Field | Description |
|---|---|
| `content_type` | `"text"`, `"image"`, or `"document"` (default: `"text"`) |
| `pillar` | Content pillar name (e.g. "Thought Leadership") |
| `pillar_id` | UUID of an existing pillar |
| `brief_ref` | Reference to a content brief (e.g. `"mar_2026_product_launch"`) |
| `suggested_publish_at` | ISO 8601 datetime for when to publish |
| `media_urls` | Array of URLs for images/media attachments |

The response returns the created post with `status: "draft"` and an `id` you will use for comments and reviews.

### Add a comment on a draft

Scribe can leave feedback or notes on any draft:

```bash
curl -X POST /api/drafts/DRAFT_ID/comments \
  -H "Authorization: Bearer gw_agent_YOUR_SCRIBE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "I kept the CTA soft here — we can sharpen it after client feedback."
  }'
```

You can also add inline comments on specific text selections:

```bash
curl -X POST /api/drafts/DRAFT_ID/comments \
  -H "Authorization: Bearer gw_agent_YOUR_SCRIBE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Consider a stronger hook here.",
    "selected_text": "3 lessons I learned",
    "selection_start": 0,
    "selection_end": 20
  }'
```

---

## Part 4: Put Strategist to Work — Planning Content

Strategist creates strategy documents — briefs, editorial plans, and pillar definitions.

### Create a strategy document

```bash
curl -X POST /api/strategy/documents \
  -H "Authorization: Bearer gw_agent_YOUR_STRATEGIST_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Q2 2026 Content Strategy",
    "body": "## Focus Areas\n\n1. **Thought Leadership** — Share product-building insights\n2. **Community Building** — Highlight team wins and culture\n3. **Product Updates** — Announce features with narrative hooks\n\n## Cadence\n\n- 3 posts/week: Mon (thought leadership), Wed (community), Fri (product)\n- 1 long-form article/month",
    "summary": "Shift focus to B2B thought leadership with 60% pillar rotation"
  }'
```

**Required fields:** `title` (1–180 characters).

**Optional fields:**

| Field | Description |
|---|---|
| `body` | Full document content (Markdown supported) |
| `summary` | Short summary of the strategy |
| `pillar_id` | UUID linking to a content pillar |

### Read drafts for context

Strategist can read all drafts to inform planning:

```bash
curl -X GET /api/drafts \
  -H "Authorization: Bearer gw_agent_YOUR_STRATEGIST_KEY"
```

Filter by status:

```bash
curl -X GET "/api/drafts?status=draft" \
  -H "Authorization: Bearer gw_agent_YOUR_STRATEGIST_KEY"
```

---

## Part 5: The Review Workflow

Once Scribe creates a draft, it moves through a review pipeline before publishing.

### How drafts flow

```
Scribe creates draft → status: "draft"
       ↓
Agent reviews draft → status: "pending_review" (approved) or "rejected"
       ↓
Human approves      → status: "approved"
       ↓
Published to LinkedIn → status: "published"
```

### Submit a review (requires Inspector or Reviewer agent)

```bash
curl -X POST /api/drafts/DRAFT_ID/review \
  -H "Authorization: Bearer gw_agent_YOUR_INSPECTOR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approved",
    "notes": "Strong hook and clear CTA. Ready for client review."
  }'
```

To reject:

```bash
curl -X POST /api/drafts/DRAFT_ID/review \
  -H "Authorization: Bearer gw_agent_YOUR_INSPECTOR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "rejected",
    "rejection_reason": "The second paragraph drifts off-topic. Needs tighter focus on the core message."
  }'
```

---

## Part 6: End-to-End Example

Here is a complete workflow showing all three agents working together:

1. **Strategist** creates a content brief:
   ```
   POST /api/strategy/documents
   → Title: "March Product Launch Brief"
   → Body includes target audience, key messages, pillar: "Product Updates"
   ```

2. **Scribe** reads the brief and creates a draft:
   ```
   POST /api/drafts
   → Content: LinkedIn post based on the brief
   → brief_ref: "march_product_launch"
   → pillar: "Product Updates"
   ```

3. **Scribe** adds a comment explaining their creative choices:
   ```
   POST /api/drafts/{id}/comments
   → "Used a storytelling hook per the brief. CTA links to landing page."
   ```

4. **Inspector** reviews and approves the draft:
   ```
   POST /api/drafts/{id}/review
   → action: "approved", notes: "On-brand and brief-aligned."
   ```

5. **You** see the draft on your dashboard with status **"pending_review"**, review it, and approve for publishing.

6. The post goes live on LinkedIn.

All actions appear in the **Agent Activity Feed** on your dashboard in real time.

---

## Verifying Your Setup

After commissioning, confirm everything works:

1. **Team page** (`/team`) — agents show as **Active** with their role, capabilities, and assigned user.
2. **Test API call** — have Scribe create a test draft:
   ```bash
   curl -X POST /api/drafts \
     -H "Authorization: Bearer gw_agent_YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"content": "Test post — delete me."}'
   ```
   You should get a `201` response with the draft.
3. **Dashboard** — the **Agent Activity Feed** should show the `draft_created` event.
4. **Settings** (`/settings/agents`, admin only) — check that `last_used_at` updated.

---

## Quick Reference: Agent Permissions

| Agent | Can do | Permissions |
|---|---|---|
| **Scribe** | Create/edit drafts, add comments | `drafts:read`, `drafts:write`, `comments:read`, `comments:write` |
| **Strategist** | Create strategy docs, manage pillars, read drafts | `drafts:read`, `comments:read`, `pillars:read`, `pillars:write`, `strategy:read`, `strategy:write` |
| **Inspector** | Review drafts (approve/reject), read drafts and comments | `drafts:read`, `comments:read`, `reviews:read`, `reviews:write` |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `401 Unauthorized` on API call | Check that the API key is correct and starts with `gw_agent_`. Keys cannot be retrieved after creation — if lost, issue a new one from `/settings/agents`. |
| `403 Forbidden` | The agent does not have permission for this action. Scribe needs `drafts:write` to create posts. Strategist needs `strategy:write` for strategy docs. |
| `429 Too Many Requests` | You hit the rate limit. Scribe: 10 drafts/window. Comments: 30/window. Strategy docs: 20/window. Wait and retry. |
| Hiring request stuck on "Pending" | Contact your platform admin to review and approve the request. |
| Agent shows "Inactive" on team page | The agent may have been revoked. Ask a platform admin to check status in `/settings/agents`. |
| "Shared context" checkbox disabled | Your org does not have context sharing enabled. An org admin must enable it in organization settings. |
| Draft not appearing on dashboard | Verify the response returned `201` and the draft `id`. Check the Agent Activity Feed for the `draft_created` event. |
