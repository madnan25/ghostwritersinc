-- Add posting_days column to strategy_config
-- Stores which days of the week briefs can be scheduled (0=Sun, 1=Mon, ..., 6=Sat)
-- Defaults to weekdays only [1,2,3,4,5]

ALTER TABLE strategy_config
  ADD COLUMN IF NOT EXISTS posting_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}'
  CONSTRAINT posting_days_valid CHECK (
    posting_days <@ ARRAY[0,1,2,3,4,5,6]
    AND array_length(posting_days, 1) >= 1
  );
