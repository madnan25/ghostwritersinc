-- Add optional title column to posts for better activity feed identification
alter table posts add column if not exists title text;
