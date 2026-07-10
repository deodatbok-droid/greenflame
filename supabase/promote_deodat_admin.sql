UPDATE public.users
SET
  role      = ARRAY['consumer','admin','platform_upline'],
  email     = 'deodatbok@gmail.com',
  full_name = 'Déodat BOKONONHOUI'
WHERE phone = '+22929260326';

SELECT id, full_name, phone, role, email FROM public.users WHERE phone = '+22929260326';