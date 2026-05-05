# Bildiri Yönetim Sistemi
**Herediter Anjiyoödem ve İmmün Yetmezliklere Zor Olgularla Pratik Çözümler**

Apple sadeliğinde, Türkçe, mobil uyumlu poster bildiri başvuru ve yönetim sistemi. Statik dosyalardan oluşur — herhangi bir sunucu kurulumu gerektirmez, doğrudan **`hao-immunyetmezlik-poster.aid.com.tr`** subdomain'ine yüklenir.

> **Hedef adres:** `https://hao-immunyetmezlik-poster.aid.com.tr/`
> **Yönetici paneli:** `https://hao-immunyetmezlik-poster.aid.com.tr/admin.html`

---

## Hızlı Başlangıç

1. Bu klasörün tamamını `hao-immunyetmezlik-poster.aid.com.tr` subdomain'inin web kök klasörüne yükleyin.
2. `index.html` ana sayfa olarak açılır.
3. `admin.html` üzerinden yönetici girişi yapılır.
4. Varsayılan giriş: **kullanıcı: `admin` · şifre: `aid2026`** — ilk girişten hemen sonra şifreyi değiştirin (Yöneticiler sekmesi).

## Dosya Yapısı

```
.
├── index.html               # Kullanıcı: başvuru formu + landing
├── admin.html               # Yönetici paneli (login arkasında)
├── assets/
│   ├── app.js               # Ortak veri katmanı (LocalStorage)
│   ├── user.js              # Başvuru formu mantığı
│   ├── admin.js             # Yönetici paneli mantığı
│   ├── export.js            # DOCX + XLSX export
│   ├── supabase-config.js   # Supabase URL + anon key (boşsa LocalStorage)
│   ├── supabase-driver.js   # Supabase backend sürücüsü (otomatik aktifleşir)
│   └── style.css            # Apple sadeliğinde özel stiller
├── supabase-schema.sql      # Supabase için SQL şeması (1 kez çalıştırılır)
└── README.md                # Bu dosya
```

## Plesk ile Yükleme (önerilen yöntem)

Subdomain'iniz **`hao-immunyetmezlik-poster.aid.com.tr`** Plesk panelinde tanımlı.

### Adım 1 — ZIP olarak hazırla
Bu klasörün tüm içeriğini (`index.html`, `admin.html`, `assets/`, `README.md`) **bir ZIP dosyasına** sıkıştırın. Ana klasörün kendisi değil, içindekiler ZIP'in köküne girmeli.

### Adım 2 — Plesk Dosya Yöneticisi'ni aç
Plesk panelinde:
- **Domains → `hao-immunyetmezlik-poster.aid.com.tr` → Files** sekmesi.
- Web kök klasörü genelde `httpdocs/` veya `public_html/` olur.

### Adım 3 — Eski dosyaları temizle
Plesk subdomain oluşturduğunda otomatik bir karşılama sayfası bırakır (`index.html`, `index.php`, `default.html` gibi). Bu dosyaları **silin** ya da `_backup/` klasörüne taşıyın.

### Adım 4 — ZIP'i yükle ve aç
- Üst menüden **Upload** → ZIP dosyasını seçin.
- Yükleme bittikten sonra ZIP'e sağ tık → **Extract Files**.
- Çıkarma sonrası `index.html`, `admin.html`, `assets/` doğrudan web kökünde olmalı.

### Adım 5 — Dosya izinleri
Plesk varsayılan izinler genelde doğrudur. Sorun yaşarsanız:
- Klasörler: `755`
- Dosyalar: `644`

### Adım 6 — SSL sertifikası
Natro Plesk'te Let's Encrypt eklentisi yoksa **Cloudflare** üzerinden ücretsiz Universal SSL kullanın (önerilen — aşağıda ayrı bölüm). Plesk'te Symantec/AutoSSL gibi başka bir ücretsiz seçenek görüyorsanız onu da kullanabilirsiniz.

### Adım 7 — Test
Aşağıdaki adresleri açıp kontrol edin:
- `https://hao-immunyetmezlik-poster.aid.com.tr/` → Başvuru formu
- `https://hao-immunyetmezlik-poster.aid.com.tr/admin.html` → Yönetici girişi

> Tüm dosyalar statiktir; PHP/Node/Python gerekmez. Plesk subdomain için varsayılan ayarlar yeterlidir.

