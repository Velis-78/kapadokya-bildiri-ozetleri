/* ============================================================
   Bildiri Sistemi — Rich Text Editör (Quill 2.0)
   ------------------------------------------------------------
   - Hızlı, kararlı, jsDelivr CDN
   - Görsel: Supabase Storage 'posters-media' bucket'ına yüklenir
   - Tablo: Custom toolbar butonu ile satır/sütun seçilir
   - Word/Google Docs paste: Quill clipboard module ile
   ============================================================ */
(function (global) {
  'use strict';

  // ---------- Supabase Storage yükleyici ----------
  function uploadFileToSupabase(file) {
    var sb = global.BildiriBackend && global.BildiriBackend.client;
    if (!sb) {
      // Storage yoksa fallback: data URL
      return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onload = function () { resolve(r.result); };
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    }
    var ext = (file.name || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    var fname = 'paste/' + Date.now() + '_' + Math.random().toString(36).slice(2, 10) + '.' + ext;
    return sb.storage.from('posters-media').upload(fname, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type || 'image/png'
    }).then(function (res) {
      if (res.error) {
        console.error('[Bildiri] Storage upload error:', res.error);
        throw new Error(res.error.message || 'Görsel yüklenemedi.');
      }
      return sb.storage.from('posters-media').getPublicUrl(fname).data.publicUrl;
    });
  }

  // ---------- HTML → Plain text ----------
  function getPlainText(html) {
    var div = document.createElement('div');
    div.innerHTML = html || '';
    div.querySelectorAll('br').forEach(function (b) { b.replaceWith(' '); });
    div.querySelectorAll('p, div, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, figcaption').forEach(function (el) {
      el.append(' ');
    });
    return (div.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function countWords(html) {
    var t = getPlainText(html);
    return t ? t.split(/\s+/).filter(Boolean).length : 0;
  }

  // ---------- Quill yüklenmesini bekle (sayfa yenileme race condition korunuru) ----------
  function waitForQuill(timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (global.Quill) return resolve();
      var start = Date.now();
      var check = function () {
        if (global.Quill) return resolve();
        if (Date.now() - start >= timeoutMs) return reject(new Error('Quill ' + timeoutMs + 'ms içinde yüklenmedi'));
        setTimeout(check, 100);
      };
      check();
    });
  }

  // ---------- Editor başlatma ----------
  function init(elementOrId, options) {
    options = options || {};
    return waitForQuill(8000).then(function () {
      return doInit(elementOrId, options);
    });
  }

  function doInit(elementOrId, options) {
    var element = typeof elementOrId === 'string'
      ? document.getElementById(elementOrId)
      : elementOrId;
    if (!element) return Promise.reject(new Error('Element bulunamadı: ' + elementOrId));

    // Element bir <textarea> ise div'e dönüştür (Quill div bekler)
    if (element.tagName === 'TEXTAREA') {
      var div = document.createElement('div');
      div.id = element.id;
      element.parentNode.replaceChild(div, element);
      element = div;
    }

    // Toolbar — TABLO butonu KALDIRILDI
    // (Tablolar görsel olarak yüklenir; Word'den paste edilen tablolar Quill'in clipboard'ı tarafından
    //  sınırlı düzeyde işlenir, kullanıcı dikkatini çekecek uyarı UI'da gösteriliyor.)
    var toolbarOptions = [
      [{ header: [false, 2, 3] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ indent: '-1' }, { indent: '+1' }],
      ['blockquote'],
      ['link', 'image'],
      ['clean']
    ];

    try {
      var quill = new global.Quill(element, {
        theme: 'snow',
        modules: {
          toolbar: {
            container: toolbarOptions,
            handlers: {
              image: function () {
                var input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = function () {
                  var file = input.files && input.files[0];
                  if (!file) return;
                  var range = quill.getSelection(true) || { index: quill.getLength() };
                  quill.insertText(range.index, '⏳ Görsel yükleniyor...', 'italic', true);
                  uploadFileToSupabase(file)
                    .then(function (url) {
                      quill.deleteText(range.index, '⏳ Görsel yükleniyor...'.length);
                      quill.insertEmbed(range.index, 'image', url, 'user');
                      quill.setSelection(range.index + 1, 0, 'user');
                    })
                    .catch(function (err) {
                      quill.deleteText(range.index, '⏳ Görsel yükleniyor...'.length);
                      alert('Görsel yüklenemedi: ' + (err.message || err));
                    });
                };
                input.click();
              }
            }
          }
        },
        placeholder: options.placeholder ||
          'Bildirinizi buraya yazın. Word/Google Docs\'tan formatlı metni doğrudan yapıştırabilirsiniz.\n\n⚠️ TABLOLAR İÇİN: Lütfen tablonuzun ekran görüntüsünü alıp toolbar\'daki resim (📷) butonu ile yükleyin.'
      });

      // Tablo paste'i engelle: kullanıcıya uyarı göster, tabloyu kaldır
      try {
        quill.clipboard.addMatcher('TABLE', function (node, delta) {
          setTimeout(function () {
            alert('⚠️ TABLO ALGILANDI\n\nQuill editörü tablo desteklemez. Lütfen tablonuzun ekran görüntüsünü alıp toolbar\'daki "📷 Görsel" butonu ile yükleyin.\n\nBu, kitabınızın profesyonel görünümünü garanti eder.');
          }, 100);
          // Boş delta döndür → tablo silinir
          var Delta = global.Quill.import('delta');
          return new Delta();
        });
      } catch (e) { console.warn('[Bildiri] Clipboard matcher kurulumu başarısız:', e); }

      // Word count callback
      if (typeof options.onWordCount === 'function') {
        var emit = function () {
          try {
            var html = quill.root.innerHTML;
            options.onWordCount(countWords(html), getPlainText(html).length, html);
          } catch (e) { /* */ }
        };
        quill.on('text-change', emit);
        setTimeout(emit, 50);
      }

      if (options.initialData) {
        quill.clipboard.dangerouslyPasteHTML(options.initialData);
      }

      // Public interface (CKEditor/TinyMCE uyumlu)
      var iface = {
        getData: function () {
          var html = quill.root.innerHTML;
          // Quill boş içerikte "<p><br></p>" döner — temizle
          if (html === '<p><br></p>' || html === '<p></p>') return '';
          return html;
        },
        setData: function (html) {
          if (!html || html === '<p><br></p>') {
            quill.setText('');
          } else {
            quill.clipboard.dangerouslyPasteHTML(html);
          }
        },
        destroy: function () {
          // Quill destroy yok — DOM'u temizle
          try {
            element.innerHTML = '';
            var prev = element.previousElementSibling;
            if (prev && prev.classList && prev.classList.contains('ql-toolbar')) {
              prev.parentNode.removeChild(prev);
            }
          } catch (e) {}
          return Promise.resolve();
        },
        getPlainText: function () { return getPlainText(quill.root.innerHTML); },
        _editor: quill
      };

      return Promise.resolve(iface);
    } catch (err) {
      console.error('[Bildiri] Quill init error:', err);
      return Promise.reject(err);
    }
  }

  global.BildiriEditor = {
    init: init,
    getPlainText: getPlainText,
    countWords: countWords,
    uploadFileToSupabase: uploadFileToSupabase
  };
})(window);
