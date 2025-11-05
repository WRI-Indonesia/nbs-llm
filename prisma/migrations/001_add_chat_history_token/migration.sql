-- Add token usage and cost columns to chat_history
ALTER TABLE "chat_history"
  ADD COLUMN "tokenUsage" JSONB,
  ADD COLUMN "tokenCost" JSONB;


