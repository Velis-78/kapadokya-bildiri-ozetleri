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
        'Kelime Sayısı': global.Bildiri.countWords(s.abstract || ''),
        'Özet': s.abstract || '',
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
    exportBookDocx: exportBookDocx
  };
})(window);
