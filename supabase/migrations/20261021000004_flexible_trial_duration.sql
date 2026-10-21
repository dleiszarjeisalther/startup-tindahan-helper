-- Component: Flexible Trial Duration (seconds, minutes, hours, days, weeks, months, years)
ALTER TABLE public.app_config
ADD COLUMN IF NOT EXISTS trial_duration_value NUMERIC NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS trial_duration_unit TEXT NOT NULL DEFAULT 'days';

UPDATE public.app_config
SET trial_duration_value = COALESCE(free_trial_days, 7),
    trial_duration_unit = 'days'
WHERE trial_duration_unit IS NULL;
