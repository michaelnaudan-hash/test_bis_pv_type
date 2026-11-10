/* Export DOCX (Word) généré localement : OOXML minimal + images JPEG embarquées,
 * produit avec fflate (zip). Entièrement modifiable dans Microsoft Word. */
import { prepareImages, CHIP_COLORS, AVIS_COLORS, hexToRgb } from './common.js';

const EMU_PER_MM = 36000;
const PAGE_W_MM = 210, PAGE_H_MM = 297, MARGIN_MM = 18;
const CONTENT_W_EMU = (PAGE_W_MM - 2 * MARGIN_MM) * EMU_PER_MM;

const xesc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function rgbHex(hex) { return hex.replace('#', '').toUpperCase(); }

function p(text, { bold = false, size = 21, color = '1C2733', italic = false, align = null, spaceBefore = 0, spaceAfter = 120, keepNext = false } = {}) {
  const jc = align ? `<w:jc w:val="${align}"/>` : '';
  const kn = keepNext ? '<w:keepNext/>' : '';
  return `<w:p><w:pPr>${kn}<w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}"/>${jc}<w:rPr>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:pPr><w:r><w:rPr>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xesc(text)}</w:t></w:r></w:p>`;
}

function cellPara(content, { bold = false, color = '1C2733', fill = null, size = 18, widthEmu }) {
  const wTwips = Math.round(widthEmu / 635);
  const shd = fill ? `<w:shd w:val="clear" w:fill="${fill}"/>` : '';
  let runs;
  if (content && typeof content === 'object' && content.chip) {
    const col = CHIP_COLORS[content.chip] || CHIP_COLORS.en_attente;
    runs = `<w:r><w:rPr><w:b/><w:color w:val="${rgbHex(col.fg)}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xesc(content.label || content.chip)}</w:t></w:r>`;
    return `<w:tc><w:tcPr><w:tcW w:w="${wTwips}" w:type="dxa"/><w:shd w:val="clear" w:fill="${rgbHex(col.bg)}"/></w:tcPr><w:p><w:pPr><w:spacing w:after="40"/></w:pPr>${runs}</w:p></w:tc>`;
  }
  runs = `<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xesc(content)}</w:t></w:r>`;
  return `<w:tc><w:tcPr><w:tcW w:w="${wTwips}" w:type="dxa"/>${shd}</w:tcPr><w:p><w:pPr><w:spacing w:after="40"/></w:pPr>${runs}</w:p></w:tc>`;
}

function table(head, rows, { col0W = 62 * EMU_PER_MM, primary = '0D47A1', header = true } = {}) {
  const n = head ? head.length : (rows[0] || []).length;
  const colW = [col0W];
  const rest = (CONTENT_W_EMU - col0W) / (n - 1 || 1);
  for (let i = 1; i < n; i++) colW.push(rest);
  const grid = `<w:tblGrid>${colW.map((w) => `<w:gridCol w:w="${Math.round(w / EMU_PER_MM * 56.7)}"/>`).join('')}</w:tblGrid>`;
  const mkRow = (cells, isHead) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.map((c, i) => cellPara(c, { bold: isHead || i === 0, color: isHead ? 'FFFFFF' : i === 0 ? primary : '1C2733', fill: isHead ? primary : i === 0 ? 'EEF3FB' : null, widthEmu: colW[i] })).join('')}</w:tr>`;
  const headRow = header && head ? mkRow(head, true) : '';
  const bodyRows = rows.map((r) => mkRow(r.map((c) => (c && typeof c === 'object' && c.chip) ? c : String(c ?? ''))), false).join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${Math.round(CONTENT_W_EMU / EMU_PER_MM * 56.7)}" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D8E0EA"/><w:left w:val="single" w:sz="4" w:color="D8E0EA"/><w:bottom w:val="single" w:sz="4" w:color="D8E0EA"/><w:right w:val="single" w:sz="4" w:color="D8E0EA"/><w:insideH w:val="single" w:sz="4" w:color="D8E0EA"/><w:insideV w:val="single" w:sz="4" w:color="D8E0EA"/></w:tblBorders></w:tblPr>${grid}${headRow}${bodyRows}</w:tbl><w:p/>`;
}

function imageBlock(b, rId, primary) {
  const maxW = CONTENT_W_EMU - 10 * EMU_PER_MM;
  const maxH = 110 * EMU_PER_MM;
  let w = maxW, h = Math.round((b.height / b.width) * w);
  if (h > maxH) { h = maxH; w = Math.round((b.width / b.height) * h); }
  const ext = `<wp:extent cx="${w}" cy="${h}"/>`;
  const drawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">${ext}<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${rId}" name="Photo ${b.num}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${rId}" name="photo${b.num}.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  const cap = p(`Photographie n°${b.num}${b.legend ? ' — ' + b.legend : ''}`, { size: 17, italic: true, color: '5B6B7C', spaceAfter: 200 });
  return `<w:p><w:pPr><w:keepNext/><w:spacing w:after="20"/></w:pPr>${drawing}</w:p>${cap}`;
}

