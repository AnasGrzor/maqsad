-- Placeholder launch prices in PKR a month, so the pricing page shows real numbers. Admins change them at /admin/plans.
-- No payment is taken; upgrades are still requested and granted by an admin.

update public.plans p set price_monthly_pkr = v.price
from (values
  ('student_plus', 5000),
  ('agent_basic', 10000),
  ('agent_professional', 25000),
  ('agency', 50000)
) v(id, price)
where p.id = v.id;
