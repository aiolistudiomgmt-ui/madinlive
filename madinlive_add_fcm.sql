-- Ajouter la colonne fcm_token à la table profils
ALTER TABLE profils ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Index pour retrouver rapidement les tokens
CREATE INDEX IF NOT EXISTS idx_profils_fcm ON profils(fcm_token) WHERE fcm_token IS NOT NULL;
