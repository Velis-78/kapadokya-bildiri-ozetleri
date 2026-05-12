-- ============================================================
-- Bildiri Yönetim Sistemi — Supabase SQL Şeması
-- Çalıştırma: Supabase Dashboard → SQL Editor → bu dosyayı yapıştırıp Run
-- ============================================================

-- 1) Bildiriler tablosu
create table if not exists public.submissions (
  id text primary key,                     -- BLD-1001 formatı
  type text not null default 'poster',     -- poster | talk (konuşma özeti)
  status text not null default 'pending',  -- pending | accepted | rejected | revision
  status_note text default '',
  title text not null,
  abstract text not null,
  keywords text[] default '{}',
  authors jsonb not null default '[]',     -- [{fullName, affiliationIndex, presenter}]
  affiliations text[] default '{}',
  contact_name text,
  contact_email text,
  contact_phone text,
  contact_inst text,
  ethics_ack boolean default false,
  originality_ack boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_status_idx on public.submissions(status);
create index if not exists submissions_created_idx on public.submissions(created_at desc);
create index if not exists submissions_email_idx on public.submissions(contact_email);
create index if not exists submissions_type_idx on public.submissions(type);

-- Eski kurulumlar için: kolon yoksa ekle
alter table public.submissions add column if not exists type text default 'poster';
update public.submissions set type = 'poster' where type is null;

-- 2) Yöneticiler tablosu (Auth ile birlikte ek profil bilgisi)
-- Not: Şifreler Supabase Auth tarafından yönetilir; burada sadece rol ve isim tutulur.
create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  name text,
  role text not null default 'editor',     -- super | editor | reviewer
  created_at timestamptz not null default now()
);

-- 3) Sistem ayarları (tek satırlık singleton tablo)
create table if not exists public.settings (
  id int primary key default 1,
  event_title text not null,
  event_short text not null,
  organizer text not null,
  word_limit int not null default 500,
  deadline date,
  submissions_open boolean not null default true,
  accent_color text default '#A3E635',
  form_sections_order text[] default array['contact','authors','affiliations','title','abstract','declaration']::text[],
  rule_format_text text default 'Yalnızca poster bildiri özeti. Tek dosya, ek belge gerekmez. {wordLimit} kelime sınırı (başlık ve yazar bilgileri hariç).',
  rule_content_text text default 'Olgu sunumu, derleme veya araştırma niteliğinde olabilir. Türkçe yazılır. Tablo ve şekil yerine açıklayıcı metin tercih edilir.',
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

-- Eski kurulumlar için: kolonlar yoksa ekle
alter table public.settings add column if not exists form_sections_order text[] default array['contact','authors','affiliations','title','abstract','declaration']::text[];
alter table public.settings add column if not exists rule_format_text text default 'Yalnızca poster bildiri özeti. Tek dosya, ek belge gerekmez. {wordLimit} kelime sınırı (başlık ve yazar bilgileri hariç).';
alter table public.settings add column if not exists rule_content_text text default 'Olgu sunumu, derleme veya araştırma niteliğinde olabilir. Türkçe yazılır. Tablo ve şekil yerine açıklayıcı metin tercih edilir.';

insert into public.settings (id, event_title, event_short, organizer, word_limit, deadline, submissions_open)
values (
  1,
  'Herediter Anjiyoödem ve İmmün Yetmezliklere Zor Olgularla Pratik Çözümler',
  'HAE & İmmün Yetmezlik Bildiri Sistemi',
  'Türkiye Ulusal Allerji ve Klinik İmmünoloji Derneği',
  500,
  '2026-09-30',
  true
)
on conflict (id) do nothing;

-- 4) Hareket günlüğü
create table if not exists public.audit_log (
  id bigserial primary key,
  ts timestamptz not null default now(),
  action text not null,
  target text,
  actor text,
  extra text
);

create index if not exists audit_ts_idx on public.audit_log(ts desc);

-- 5) updated_at otomatik güncelleyici
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_submissions_updated on public.submissions;
create trigger trg_submissions_updated before update on public.submissions
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated before update on public.settings
  for each row execute function public.touch_updated_at();

-- 6) Otomatik ID üretici fonksiyon (BLD-1001, BLD-1002, ...)
create or replace function public.next_submission_id()
returns text language plpgsql as $$
declare
  n int;
begin
  select coalesce(max(substring(id from 5)::int), 1000) + 1 into n from public.submissions;
  return 'BLD-' || n::text;
end $$;

-- 7) Row Level Security
alter table public.submissions enable row level security;
alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;

-- ---- YARDIMCI FONKSİYONLAR (SECURITY DEFINER ile RLS recursion'ı önler) ----
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

-- ---- POLİTİKALAR ----

-- Submissions: anonim kullanıcılar yeni bildiri ekleyebilir
drop policy if exists "anon_can_insert_submission" on public.submissions;
create policy "anon_can_insert_submission"
  on public.submissions for insert to anon with check (true);

-- Submissions: anonim okumaya açık (durum sorgulama için)
drop policy if exists "anon_can_read_own_submission" on public.submissions;
create policy "anon_can_read_own_submission"
  on public.submissions for select to anon using (true);

-- Submissions: admin tüm CRUD
drop policy if exists "admin_full_access_submissions" on public.submissions;
create policy "admin_full_access_submissions"
  on public.submissions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admins: SELECT - authenticated herkes okur
drop policy if exists "admins_select_authenticated" on public.admins;
create policy "admins_select_authenticated"
  on public.admins for select to authenticated using (true);

-- Admins: INSERT/UPDATE/DELETE - sadece super admin
drop policy if exists "super_admin_manage_admins" on public.admins;
drop policy if exists "super_admin_insert_admins" on public.admins;
drop policy if exists "super_admin_update_admins" on public.admins;
drop policy if exists "super_admin_delete_admins" on public.admins;

create policy "super_admin_insert_admins"
  on public.admins for insert to authenticated with check (public.is_super_admin());

create policy "super_admin_update_admins"
  on public.admins for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "super_admin_delete_admins"
  on public.admins for delete to authenticated using (public.is_super_admin());

-- Settings: SELECT herkes okur
drop policy if exists "anon_read_settings" on public.settings;
create policy "anon_read_settings" on public.settings for select to anon using (true);

drop policy if exists "auth_read_settings" on public.settings;
create policy "auth_read_settings" on public.settings for select to authenticated using (true);

-- Settings: UPDATE sadece super admin
drop policy if exists "super_admin_update_settings" on public.settings;
create policy "super_admin_update_settings"
  on public.settings for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Audit: authenticated okur, herkes yazar
drop policy if exists "auth_read_audit" on public.audit_log;
create policy "auth_read_audit" on public.audit_log for select to authenticated using (true);

drop policy if exists "auth_write_audit" on public.audit_log;
create policy "auth_write_audit" on public.audit_log for insert to authenticated with check (true);

drop policy if exists "anon_write_audit" on public.audit_log;
create policy "anon_write_audit" on public.audit_log for insert to anon with check (true);

-- ============================================================
-- Kurulum sonrası: ilk super admin eklemek için
-- 1) Supabase Dashboard → Authentication → Users → "Add user" ile bir hesap aç
--    (örn. admin@aid.org.tr, şifrenizi belirleyin)
-- 2) O kullanıcının UUID'sini kopyala
-- 3) Aşağıdaki INSERT'ü kendi UUID ve bilgilerinle çalıştır:
--
-- insert into public.admins (id, username, name, role)
-- values ('YAPIŞTIRILAN-UUID', 'admin', 'Sistem Yöneticisi', 'super');
-- ============================================================
