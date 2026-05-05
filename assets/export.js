/* ============================================================
   Bildiri Yönetim Sistemi — Export Modülü
   Kullanılan kütüphaneler: docx (CDN), SheetJS xlsx (CDN), FileSaver (CDN)
   ============================================================ */
(function (global) {
  'use strict';

  // ---- Tek bildiri DOCX ----
  function exportSubmissionDocx(sub) {
    if (!global.docx) {
      alert('DOCX kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.');
      return;
    }
    const settings = global.Bildiri.getSettings();
    const d = global.docx;

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
    if (!global.XLSX) {
      alert('Excel kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.');
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

  // ---- Yardımcı: dosya adı temizleyici ----
  function sanitize(str) {
    return String(str)
      .replace(/[\\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80);
  }

  global.BildiriExport = {
    exportSubmissionDocx: exportSubmissionDocx,
    exportAllXlsx: exportAllXlsx
  };
})(window);
