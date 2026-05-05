-- ============================================================
-- ACİL DÜZELTME: RLS Infinite Recursion
-- ------------------------------------------------------------
-- Sorun: admins tablosundaki policy kendisi admins tablosunu
-- sorguluyor → Postgres recursion algılıyor → 500 hata.
-- Bu script policy'leri SECURITY DEFINER fonksiyonlarla yeniden
-- yapılandırarak sorunu çözer.
--
-- ÇALIŞTIRMA: Supabase Dashboard → SQL Editor → New query →
-- bu dosyanın TÜMÜNÜ yapıştır → Run.
-- "Success" görmen yeterli.
-- ============================================================

-- 1) RLS bypass eden yardımcı fonksiyonlar
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid() and role = 'super');
$$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_super_admin() to anon, authenticated;

-- 2) Recursion yapan eski policy'leri kaldır
drop policy if exists "super_admin_manage_admins" on public.admins;
drop policy if exists "admin_full_access_submissions" on public.submissions;
drop policy if exists "super_admin_update_settings" on public.settings;

-- 3) Yeni policy'ler (recursion-free)

-- Admins tablosu: SELECT herkes authenticated yapabilir (zaten vardı)
-- INSERT/UPDATE/DELETE: sadece super admin (SECURITY DEFINER ile)
create policy "super_admin_insert_admins"
  on public.admins for insert to authenticated
  with check (public.is_super_admin());

create policy "super_admin_update_admins"
  on public.admins for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "super_admin_delete_admins"
  on public.admins for delete to authenticated
  using (public.is_super_admin());

-- Submissions: tüm CRUD admin için
create policy "admin_full_access_submissions"
  on public.submissions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Settings: UPDATE sadece super admin
create policy "super_admin_update_settings"
  on public.settings for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- 4) Kullanıcı kontrolü (sekreter@aid.org.tr için)
-- ------------------------------------------------------------
-- Aşağıdaki sorgu, hangi kullanıcıların admins tablosunda olduğunu listeler.
-- Kendi UUID'nin görünmesi gerekir.
-- ============================================================

select a.id, a.username, a.name, a.role, u.email
from public.admins a
left join auth.users u on u.id = a.id;

-- ============================================================
-- Eğer yukarıdaki sorgu BOŞ döndüyse veya senin e-postan görünmüyorsa,
-- aşağıdaki INSERT'i UUID'ni ve e-postanı yapıştırarak çalıştır.
-- (UUID'yi ekran görüntünden okudum: db6edb2a-2cb1-4dd6-bf9a-5ffdc5e9bd92)
-- ============================================================

-- insert into public.admins (id, username, name, role)
-- values (
--   'db6edb2a-2cb1-4dd6-bf9a-5ffdc5e9bd92',  -- sekreter@aid.org.tr UUID'si
--   'sekreter',
--   'Sistem Yöneticisi',
--   'super'
-- )
-- on conflict (id) do update set role = 'super';
