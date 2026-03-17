-- Ghostwriters Inc. — Remote Supabase Seed & Content Import
-- Uses actual organization and user IDs from the remote instance
-- Organization: da7e88ce-3841-4a0a-91b9-61f56f7405a7
-- User: 17567dc0-335b-4afb-8b1f-3e258aa9e286

-- ============================================================
-- 1. Import 7 drafts from /content/drafts/dayem/
-- ============================================================

-- week1-post1: What agentic AI actually means for your agency
INSERT INTO posts (organization_id, user_id, content, content_type, pillar, status, created_by_agent, suggested_publish_at)
VALUES (
  'da7e88ce-3841-4a0a-91b9-61f56f7405a7',
  '17567dc0-335b-4afb-8b1f-3e258aa9e286',
  'Most agencies are using AI wrong.

They automate the obvious stuff. Email sorting. Calendar invites. Data entry.

And then they call themselves "AI-powered."

Meanwhile, the work that''s actually expensive — the $150/hr tasks, the manual reporting, the workflows that eat 20+ hours a week — stays untouched.

I''ve seen this pattern across dozens of companies we work with at NettaWorks. Everyone automates the cheap tasks first. It feels productive. It looks good in a deck.

But it doesn''t move a number that matters.

Here''s what agentic AI actually means for your agency:

It''s not a chatbot on your website.

It''s not auto-generated social posts.

It''s an AI system that takes a workflow end to end. Lead comes in through your CRM, gets scored, quality gets assessed, and a report lands in your inbox telling you exactly how many qualified leads you got this week, which campaign they came from, and what your real cost per qualified lead is.

No manual entry. No sales ops person pulling numbers into a spreadsheet every Friday.

One client was running ad campaigns across Meta and Google, spending real money, but their reporting was a mess. Someone had to manually check the CRM, tag leads as qualified or not, cross-reference against campaign spend, and build a report. Every week. Hours of work that added zero value.

We built an automated reporting system that plugs into their Bitrix CRM. All the computation happens inside their system. Their lead data never leaves their CRM. We only see the output: how many qualified leads, which campaign drove them, what the cost per outcome looks like.

The person who used to build that report every week? Now she''s actually working the leads instead of counting them.

The difference between "AI tools" and "agentic AI" is simple:

Tools help you do tasks faster.
Agents do the tasks for you.

If you''re running a 10-50 person company and you''re still hiring for bottlenecks instead of automating them — you''re spending $60K/year on a problem that costs $6K to solve.

Start with the expensive work. Not the easy work.

What''s the most expensive manual workflow in your business right now?',
  'text',
  'ai-agents',
  'draft',
  'import',
  '2026-03-18T09:00:00Z'
);

-- week1-post2: $100M+ pipeline — the system behind it
INSERT INTO posts (organization_id, user_id, content, content_type, pillar, status, created_by_agent, suggested_publish_at)
VALUES (
  'da7e88ce-3841-4a0a-91b9-61f56f7405a7',
  '17567dc0-335b-4afb-8b1f-3e258aa9e286',
  '$100M+ in qualified pipeline.

Not revenue. Not "estimated value." Qualified pipeline — deals with real budgets, real timelines, and real decision-makers attached to them.

I get asked about this number a lot. Usually by founders who''ve spent $200K on marketing and can''t tell you their cost per qualified lead.

So here''s the system. No gatekeeping.

Step 1: We killed every metric that didn''t connect to revenue.

Impressions. Reach. Click-through rate. Gone from the weekly report.

Not because they don''t matter. But because when those numbers are in front of you, you start optimizing for them. And optimizing for clicks is not the same as optimizing for closed deals.

Step 2: We measured cost per outcome. Not cost per activity.

Cost per sqft sold. Cost per deal won. Cost per qualified lead. Cost per campaign.

Every dollar had an owner. Every campaign had a revenue number attached to it — not an engagement number.

Step 3: We cut what didn''t convert. Fast.

Most agencies let underperforming campaigns run for months because the "data needs time." That''s a nice way of saying they don''t want to admit something isn''t working.

We gave every channel 4-6 weeks. If the cost per qualified lead wasn''t where it needed to be, we killed it and moved the budget.

Step 4: We reported on the numbers that keep us honest.

Weekly. Not monthly. Not quarterly.

The report had three numbers: cost per qualified lead, qualified leads generated, and pipeline added. That''s it. Everything else was noise.

The result: 380 leads. 26 deals closed. 3.8x lead qualification rate.

And more importantly — a founder who could walk into a board meeting and answer "what''s working?" with a specific dollar amount.

Your agency shows you impressions. You should be asking for cost per deal won.

If you can''t name that number right now, your marketing isn''t broken. Your measurement is.

What''s the one metric you wish your marketing team reported on but doesn''t?',
  'text',
  'advertising-accountability',
  'draft',
  'import',
  '2026-03-20T09:00:00Z'
);

