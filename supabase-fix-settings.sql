-- ============================================================
-- AYARLAR (SETTINGS) GÜNCELLEME 406 HATASI — ONARIM
-- ------------------------------------------------------------
-- Sorun: admin paneli → Ayarlar → Format/İçerik kartı düzenle →
--   "Ayarlar kaydedilemedi" hatası, Console'da PGRST116 (0 rows)
-- Sebep: Settings UPDATE policy is_super_admin() = false döndürüyor.
--   Yani: kullanıcı admins tablosunda 'super' rolüne sahip değil
--   ya da is_super_admin() fonksiyonu eksik/bozuk.
-- ============================================================

-- -------------------------------------------------------------
-- ADIM 1 — DURUM TESPİTİ
-- -------------------------------------------------------------
-- Aşağıdaki sorguyu Run et, sonucu paylaş veya kontrol et:

select
  a.id,
  a.username,
  a.name,
  a.role,
  u.email,
  case when a.role = 'super' then '✅ Super Admin' else '❌ Super değil' end as durum
from public.admins a
left join auth.users u on u.id = a.id
order by a.created_at;

-- Eğer:
-- - Liste boşsa → admins tablosuna satır eklemeniz lazım (Adım 3)
-- - Sizin satırınız var ama role 'super' değilse → Adım 2 ile super yapın
-- - role 'super' ise → Adım 4'teki RLS yenileme

-- -------------------------------------------------------------
-- ADIM 2 — Mevcut kullanıcıyı SUPER ADMIN yap
-- (e-postayı kendi hesabınızla değiştirin)
-- -------------------------------------------------------------
update public.admins
set role = 'super'
where id = (select id from auth.users where email = 'sekreter@aid.org.tr');

-- Doğrula:
select id, username, role from public.admins;

-- -------------------------------------------------------------
-- ADIM 3 — Eğer admins tablosunda hiç yoksa, ekle
-- (e-postanızı kendi hesabınızla değiştirin)
-- -------------------------------------------------------------
insert into public.admins (id, username, name, role)
select u.id, 'sekreter', 'Sistem Yöneticisi', 'super'
from auth.users u
where u.email = 'sekreter@aid.org.tr'
on conflict (id) do update set role = 'super';

-- -------------------------------------------------------------
-- ADIM 4 — is_super_admin() fonksiyonunu ve UPDATE policy'sini
-- yeniden tanımla (recursion-safe, kararlı)
-- -------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where id = auth.uid() and role = 'super'
  );
$$;

grant execute on function public.is_super_admin() to anon, authenticated;

-- Settings UPDATE policy'sini yeniden kur
drop policy if exists "super_admin_update_settings" on public.settings;
drop policy if exists "auth_update_settings" on public.settings;

create policy "super_admin_update_settings" on public.settings
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- -------------------------------------------------------------
-- ADIM 5 — Settings satırının var olduğundan emin ol
-- -------------------------------------------------------------
insert into public.settings (id, event_title, event_short, organizer, word_limit, deadline, submissions_open)
values (
  1,
  'Herediter Anjiyoödem ve İmmün Yetmezliklere Zor Olgularla Pratik Çözümler',
  'HAE & İmmün Yetmezlik Bildiri Sistemi',
  'Türkiye Ulusal Allerji ve Klinik İmmünoloji Derneği',
  5000,
  '2026-09-30',
  true
)
on conflict (id) do nothing;

-- Yeni kolon eksikliklerini de garantiye al:
alter table public.settings add column if not exists rule_format_text text
  default 'Yalnızca poster bildiri özeti. Tek dosya, ek belge gerekmez. {wordLimit} kelime sınırı (başlık ve yazar bilgileri hariç).';
alter table public.settings add column if not exists rule_content_text text
  default 'Olgu sunumu, derleme veya araştırma niteliğinde olabilir. Türkçe yazılır. Tablo ve şekil yerine açıklayıcı metin tercih edilir.';
alter table public.settings add column if not exists form_sections_order text[]
  default array['contact','authors','affiliations','title','abstract','declaration']::text[];

-- -------------------------------------------------------------
-- ADIM 6 — DOĞRULAMA
-- -------------------------------------------------------------
-- Tüm settings'i göster:
select * from public.settings;

-- Tüm admin'leri göster:
select a.id, a.username, a.role, u.email
from public.admins a
left join auth.users u on u.id = a.id;

-- Bu sorguların sonuçlarını gördükten sonra siteyi açıp Ayarlar'da
-- tekrar değişiklik yapmayı deneyin. Artık çalışmalı.
