-- LIN-508: Add publish_failed to notification_type enum
-- Missed in LIN-302 / 20260319000031 which added publish_failed to post_status only.
-- Without this, publish-scheduled.ts silently fails to insert failure notifications.

alter type notification_type add value if not exists 'publish_failed';
