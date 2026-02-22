ALTER TABLE ai_conversations ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE ai_conversations ADD COLUMN admin_notes TEXT;
ALTER TABLE ai_conversations ADD COLUMN assigned_to TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_status
  ON ai_conversations(status, last_message_at DESC);

