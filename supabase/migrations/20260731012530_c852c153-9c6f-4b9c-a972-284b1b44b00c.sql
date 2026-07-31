INSERT INTO public.bootstrap_super_admins (email)
VALUES ('grancontsc@gmail.com'), ('raulalmeida6@gmail.com')
ON CONFLICT DO NOTHING;

INSERT INTO public.global_user_roles (user_id, role)
SELECT p.id, 'super_admin'
FROM public.profiles p
WHERE lower(p.email) IN ('grancontsc@gmail.com', 'raulalmeida6@gmail.com')
ON CONFLICT DO NOTHING;

UPDATE public.profiles
SET account_status = 'active'
WHERE lower(email) IN ('grancontsc@gmail.com', 'raulalmeida6@gmail.com');