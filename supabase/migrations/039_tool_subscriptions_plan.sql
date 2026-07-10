-- Migration 039 — Ajout du champ plan (monthly | annual) à tool_subscriptions

ALTER TABLE public.tool_subscriptions
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'monthly'
    CHECK (plan IN ('monthly', 'annual'));
