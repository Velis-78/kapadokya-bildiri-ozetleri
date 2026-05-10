# 📘 Bildiri Sistemi — Sıfırdan Kurulum ve Kullanım Rehberi

**Sistem:** Herediter Anjiyoödem ve İmmün Yetmezliklere Zor Olgularla Pratik Çözümler — Poster Bildiri Başvuru ve Yönetim Sistemi
**Subdomain:** `https://hao-immunyetmezlik-poster.aid.com.tr/`
**Mevcut sürüm:** v22

Bu rehber, sistemi sıfırdan kurarken **hatasız** ilerlemen için yazıldı. Tüm denenmiş ve başarısız yollar bilerek elenmiş; sadece çalışan akış var.

---

## 🏗️ Mimari (Servisler)

| Servis | Görev | Maliyet |
|---|---|---|
| **GitHub** | Kod deposu | Ücretsiz |
| **Vercel** | Hosting + Otomatik SSL + CDN | Ücretsiz |
| **Supabase** | Veritabanı + Auth + Storage | Ücretsiz (500 MB DB, 1 GB storage) |
| **Quill 2.0 (jsDelivr)** | Zengin metin editör | Ücretsiz CDN |
| **html2pdf + window.print** | PDF üretimi | Browser native |
| **Tailwind CDN** | CSS framework | Ücretsiz |

> **Önemli:** Sistem **vanilla HTML/JS** — React veya Node.js build adımı **YOK**. Statik dosyalar Vercel'e yüklenir, çalışır.

---

## 📂 Dosya Yapısı

```
.
├── index.html               # Kullanıcı: başvuru formu + landing
├── admin.html               # Yönetici paneli (login arkasında)
├── README.md                # Genel kullanım bilgisi
├── REHBER.md                # BU DOSYA — sıfırdan kurulum
├── supabase-schema.sql      # SQL şeması (1 kez çalıştırılır)
├── supabase-fix.sql         # RLS recursion düzeltmesi
├── supabase-fix-settings.sql # Settings UPDATE 406 düzeltmesi
├── bildiri-sistemi.zip      # Tüm dosyaları içeren güncel paket
└── assets/
    ├── app.js               # Ortak veri katmanı + utils
    ├── user.js              # Başvuru formu mantığı
    ├── admin.js             # Yönetici paneli mantığı
    ├── editor.js            # Quill 2.0 wrapper + Supabase upload
    ├── export.js            # PDF (window.print) + DOCX + XLSX
    ├── sanitize.js          # DOMPurify HTML sanitize
    ├── style.css            # Apple sadeliğinde özel stiller
    ├── supabase-config.js   # URL + anon key (boşsa LocalStorage)
    └── supabase-driver.js   # Supabase backend sürücüsü
```

---

# 🚀 SIFIRDAN KURULUM — Ana Akış

Aşağıdaki sırayı **birebir takip et**. Her aşama bir öncekine bağlı.

## Aşama 1 — Supabase (≈15 dk)