-- week1-post3: 45 customer discovery interviews
INSERT INTO posts (organization_id, user_id, content, content_type, pillar, status, created_by_agent, suggested_publish_at)
VALUES (
  'da7e88ce-3841-4a0a-91b9-61f56f7405a7',
  '17567dc0-335b-4afb-8b1f-3e258aa9e286',
  'I spent 6 months at Trek10 doing nothing but listening.

45+ customer discovery interviews. Sitting across from people — sometimes on Zoom, sometimes in person — asking them what was broken, what was frustrating, what they wished existed.

I wasn''t selling anything. I was just trying to understand what people actually needed versus what they said they needed.

Those are not the same thing. Not even close.

A founder would tell me "I need better project management software." What he actually needed was for his three-person team to stop losing client deliverables in email threads.

A VP would say "we need to improve our onboarding." What she actually meant was that new hires were productive by week 8 and she needed that to be week 3.

The gap between what someone asks for and what they actually need — that''s where the real work lives.

I''ve carried that into everything since.

When I ran delivery at NettaWorks, we stopped taking client briefs at face value. We''d ask: "What changes for your business if we build this? What happens if we don''t?" Half the time, the real priority wasn''t even in the original scope.

Now as Managing Director, it''s the same instinct. Before we scope a project, before we quote a number, we dig into the actual problem. Not the symptom.

Product management taught me to build for what people need.

Customer discovery taught me that people can''t always tell you what that is.

Your job is to figure it out anyway.

What''s a skill from a completely different role that you use every day now?',
  'text',
  'operators-playbook',
  'draft',
  'import',
  '2026-03-22T09:00:00Z'
);

-- week2-post1: The real math on replacing a community manager with an AI agent
INSERT INTO posts (organization_id, user_id, content, content_type, pillar, status, created_by_agent, suggested_publish_at)
VALUES (
  'da7e88ce-3841-4a0a-91b9-61f56f7405a7',
  '17567dc0-335b-4afb-8b1f-3e258aa9e286',
  'A community manager in the US costs $5,400 to $8,500 a month.

I scoped an AI agent that does the same job for $140.

Here''s the real math, and why it''s more nuanced than most people think.

A client was scaling their Instagram presence. Comments coming in faster than anyone could respond, DMs piling up, spam sitting in plain sight, and real leads getting buried in message requests nobody had time to check.

They needed someone managing this full-time. We proposed something different.

An AI agent that handles community management end to end. It responds to comments with actual context, not canned replies. It catches and removes spam automatically. It handles DMs, qualifies inbound leads, and routes the serious ones to a human. And every morning, the client gets a report showing who engaged, who looks ready to buy, and who needs follow-up.

We priced it at $1,750 to build and $140 a month to run.

Now here''s where it gets interesting.

This client is in Pakistan. A community manager there costs PKR 34k to 53k per month according to Glassdoor. That''s $120 to $185. Our AI agent at $140 a month is basically the same price as a junior hire.

So the pitch wasn''t "this saves you money." It was "this gives you something a single hire can''t."

One agent handles multiple accounts. It runs at 3am the same as 3pm. It doesn''t need onboarding. It doesn''t quit after four months when a better offer comes along. And if you''ve ever hired for community management, you know that turnover is the real cost nobody accounts for.

But run the same numbers for a US company. A community manager there costs $5,400 to $8,500 a month. The AI agent is still $140. That''s a 97% cost reduction. The $1,750 setup pays for itself before the second paycheck would''ve been due.

Same build. Same capabilities. Completely different economic story depending on where your team is.

This is the part most AI automation posts skip. They throw out a "we saved 10x" headline without telling you which market, which role, or what the actual comparison looks like.

The math is only as good as the inputs. And if you''re going to make the case for automating a role, you owe it to yourself to compare real salary data against real build costs.

What''s a role on your team where you''ve considered automation but haven''t pulled the trigger yet?',
  'text',
  'ai-agents',
  'draft',
  'import',
  '2026-03-25T09:00:00Z'
);

