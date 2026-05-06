/* ============================================================
   Bildiri Sistemi — CKEditor 5 sarıcı
   ------------------------------------------------------------
   Görsel: Supabase Storage 'posters-media' bucket'ına yüklenir.
   Word/Google Docs kopyala-yapıştır: PasteFromOffice ile korunur.
   Kelime sayacı: HTML etiketleri çıkarılarak yapılır.
   ============================================================ */
(function (global) {
  'use strict';

  function uploadFileToSupabase(file) {
    var sb = global.BildiriBackend && global.BildiriBackend.client;
    if (!sb) {
      // Storage yoksa (LocalStorage modu) — base64 data URL döndür (fallback)
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
      var pub = sb.storage.from('posters-media').getPublicUrl(fname);
      return pub.data.publicUrl;
    });
  }

  // CKEditor 5 Upload Adapter
  function SupabaseUploadAdapter(loader) {
    this.loader = loader;
  }
  SupabaseUploadAdapter.prototype.upload = function () {
    return this.loader.file.then(function (file) {
      return uploadFileToSupabase(file).then(function (url) {
        return { default: url };
      });
    });
  };
  SupabaseUploadAdapter.prototype.abort = function () {};

  function SupabaseUploadAdapterPlugin(editor) {
    editor.plugins.get('FileRepository').createUploadAdapter = function (loader) {
      return new SupabaseUploadAdapter(loader);
    };
  }

  // ---- HTML → Plain text (kelime sayacı için) ----
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
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }

  // ---- Editor init ----
  function init(elementOrId, options) {
    options = options || {};
    if (!global.ClassicEditor) {
      console.error('[Bildiri] CKEditor 5 yüklenemedi (ClassicEditor undefined).');
      return Promise.reject(new Error('CKEditor 5 yüklenmedi'));
    }
    var element = typeof elementOrId === 'string'
      ? document.getElementById(elementOrId)
      : elementOrId;
    if (!element) return Promise.reject(new Error('Editör elementi bulunamadı'));

    var config = {
      extraPlugins: [SupabaseUploadAdapterPlugin],
      toolbar: {
        items: [
          'heading', '|',
          'bold', 'italic', 'underline', 'strikethrough', '|',
          'bulletedList', 'numberedList', '|',
          'outdent', 'indent', '|',
          'link', 'imageUpload', 'insertTable', 'blockQuote', '|',
          'undo', 'redo'
        ],
        shouldNotGroupWhenFull: false
      },
      heading: {
        options: [
          { model: 'paragraph', title: 'Paragraf', class: 'ck-heading_paragraph' },
          { model: 'heading2', view: 'h2', title: 'Alt Başlık', class: 'ck-heading_heading2' },
          { model: 'heading3', view: 'h3', title: 'Küçük Başlık', class: 'ck-heading_heading3' }
        ]
      },
      table: {
        contentToolbar: [
          'tableColumn', 'tableRow', 'mergeTableCells',
          'tableCellProperties', 'tableProperties'
        ]
      },
      image: {
        toolbar: [
          'imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|',
          'toggleImageCaption', 'imageTextAlternative'
        ],
        styles: {
          options: ['inline', 'block', 'side']
        }
      },
      link: {
        addTargetToExternalLinks: true,
        defaultProtocol: 'https://'
      },
      placeholder: options.placeholder ||
        'Bildirinizi buraya yazın. Word/Google Docs\'tan tablo, resim ve formatlı metni doğrudan yapıştırabilirsiniz.',
      language: 'tr'
    };

    return global.ClassicEditor.create(element, config).then(function (editor) {
      // Word count
      if (typeof options.onWordCount === 'function') {
        var emit = function () {
          try {
            var html = editor.getData();
            options.onWordCount(countWords(html), getPlainText(html).length, html);
          } catch (e) { /* */ }
        };
        editor.model.document.on('change:data', emit);
        setTimeout(emit, 80);
      }
      // İlk değer
      if (options.initialData) {
        editor.setData(options.initialData);
      }
      return editor;
    }).catch(function (err) {
      console.error('[Bildiri] Editör başlatılamadı:', err);
      throw err;
    });
  }

  global.BildiriEditor = {
    init: init,
    getPlainText: getPlainText,
    countWords: countWords,
    uploadFileToSupabase: uploadFileToSupabase
  };
})(window);
