-- Fix post attribution: update imported posts to be attributed to scribe/strategist
UPDATE posts
SET
  created_by_agent = 'scribe',
  reviewed_by_agent = 'strategist'
WHERE created_by_agent = 'import';
