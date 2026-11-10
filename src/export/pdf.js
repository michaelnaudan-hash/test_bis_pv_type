/* Export PDF via jsPDF + autoTable — 100 % local. */
import { prepareImages, CHIP_COLORS, AVIS_COLORS, hexToRgb } from './common.js';
import { esc } from '../util.js';

const A4 = { w: 210, h: 297 };
const MARGIN = { top: 24, bottom: 20, left: 16, right: 16 };
const CONTENT_W = A4.w - MARGIN.left - MARGIN.right;

export async function exportPDF(model, pv, filename) {
  await prepareImages(model, pv);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const primary = hexToRgb(model.primaryColor || '#0d47a1');
  doc.setProperties({ title: `PV ${model.numero}`, author: '', subject: 'Procès-verbal de contrôle de mise en œuvre de l étanchéité', creator: 'PV Étanchéité OA (hors ligne)' });

  let y = MARGIN.top;
  const pageBottom = () => A4.h - MARGIN.bottom;
  const ensureSpace = (h) => { if (y + h > pageBottom()) { doc.addPage(); y = MARGIN.top; } };
  const newSection = () => { if (y > MARGIN.top + 40) doc.addPage(); y = MARGIN.top; };

  const setFont = (size, style = 'normal') => { doc.setFont('helvetica', style); doc.setFontSize(size); };
  const text = (t, x, yy, opts = {}) => { setFont(opts.size || 10, opts.style || 'normal'); doc.setTextColor(...(opts.color || [28, 39, 51])); doc.text(String(t ?? ''), x, yy, { maxWidth: opts.maxWidth, ...(opts.align ? { align: opts.align } : {}) }); };
  const wrappedHeight = (t, size, maxWidth) => { setFont(size); return doc.getTextDimensions(String(t ?? ''), { maxWidth, fontSize: size }).h; };

  for (const b of model.blocks) {
    switch (b.t) {
      case 'cover': {
        y = 40;
        if (b.logoDataUrl) {
          try {
            const img = new Image();
            await new Promise((res) => { img.onload = res; img.onerror = res; img.src = b.logoDataUrl; });
            const iw = 50, ih = (img.height / Math.max(1, img.width)) * iw;
            doc.addImage(b.logoDataUrl, 'PNG', (A4.w - iw) / 2, y, iw, ih);
            y += ih + 10;
          } catch (e) {}
        }
        if (b.societe) { text(b.societe, A4.w / 2, y, { size: 16, style: 'bold', color: primary, align: 'center' }); y += 10; }
        text(b.titre, A4.w / 2, y, { size: 22, style: 'bold', color: primary, align: 'center' }); y += 10;
        text(b.sousTitre, A4.w / 2, y, { size: 12, style: 'italic', align: 'center' }); y += 16;
        doc.setDrawColor(...primary); doc.setLineWidth(0.6);
        doc.line(MARGIN.left + 30, y, A4.w - MARGIN.right - 30, y); y += 12;
        const coverRows = [
          ['Numéro de PV', b.numero], ["Intitulé de l’opération", b.intitule], ["Ouvrage", b.ouvrage],
          ['Localisation', b.localisation], ["Date d’édition", b.dateEdition],
        ].filter(([, v]) => v);
        doc.autoTable({
          startY: y, theme: 'plain', styles: { fontSize: 11, cellPadding: 3 },
          columnStyles: { 0: { fontStyle: 'bold', textColor: primary, cellWidth: 60 } },
          body: coverRows, margin: { left: MARGIN.left + 20, right: MARGIN.right + 20 },
        });
        y = doc.lastAutoTable.finalY + 12;
        if (b.demo) {
          text('DOSSIER DE DÉMONSTRATION — données fictives, non issues de contrôles réels', A4.w / 2, y, { size: 10, style: 'bold', color: [106, 27, 154], align: 'center' });
          y += 8;
        }
        text('Document généré localement, hors connexion.', A4.w / 2, A4.h - 15, { size: 8, color: [91, 107, 124], align: 'center' });
        doc.addPage(); y = MARGIN.top;
        break;
      }
      case 'h1': {
        newSection();
        y += 4;
        text(`${b.num}. ${b.text}`, MARGIN.left, y, { size: 14, style: 'bold', color: primary });
        y += 2;
        doc.setDrawColor(...primary); doc.setLineWidth(0.4);
        doc.line(MARGIN.left, y + 2, MARGIN.left + CONTENT_W, y + 2);
        y += 8;
        break;
      }
      case 'h2': { ensureSpace(12); y += 3; text(b.text, MARGIN.left, y, { size: 12, style: 'bold', color: primary }); y += 7; break; }
      case 'h3': { ensureSpace(10); y += 2; text(b.text, MARGIN.left, y, { size: 10.5, style: 'bold' }); y += 6; break; }
      case 'p': {
        const label = b.label ? b.label + ' : ' : '';
        const full = label + (b.text || '');
        const h = wrappedHeight(full, 10, CONTENT_W) + 2;
        ensureSpace(h);
        if (b.label) { text(b.label + ' :', MARGIN.left, y, { size: 10, style: 'bold' }); }
        text(b.text || '', MARGIN.left + (b.label ? doc.getTextWidth(b.label + ' : ') + 1 : 0), y, { size: 10, maxWidth: CONTENT_W - (b.label ? doc.getTextWidth(b.label + ' : ') + 1 : 0) });
        y += h;
        break;
      }
      case 'warning': {
        const h = wrappedHeight(b.text, 8.5, CONTENT_W - 8) + 8;
        ensureSpace(h + 4);
        doc.setFillColor(255, 248, 225); doc.setDrawColor(255, 224, 130);
        doc.roundedRect(MARGIN.left, y, CONTENT_W, h, 2, 2, 'FD');
        text('⚠ ' + b.text, MARGIN.left + 4, y + 5, { size: 8.5, maxWidth: CONTENT_W - 8, color: [90, 70, 0] });
        y += h + 4;
        break;
      }
      case 'kv': {
        doc.autoTable({
          startY: y, theme: 'grid', styles: { fontSize: 9.5, cellPadding: 2.5, lineColor: [216, 224, 234] },
          head: [], body: b.rows.map(([k, v]) => [k, cellText(v)]),
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 62, fillColor: [238, 243, 251], textColor: primary } },
          margin: { left: MARGIN.left, right: MARGIN.right },
          didParseCell: (data) => { if (data.column.index === 1 && data.cell.raw && data.cell.raw.chip) chipCell(data, b); },
        });
        y = doc.lastAutoTable.finalY + 4;
        break;
      }
      case 'table': {
        doc.autoTable({
          startY: y, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: [216, 224, 234] },
          head: [b.head], body: b.rows.map((r) => r.map(cellText)),
          headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold' },
          margin: { left: MARGIN.left, right: MARGIN.right },
          didParseCell: (data) => {
            if (data.section === 'body' && data.cell.raw && data.cell.raw.chip) chipCell(data, b);
          },
        });
        y = doc.lastAutoTable.finalY + 4;
        break;
      }
      case 'ctrl': {
        ensureSpace(30);
        y += 2;
        text(`${b.code} — ${b.titre}`, MARGIN.left, y, { size: 10.5, style: 'bold' });
        y += 5;
        let bx = MARGIN.left + doc.getTextWidth(`${b.code} — ${b.titre}`) + 8;
        setFont(7.5, 'bold');
        for (const bd of b.badges || []) {
          const w = doc.getTextWidth(bd.label) + 6;
          doc.setFillColor(...(bd.tag === 'PA' ? [253, 236, 234] : bd.tag === 'PC' ? [255, 248, 225] : [236, 239, 241]));
          doc.setTextColor(...(bd.tag === 'PA' ? [183, 28, 28] : bd.tag === 'PC' ? [138, 109, 0] : [69, 90, 100]));
          doc.roundedRect(bx, y - 3.4, w, 4.6, 1, 1, 'F');
          doc.text(bd.label, bx + 3, y);
          bx += w + 3;
        }
        y += 6;
        doc.autoTable({
          startY: y, theme: 'grid', styles: { fontSize: 9, cellPadding: 2.5, lineColor: [216, 224, 234] },
          body: b.rows.map(([k, v]) => [k, cellText(v)]),
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 62, fillColor: [247, 249, 252] } },
          margin: { left: MARGIN.left, right: MARGIN.right },
          didParseCell: (data) => { if (data.column.index === 1 && data.cell.raw && data.cell.raw.chip) chipCell(data, b); },
        });
        y = doc.lastAutoTable.finalY + 5;
        break;
      }
      case 'img': {
        if (!b.dataUrl) break;
        const maxW = CONTENT_W - 10;
        const maxH = 110;
        let w = maxW, h = (b.height / b.width) * w;
        if (h > maxH) { h = maxH; w = (b.width / b.height) * h; }
        const legendH = wrappedHeight(`Photographie n°${b.num}${b.legend ? ' — ' + b.legend : ''}`, 8.5, w) + 3;
        ensureSpace(h + legendH + 6);
        const x = MARGIN.left + (CONTENT_W - w) / 2;
        doc.addImage(b.dataUrl, 'JPEG', x, y, w, h);
        doc.setDrawColor(180, 190, 205); doc.setLineWidth(0.3); doc.rect(x, y, w, h);
        y += h + 2;
        text(`Photographie n°${b.num}${b.legend ? ' — ' + b.legend : ''}`, x, y, { size: 8.5, style: 'italic', maxWidth: w, color: [91, 107, 124] });
        y += legendH + 5;
        break;
      }
      case 'conclusion': {
        const col = AVIS_COLORS[b.avis] || AVIS_COLORS.en_attente;
        const lines = String(b.texte || '').split('\n');
        let h = 8;
        for (const l of lines) h += wrappedHeight(l, 9.5, CONTENT_W - 10) + 1;
        ensureSpace(h + 10);
        doc.setFillColor(...hexToRgb(col.bg)); doc.setDrawColor(...hexToRgb(col.fg));
        doc.roundedRect(MARGIN.left, y, CONTENT_W, h, 2, 2, 'FD');
        let ty = y + 5;
        for (const l of lines) { text(l, MARGIN.left + 5, ty, { size: 9.5, maxWidth: CONTENT_W - 10 }); ty += wrappedHeight(l, 9.5, CONTENT_W - 10) + 1; }
        y += h + 6;
        break;
      }
      case 'sig': {
        ensureSpace(40);
        y += 4;
        text(b.titre, MARGIN.left, y, { size: 10.5, style: 'bold' }); y += 6;
        if (b.noms) { text(b.noms, MARGIN.left, y, { size: 9.5 }); y += 5; }
        doc.setDrawColor(150, 160, 175); doc.setLineDash([2, 2]);
        doc.line(MARGIN.left + 60, y + 18, MARGIN.left + CONTENT_W - 10, y + 18);
        doc.setLineDash([]);
        text('Signature et date', MARGIN.left + 60, y + 22, { size: 8, color: [91, 107, 124] });
        y += 30;
        break;
      }
      case 'pagebreak': doc.addPage(); y = MARGIN.top; break;
    }
  }

  // en-têtes / pieds de page sur toutes les pages (sauf la page de garde pour l’en-tête)
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (i > 1 && model.headerText) {
      setFont(8, 'normal'); doc.setTextColor(91, 107, 124);
      doc.text(model.headerText, MARGIN.left, 10);
      doc.setDrawColor(...primary); doc.setLineWidth(0.3);
      doc.line(MARGIN.left, 13, A4.w - MARGIN.right, 13);
    }
    doc.setDrawColor(200, 208, 220); doc.setLineWidth(0.2);
    doc.line(MARGIN.left, A4.h - 14, A4.w - MARGIN.right, A4.h - 14);
    setFont(8); doc.setTextColor(91, 107, 124);
    doc.text(`PV n° ${model.numero} — édité le ${new Date().toLocaleDateString('fr-FR')}`, MARGIN.left, A4.h - 9);
    if (model.footerText) doc.text(model.footerText, MARGIN.left, A4.h - 5, { maxWidth: CONTENT_W - 40 });
    doc.text(`Page ${i} / ${total}`, A4.w - MARGIN.right, A4.h - 9, { align: 'right' });
  }

  doc.save(filename);
}

function cellText(v) {
  if (v && typeof v === 'object' && v.chip) return v;
  return String(v ?? '');
}

function chipCell(data, block) {
  const chip = data.cell.raw.chip;
  const col = CHIP_COLORS[chip] || CHIP_COLORS.en_attente;
  data.cell.text = [data.cell.raw.label || chip];
  data.cell.styles.textColor = hexToRgb(col.fg);
  data.cell.styles.fillColor = hexToRgb(col.bg);
  data.cell.styles.fontStyle = 'bold';
}
