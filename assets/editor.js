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

  // ---------- Tablo HTML üreticisi ----------
  function buildTableHtml(rows, cols) {
    var html = '<table><tbody>';
    for (var r = 0; r < rows; r++) {
      html += '<tr>';
      for (var c = 0; c < cols; c++) {
        if (r === 0) {
          html += '<th>Başlık ' + (c + 1) + '</th>';
        } else {
          html += '<td>&nbsp;</td>';
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    return html;
  }

  // ---------- Editor başlatma ----------
  function init(elementOrId, options) {
    options = options || {};
    if (!global.Quill) {
      console.error('[Bildiri] Quill yüklenemedi.');
      return Promise.reject(new Error('Quill yüklenmedi'));
    }
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

    // Quill toolbar konfigürasyonu
    var toolbarOptions = [
      [{ header: [false, 2, 3] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ indent: '-1' }, { indent: '+1' }],
      ['blockquote'],
      ['link', 'image', 'table-custom'],
      ['clean']
    ];

    try {
      var quill = new global.Quill(element, {
        theme: 'snow',
        modules: {
          toolbar: {
            container: toolbarOptions,
            handlers: {
              // Görsel: Supabase'e upload
              image: function () {
                var input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = function () {
                  var file = input.files && input.files[0];
                  if (!file) return;
                  var range = quill.getSelection(true) || { index: quill.getLength() };
                  // Yükleniyor placeholder
                  quill.insertText(range.index, '⏳ Görsel yükleniyor...', 'italic', true);
                  uploadFileToSupabase(file)
                    .then(function (url) {
                      // Placeholder text'i sil
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
              },
              // Tablo: prompt ile satır/sütun
              'table-custom': function () {
                var rowsStr = prompt('Satır sayısı (başlık dahil):', '3');
                if (!rowsStr) return;
                var rows = parseInt(rowsStr, 10);
                if (!rows || rows < 1 || rows > 30) { alert('Geçerli bir satır sayısı girin (1-30).'); return; }
                var colsStr = prompt('Sütun sayısı:', '3');
                if (!colsStr) return;
                var cols = parseInt(colsStr, 10);
                if (!cols || cols < 1 || cols > 10) { alert('Geçerli bir sütun sayısı girin (1-10).'); return; }
                var range = quill.getSelection(true) || { index: quill.getLength() };
                quill.clipboard.dangerouslyPasteHTML(range.index, buildTableHtml(rows, cols));
              }
            }
          }
        },
        placeholder: options.placeholder ||
          'Bildirinizi buraya yazın. Word/Google Docs\'tan formatlı metni doğrudan yapıştırabilirsiniz.'
      });

      // Tablo butonu için tooltip + ikon
      var toolbarEl = quill.getModule('toolbar').container;
      var tableBtn = toolbarEl.querySelector('.ql-table-custom');
      if (tableBtn) {
        tableBtn.innerHTML = '<svg viewBox="0 0 18 18"><rect x="3" y="3" width="12" height="12" stroke="currentColor" fill="none" stroke-width="1.5"/><line x1="3" y1="7.5" x2="15" y2="7.5" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="11.5" x2="15" y2="11.5" stroke="currentColor" stroke-width="1.5"/><line x1="7.5" y1="3" x2="7.5" y2="15" stroke="currentColor" stroke-width="1.5"/><line x1="11.5" y1="3" x2="11.5" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>';
        tableBtn.setAttribute('title', 'Tablo ekle');
      }

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
