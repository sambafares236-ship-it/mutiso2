-- Contractor phone number - needed for WhatsApp/SMS delivery (weekly digest
-- automation via n8n). profiles previously only had email_address; there was
-- no channel for SMS/WhatsApp anywhere in the schema.
alter table public.profiles add column phone_number text;
