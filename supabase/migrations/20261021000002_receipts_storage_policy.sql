-- Storage policies for receipts bucket
CREATE POLICY "Public Access to Receipts" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'receipts');

CREATE POLICY "Allow Public Upload to Receipts" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'receipts');
