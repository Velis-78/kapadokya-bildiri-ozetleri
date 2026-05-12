-- ============================================================
-- BİLDİRİ TÜRÜ KOLONU EKLEME (v24)
-- ------------------------------------------------------------
-- submissions tablosuna 'type' kolonu eklenir:
--   'poster' → Poster Bildirisi (varsayılan, mevcut tüm kayıtlar)
--   'talk'   → Konuşma Özeti
--
-- Mevcut tüm bildiriler 'poster' olarak işaretlenir (geriye uyumlu).
-- ============================================================

-- 1) Kolonu ekle (idempotent — tekrar çalıştırılabilir)
alter table public.submissions
add column if not exists type text default 'poster';

-- 2) Eski kayıtlarda null kalmışsa 'poster' yap
update public.submissions set type = 'poster' where type is null;

-- 3) Check constraint (sadece izinli değerler)
alter table public.submissions drop constraint if exists submissions_type_check;
alter table public.submissions add constraint submissions_type_check
  check (type in ('poster', 'talk'));

-- 4) Index — filtreleme için
create index if not exists submissions_type_idx on public.submissions(type);

-- 5) DOĞRULAMA
select 'Tip kolonu eklendi ✓' as durum;
select type, count(*) as adet from public.submissions group by type;
