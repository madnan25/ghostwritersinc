-- Ghostwriters Inc. — Development Seed Data
-- Run after migrations to create a usable dev environment

-- Create a dev organization
insert into organizations (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000001', 'Ghostwriters Inc.', 'ghostwriters-inc');

-- Note: Users are linked to auth.users, so they must be created after
-- Supabase Auth signup. The seed below uses placeholder UUIDs that should
-- be replaced with real auth.users IDs after signing up via the app.

-- Sample posts for development
insert into posts (id, organization_id, content, content_type, pillar, status, created_by_agent, suggested_publish_at) values
  (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Most founders think they need a perfect strategy before they start posting on LinkedIn.

Here''s what actually works: post consistently for 30 days. You''ll learn more about your audience in a month of publishing than a year of planning.

The algorithm rewards consistency, not perfection.

What''s holding you back from starting?',
    'text',
    'thought-leadership',
    'pending_review',
    'scribe',
    now() + interval '1 day'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'I used to spend 3 hours writing a single LinkedIn post.

Now I spend 20 minutes. Here''s what changed:

1. I stopped trying to be clever
2. I focused on one idea per post
3. I wrote like I talk
4. I let my ghostwriting team handle the polish

The result? 5x more posts, 3x more engagement.

Sometimes less effort = more impact.',
    'text',
    'personal-story',
    'draft',
    'scribe',
    now() + interval '3 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'The content flywheel is real, but nobody talks about the hardest part:

Getting it spinning in the first place.

Week 1-2: Crickets
Week 3-4: A few likes from friends
Month 2: Strangers start engaging
Month 3: DMs from potential clients

The gap between starting and results is where 90% of people quit.

Don''t be the 90%.',
    'text',
    'framework',
    'agent_review',
    'strategist',
    now() + interval '2 days'
  );

-- Sample review events
insert into review_events (post_id, agent_name, action, notes) values
  ('b0000000-0000-0000-0000-000000000001', 'strategist', 'approved', 'Strong hook, clear CTA. Ready for client review.'),
  ('b0000000-0000-0000-0000-000000000003', 'scribe', 'approved', 'Good structure, passed to strategist for final review.');

-- Sample agent keys (hashes generated dynamically — never commit real credentials)
insert into agent_keys (organization_id, agent_name, api_key_hash, permissions) values
  ('a0000000-0000-0000-0000-000000000001', 'strategist', crypt(gen_random_uuid()::text, gen_salt('bf')), '{read,write,review}'),
  ('a0000000-0000-0000-0000-000000000001', 'scribe', crypt(gen_random_uuid()::text, gen_salt('bf')), '{read,write}');