-- week2-post2: A client sued us after running out of money
INSERT INTO posts (organization_id, user_id, content, content_type, pillar, status, created_by_agent, suggested_publish_at)
VALUES (
  'da7e88ce-3841-4a0a-91b9-61f56f7405a7',
  '17567dc0-335b-4afb-8b1f-3e258aa9e286',
  'A client changed priorities four times, ran out of money, and then sued us.

We''d met every deliverable in the contract.

We took on a software project. Clear scope. Signed SOW. Milestone payments tied to specific features. The kind of setup you''d look at and think "this one''s going to go smoothly."

It didn''t.

First came the "small tweaks." Then a full pivot on the feature set. Then another pivot. The budget didn''t run out because we overcharged. It ran out because the client''s company had never made a dollar and the money simply wasn''t there anymore.

And when the money dried up, the story changed. We went from "great partners" to "didn''t deliver" overnight. A lawyer got involved.

We talked to three attorneys. All three said we''d win.

We settled for $1,500 anyway.

Why? Because winning in court costs more than $1,500 in the first week alone. And the settlement included a sentence every agency owner should memorize:

"As an offer of settlement, without any admission of liability or wrongdoing."

That one line ended the conversation, protected our reputation, and let us get back to work.

Here''s what I tell founders now.

Your SOW needs to list exact deliverables and revision rounds. Not "build an app." Exact features. Numbered. If it''s not in the document, it doesn''t exist.

Tie every payment to a deliverable sign-off. No sign-off, no next phase. This feels harsh until the first time it saves you.

Cap your scope changes. We include two. After that, it''s a new SOW with new pricing. Clients respect this more than you''d expect.

And document everything. Every email, every approval, every "can we just add this one thing real quick." When a project goes sideways, your paper trail is your entire defense.

Chris Do put it well: "Every project that goes sideways starts the same way. Vague agreements. Fuzzy boundaries. Good intentions."

I''d add one thing. It''s not the bad-faith clients who burn you. It''s the ones who start with great intentions and run out of money. Those are the ones who rewrite history.

Protect yourself before the project starts. Not after.

What''s the hardest lesson a client has taught you about contracts?',
  'text',
  'custom-software',
  'draft',
  'import',
  '2026-03-27T09:00:00Z'
);

