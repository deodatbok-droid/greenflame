-- Promouvoir Aurel (co-fondateur tech) comme admin
-- Phone : +22997025083  |  Email : aurelioteam229@gmail.com

UPDATE public.users
SET role = ARRAY['consumer', 'admin']
WHERE phone = '+22997025083';

-- Vérification
SELECT id, full_name, phone, email, role
FROM public.users
WHERE phone = '+22997025083';
