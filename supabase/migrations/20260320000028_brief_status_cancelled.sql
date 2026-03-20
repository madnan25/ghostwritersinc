-- Add 'cancelled' value to brief_status enum
-- so cancelled briefs are distinguishable from completed ones.
alter type brief_status add value if not exists 'cancelled';
