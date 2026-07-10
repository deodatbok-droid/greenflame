-- hashPin() génère "salt:key" = 97 caractères (scrypt hex)
-- La colonne était VARCHAR(6) (PIN brut), on passe à TEXT
ALTER TABLE public.users ALTER COLUMN transaction_pin TYPE TEXT;
