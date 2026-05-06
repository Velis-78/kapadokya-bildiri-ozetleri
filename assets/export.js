/* ============================================================
   Bildiri Yönetim Sistemi — Export Modülü
   Kullanılan kütüphaneler: docx (CDN), SheetJS xlsx (CDN), FileSaver (CDN)
   ============================================================ */
(function (global) {
  'use strict';

  // ---- Tek bildiri DOCX ----
  function exportSubmissionDocx(sub) {
    // docx kütüphanesi window.docx, window.Docx veya başka bir adla yüklenmiş olabilir
    const d = global.docx || global.Docx || (typeof window !== 'undefined' && window.docx);
    if (!d || !d.Document || !d.Packer) {
      console.error('DOCX kütüphanesi yüklenemedi. window.docx:', typeof global.docx);
      alert('DOCX kütüphanesi yüklenemedi. Sayfayı yenileyip tekrar deneyin. Hâlâ çalışmazsa internet/CDN engellemesi olabilir.');
      return;
    }
    if (typeof saveAs !== 'function') {
      alert('FileSaver kütüphanesi yüklenemedi. Sayfayı yenileyin.');
      return;
    }
    const settings = global.Bildiri.getSettings();
    // FAZ 1: HTML içeriği plain text'e çevir (formatlar/tablolar/görseller kaybolur)
    // FAZ 2: gerçek HTML→DOCX dönüşümü yapılacak
    var abstractText = sub.abstract || '';
    if (global.BildiriEditor && global.BildiriEditor.getPlainText) {
      abstractText = global.BildiriEditor.getPlainText(abstractText);
    }
    sub = Object.assign({}, sub, { abstract: abstractText });

    const titleParagraph = new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new d.TextRun({
          text: sub.title || '',
          bold: true,
          size: 32,
          font: 'Calibri'
        })
      ]
    });

    const authorsLine = (sub.authors || [])
      .map(function (a, i) {
        const sup = a.affiliationIndex ? a.affiliationIndex.toString() : '';
        return a.fullName + (sup ? ' (' + sup + ')' : '') + (a.presenter ? ' *' : '');
      })
      .join(', ');

    const authorsParagraph = new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new d.TextRun({ text: authorsLine, size: 22, font: 'Calibri' })]
    });

    const affLines = (sub.affiliations || []).map(function (af, i) {
      return new d.Paragraph({
        alignment: d.AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new d.TextRun({
            text: (i + 1) + ' ' + af,
            size: 20,
            italics: true,
            font: 'Calibri'
          })
        ]
      });
    });

    const presenterNote = new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new d.TextRun({
          text: '* Sunan yazar',
          size: 18,
          italics: true,
          color: '6B7280',
          font: 'Calibri'
        })
      ]
    });

    const abstractHeading = new d.Paragraph({
      spacing: { before: 200, after: 120 },
      children: [
        new d.TextRun({
          text: 'ÖZET',
          bold: true,
          size: 24,
          font: 'Calibri'
        })
      ]
    });

    const abstractBody = new d.Paragraph({
      alignment: d.AlignmentType.JUSTIFIED,
      spacing: { after: 200, line: 360 },
      children: [
        new d.TextRun({
          text: sub.abstract || '',
          size: 22,
          font: 'Calibri'
        })
      ]
    });

    const keywordsParagraph = new d.Paragraph({
      spacing: { after: 200 },
      children: [
        new d.TextRun({
          text: 'Anahtar Kelimeler: ',
          bold: true,
          size: 22,
          font: 'Calibri'
        }),
        new d.TextRun({
          text: (sub.keywords || []).join(', '),
          size: 22,
          font: 'Calibri'
        })
      ]
    });

    const footer = new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      spacing: { before: 600 },
      children: [
        new d.TextRun({
          text: settings.eventTitle,
          size: 18,
          color: '6B7280',
          italics: true,
          font: 'Calibri'
        })
      ]
    });

    const idRow = new d.Paragraph({
      alignment: d.AlignmentType.RIGHT,
      spacing: { before: 120 },
      children: [
        new d.TextRun({
          text: 'Bildiri No: ' + sub.id,
          size: 18,
          color: '9CA3AF',
          font: 'Calibri'
        })
      ]
    });

    const doc = new d.Document({
      creator: settings.organizer,
      title: sub.title,
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }
            }
          },
          children: [titleParagraph, authorsParagraph]
            .concat(affLines)
            .concat([presenterNote, abstractHeading, abstractBody, keywordsParagraph, idRow, footer])
        }
      ]
    });

    d.Packer.toBlob(doc).then(function (blob) {
      const fname = sanitize(sub.id + '_' + (sub.title || 'bildiri')) + '.docx';
      saveAs(blob, fname);
    });
  }

  // ---- Toplu Excel ----
  function exportAllXlsx(subs, filename) {
    if (!global.XLSX || !global.XLSX.utils) {
      alert('Excel kütüphanesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.');
      return;
    }
    const rows = (subs || []).map(function (s, i) {
      const authorNames = (s.authors || [])
        .map(function (a) {
          return a.fullName + (a.presenter ? ' *' : '');
        })
        .join('; ');
      const affs = (s.affiliations || []).join('; ');
      // Excel için HTML strip (tablolar/görseller plain text)
      var plainAbstract = s.abstract || '';
      if (global.BildiriEditor && global.BildiriEditor.getPlainText) {
        plainAbstract = global.BildiriEditor.getPlainText(plainAbstract);
      }
      return {
        '#': i + 1,
        'Bildiri No': s.id,
        'Durum': global.Bildiri.statusLabel(s.status),
        'Başlık': s.title || '',
        'Yazarlar': authorNames,
        'Kurumlar': affs,
        'İletişim Adı': s.contactName || '',
        'İletişim E-posta': s.contactEmail || '',
        'İletişim Telefon': s.contactPhone || '',
        'Anahtar Kelimeler': (s.keywords || []).join(', '),
        'Kelime Sayısı': global.BildiriEditor ? global.BildiriEditor.countWords(s.abstract || '') : global.Bildiri.countWords(s.abstract || ''),
        'Özet': plainAbstract,
        'Notlar': s.statusNote || '',
        'Gönderim': global.Bildiri.formatDate(s.createdAt),
        'Son Güncelleme': global.Bildiri.formatDate(s.updatedAt)
      };
    });

    const ws = global.XLSX.utils.json_to_sheet(rows);
    // Sütun genişlikleri
    ws['!cols'] = [
      { wch: 4 }, { wch: 12 }, { wch: 12 }, { wch: 60 },
      { wch: 40 }, { wch: 50 }, { wch: 22 }, { wch: 28 }, { wch: 16 },
      { wch: 30 }, { wch: 12 }, { wch: 80 }, { wch: 30 },
      { wch: 18 }, { wch: 18 }
    ];
    const wb = global.XLSX.utils.book_new();
    global.XLSX.utils.book_append_sheet(wb, ws, 'Bildiriler');
    global.XLSX.writeFile(wb, filename || 'bildiriler.xlsx');
  }

  // ---- Bildiri Kitabı (toplu DOCX) ----
  function exportBookDocx(subs, options) {
    options = options || {};
    const d = global.docx || global.Docx || (typeof window !== 'undefined' && window.docx);
    if (!d || !d.Document || !d.Packer) {
      alert('DOCX kütüphanesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.');
      return;
    }
    if (typeof saveAs !== 'function') {
      alert('FileSaver kütüphanesi yüklenemedi. Sayfayı yenileyin.');
      return;
    }
    if (!subs || !subs.length) {
      alert('Kitaba eklenecek bildiri bulunamadı.');
      return;
    }
    const settings = global.Bildiri.getSettings();
    const eventTitle = settings.eventTitle || 'Bildiri Kitabı';
    const organizer = settings.organizer || '';

    // FAZ 1: HTML içerikleri plain text'e çevir (Faz 2'de tam HTML→DOCX yapılacak)
    subs = subs.map(function (s) {
      if (global.BildiriEditor && global.BildiriEditor.getPlainText) {
        return Object.assign({}, s, { abstract: global.BildiriEditor.getPlainText(s.abstract || '') });
      }
      return s;
    });

    const children = [];

    // === KAPAK PLACEHOLDER ===
    children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before: 4000 },
      children: [new d.TextRun({ text: '[ KAPAK SAYFASI ]', bold: true, size: 28, color: 'AAAAAA' })] }));
    children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before: 200 },
      children: [new d.TextRun({ text: 'Kongre kapağınızı (PDF) bu sayfa yerine yerleştirin.', italics: true, size: 20, color: 'AAAAAA' })] }));
    children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before: 1200 },
      children: [new d.TextRun({ text: eventTitle, bold: true, size: 32 })] }));
    children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before: 200 },
      children: [new d.TextRun({ text: 'POSTER BİLDİRİ ÖZETLERİ', size: 24, color: '7A9F2A' })] }));
    if (organizer) {
      children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before: 800 },
        children: [new d.TextRun({ text: organizer, italics: true, size: 22, color: '525252' })] }));
    }
    children.push(new d.Paragraph({ children: [new d.PageBreak()] }));

    // === İÇİNDEKİLER ===
    children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { after: 400 },
      children: [new d.TextRun({ text: 'İÇİNDEKİLER', bold: true, size: 32 })] }));
    subs.forEach(function (s, i) {
      const presenter = (s.authors || []).find(function (a) { return a.presenter; }) || (s.authors || [])[0] || {};
      children.push(new d.Paragraph({ spacing: { after: 220 }, children: [
        new d.TextRun({ text: (i + 1) + '. ', bold: true, size: 22 }),
        new d.TextRun({ text: s.title || '(başlıksız)', size: 22 })
      ]}));
      children.push(new d.Paragraph({ spacing: { after: 80 }, indent: { left: 360 }, children: [
        new d.TextRun({ text: (presenter.fullName || '-') + ' ve ark. · ' + s.id, size: 18, color: '6B7280', italics: true })
      ]}));
    });
    children.push(new d.Paragraph({ children: [new d.PageBreak()] }));

    // === BİLDİRİ SAYFALARI ===
    subs.forEach(function (s, i) {
      // Bildiri no
      children.push(new d.Paragraph({ alignment: d.AlignmentType.RIGHT, spacing: { after: 200 },
        children: [new d.TextRun({ text: s.id, size: 18, color: '7A9F2A', bold: true })] }));

      // Başlık
      children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { after: 240 },
        children: [new d.TextRun({ text: s.title || '(başlıksız)', bold: true, size: 28 })] }));

      // Yazarlar
      const authorRuns = [];
      (s.authors || []).forEach(function (a, idx) {
        if (idx > 0) authorRuns.push(new d.TextRun({ text: ', ', size: 22 }));
        authorRuns.push(new d.TextRun({ text: a.fullName || '', size: 22 }));
        if (a.affiliationIndex) authorRuns.push(new d.TextRun({ text: String(a.affiliationIndex), superScript: true, size: 22 }));
        if (a.presenter) authorRuns.push(new d.TextRun({ text: '*', superScript: true, size: 22, color: '7A9F2A' }));
      });
      children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { after: 200 }, children: authorRuns }));

      // Kurumlar
      (s.affiliations || []).forEach(function (aff, idx) {
        children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { after: 80 }, children: [
          new d.TextRun({ text: String(idx + 1) + ' ', superScript: true, size: 18 }),
          new d.TextRun({ text: aff, italics: true, size: 18, color: '525252' })
        ]}));
      });

      children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before: 200, after: 400 },
        children: [new d.TextRun({ text: '* Sunan yazar', size: 16, italics: true, color: '9CA3AF' })] }));

      // ÖZET başlığı
      children.push(new d.Paragraph({ spacing: { before: 200, after: 200 },
        border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, color: '7A9F2A', space: 4 } },
        children: [new d.TextRun({ text: 'ÖZET', bold: true, size: 24, color: '7A9F2A' })] }));

      // Özet metni
      children.push(new d.Paragraph({ alignment: d.AlignmentType.JUSTIFIED, spacing: { after: 200, line: 360 },
        children: [new d.TextRun({ text: s.abstract || '', size: 22 })] }));

      // Anahtar kelimeler
      children.push(new d.Paragraph({ spacing: { before: 240, after: 200 }, children: [
        new d.TextRun({ text: 'Anahtar Kelimeler: ', bold: true, size: 22 }),
        new d.TextRun({ text: (s.keywords || []).join(', '), size: 22, italics: true })
      ]}));

      if (i < subs.length - 1) {
        children.push(new d.Paragraph({ children: [new d.PageBreak()] }));
      }
    });

    // === ARKA KAPAK ===
    children.push(new d.Paragraph({ children: [new d.PageBreak()] }));
    children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before: 4000 },
      children: [new d.TextRun({ text: '[ ARKA KAPAK / ALT SAYFA ]', bold: true, size: 28, color: 'AAAAAA' })] }));
    children.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before: 200 },
      children: [new d.TextRun({ text: 'Kongre arka kapağınızı (PDF) bu sayfa yerine yerleştirin.', italics: true, size: 20, color: 'AAAAAA' })] }));

    // === DOCUMENT ===
    const doc = new d.Document({
      creator: organizer,
      title: eventTitle + ' — Bildiri Kitabı',
      styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1701, right: 1701, bottom: 1701, left: 1701 } // 3 cm
          }
        },
        headers: {
          default: new d.Header({ children: [new d.Paragraph({ alignment: d.AlignmentType.CENTER,
            children: [new d.TextRun({ text: eventTitle, size: 16, color: '9CA3AF', italics: true })] })] })
        },
        footers: {
          default: new d.Footer({ children: [new d.Paragraph({ alignment: d.AlignmentType.CENTER,
            children: [
              new d.TextRun({ text: 'Sayfa ', size: 16, color: '9CA3AF' }),
              new d.TextRun({ children: [d.PageNumber.CURRENT], size: 16, color: '9CA3AF' })
            ] })] })
        },
        children: children
      }]
    });

    d.Packer.toBlob(doc).then(function (blob) {
      const today = new Date().toISOString().slice(0, 10);
      const fname = 'bildiri-kitabi_' + today + '.docx';
      saveAs(blob, fname);
    }).catch(function (err) {
      console.error(err);
      alert('Bildiri kitabı oluşturulamadı: ' + (err.message || err));
    });
  }

  // ============================================================
  // PDF EXPORT (zengin format korunarak — tablolar, görseller, formatlar)
  // html2pdf.js + jsPDF + html2canvas bundle'ı kullanır
  // ============================================================

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // PDF için ortak inline CSS — html2canvas eski Tailwind class'larını
  // anlamadığı için her şey inline veya <style> bloğu olarak yazılır.
  function pdfBaseStyles() {
    return (
      '<style>' +
      '* { box-sizing: border-box; }' +
      'body, .pdf-root { font-family: Calibri, Arial, "Segoe UI", sans-serif; color: #0a0a0a; font-size: 11pt; line-height: 1.55; }' +
      '.pdf-page { padding: 1.4cm 1.6cm; }' +
      '.pdf-break { page-break-before: always; }' +
      '.pdf-title { text-align: center; font-size: 16pt; font-weight: 700; margin: 0 0 12px 0; line-height: 1.25; }' +
      '.pdf-id { text-align: right; color: #65a30d; font-weight: 700; font-size: 10pt; letter-spacing: 0.05em; margin-bottom: 6px; }' +
      '.pdf-authors { text-align: center; font-size: 11pt; margin: 0 0 8px 0; }' +
      '.pdf-aff { text-align: center; font-size: 9.5pt; font-style: italic; color: #525252; margin: 2px 0; }' +
      '.pdf-presnote { text-align: center; font-size: 9pt; color: #9ca3af; font-style: italic; margin: 8px 0 16px 0; }' +
      '.pdf-section-title { font-size: 12pt; font-weight: 700; color: #65a30d; border-bottom: 2px solid #65a30d; padding-bottom: 4px; margin: 16px 0 10px 0; letter-spacing: 0.04em; }' +
      '.pdf-abstract { text-align: justify; }' +
      '.pdf-abstract p { margin: 0.5em 0; }' +
      '.pdf-abstract h2 { font-size: 13pt; font-weight: 700; margin: 12px 0 6px 0; }' +
      '.pdf-abstract h3 { font-size: 12pt; font-weight: 700; margin: 10px 0 4px 0; }' +
      '.pdf-abstract ul, .pdf-abstract ol { padding-left: 1.4em; margin: 0.4em 0; }' +
      '.pdf-abstract li { margin: 0.15em 0; }' +
      '.pdf-abstract strong { font-weight: 700; }' +
      '.pdf-abstract em { font-style: italic; }' +
      '.pdf-abstract u { text-decoration: underline; }' +
      '.pdf-abstract blockquote { border-left: 3px solid #84cc16; padding: 0.4em 1em; color: #525252; font-style: italic; margin: 0.8em 0; }' +
      '.pdf-abstract table { width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 10pt; page-break-inside: avoid; }' +
      '.pdf-abstract td, .pdf-abstract th { border: 1px solid #d4d4d8; padding: 6px 9px; vertical-align: top; text-align: left; }' +
      '.pdf-abstract th { background: #f4f4f5; font-weight: 700; }' +
      '.pdf-abstract img { max-width: 100%; height: auto; display: block; margin: 0.6em auto; page-break-inside: avoid; }' +
      '.pdf-abstract figure { margin: 0.8em 0; text-align: center; page-break-inside: avoid; }' +
      '.pdf-abstract figcaption { font-size: 9pt; color: #6b7280; font-style: italic; margin-top: 4px; }' +
      '.pdf-keywords { margin-top: 14px; font-size: 10.5pt; }' +
      '.pdf-keywords strong { font-weight: 700; }' +
      '.pdf-cover { text-align: center; padding-top: 35%; }' +
      '.pdf-cover h1 { font-size: 22pt; font-weight: 700; line-height: 1.25; margin: 0 0 16px 0; }' +
      '.pdf-cover .pdf-cover-sub { font-size: 14pt; color: #65a30d; margin: 0 0 24px 0; letter-spacing: 0.06em; }' +
      '.pdf-cover .pdf-cover-org { font-size: 12pt; font-style: italic; color: #525252; }' +
      '.pdf-toc-item { display: flex; gap: 10px; margin-bottom: 14px; align-items: baseline; }' +
      '.pdf-toc-num { font-weight: 700; min-width: 20px; }' +
      '.pdf-toc-title { flex: 1; }' +
      '.pdf-toc-meta { font-size: 9pt; color: #6b7280; font-style: italic; }' +
      '</style>'
    );
  }

  // CORS-uyumlu olmayan görselleri base64 data URL'ye çevir (html2canvas için)
  function preprocessImages(container) {
    var imgs = container.querySelectorAll('img');
    if (!imgs.length) return Promise.resolve();
    var promises = [];
    imgs.forEach(function (img) {
      img.setAttribute('crossorigin', 'anonymous');
      if (img.src.indexOf('data:') === 0) return;
      promises.push(
        fetch(img.src, { mode: 'cors' })
          .then(function (r) { return r.blob(); })
          .then(function (blob) {
            return new Promise(function (resolve) {
              var fr = new FileReader();
              fr.onload = function () {
                img.src = fr.result;
                // Yeni src yüklensin diye load event'ini bekle
                if (img.complete) { resolve(); }
                else { img.onload = function () { resolve(); }; img.onerror = function () { resolve(); }; }
              };
              fr.onerror = function () { resolve(); };
              fr.readAsDataURL(blob);
            });
          })
          .catch(function () { /* */ })
      );
    });
    return Promise.all(promises);
  }

  // Tüm DOM yerleşmesi ve fontların yüklenmesi için bekle
  function waitLayoutReady() {
    return new Promise(function (resolve) {
      // Animation frame + microtask + 250ms buffer
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () { setTimeout(resolve, 250); });
          } else {
            setTimeout(resolve, 250);
          }
        });
      });
    });
  }

  function buildSubmissionPdfHtml(sub) {
    var safeAbstract = global.BildiriSanitize
      ? global.BildiriSanitize.sanitize(sub.abstract || '')
      : escHtml(sub.abstract || '');
    var authorParts = (sub.authors || []).map(function (a) {
      return escHtml(a.fullName) +
        (a.affiliationIndex ? '<sup>' + escHtml(a.affiliationIndex) + '</sup>' : '') +
        (a.presenter ? '<sup style="color:#65a30d">*</sup>' : '');
    }).join(', ');
    var affs = (sub.affiliations || []).map(function (af, i) {
      return '<div class="pdf-aff"><sup>' + (i + 1) + '</sup> ' + escHtml(af) + '</div>';
    }).join('');
    return (
      '<div class="pdf-page">' +
        '<div class="pdf-id">' + escHtml(sub.id) + '</div>' +
        '<h1 class="pdf-title">' + escHtml(sub.title || '') + '</h1>' +
        '<div class="pdf-authors">' + authorParts + '</div>' +
        affs +
        '<div class="pdf-presnote">* Sunan yazar</div>' +
        '<div class="pdf-section-title">ÖZET</div>' +
        '<div class="pdf-abstract">' + safeAbstract + '</div>' +
        '<div class="pdf-keywords"><strong>Anahtar Kelimeler:</strong> <em>' +
          escHtml((sub.keywords || []).join(', ')) +
        '</em></div>' +
      '</div>'
    );
  }

  // Print için stil — @media print ile sayfa kurulumu
  function printStyles(eventTitle) {
    return (
      '<style>' +
      '@page { size: A4; margin: 1.5cm 1.6cm; }' +
      '* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
      'body { font-family: Calibri, Arial, "Segoe UI", sans-serif; color: #000; font-size: 11pt; line-height: 1.55; margin: 0; padding: 0; }' +
      '.pdf-page { padding: 0; }' +
      '.pdf-break { page-break-before: always; }' +
      '.pdf-title { text-align: center; font-size: 16pt; font-weight: 700; margin: 0 0 12px 0; line-height: 1.25; }' +
      '.pdf-id { text-align: right; color: #555; font-weight: 700; font-size: 10pt; letter-spacing: 0.05em; margin-bottom: 6px; }' +
      '.pdf-authors { text-align: center; font-size: 11pt; margin: 0 0 8px 0; }' +
      '.pdf-aff { text-align: center; font-size: 9.5pt; font-style: italic; color: #555; margin: 2px 0; }' +
      '.pdf-presnote { text-align: center; font-size: 9pt; color: #777; font-style: italic; margin: 8px 0 16px 0; }' +
      '.pdf-section-title { font-size: 12pt; font-weight: 700; color: #000; border-bottom: 2px solid #000; padding-bottom: 4px; margin: 16px 0 10px 0; letter-spacing: 0.04em; }' +
      '.pdf-abstract { text-align: justify; }' +
      '.pdf-abstract p { margin: 0.5em 0; }' +
      '.pdf-abstract h2 { font-size: 13pt; font-weight: 700; margin: 12px 0 6px 0; }' +
      '.pdf-abstract h3 { font-size: 12pt; font-weight: 700; margin: 10px 0 4px 0; }' +
      '.pdf-abstract ul, .pdf-abstract ol { padding-left: 1.4em; margin: 0.4em 0; }' +
      '.pdf-abstract li { margin: 0.15em 0; }' +
      '.pdf-abstract strong, .pdf-abstract b { font-weight: 700; }' +
      '.pdf-abstract em, .pdf-abstract i { font-style: italic; }' +
      '.pdf-abstract u { text-decoration: underline; }' +
      '.pdf-abstract blockquote { border-left: 3px solid #000; padding: 0.4em 1em; color: #444; font-style: italic; margin: 0.8em 0; }' +
      '.pdf-abstract table { width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 10pt; page-break-inside: avoid; }' +
      '.pdf-abstract td, .pdf-abstract th { border: 1px solid #000; padding: 6px 9px; vertical-align: top; text-align: left; }' +
      '.pdf-abstract th { background: #eee; font-weight: 700; }' +
      '.pdf-abstract img { max-width: 100%; height: auto; display: block; margin: 0.6em auto; page-break-inside: avoid; }' +
      '.pdf-abstract figure { margin: 0.8em 0; text-align: center; page-break-inside: avoid; }' +
      '.pdf-abstract figcaption { font-size: 9pt; color: #555; font-style: italic; margin-top: 4px; }' +
      '.pdf-keywords { margin-top: 14px; font-size: 10.5pt; }' +
      '.pdf-keywords strong { font-weight: 700; }' +
      '.pdf-cover { text-align: center; padding-top: 30%; }' +
      '.pdf-cover h1 { font-size: 22pt; font-weight: 700; line-height: 1.25; margin: 0 0 16px 0; }' +
      '.pdf-cover .pdf-cover-sub { font-size: 14pt; margin: 0 0 24px 0; letter-spacing: 0.06em; }' +
      '.pdf-cover .pdf-cover-org { font-size: 12pt; font-style: italic; color: #444; }' +
      '.pdf-toc-item { display: flex; gap: 10px; margin-bottom: 14px; align-items: baseline; }' +
      '.pdf-toc-num { font-weight: 700; min-width: 20px; }' +
      '.pdf-toc-title { flex: 1; }' +
      '.pdf-toc-meta { font-size: 9pt; color: #555; font-style: italic; }' +
      '.print-toolbar { position: sticky; top: 0; background: #fafafa; padding: 12px; border-bottom: 1px solid #ddd; text-align: center; z-index: 1000; }' +
      '.print-toolbar button { background: #000; color: #fff; border: none; padding: 10px 20px; font-size: 14px; border-radius: 6px; cursor: pointer; font-weight: 600; margin: 0 5px; }' +
      '.print-toolbar button.secondary { background: #f4f4f5; color: #000; border: 1px solid #ddd; }' +
      '@media print { .print-toolbar { display: none !important; } body { background: #fff; } }' +
      '</style>' +
      '<title>' + escHtml(eventTitle || 'Bildiri') + '</title>'
    );
  }

  function exportSubmissionPdf(sub) {
    var settings = global.Bildiri.getSettings();
    var eventTitle = settings.eventTitle || 'Bildiri';
    var win = window.open('', '_blank');
    if (!win) {
      alert('Pop-up engellendi! Tarayıcı ayarlarından bu site için pop-up\'a izin verin ve tekrar deneyin.');
      return;
    }
    var html =
      '<!doctype html><html lang="tr"><head><meta charset="utf-8">' +
      printStyles(eventTitle) +
      '</head><body>' +
      '<div class="print-toolbar">' +
        '<strong>📄 PDF Önizleme:</strong> "Yazdır / PDF Olarak Kaydet" düğmesine basıp hedefte <em>"PDF olarak kaydet"</em> seçin.' +
        '<div style="margin-top:10px">' +
          '<button onclick="window.print()">🖨️ Yazdır / PDF Olarak Kaydet</button>' +
          '<button class="secondary" onclick="window.close()">Kapat</button>' +
        '</div>' +
      '</div>' +
      '<div style="max-width: 17.7cm; margin: 0 auto; padding: 1.5cm 0;">' +
        buildSubmissionPdfHtml(sub) +
      '</div>' +
      '<script>window.addEventListener("load", function(){ setTimeout(function(){ window.focus(); window.print(); }, 800); });<\/script>' +
      '</body></html>';
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function exportBookPdf(subs) {
    if (!subs || !subs.length) {
      alert('Kitaba eklenecek bildiri yok.');
      return;
    }
    var settings = global.Bildiri.getSettings();
    var eventTitle = settings.eventTitle || 'Bildiri Kitabı';
    var organizer = settings.organizer || '';

    var tocItems = subs.map(function (s, i) {
      var presenter = (s.authors || []).find(function (a) { return a.presenter; }) || (s.authors || [])[0] || {};
      return '<div class="pdf-toc-item">' +
        '<span class="pdf-toc-num">' + (i + 1) + '.</span>' +
        '<div class="pdf-toc-title"><div>' + escHtml(s.title || '(başlıksız)') + '</div>' +
          '<div class="pdf-toc-meta">' + escHtml(presenter.fullName || '-') + ' ve ark. · ' + escHtml(s.id) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var win = window.open('', '_blank');
    if (!win) {
      alert('Pop-up engellendi! Tarayıcı ayarlarından bu site için pop-up\'a izin verin.');
      return;
    }

    var bodyHtml =
      // Kapak
      '<div class="pdf-cover">' +
        '<h1>' + escHtml(eventTitle) + '</h1>' +
        '<div class="pdf-cover-sub">POSTER BİLDİRİ ÖZETLERİ</div>' +
        (organizer ? '<div class="pdf-cover-org">' + escHtml(organizer) + '</div>' : '') +
      '</div>' +
      '<div class="pdf-break">' +
        '<h1 class="pdf-title">İÇİNDEKİLER</h1>' +
        '<div style="margin-top:18px">' + tocItems + '</div>' +
      '</div>' +
      subs.map(function (s) {
        return '<div class="pdf-break">' + buildSubmissionPdfHtml(s) + '</div>';
      }).join('');

    var html =
      '<!doctype html><html lang="tr"><head><meta charset="utf-8">' +
      printStyles(eventTitle + ' — Bildiri Kitabı') +
      '</head><body>' +
      '<div class="print-toolbar">' +
        '<strong>📕 Bildiri Kitabı Önizlemesi (' + subs.length + ' bildiri):</strong> "Yazdır / PDF Olarak Kaydet" düğmesine basıp hedefte <em>"PDF olarak kaydet"</em> seçin.' +
        '<div style="margin-top:10px">' +
          '<button onclick="window.print()">🖨️ Yazdır / PDF Olarak Kaydet</button>' +
          '<button class="secondary" onclick="window.close()">Kapat</button>' +
        '</div>' +
      '</div>' +
      '<div style="max-width: 17.7cm; margin: 0 auto; padding: 1.5cm 0;">' +
        bodyHtml +
      '</div>' +
      '<script>window.addEventListener("load", function(){ setTimeout(function(){ window.focus(); window.print(); }, 1500); });<\/script>' +
      '</body></html>';
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  // ---- Yardımcı: dosya adı temizleyici ----
  function sanitize(str) {
    return String(str)
      .replace(/[\\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80);
  }

  global.BildiriExport = {
    exportSubmissionDocx: exportSubmissionDocx,
    exportAllXlsx: exportAllXlsx,
    exportBookDocx: exportBookDocx,
    exportSubmissionPdf: exportSubmissionPdf,
    exportBookPdf: exportBookPdf
  };
})(window);
