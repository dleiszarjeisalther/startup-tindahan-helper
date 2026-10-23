-- Publish only after downloading and verifying the final, signed GitHub artifact.
CREATE TABLE public.app_releases (
  version_code bigint PRIMARY KEY CHECK (version_code > 0 AND version_code <= 2100000000),
  version_name text NOT NULL CHECK (length(version_name) BETWEEN 1 AND 80),
  apk_url text NOT NULL CHECK (apk_url LIKE 'https://github.com/dleiszarjeisalther/startup-tindahan-helper/releases/download/%.apk'),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 1073741824),
  release_notes text NOT NULL CHECK (length(release_notes) <= 20000),
  mandatory boolean NOT NULL DEFAULT false,
  mandatory_reason text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'withdrawn')),
  published_at timestamptz,
  CHECK (NOT mandatory OR length(trim(mandatory_reason)) > 0 AND mandatory_reason IS NOT NULL),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_releases FROM anon, authenticated;
GRANT SELECT ON public.app_releases TO anon, authenticated;
CREATE POLICY "Read published releases" ON public.app_releases FOR SELECT TO anon, authenticated
  USING (status = 'published' AND published_at <= now());
