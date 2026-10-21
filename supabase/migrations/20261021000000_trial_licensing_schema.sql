-- 1. App Configuration & Payment Settings
CREATE TABLE IF NOT EXISTS public.app_config (
    id TEXT PRIMARY KEY DEFAULT 'global',
    free_trial_days INT NOT NULL DEFAULT 7,
    gcash_number TEXT NOT NULL DEFAULT '0991 658 9854',
    gcash_name TEXT NOT NULL DEFAULT 'Startup Tindahan Helper',
    gcash_qr_url TEXT DEFAULT 'https://tindahanhelper.wuaze.com/assets/images/gcash_qr.png',
    pro_price NUMERIC(10, 2) NOT NULL DEFAULT 299.00,
    helpline_number TEXT NOT NULL DEFAULT '0991 658 9854',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default global row
INSERT INTO public.app_config (id, free_trial_days, gcash_number, gcash_name, pro_price)
VALUES ('global', 7, '0991 658 9854', 'Startup Tindahan Helper Support', 299.00)
ON CONFLICT (id) DO NOTHING;

-- 2. Device Trials (Registered during in-app onboarding)
CREATE TABLE IF NOT EXISTS public.device_trials (
    device_id TEXT PRIMARY KEY,
    owner_name TEXT NOT NULL,
    store_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    location TEXT NOT NULL,
    trial_days INT NOT NULL DEFAULT 7,
    first_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'trial_active', -- 'trial_active', 'trial_expired', 'licensed'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Pending Payments & License Approvals
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL REFERENCES public.device_trials(device_id),
    store_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    gcash_reference TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 299.00,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    generated_pin TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_device_trials_status ON public.device_trials(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_device_id ON public.payment_requests(device_id);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public read app_config" ON public.app_config;
DROP POLICY IF EXISTS "App select device_trials" ON public.device_trials;
DROP POLICY IF EXISTS "App insert device_trials" ON public.device_trials;
DROP POLICY IF EXISTS "App update device_trials" ON public.device_trials;
DROP POLICY IF EXISTS "App select payment_requests" ON public.payment_requests;
DROP POLICY IF EXISTS "App insert payment_requests" ON public.payment_requests;

-- Policies for public and app client (Anon / Authenticated)
CREATE POLICY "Public read app_config" ON public.app_config FOR SELECT USING (true);
CREATE POLICY "App select device_trials" ON public.device_trials FOR SELECT USING (true);
CREATE POLICY "App insert device_trials" ON public.device_trials FOR INSERT WITH CHECK (true);
CREATE POLICY "App update device_trials" ON public.device_trials FOR UPDATE USING (true);
CREATE POLICY "App select payment_requests" ON public.payment_requests FOR SELECT USING (true);
CREATE POLICY "App insert payment_requests" ON public.payment_requests FOR INSERT WITH CHECK (true);
