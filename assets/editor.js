/* ============================================================
   Bildiri Sistemi — Rich Text Editör (TinyMCE 7)
   ------------------------------------------------------------
   - Görsel: Supabase Storage 'posters-media' bucket'ına yüklenir
   - Word/Google Docs paste: TinyMCE'in PowerPaste benzeri yeteneği ile
   - Kelime sayacı: HTML strip sonrası plain text üzerinden
   ============================================================ */
(function (global) {
  'use strict';

  // ---------- Supabase Storage yükleyici ----------
  function uploadFileToSupabase(file) {
    var sb = global.BildiriBackend && global.BildiriBackend.client;
    if (!sb) {
      // Storage yoksa (LocalStorage modu) — fallback: data URL
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

  // ---------- Editor başlatma ----------
  function init(elementOrId, options) {
    options = options || {};
    if (!global.tinymce) {
      console.error('[Bildiri] TinyMCE yüklenmedi.');
      return Promise.reject(new Error('TinyMCE yüklenmedi'));
    }
    var element = typeof elementOrId === 'string'
      ? document.getElementById(elementOrId)
      : elementOrId;
    if (!element) return Promise.reject(new Error('Element bulunamadı: ' + elementOrId));

    return new Promise(function (resolve, reject) {
      var settled = false;
      try {
        global.tinymce.init({
          target: element,
          // jsDelivr'dan self-hosted TinyMCE 6 — community edition, read-only kısıtlaması yok
          base_url: 'https://cdn.jsdelivr.net/npm/tinymce@6.8.5',
          suffix: '.min',
          readonly: false,
          height: 480,
          menubar: false,
          branding: false,
          promotion: false,
          statusbar: true,
          elementpath: false,
          resize: true,
          plugins: 'advlist autolink lists link image charmap searchreplace visualblocks code fullscreen insertdatetime media table help wordcount',
          toolbar: 'undo redo | blocks | bold italic underline | bullist numlist | indent outdent | link image table | removeformat | code',
          toolbar_mode: 'sliding',
          paste_data_images: true,
          automatic_uploads: true,
          smart_paste: true,
          paste_block_drop: false,
          // Word/Google Docs uyumluluğu
          paste_merge_formats: true,
          paste_remove_styles_if_webkit: false,
          paste_webkit_styles: 'all',
          // Görsel yükleme: Supabase Storage'a
          images_upload_handler: function (blobInfo, progress) {
            return new Promise(function (res, rej) {
              uploadFileToSupabase(blobInfo.blob())
                .then(res)
                .catch(function (e) { rej(e.message || String(e)); });
            });
          },
          file_picker_types: 'image',
          // İçerik CSS — editör içinde prose benzeri görünüm
          content_style: [
            'body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;font-size:15px;line-height:1.65;color:#0a0a0a;padding:8px 14px;}',
            'p{margin:0.6em 0}',
            'table{border-collapse:collapse;width:100%;margin:1em 0}',
            'table td,table th{border:1px solid #e4e4e7;padding:8px 10px;vertical-align:top}',
            'table th{background:#f4f4f5;font-weight:600}',
            'img{max-width:100%;height:auto;border-radius:6px}',
            'blockquote{border-left:3px solid #84cc16;padding:0.4em 1em;color:#525252;font-style:italic;margin:1em 0}'
          ].join(''),
          placeholder: options.placeholder || 'Bildirinizi buraya yazın. Word/Google Docs\'tan tablo, resim ve formatlı metni doğrudan yapıştırabilirsiniz.',
          setup: function (editor) {
            editor.on('init', function () {
              // Read-only mode'u kesin kapat
              editor.mode.set('design');
              if (options.initialData) {
                editor.setContent(options.initialData);
              }
              if (typeof options.onWordCount === 'function') {
                var emit = function () {
                  try {
                    var html = editor.getContent();
                    options.onWordCount(countWords(html), getPlainText(html).length, html);
                  } catch (e) { /* */ }
                };
                editor.on('input keyup change SetContent NodeChange', emit);
                setTimeout(emit, 80);
              }
              if (!settled) {
                settled = true;
                resolve(makeEditorInterface(editor));
              }
            });
            editor.on('LoadError', function (err) {
              console.error('[Bildiri] TinyMCE LoadError:', err);
              if (!settled) { settled = true; reject(err); }
            });
          }
        }).catch(function (err) {
          console.error('[Bildiri] TinyMCE init error:', err);
          if (!settled) { settled = true; reject(err); }
        });
      } catch (err) {
        console.error('[Bildiri] TinyMCE try-catch:', err);
        if (!settled) { settled = true; reject(err); }
      }
    });
  }

  // CKEditor uyumlu API arabirimi (kod paylaşımı için)
  function makeEditorInterface(editor) {
    return {
      // İçerik al/set
      getData: function () { return editor.getContent(); },
      setData: function (html) { editor.setContent(html || ''); },
      // Kapatma
      destroy: function () {
        try { editor.remove(); } catch (e) { /* */ }
        return Promise.resolve();
      },
      // Plain text
      getPlainText: function () { return getPlainText(editor.getContent()); },
      // Düşük seviye erişim
      _editor: editor
    };
  }

  global.BildiriEditor = {
    init: init,
    getPlainText: getPlainText,
    countWords: countWords,
    uploadFileToSupabase: uploadFileToSupabase
  };
})(window);