export async function exportDOCX(model, pv, filename) {
  await prepareImages(model, pv);
  const primary = rgbHex(model.primaryColor || '#0d47a1');
  const files = {};
  const media = [];
  let rIdCounter = 10;
  const body = [];

  for (const b of model.blocks) {
    switch (b.t) {
      case 'cover': {
        if (b.logoDataUrl) {
          const m = /^data:image\/(\w+);base64,(.*)$/s.exec(b.logoDataUrl);
          if (m) {
            const rId = `rId${rIdCounter++}`;
            media.push({ name: `word/media/logo.${m[1] === 'png' ? 'png' : 'jpg'}`, dataUrl: b.logoDataUrl, rId });
            const w = 50 * EMU_PER_MM, h = w; // ratio approximatif géré par Word si hauteur fixe ; on fixe 50mm x proportion via image réelle non connue ici
            body.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${w}" cy="${w}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="Logo"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${w}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
          }
        }
        body.push(p(b.societe || '', { bold: true, size: 32, color: primary, align: 'center', spaceAfter: 200 }));
        body.push(p(b.titre, { bold: true, size: 44, color: primary, align: 'center', spaceAfter: 120 }));
        body.push(p(b.sousTitre, { italic: true, size: 24, align: 'center', spaceAfter: 400 }));
        const coverRows = [
          ['Numéro de PV', b.numero], ["Intitulé de l’opération", b.intitule], ['Ouvrage', b.ouvrage],
          ['Localisation', b.localisation], ["Date d’édition", b.dateEdition],
        ].filter(([, v]) => v);
        body.push(table(null, coverRows, { primary }));
        if (b.demo) body.push(p('DOSSIER DE DÉMONSTRATION — données fictives, non issues de contrôles réels', { bold: true, size: 20, color: '6A1B9A', align: 'center', spaceBefore: 240 }));
        body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
        break;
      }
      case 'h1':
        body.push(p(`${b.num}. ${b.text}`, { bold: true, size: 28, color: primary, spaceBefore: 240, spaceAfter: 160, keepNext: true }));
        body.push(`<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:color="${primary}"/></w:pBdr><w:spacing w:after="160"/></w:pPr></w:p>`);
        break;
      case 'h2': body.push(p(b.text, { bold: true, size: 24, color: primary, spaceBefore: 200, spaceAfter: 100, keepNext: true })); break;
      case 'h3': body.push(p(b.text, { bold: true, size: 21, spaceBefore: 160, spaceAfter: 80, keepNext: true })); break;
      case 'p':
        body.push(p((b.label ? b.label + ' : ' : '') + (b.text || ''), { size: 20, spaceAfter: 140 }));
        break;
      case 'warning': {
        body.push(`<w:p><w:pPr><w:spacing w:before="120" w:after="120"/><w:pBdr><w:top w:val="single" w:sz="6" w:color="FFE082"/><w:left w:val="single" w:sz="6" w:color="FFE082"/><w:bottom w:val="single" w:sz="6" w:color="FFE082"/><w:right w:val="single" w:sz="6" w:color="FFE082"/></w:pBdr><w:shd w:val="clear" w:fill="FFF8E1"/></w:pPr><w:r><w:rPr><w:color w:val="5A4600"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr><w:t xml:space="preserve">⚠ ${xesc(b.text)}</w:t></w:r></w:p>`);
        break;
      }
      case 'kv': body.push(table(null, b.rows.map(([k, v]) => [k, v && typeof v === 'object' ? v : String(v ?? '')]), { primary })); break;
      case 'table': body.push(table(b.head, b.rows.map((r) => r.map((c) => (c && typeof c === 'object' && c.chip) ? c : String(c ?? ''))), { primary })); break;
      case 'ctrl': {
        const badges = (b.badges || []).map((bd) => `[${bd.label}]`).join(' ');
        body.push(p(`${b.code} — ${b.titre}  ${badges}`, { bold: true, size: 21, spaceBefore: 200, spaceAfter: 60, keepNext: true }));
        body.push(table(null, b.rows.map(([k, v]) => [k, v && typeof v === 'object' ? v : String(v ?? '')]), { primary }));
        break;
      }
      case 'img': {
        if (!b.dataUrl) break;
        const rId = `rId${rIdCounter++}`;
        media.push({ name: `word/media/photo${b.num}.jpg`, dataUrl: b.dataUrl, rId });
        body.push(imageBlock(b, rId, primary));
        break;
      }
      case 'conclusion': {
        const col = AVIS_COLORS[b.avis] || AVIS_COLORS.en_attente;
        const paras = String(b.texte || '').split('\n').map((l) => `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:color w:val="${rgbHex(col.fg)}"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t xml:space="preserve">${xesc(l)}</w:t></w:r></w:p>`).join('');
        body.push(`<w:tbl><w:tblPr><w:tblW w:w="${Math.round(CONTENT_W_EMU / EMU_PER_MM * 56.7)}" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="8" w:color="${rgbHex(col.fg)}"/><w:left w:val="single" w:sz="8" w:color="${rgbHex(col.fg)}"/><w:bottom w:val="single" w:sz="8" w:color="${rgbHex(col.fg)}"/><w:right w:val="single" w:sz="8" w:color="${rgbHex(col.fg)}"/></w:tblBorders><w:shd w:val="clear" w:fill="${rgbHex(col.bg)}"/></w:tblPr><w:tblGrid><w:gridCol w:w="${Math.round(CONTENT_W_EMU / EMU_PER_MM * 56.7)}"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="${Math.round(CONTENT_W_EMU / EMU_PER_MM * 56.7)}" w:type="dxa"/><w:shd w:val="clear" w:fill="${rgbHex(col.bg)}"/></w:tcPr>${paras}</w:tc></w:tr></w:tbl><w:p/>`);
        break;
      }
      case 'sig': {
        body.push(p(b.titre, { bold: true, size: 21, spaceBefore: 240, spaceAfter: 60 }));
        if (b.noms) body.push(p(b.noms, { size: 19, spaceAfter: 60 }));
        body.push(p('Signature et date :  ______________________________', { size: 19, color: '5B6B7C', spaceAfter: 300 }));
        break;
      }
      case 'pagebreak': body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); break;
    }
  }

  const mediaFiles = {};
  for (const m of media) {
    const base64 = m.dataUrl.split(',')[1];
    const bin = atob(base64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    mediaFiles[m.name] = u8;
  }

  const imageRels = media.map((m) => `<Relationship Id="${m.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${m.name.replace('word/', '')}"/>`).join('');
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="word/styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="word/header1.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="word/footer1.xml"/>
${imageRels}
</Relationships>`;

  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:color="${primary}"/></w:pBdr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:color w:val="5B6B7C"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">${xesc(model.headerText || '')}</w:t></w:r></w:p></w:hdr>`;
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${Math.round(CONTENT_W_EMU / EMU_PER_MM * 56.7)}"/></w:tabs></w:pPr>
<w:r><w:rPr><w:color w:val="5B6B7C"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">PV n° ${xesc(model.numero)} — ${xesc(model.footerText || '')}\t</w:t></w:r>
<w:r><w:rPr><w:color w:val="5B6B7C"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>Page </w:t></w:r>
<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
<w:r><w:rPr><w:color w:val="5B6B7C"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t> / </w:t></w:r>
<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
</w:p></w:ftr>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D8E0EA"/><w:left w:val="single" w:sz="4" w:color="D8E0EA"/><w:bottom w:val="single" w:sz="4" w:color="D8E0EA"/><w:right w:val="single" w:sz="4" w:color="D8E0EA"/><w:insideH w:val="single" w:sz="4" w:color="D8E0EA"/><w:insideV w:val="single" w:sz="4" w:color="D8E0EA"/></w:tblBorders></w:tblPr></w:style>
</w:styles>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
<w:body>${body.join('')}
<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/>
<w:pgSz w:w="${PAGE_W_MM * 56.7}" w:h="${PAGE_H_MM * 56.7}"/>
<w:pgMar w:top="${MARGIN_MM * 56.7}" w:right="${MARGIN_MM * 56.7}" w:bottom="${MARGIN_MM * 56.7}" w:left="${MARGIN_MM * 56.7}" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpg" ContentType="image/jpeg"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>PV ${xesc(model.numero)}</dc:title><dc:creator>PV Étanchéité OA</dc:creator></cp:coreProperties>`;
  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>PV Étanchéité OA (hors ligne)</Application></Properties>`;

  files['[Content_Types].xml'] = new TextEncoder().encode(contentTypes);
  files['_rels/.rels'] = new TextEncoder().encode(rels);
  files['word/document.xml'] = new TextEncoder().encode(documentXml);
  files['word/_rels/document.xml.rels'] = new TextEncoder().encode(docRels);
  files['word/styles.xml'] = new TextEncoder().encode(stylesXml);
  files['word/header1.xml'] = new TextEncoder().encode(headerXml);
  files['word/footer1.xml'] = new TextEncoder().encode(footerXml);
  files['docProps/core.xml'] = new TextEncoder().encode(coreXml);
  files['docProps/app.xml'] = new TextEncoder().encode(appXml);
  for (const [name, u8] of Object.entries(mediaFiles)) files[name] = u8;

  const zip = fflate.zipSync(files, { level: 6 });
  const blob = new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const { downloadBlob } = await import('../util.js');
  downloadBlob(blob, filename);
}
