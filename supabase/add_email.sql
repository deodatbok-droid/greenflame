ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email) WHERE email IS NOT NULL;