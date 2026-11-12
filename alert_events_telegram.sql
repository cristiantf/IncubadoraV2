USE encubadora_db;
ALTER TABLE alert_events ADD COLUMN telegram_sent_at DATETIME NULL;