### 1.1 Hesap aç
1. [supabase.com](https://supabase.com) → **Start your project**
2. **GitHub ile devam et** (önerilen — Vercel'le aynı hesaptan girebilirsin).

### 1.2 Yeni proje oluştur
- **Name:** `bildiri-aid`
- **Database Password:** güçlü şifre (bir yere kaydet)
- **Region:** **Central EU (Frankfurt)** ← Türkiye'ye en yakın
- **Pricing Plan:** Free
- **Create new project** → 1-2 dk bekle.

### 1.3 SQL şemasını yükle
1. Sol menü → **SQL Editor** → **+ New query**
2. `supabase-schema.sql` dosyasının **TAMAMINI** yapıştır
3. **Run** → "Success. No rows returned." görmelisin

✅ **Doğrulama:** Sol menü → Table Editor → şu 4 tablo olmalı:
- `submissions`
- `admins`
- `settings`
- `audit_log`

### 1.4 İlk admin kullanıcısını oluştur
1. Sol menü → **Authentication** → **Users** sekmesi
2. **Add user** → **Create new user**
3. Form:
   - **Email:** kendi e-postanı yaz (örn. `sekreter@aid.org.tr`)
   - **Password:** güçlü şifre (NOT ET)
   - **Auto Confirm User:** ✓ MUTLAKA İŞARETLE
4. **Create user**

### 1.5 İlk admin'i süper admin yap
1. Authentication → Users → az önce oluşturduğun kullanıcıya tıkla
2. **User UID** alanını kopyala (uzun string, örn. `db6edb2a-2cb1-4dd6-bf9a-...`)
3. SQL Editor → New query → şunu yapıştır (UID'i değiştir):

```sql
insert into public.admins (id, username, name, role)
values (
  'BURAYA_UID_YAPIŞTIR',
  'admin',
  'Sistem Yöneticisi',
  'super'
);
```

4. **Run** → "Success. 1 row inserted"

✅ **Doğrulama:** Table Editor → admins tablosunda 1 satır olmalı.

### 1.6 Storage bucket oluştur (görseller için)
1. Sol menü → **Storage** → **New bucket**
2. **Name:** `posters-media`
3. **Public bucket:** ✓ aç
4. **File size limit:** 5 MB
5. **Allowed MIME types:** `image/png, image/jpeg, image/jpg, image/gif, image/webp`
6. Save.

### 1.7 Storage RLS politikalarını ayarla
SQL Editor → New query → yapıştır → Run:

```sql
drop policy if exists "Anon can upload posters-media" on storage.objects;
create policy "Anon can upload posters-media"
  on storage.objects for insert to anon
  with check (bucket_id = 'posters-media');

drop policy if exists "Auth can upload posters-media" on storage.objects;
create policy "Auth can upload posters-media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'posters-media');

drop policy if exists "Public can read posters-media" on storage.objects;
create policy "Public can read posters-media"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'posters-media');
```

### 1.8 RLS recursion düzeltmesini çalıştır (KRİTİK!)
SQL Editor → New query → `supabase-fix.sql` içeriğini yapıştır → Run.

> **Neden gerekli:** Schema'daki orijinal RLS policy'leri sonsuz döngüye girer. Bu fix `is_admin()` ve `is_super_admin()` fonksiyonlarını SECURITY DEFINER ile yeniden tanımlar.

### 1.9 API anahtarlarını kopyala
1. Sol alt → **Project Settings** (dişli) → **API**
2. **Project URL** kopyala (örn. `https://abcdefgh.supabase.co`)
3. **API Keys → anon public** anahtarını kopyala (uzun JWT, `eyJ...` ile başlar)
4. Bunları geçici bir not dosyasına yapıştır.

### 1.10 Authentication URL Configuration (şifre sıfırlama linki için)
1. Sol menü → **Authentication** → **URL Configuration** sekmesi
2. **Site URL:** `https://hao-immunyetmezlik-poster.aid.com.tr` (kendi domain'inle değiştir)
3. **Redirect URLs:** ekle:
   - `https://hao-immunyetmezlik-poster.aid.com.tr/admin.html`
   - `https://hao-immunyetmezlik-poster.aid.com.tr/**`
4. Save.

> **Neden:** Aksi halde "şifremi unuttum" e-postaları `localhost:3000`'e yönlendirir.

⚠️ **TUZAK:** `anon` ile `service_role` key'i karıştırma. Service role frontend'de **kesinlikle olmamalı** (tüm RLS bypass eder, güvenlik felaketi).

---

## Aşama 2 — Proje Dosyalarını Hazırla (≈5 dk)

### 2.1 ZIP'i indir, aç
- `bildiri-sistemi.zip` dosyasını masaüstüne çıkar.

### 2.2 Supabase config'i doldur
`assets/supabase-config.js` dosyasını **TextEdit/Notepad** ile aç (Word/Pages değil!).

İçerik **tam olarak şöyle olmalı**:
```js
window.SUPABASE_CONFIG = {
  url: 'https://abcdefgh.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...',
};
```

⚠️ **TUZAKLAR:**
- URL'nin **sonunda `/rest/v1/` OLMAMALI** — sadece domain
- anonKey **`eyJ` ile başlamalı** (JWT). Eğer `sb_secret_` ile başlıyorsa o **YANLIŞ** key (service role)
- Tek tırnak içinde olmalı, virgüller yerinde

Kaydet.

---

## Aşama 3 — GitHub'a Yükle (≈5 dk)

### 3.1 GitHub repo oluştur
1. [github.com](https://github.com) → giriş yap → sağ üst **+** → **New repository**
2. **Name:** `bildiri-aid`
3. **Public** seç (Vercel free için kolay)
4. **Add a README file:** ✗ işaretleme
5. **Create repository**

### 3.2 Dosyaları yükle
1. Boş repo sayfasında **uploading an existing file** linkine tıkla
2. Klasördeki **TÜM dosya/klasörleri sürükle**:
   - `index.html`, `admin.html`, `README.md`, `REHBER.md`
   - `supabase-schema.sql`, `supabase-fix.sql`, `supabase-fix-settings.sql`
   - `assets/` klasörü (komple)
3. Yeşil tikleri görene kadar bekle
4. **Commit changes**

✅ **Doğrulama:** Repo ana sayfasında dosyaları görmeli, `assets/` içinde 9 dosya olmalı.

---

## Aşama 4 — Vercel'e Deploy (≈5 dk)

### 4.1 Vercel hesabı + proje
1. [vercel.com](https://vercel.com) → **Sign Up** → GitHub ile giriş
2. Dashboard → **Add New → Project**
3. **Import Git Repository** → `bildiri-aid` repo'na tıkla → **Import**
4. Form aynen kalsın, sadece **Deploy**'a bas
5. 1-2 dk bekle → "Congratulations" görmelisin
6. Sana otomatik bir adres verir (örn. `bildiri-aid-xxx.vercel.app`)

### 4.2 Domain bağla
1. Project → **Settings** → **Domains**
2. **Add** → `hao-immunyetmezlik-poster.aid.com.tr` (kendi subdomain'in)
3. Vercel sana bir CNAME değeri verir (`cname.vercel-dns.com`)
4. **Domain DNS yönetimini yapan paneli aç** (Natro vb.):
   - subdomain için **CNAME kaydı** ekle:
     - **Name:** `hao-immunyetmezlik-poster`
     - **Value:** `cname.vercel-dns.com`
     - **TTL:** 3600
5. 5-30 dk bekle → Vercel "Valid Configuration" yeşil tik gösterir
6. SSL otomatik gelir (Vercel Let's Encrypt yönetir, ek iş yok)

⚠️ **TUZAK:** Eğer önceden Plesk veya başka yere deploy denediysen, eski DNS kayıtlarını sil. Hatalı bir CNAME varsa Vercel'i ezer.

---

## Aşama 5 — Test ve Doğrulama (≈5 dk)

### 5.1 Site açılıyor mu?
1. `https://hao-immunyetmezlik-poster.aid.com.tr/` aç
2. **Cmd+Shift+R** (hard refresh)
3. F12 → Console → **kırmızı hata olmamalı**
4. Console'da `[Bildiri] Supabase verisi yüklendi.` mesajı olmalı
5. Sayfanın altında footer'da **`v22`** yazısı görmelisin

### 5.2 Admin'e giriş
1. `https://hao-immunyetmezlik-poster.aid.com.tr/admin.html`
2. Hard refresh
3. Form:
   - **Kullanıcı adı:** Adım 1.4'te oluşturduğun e-posta
   - **Şifre:** Adım 1.4'teki şifre
4. **Giriş yap**
5. Sağ üstte **"Sistem Yöneticisi · Süper Admin"** yazmalı (undefined ise SQL fix'i yeniden çalıştır)

### 5.3 Test bildirisi gönder
1. Yeni sekmede başvuru sayfası
2. Form doldur, görsel yükle, beyanları işaretle
3. **Bildiri Gönder** → Son Kontrol modali → **Onayla ve Gönder**
4. Başarı ekranı, bildiri numarası göster

### 5.4 Admin'de göründüğünü kontrol et
1. Admin → Bildiriler sekmesi → satır görmelisin
2. Tıkla → detay modalında özet HTML olarak render olmalı
3. **PDF** butonu → yeni sekme açılır → "Yazdır" → PDF indirilir → tablo/görsel/format **korunmuş** olmalı

✅ **Buraya kadar geldiyseniz sistem üretim için hazır.**

---

# 🛠️ Sürüm Güncellemesi (Kod Değişikliği)

İleride bir kod değişikliği yapacaksan:

1. Yeni ZIP'i indir, aç.
2. `assets/supabase-config.js` dosyasını **dokunma** (kendi URL/key'in olduğu için).
3. GitHub repo → **Add file → Upload files** → değişen dosyaları sürükle (üstüne yazılır).
4. Commit changes.
5. Vercel otomatik deploy eder (~1 dk).
6. Hard refresh ile doğrula.

---

# 🚨 SORUN GİDERME — Acil Durum Kataloğu

## Sorun 1: Site açılmıyor / 404
**Olası neden:** DNS doğru bağlı değil, Vercel'i göstermiyor.
**Çözüm:**
1. [whatsmydns.net](https://whatsmydns.net) → subdomain'ini sorgula → CNAME = `cname.vercel-dns.com` mu?
2. Değilse domain DNS panelinde CNAME'i düzelt
3. Vercel Settings → Domains → "Valid Configuration" yeşil mi?

## Sorun 2: Console'da `Cannot access 'X' before initialization`
**Sebep:** JavaScript Temporal Dead Zone — modül-seviye `let`/`const` tanımı bir fonksiyon tarafından erkenden erişiliyor.
**Çözüm:** İlgili `let` veya `const`'u dosyanın **EN BAŞINA** taşı (tüm fonksiyonlardan önce). admin.js'te ilk 32 satır bu kural için ayrılmış.

## Sorun 3: "Ayarlar kaydedilemedi" / 406 PGRST116 hatası
**Sebep:** Supabase RLS UPDATE policy'si bloke ediyor — admin hesabın `super` rolüne sahip değil ya da `is_super_admin()` fonksiyonu bozuk.
**Çözüm:** `supabase-fix-settings.sql` dosyasının tamamını SQL Editor'da çalıştır. (Bu dosyada e-postanı kendi e-postanla değiştirmeyi unutma.)

## Sorun 4: Admin panelinde "undefined · undefined" badge
**Sebep:** Login sırasında session bozuk kuruldu — async/await sorunu olabilir.
**Çözüm:** Çıkış yap → tekrar giriş yap. Hâlâ çıkıyorsa `supabase-fix-settings.sql` çalıştır + browser cache temizle.

## Sorun 5: Editör yüklenmiyor / sürekli "Yükleniyor..." dönüyor
**Sebep 1:** jsDelivr CDN'inden Quill yüklenemiyor (network problemi).
**Sebep 2:** Browser eklentisi (VPN, AdBlock) script'i bloke ediyor.
**Çözüm:**
1. Chrome → `chrome://extensions` → şüpheli VPN/proxy uzantısını **kaldır**
2. Adblocker varsa bu site için kapat
3. Hard refresh + Console'da kırmızı hatayı paylaş

## Sorun 6: PDF boş çıkıyor (eski hatamız)
**Sebep:** Eskiden html2pdf.js kullanıyorduk, off-screen positioning bug'ı vardı.
**Çözüm:** v22'de `window.print()` yöntemine geçtik — yeni sekme açılır, browser native PDF motoru kullanılır. Bu yöntem **garanti çalışır**. Eğer pop-up engellendi uyarısı gelirse, browser ayarlarından bu site için pop-up'a izin ver.

## Sorun 7: DOCX'te tablo/görsel görünmüyor
**Sebep:** DOCX şu anda sadece düz metin export ediyor (HTML→DOCX dönüşümü Faz 3'te yapılacak).
**Çözüm:** Tablo/görsel için **PDF kullan** — PDF her şeyi kayıpsız korur. Word'de düzenleme gerekirse DOCX inip elle ekleyebilirsin.

## Sorun 8: Tablo paste edince hata veriyor
**Beklenen davranış:** v19+ Quill clipboard'tan tablo yapıştırılırsa otomatik uyarı verir ve siler. Kullanıcı tablonun ekran görüntüsünü görsel olarak yüklemeli.
**Çözüm:** Form üstündeki sarı uyarı bandını kullanıcıya hatırlat.

## Sorun 9: Sayfa yenileme sonrası tuşlar çalışmıyor
**Sebep:** TDZ hatası (Sorun 2'nin sonucu) — script çöker, event listener'lar bağlanmaz.
**Çözüm:** Console'da kırmızı hatayı bul → ilgili `let`/`const`'u dosyanın başına taşı.

---

# 📐 Veritabanı Şeması (Referans)

## `submissions` tablosu
| Kolon | Tip | Açıklama |
|---|---|---|
| id | text PK | `BLD-1001` formatında |
| status | text | pending / accepted / rejected / revision |
| status_note | text | yönetici notu |
| title | text | bildiri başlığı |
| abstract | text | **HTML** (zengin metin, görsel/format dahil) |
| keywords | text[] | anahtar kelimeler |
| authors | jsonb | `[{fullName, affiliationIndex, presenter}]` |
| affiliations | text[] | kurum listesi |
| contact_name | text | iletişim adı |
| contact_email | text | iletişim e-posta |
| contact_phone | text | iletişim telefon |
| contact_inst | text | iletişim kurum |
| ethics_ack | bool | "Geri çekilemez" beyanı (rename: ackNoWithdraw) |
| originality_ack | bool | "Katılım zorunlu" beyanı (rename: ackAttendance) |
| created_at | timestamptz | gönderim tarihi |
| updated_at | timestamptz | son güncelleme |

## `admins` tablosu
| Kolon | Tip | Açıklama |
|---|---|---|
| id | uuid PK | auth.users(id) ile foreign key |
| username | text | kullanıcı adı |
| name | text | ad soyad |
| role | text | super / editor / reviewer |
| created_at | timestamptz | |

## `settings` tablosu (singleton — id=1)
- event_title, event_short, organizer
- word_limit (default 5000)
- deadline (date)
- submissions_open (bool)
- form_sections_order (text[])
- rule_format_text, rule_content_text

## `audit_log` tablosu
İşlem geçmişi (oluşturma, güncelleme, silme, kabul/ret).

---

# 🎯 Önemli Tasarım Kararları (Geriye Dönük Notlar)

Bu kararlar **denenmiş ve değişmemesi gereken** seçimlerdir:

1. **Vanilla JS, React yok** — Vercel'e direkt deploy edilebilsin diye. Build adımı yok, npm yok. ZIP açılır, yüklenir, çalışır.

2. **Quill 2.0, TinyMCE/CKEditor değil** — TinyMCE'in license_key drama'sı, CKEditor super-build'in CDN sorunu vardı. Quill stabil, hızlı, sade.

3. **Tablo desteği YOK** — Quill'in tablo desteği experimental, paste'de bozulur. Kullanıcılara "tablo yerine ekran görüntüsü" yönlendirmesi yapıyoruz. v19'dan itibaren paste edilen tablolar otomatik silinir + uyarı.

4. **PDF için `window.print()`, html2pdf değil** — html2pdf'in off-screen render bug'ı vardı, boş PDF çıkıyordu. window.print() browser native, garanti çalışır.

5. **DOCX'te tablo/görsel yok** — HTML→DOCX dönüştürücüsü yazmak çok iş. PDF zaten bu işi mükemmel yapıyor. DOCX yedek olarak düz metin tutuyor.

6. **Cache busting `?v=NN`** — Vercel cache + browser cache eski sürümü tutmasın diye. Her büyük güncellemede number arttırılır. Footer'da görünür.

7. **TDZ koruma** — Tüm modül-seviye `let`/`const` ilk 32 satırda. Yeni özellik eklerken bu kuralı koru.

8. **DNS Vercel'i göstermeli** — Plesk veya başka host kullanmıyoruz. SSL otomatik gelir, dert yok.

9. **Cloudflare gereksiz** — Vercel SSL'i otomatik veriyor, Cloudflare ek olarak DNS değişimi gerektirirdi. Vercel free yeterli.

10. **Supabase Storage `posters-media` bucket** — görseller Base64 olarak kayıt edilmez, public URL ile gömülür. Hem DB küçük kalır, hem PDF rendering kolay.

---

# 📞 Kim, Nereye, Ne Zaman?

| Konu | Yer |
|---|---|
| Kod deposu | GitHub repo (yetkili: kendi hesabın) |
| Hosting | Vercel Dashboard |
| Veritabanı | Supabase Dashboard |
| DNS | Domain panelin (Natro vb.) |
| Yedekleme | Supabase otomatik 7 gün, Admin → Ayarlar → "Yedeği indir" ile manuel |
| Yeni admin ekleme | Supabase Authentication → Add user + admins tablosuna SQL ile rol ekle |
| Şifre sıfırlama | Supabase → Authentication → Users → kullanıcı → ⋮ → "Send password recovery" (Site URL doğru olmalı, 1.10'a bak) |

---

# ✅ Checkpoint Özeti — "Bu rehberi takip ettim" listesi

Sıfırdan kurarken şunları işaretle:

- [ ] **Aşama 1:** Supabase hesap + proje + SQL şema + admin user + storage + RLS fix + URL config
- [ ] **Aşama 2:** ZIP açıldı, `supabase-config.js` doldu (URL + anon key)
- [ ] **Aşama 3:** GitHub repo + dosyalar yüklendi
- [ ] **Aşama 4:** Vercel deploy + DNS CNAME + SSL otomatik
- [ ] **Aşama 5:** Hard refresh ile site açılıyor, footer'da "v22", admin'e giriş yapıldı, test bildirisi gönderildi, PDF indi

Her ✓ doğruysa sistem hazır.

---

# 🔚 Son Notlar

- **Bu rehber statiktir** — kod evrim geçirdikçe sürüm numarası değişir, bazı detaylar farklılaşabilir. Ama genel akış (Supabase → GitHub → Vercel → DNS) kalıcıdır.
- **README.md** kullanıcı için kısa bir kullanım kılavuzudur. Bu **REHBER.md** geliştirici/yönetici için detaylı kurulum dökümandır.
- **Sorun çıktığında ilk yapılacak:** F12 → Console → kırmızı hata satırını oku. Yukarıdaki "Sorun Giderme" listesinde benzer pattern'i bul.
- **Supabase backup:** Düzenli olarak Admin → Ayarlar → "Yedeği indir" ile manuel yedek almanı tavsiye ederim. Supabase free planda 7 gün otomatik backup tutar, ama dışa aktarmak güvenli.
- **Maliyet:** Şu anki yapı **tamamen ücretsiz**. Bildiri sayısı 1000+ olursa Supabase 500 MB DB sınırı zorlanabilir, o noktada Pro plana geçilir ($25/ay).

İyi yönetimler! 🎉
