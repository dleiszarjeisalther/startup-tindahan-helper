-- Component 1: Deduplication columns and indexes on device_trials
ALTER TABLE public.device_trials
ADD COLUMN IF NOT EXISTS phone_number_normalized TEXT,
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS install_count INT NOT NULL DEFAULT 1;

-- Backfill phone_number_normalized for existing records
UPDATE public.device_trials
SET phone_number_normalized = REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g')
WHERE phone_number_normalized IS NULL;

-- Indexes for lightning-fast deduplication lookup
CREATE INDEX IF NOT EXISTS idx_device_trials_phone_norm ON public.device_trials(phone_number_normalized);
CREATE INDEX IF NOT EXISTS idx_device_trials_fingerprint ON public.device_trials(device_fingerprint);

-- Add unique constraint on payment_requests (prevent reusing the exact same gcash reference)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_gcash_reference 
ON public.payment_requests(gcash_reference);
