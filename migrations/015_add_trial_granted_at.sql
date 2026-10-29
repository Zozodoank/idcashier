-- 015_add_trial_granted_at.sql
-- Menjamin free trial (7 hari) hanya diberikan SATU KALI per akun.
--
-- Alasan:
-- - Sebelumnya idempotensi trial hanya mengandalkan pengecekan "sudah ada baris
--   subscription atau belum" di Edge Function, sehingga dua pemanggilan paralel
--   bisa membuat dua baris trial.
-- - Kolom ini dipakai sebagai klaim atomik:
--     UPDATE users SET trial_granted_at = now()
--     WHERE id = :user AND trial_granted_at IS NULL;
--   Hanya satu pemanggil yang berhasil klaim, jadi trial tidak pernah dobel dan
--   tidak pernah diberikan ulang untuk akun yang sama.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trial_granted_at timestamptz;

-- Backfill WAJIB: siapa pun yang sudah punya baris subscription dianggap sudah
-- memakai jatah trial. Tanpa backfill ini, user lama yang trial-nya sudah
-- kedaluwarsa akan mendapat trial 7 hari gratis lagi pada login berikutnya.
UPDATE public.users u
SET trial_granted_at = COALESCE(u.created_at, now())
WHERE u.trial_granted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id
  );

CREATE INDEX IF NOT EXISTS idx_users_trial_granted_at
  ON public.users (trial_granted_at);

-- Verifikasi setelah migrasi (harus 0):
--   SELECT count(*) FROM public.users u
--   WHERE u.trial_granted_at IS NULL
--     AND EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id);