-- week2-post3: LinkedIn BD campaigns — real outreach numbers
INSERT INTO posts (organization_id, user_id, content, content_type, pillar, status, created_by_agent, suggested_publish_at)
VALUES (
  'da7e88ce-3841-4a0a-91b9-61f56f7405a7',
  '17567dc0-335b-4afb-8b1f-3e258aa9e286',
  'I booked meetings with CTOs in the first week of a LinkedIn outreach campaign.

Not by pitching. Not by sliding into DMs with a deck. Just by asking a genuine question.

Here''s what we ran, what worked, and what the numbers actually looked like.

We set up three campaigns at the same time, each with a different angle.

The first targeted alumni. Founders and CTOs from the same university. The message was simple: "Would you be open to exchanging notes?" That''s it. No pitch, no angle. Just two people from the same school having a conversation. Accept rates were strong. Several of those conversations turned into discovery calls without either side forcing it.

The second targeted founders who were actively hiring for roles we could fill with automation or dev teams. The thinking was straightforward: if they''re hiring, they have a problem. If we can solve it faster than a three-month recruiting cycle, that''s worth a conversation. We generated 71 leads from this one. My US partner got 4 accepts on day one. Meetings followed within the week.

The third was industry-specific. Law firm partners looking for SEO and digital presence. Narrow targeting, high intent. Accept rate was slower, but every meeting was with a decision-maker. No gatekeepers, no "let me loop in my team."

What tied all three together:

We focused on 2nd-degree connections. Warm enough to accept, close enough to convert.

We led with curiosity instead of a pitch. "I''d love to exchange notes on X" lands differently than "We help companies like yours do Y." People can feel the difference.

We ran everything through Dripify at $80/month for the sequences, but when someone actually replied, a real human showed up. That handoff matters more than the automation.

And we tracked accepts, replies, and meetings booked. Not connections sent. Vanity metrics in outreach are the same trap as vanity metrics in advertising. Measure what converts.

One thing surprised me. We gained 500 followers in a single week just from the connection activity. Not paid. Not from content going viral. Just from showing up consistently in people''s feeds through genuine engagement.

But here''s the realistic math. 500 a week is a sprint, not a pace. A sustainable target is 10K over a quarter. If someone promises you 50K followers in three months, they''re selling you something, not building you something.

LinkedIn BD works when the system is honest. The numbers. The expectations. The follow-through.

What''s your approach to LinkedIn outreach? Automation, manual, or some mix of both?',
  'text',
  'ai-agents',
  'draft',
  'import',
  '2026-03-29T09:00:00Z'
);

-- meta-whatsapp-ai-policy: WhatsApp AI community management
INSERT INTO posts (organization_id, user_id, content, content_type, pillar, status, created_by_agent, suggested_publish_at)
VALUES (
  'da7e88ce-3841-4a0a-91b9-61f56f7405a7',
  '17567dc0-335b-4afb-8b1f-3e258aa9e286',
  'I''ve been running an AI community management agent on WhatsApp for three weeks.

Last week, Meta published a policy that describes exactly what I built.

In early March, I scoped this out for a client. They manage a WhatsApp community, the message volume was growing faster than one person could handle, and real leads were getting buried in noise.

We built an agent with three specific jobs: moderate incoming messages, process DMs and flag leads based on intent signals, and route high-priority conversations to the human who needs to act.

Not a general chatbot. A narrow agent with a job description.

We''re testing it live now.

Then Meta released their 2026 WhatsApp Business API policy.

The core rule: general-purpose AI chatbots are prohibited. AI can only be deployed for defined business workflows — customer service, lead qualification, order tracking. Open-ended bots that try to handle every conversation are out.

I read it and thought: that''s what we built.

Here''s what this means if you''re running a community on WhatsApp.

The platforms aren''t banning AI. They''re raising the bar for how AI gets used.

A bot that tries to answer every message from every member will get flagged. An agent that does one specific thing well — qualify leads, filter spam, triage inbound — is exactly what the policy describes as compliant.

The businesses that built narrow, outcome-focused automation before this policy landed are ahead of the ones now trying to figure out where to start. Not because they got lucky with the timing. Because they were solving a real problem instead of deploying a toy.

If you''re managing a WhatsApp community for your business, the question isn''t whether to use AI.

It''s whether your AI has a job description.

The distinction matters more now than it did six months ago.',
  'text',
  'industry-insights',
  'draft',
  'import',
  '2026-03-31T09:00:00Z'
);

-- ============================================================
-- 3. Seed agent keys for real org
-- ============================================================

INSERT INTO agent_keys (organization_id, agent_name, api_key_hash, permissions)
VALUES
  ('da7e88ce-3841-4a0a-91b9-61f56f7405a7', 'strategist', crypt(gen_random_uuid()::text, gen_salt('bf')), '{read,write,review}'),
  ('da7e88ce-3841-4a0a-91b9-61f56f7405a7', 'scribe', crypt(gen_random_uuid()::text, gen_salt('bf')), '{read,write}')
ON CONFLICT DO NOTHING;
