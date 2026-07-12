-- Lets a material actual-cost entry point back at the specific delivery
-- it's paying for, rather than being a free-floating line item the
-- contractor has to re-describe from memory. Nullable and on delete set
-- null - a payment can still exist without a matched delivery (e.g. a
-- lump-sum supplier invoice covering several), and deleting the delivery
-- record itself must never silently delete money already recorded as
-- spent. No RLS change needed - actual_cost's existing owner-only-write /
-- owner-or-foreman-read policy already fits: the contractor is the one
-- matching deliveries to payments, same "financial authority ≠ field
-- capture" reasoning as the rest of this table.

alter table public.actual_cost
  add column material_delivery_id uuid references public.materials_delivered(id) on delete set null;