## Alternatif Yükleme Yöntemleri

### FTP/SFTP istemcisi (FileZilla, Cyberduck)
1. Plesk → **FTP Access** ile FTP kullanıcı bilgilerinizi alın.
2. Sunucuya bağlanın → `/httpdocs/` (veya `/hao-immunyetmezlik-poster.aid.com.tr/`) klasörüne girin.
3. Bu klasörün tüm içeriğini sürükleyip bırakın.

### Vercel (test/staging için)
Plesk öncesi hızlı test almak isterseniz:
1. [vercel.com](https://vercel.com) → New Project → klasörü sürükleyin.
2. Anında geçici bir `*.vercel.app` adresi alırsınız.
3. Üretim için Plesk'e geçmeden önce davranışı doğrulayabilirsiniz.

## Özellikler

### Kullanıcı (index.html)
- Tek sayfada başvuru formu — Apple sadeliği
- 350 kelimelik özet — anlık sayaç ve renk kodlu uyarı
- Title Case otomatik düzeltme (Türkçe karakter güvenli)
- Dinamik yazar ve kurum kartları (numaralı eşleme)
- Otomatik taslak kaydı — kullanıcı sayfayı kapatsa bile devam edebilir
- Anahtar kelime, etik kurul ve özgünlük beyanı
- Başvuru numarası ile durum sorgulama modalı
- %100 mobil uyumlu, &lt;2 sn yüklenme

### Yönetici (admin.html)
- Şifreli giriş (LocalStorage tabanlı, hash'li parola)
- Genel bakış: toplam, beklemede, kabul, ret KPI'ları + son başvurular
- Bildiriler sekmesi:
  - Anlık metin araması (başlık, yazar, e-posta, anahtar kelime, özet)
  - Durum filtresi · sıralama
  - Cmd/Ctrl+F ile arama kutusuna odak
  - Hızlı kabul (✓) ve hızlı ret (✕) düğmeleri
  - Detay modalında özet/başlık/durum/not düzenleme
  - Tek tıkla DOCX bildiri çıktısı
- Yöneticiler sekmesi: birden fazla admin ekleme, rol atama (Süper Admin / Editör / Hakem), şifre değiştirme
- Ayarlar: etkinlik adı, kelime sınırı, son tarih, başvuru aç/kapat
- Veri yönetimi: JSON yedek indir / yedekten geri yükle / tüm verileri sıfırla
- Hareket günlüğü: son 500 işlem (oluşturma, güncelleme, silme, kabul/ret)
- Toplu Excel export (tümü / sadece kabul / filtreli)

## Cloudflare ile Ücretsiz SSL (Natro Plesk için önerilen)

Plesk'te Let's Encrypt yoksa Cloudflare üzerinden domain'i geçirip otomatik SSL alabilirsiniz. Cloudflare ücretsizdir, sertifikayı kendi yeniler, bonus DDoS koruması verir.

### Adım 1 — Cloudflare hesabı aç
[cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) → ücretsiz hesap.

### Adım 2 — Domain ekle
Dashboard → **Add a site** → `aid.com.tr` (subdomain değil, ana domain) → **Free** plan seç. Cloudflare mevcut DNS kayıtlarını otomatik tarar.

### Adım 3 — Nameserver değiştir
Cloudflare size iki nameserver verir (örn. `kate.ns.cloudflare.com`, `walt.ns.cloudflare.com`).

Bu nameserver'ları **Natro müşteri panelinizde** `aid.com.tr` domaininin nameserver alanına girin (Domain → DNS yönetimi → Nameserver değiştir). Bu değişiklik 1–24 saat içinde aktif olur.

> **Önemli:** Cloudflare yalnızca ana domain (aid.com.tr) için aktif olur ve onun tüm subdomain'leri dahil. Sadece subdomain'i Cloudflare'e taşımak mümkün değildir.

### Adım 4 — DNS kaydını doğrula
Cloudflare DNS sekmesinde `hao-immunyetmezlik-poster` adında bir A veya CNAME kaydı olmalı. Yoksa ekleyin:
- **Type:** A
- **Name:** `hao-immunyetmezlik-poster`
- **IPv4:** Plesk sunucunuzun IP'si (Plesk → Tools & Settings → Server Info)
- **Proxy status:** Proxied (turuncu bulut)

### Adım 5 — SSL modunu ayarla
Cloudflare Dashboard → SSL/TLS → **Flexible** seçin (Plesk'te SSL yokken bu çalışır). Daha sonra Plesk'te self-signed sertifika kurarsanız **Full** moduna geçirin.

> Flexible: kullanıcı ↔ Cloudflare HTTPS, Cloudflare ↔ Plesk HTTP. Genel kullanım için yeterli.

### Adım 6 — HTTP → HTTPS yönlendirme
SSL/TLS → Edge Certificates → **Always Use HTTPS** açın.

### Adım 7 — Test
- Tarayıcıda `https://hao-immunyetmezlik-poster.aid.com.tr/` açılmalı, kilit ikonu görünmeli.
- Cloudflare panelinde `Analytics` → trafiğin gelip gelmediğini görebilirsiniz.

> **Not:** Cloudflare'i istemiyorsanız ZeroSSL (zerossl.com) üzerinden manuel Let's Encrypt sertifikası alıp Plesk'e yükleyebilirsiniz, ancak 90 günde bir manuel yenileme gerekir.

## Site Açılmıyorsa — Debug Listesi

Plesk'e yükledikten sonra site beyaz sayfa veriyor, 404 dönüyor veya başka bir karşılama sayfası açılıyor olabilir. Sırayla kontrol edin:

**1. Doğru klasöre yükledim mi?**
Plesk → Files → Subdomain'in web kökü genelde `httpdocs/` veya `hao-immunyetmezlik-poster.aid.com.tr/` adlı klasördür. `index.html` ve `admin.html` BU klasörün doğrudan içinde olmalı; alt klasörde değil.

**2. Eski karşılama sayfası kalmış mı?**
Plesk subdomain oluştururken otomatik bir `index.html`, `index.php`, `default.html`, veya `web.config` bırakır. Bunları silin. Özellikle `index.php` varsa onu silin — yoksa Apache önce onu açar.

**3. Default page sıralaması doğru mu?**
Plesk → Apache & nginx Settings → Index files: `index.html index.htm` olmalı (en başta `index.html`).

**4. DNS yayılmış mı?**
Komut satırı: `nslookup hao-immunyetmezlik-poster.aid.com.tr` çalıştırın. IP dönmeli. Yeni eklenmiş subdomain için 1-2 saat bekleyin.

**5. Tarayıcı önbelleği**
Chrome'da `Ctrl+Shift+R` (hard reload). Veya gizli sekmede deneyin.

**6. Mixed content uyarısı**
HTTP üzerinden açıyorsanız (SSL henüz kurulmamış), sayfa yüklenir ama bazı CDN scriptleri (Tailwind, Supabase SDK) `https://` ile geldiği için bloklanabilir. Cloudflare ile SSL kurun; bu çözer.

**7. Konsol hatalarını oku**
Chrome'da F12 → Console sekmesi. 404, CORS, ya da CSP hatalarını paylaşın, daha hızlı tanı koyarım.

**8. Dosya izinleri**
Plesk → Files → her dosya sağ tık → **Change Permissions**:
- Klasörler: `0755`
- Dosyalar: `0644`

**9. .htaccess çakışması**
Eski bir `.htaccess` dosyası varsa silin veya yeniden adlandırın.

## Veri Saklama

Veriler tarayıcının **LocalStorage**'ında saklanır:
- `bildiri.submissions.v1` — tüm bildiriler
- `bildiri.admins.v1` — yöneticiler (parolalar hash'li)
- `bildiri.session.v1` — aktif oturum
- `bildiri.settings.v1` — sistem ayarları
- `bildiri.audit.v1` — hareket günlüğü
- `bildiri.draft.v1` — kullanıcının yarım kalan başvurusu

**Önemli:** LocalStorage tarayıcıya özeldir. Yöneticiler farklı bilgisayarlardan erişiyorsa her bilgisayar kendi yerel kopyasını tutar. Üretim için aşağıdaki Firebase geçişine bakın.

## Supabase Backend Kurulumu (önerilen)

LocalStorage tarayıcıya özeldir — birden fazla cihazdan yöneticilik yapacaksanız Supabase önerilir. Ücretsiz katmanı bu boyutta bir kongre için fazlasıyla yeterli (500 MB DB, 2 GB transfer/ay).

Sistemde Supabase entegrasyonu **hazır** geliyor — sadece config doldurulduğunda otomatik aktifleşir. Yapmanız gerekenler:

### Adım 1 — Supabase hesabı aç
[supabase.com](https://supabase.com) → **Start your project** → GitHub veya e-posta ile kayıt ol.

### Adım 2 — Yeni proje oluştur
Dashboard → **New project**:
- **Name:** `bildiri-aid` (istediğiniz isim)
- **Database Password:** güçlü bir şifre seçin (ileride DB'ye direkt bağlanmak için lazım olur, kaydedin)
- **Region:** `Frankfurt (eu-central-1)` (Türkiye'ye en yakın)
- **Plan:** Free

Proje 1-2 dakikada hazır olur.

### Adım 3 — SQL şemasını yükle
Sol menü → **SQL Editor** → **New query** → bu klasördeki `supabase-schema.sql` dosyasının tüm içeriğini yapıştırın → **Run**.

"Success. No rows returned." mesajı görmeniz gerekir. Tablolar (`submissions`, `admins`, `settings`, `audit_log`), index'ler, trigger'lar ve RLS politikaları otomatik kurulur.

### Adım 4 — İlk yöneticiyi oluştur
Sol menü → **Authentication** → **Users** → **Add user** → **Create new user**:
- **Email:** `admin@aid.org.tr` (kendi e-posta adresiniz)
- **Password:** güçlü bir şifre
- **Auto Confirm User:** ✓ işaretle

Kullanıcı oluştuktan sonra satıra tıklayın → **User UID**'yi (uzun bir string) kopyalayın.

Sonra **SQL Editor**'a dönüp şu sorguyu çalıştırın (UID'yi kendi UID'nizle değiştirin):

```sql
insert into public.admins (id, username, name, role)
values ('YAPIŞTIRDIĞINIZ-UID', 'admin', 'Sistem Yöneticisi', 'super');
```

Bu kullanıcı artık Süper Admin yetkisine sahip.

### Adım 5 — API anahtarlarını al
Sol menü → **Project Settings** (dişli ikonu) → **API**:
- **Project URL** (örn. `https://abcdefgh.supabase.co`) — kopyalayın
- **anon public key** (uzun JWT string) — kopyalayın

### Adım 6 — Yapılandırmayı dosyaya yaz
Plesk dosya yöneticisinde `assets/supabase-config.js` dosyasını **düzenle** (sağ tık → Edit) ve şu değerleri yapıştırın:

```js
window.SUPABASE_CONFIG = {
  url: 'https://abcdefgh.supabase.co',  // Adım 5'ten
  anonKey: 'eyJhbGciOi...uzunJWTstring...',  // Adım 5'ten
};
```

Kaydedin. Tarayıcıda siteyi açıp F12 → Console'a bakın — `[Bildiri] Supabase verisi yüklendi.` mesajını görmelisiniz.

### Adım 7 — Yöneticiler artık e-posta ile giriş yapar
`admin.html` üzerinde:
- **Kullanıcı adı:** Adım 4'te kullandığınız e-posta
- **Şifre:** Adım 4'te belirlediğiniz şifre

### Yeni admin eklemek
Supabase Dashboard → Authentication → Add user (Adım 4'teki gibi) → SQL'de bir satır insert. UI üzerinden admin ekleme bu modda devre dışıdır (güvenlik için).

### Yedek alma
Supabase otomatik günlük yedek alır (Free planda 7 gün). Manuel yedek için Dashboard → Database → Backups.

### Supabase'i devre dışı bırakma
`assets/supabase-config.js`'i tekrar boşaltırsanız sistem otomatik LocalStorage moduna döner.

## Şifre Sıfırlama (acil durum)

Tüm yönetici şifrelerini sıfırlamak isterseniz tarayıcı geliştirici konsolunda:
```js
localStorage.removeItem('bildiri.admins.v1'); location.reload();
```
Bu işlem varsayılan `admin / aid2026` hesabını yeniden oluşturur.

## Tarayıcı Desteği
Chrome, Edge, Safari, Firefox güncel sürümleri. IE desteklenmez.

## Lisans
İç kullanıma yöneliktir. Türkiye Ulusal Allerji ve Klinik İmmünoloji Derneği için hazırlanmıştır.
