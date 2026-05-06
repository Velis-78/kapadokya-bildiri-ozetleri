/* ============================================================
   Bildiri Sistemi — HTML Sanitize (XSS koruması)
   DOMPurify CDN üzerinden yüklenmiş olmalıdır.
   ============================================================ */
(function (global) {
  'use strict';

  var ALLOWED_TAGS = [
    'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark',
    'h2', 'h3', 'h4',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
    'img', 'figure', 'figcaption',
    'a', 'span', 'div'
  ];
  var ALLOWED_ATTR = [
    'href', 'target', 'rel',
    'src', 'alt', 'title', 'width', 'height',
    'colspan', 'rowspan',
    'style', 'class'
  ];

  function sanitize(html) {
    if (!html) return '';
    if (global.DOMPurify && typeof global.DOMPurify.sanitize === 'function') {
      return global.DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ALLOWED_TAGS,
        ALLOWED_ATTR: ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link', 'base'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
      });
    }
    // DOMPurify yoksa: temel strip (geri dönüş)
    var div = document.createElement('div');
    div.textContent = (html || '').replace(/<[^>]*>/g, '');
    return div.innerHTML;
  }

  // Düz metin (önizleme/özet için)
  function toPlainText(html) {
    var div = document.createElement('div');
    div.innerHTML = sanitize(html);
    div.querySelectorAll('br').forEach(function (b) { b.replaceWith(' '); });
    div.querySelectorAll('p, div, li, td, th, h2, h3, h4, blockquote').forEach(function (el) { el.append(' '); });
    return (div.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function countWords(html) {
    var t = toPlainText(html);
    return t ? t.split(/\s+/).filter(Boolean).length : 0;
  }

  global.BildiriSanitize = {
    sanitize: sanitize,
    toPlainText: toPlainText,
    countWords: countWords
  };
})(window);
