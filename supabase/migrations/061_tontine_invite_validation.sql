-- ============================================================================
-- 061 — Flux d'invitation + validation pour les membres de tontine
--
-- Contexte : un membre ajouté par l'admin (nom + téléphone) reste "pending"
-- jusqu'à ce qu'il valide son invitation via un lien à token, ce qui requiert
-- un compte GreenFlame (lie user_id). Sa place dans la rotation (position)
-- est réservée dès l'ajout, qu'il valide ou non. Le lien expire après 7 jours
-- (l'admin peut relancer). S'il ne valide jamais, il reste simplement exclu
-- des mécaniques de la tontine — aucune suppression forcée.
--
-- DEFAULT 'active' (et non 'pending') sur la colonne status : pour ne pas
-- casser rétroactivement les tontines déjà créées, dont les membres existants
-- n'ont jamais eu à valider quoi que ce soit. Seuls les NOUVEAUX membres
-- insérés après ce déploiement seront explicitement marqués 'pending' par
-- le code applicatif (app/api/tontines/route.ts et
-- app/api/tontines/[id]/membres/route.ts).
-- ============================================================================

ALTER TABLE tontine_membres
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'expired')),
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tontine_membres_invite_token ON tontine_membres(invite_token);

COMMENT ON COLUMN tontine_membres.status IS
  'pending = ajouté par admin, invitation non encore validée. active = validé (ou créateur/membre historique). expired = lien dépassé (admin doit relancer).';
COMMENT ON COLUMN tontine_membres.invite_token IS
  'Token unique du lien d''invitation (/tontine/invite/[token]). NULL une fois validé ou pour les membres historiques.';
COMMENT ON COLUMN tontine_membres.invite_expires_at IS
  'Expiration du lien d''invitation, 7 jours après génération (création ou relance).';
