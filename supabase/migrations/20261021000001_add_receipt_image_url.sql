-- Add receipt_image_url to payment_requests
ALTER TABLE public.payment_requests 
ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;
