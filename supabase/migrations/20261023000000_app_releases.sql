-- ======================================================================
-- STARTUP TINDAHAN HELPER: APP RELEASES & IN-APP UPDATE SYSTEM
-- Stores version metadata, feature notes, image banners, video demos,
-- and APK download links for real-time in-app updates.
-- ======================================================================

CREATE TABLE IF NOT EXISTS public.app_releases (
  version_code bigint PRIMARY KEY CHECK (version_code > 0 AND version_code <= 2100000000),
  version_name text NOT NULL CHECK (length(version_name) BETWEEN 1 AND 80),
  apk_url text NOT NULL CHECK (length(apk_url) > 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-fA-F]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 1073741824),
  release_notes text NOT NULL CHECK (length(release_notes) <= 20000),
  image_url text,
  video_url text,
  mandatory boolean NOT NULL DEFAULT false,
  mandatory_reason text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'withdrawn')),
  published_at timestamptz DEFAULT NOW(),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CHECK (NOT mandatory OR (length(trim(mandatory_reason)) > 0 AND mandatory_reason IS NOT NULL))
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- Grants
REVOKE ALL ON public.app_releases FROM anon, authenticated;
GRANT SELECT ON public.app_releases TO anon, authenticated;
GRANT ALL ON public.app_releases TO service_role;

-- RLS Policies
DROP POLICY IF EXISTS "Read published releases" ON public.app_releases;
CREATE POLICY "Read published releases" ON public.app_releases FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "Service role full access on app_releases" ON public.app_releases;
CREATE POLICY "Service role full access on app_releases" ON public.app_releases FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Index for speedy ordering by newest version code
CREATE INDEX IF NOT EXISTS idx_app_releases_status_version ON public.app_releases(status, version_code DESC);

-- Seed current version 1.0.6
INSERT INTO public.app_releases (
  version_code, version_name, apk_url, sha256, size_bytes, release_notes,
  image_url, video_url, mandatory, mandatory_reason, status, published_at
) VALUES (
  6,
  '1.0.6',
  'https://github.com/dleiszarjeisalther/startup-tindahan-helper/releases/download/v1.0.6/tindahan-helper.apk',
  '06b191bfed628aace16726eaed6f6de42b634a2706f090f98da0c8e8020eec3c',
  137710920,
  '🚀 Bagong Bersyon 1.0.6:\n• Mabilis na pag-scan ng barcode gamit ang camera nang walang delay.\n• Awtomatikong pagkwenta ng sukli at kabuuang benta.\n• Pinahusay na talaan ng Utang at listahan ng suki.\n• Ligtas at maaasahang offline backup para sa lahat ng paninda.',
  'https://tindahanhelper.wuaze.com/assets/images/hero-tindahan.jpg',
  'https://tindahanhelper.wuaze.com/assets/video/merged_part1_part3.mp4',
  false,
  NULL,
  'published',
  NOW()
) ON CONFLICT (version_code) DO UPDATE SET
  version_name = EXCLUDED.version_name,
  apk_url = EXCLUDED.apk_url,
  sha256 = EXCLUDED.sha256,
  size_bytes = EXCLUDED.size_bytes,
  release_notes = EXCLUDED.release_notes,
  image_url = EXCLUDED.image_url,
  video_url = EXCLUDED.video_url,
  status = EXCLUDED.status,
  updated_at = NOW();
