/* Export ODT (LibreOffice Writer) généré localement : ODF minimal + images JPEG,
 * produit avec fflate (zip, mimetype non compressé en première entrée). */
import { prepareImages, CHIP_COLORS, AVIS_COLORS } from './common.js';

const oesc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rgbHex = (hex) => hex.replace('#', '').toUpperCase();

const pstyles = new Map();
function pstyleName({ bold = false, size = 10.5, color = null, italic = false, align = null, bg = null, border = null, keepNext = false, padding = null, margin = null, breakBefore = false } = {}) {
  const key = JSON.stringify([bold, size, color, italic, align, bg, border, keepNext, padding, margin, breakBefore]);
  if (!pstyles.has(key)) {
    const name = `Pa${pstyles.size + 1}`;
    const tp = [bold && 'fo:font-weight="bold"', italic && 'fo:font-style="italic"', size !== 10.5 && `fo:font-size="${size}pt"`, color && `fo:color="#${color}"`].filter(Boolean).join(' ');
    const pp = [
      align && `fo:text-align="${align}"`, keepNext && 'fo:keep-with-next="always"',
      bg && `fo:background-color="#${bg}"`, border && `fo:border="${border}"`,
      padding && `fo:padding="${padding}"`, margin && `fo:margin="${margin}"`,
      breakBefore && 'fo:break-before="page"',
    ].filter(Boolean).join(' ');
    pstyles.set(key, { name, def: `<style:style style:name="${name}" style:family="paragraph"><style:paragraph-properties ${pp}/><style:text-properties ${tp || 'fo:font-size="10.5pt"'}/></style:style>` });
  }
  return pstyles.get(key).name;
}

function p(text, opts = {}) {
  return `<text:p text:style-name="${pstyleName(opts)}">${oesc(text)}</text:p>`;
}

const cstyles = new Map();
function cstyleName({ head = false, label = false, chipBg = null } = {}) {
  const key = JSON.stringify([head, label, chipBg]);
  if (!cstyles.has(key)) {
    const name = `Tca${cstyles.size + 1}`;
    const bg = head ? 'PRIMARY' : label ? 'EEF3FB' : chipBg;
    cstyles.set(key, { name, bg });
  }
  return cstyles.get(key);
}

function cell(content, { head = false, label = false } = {}) {
  let text, st;
  if (content && typeof content === 'object' && content.chip) {
    const col = CHIP_COLORS[content.chip] || CHIP_COLORS.en_attente;
    text = content.label || content.chip;
    st = cstyleName({ chipBg: rgbHex(col.bg) });
    return `<table:table-cell table:style-name="${st.name}"><text:p text:style-name="${pstyleName({ bold: true, color: rgbHex(col.fg), size: 9 })}">${oesc(text)}</text:p></table:table-cell>`;
  }
  st = cstyleName({ head, label });
  const txt = String(content ?? '');
  const pname = pstyleName({ bold: head || label, size: 9, color: head ? 'FFFFFF' : label ? 'PRIMARY' : null });
  return `<table:table-cell table:style-name="${st.name}"><text:p text:style-name="${pname}">${oesc(txt)}</text:p></table:table-cell>`;
}

function table(head, rows, { col0Cm = 6.2 } = {}) {
  const n = head ? head.length : (rows[0] || []).length;
  const restCm = ((17.0 - col0Cm) / (n - 1 || 1)).toFixed(3);
  const cols = Array.from({ length: n }, (_, i) => `<table:table-column table:style-name="Tcol" ${i === 0 ? `style:column-width="${col0Cm}cm"` : `style:column-width="${restCm}cm"`}/>`).join('');
  const mkRow = (cells, isHead) => `<table:table-row table:style-name="Trow">${cells.map((c, i) => cell(c, { head: isHead, label: !isHead && i === 0 })).join('')}</table:table-row>`;
  return `<table:table table:name="T${Math.floor(Math.random() * 1e6)}" table:style-name="Tmain">${cols}${head ? mkRow(head, true) : ''}${rows.map((r) => mkRow(r.map((c) => (c && typeof c === 'object' && c.chip) ? c : String(c ?? '')), false)).join('')}</table:table><text:p text:style-name="${pstyleName({})}"/>`;
}

function imageBlock(b, imgName) {
  const maxWcm = 16, maxHcm = 10.5;
  let w = maxWcm, h = (b.height / b.width) * w;
  if (h > maxHcm) { h = maxHcm; w = (b.width / b.height) * h; }
  return `<text:p text:style-name="${pstyleName({ align: 'center', keepNext: true, margin: '0.2cm 0cm 0cm 0cm' })}"><draw:frame draw:name="Photo${b.num}" draw:style-name="Gimg" svg:width="${w.toFixed(2)}cm" svg:height="${h.toFixed(2)}cm" text:anchor-type="as-char"><draw:image xlink:href="Pictures/${imgName}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></text:p>` +
    p(`Photographie n°${b.num}${b.legend ? ' — ' + b.legend : ''}`, { size: 8.5, italic: true, color: '5B6B7C', align: 'center' });
}

export async function exportODT(model, pv, filename) {
  await prepareImages(model, pv);
  const primary = rgbHex(model.primaryColor || '#0d47a1');
  const files = {};
  const pictures = {};
  let imgCounter = 0;

  const body = [];
  for (const b of model.blocks) {
    switch (b.t) {
      case 'cover': {
        if (b.logoDataUrl) {
          const m = /^data:image\/(\w+);base64,(.*)$/s.exec(b.logoDataUrl);
          if (m) {
            const name = `logo.${m[1] === 'png' ? 'png' : 'jpg'}`;
            pictures[`Pictures/${name}`] = dataUrlToU8(b.logoDataUrl);
            body.push(`<text:p text:style-name="${pstyleName({ align: 'center', margin: '0cm 0cm 0.4cm 0cm' })}"><draw:frame draw:name="Logo" draw:style-name="Glogo" svg:width="5cm" svg:height="5cm" text:anchor-type="as-char"><draw:image xlink:href="Pictures/${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></text:p>`);
          }
        }
        body.push(p(b.societe || '', { bold: true, size: 16, color: primary, align: 'center' }));
        body.push(p(b.titre, { bold: true, size: 22, color: primary, align: 'center' }));
        body.push(p(b.sousTitre, { italic: true, size: 12, align: 'center' }));
        const coverRows = [
          ['Numéro de PV', b.numero], ["Intitulé de l’opération", b.intitule], ['Ouvrage', b.ouvrage],
          ['Localisation', b.localisation], ["Date d’édition", b.dateEdition],
        ].filter(([, v]) => v);
        body.push(table(null, coverRows));
        if (b.demo) body.push(p('DOSSIER DE DÉMONSTRATION — données fictives, non issues de contrôles réels', { bold: true, size: 10, color: '6A1B9A', align: 'center', margin: '0.4cm 0cm 0cm 0cm' }));
        body.push(p('', { breakBefore: true }));
        break;
      }
      case 'h1': body.push(`<text:h text:style-name="H1" text:outline-level="1">${oesc(`${b.num}. ${b.text}`)}</text:h>`); break;
      case 'h2': body.push(`<text:h text:style-name="H2" text:outline-level="2">${oesc(b.text)}</text:h>`); break;
      case 'h3': body.push(`<text:h text:style-name="H3" text:outline-level="3">${oesc(b.text)}</text:h>`); break;
      case 'p': body.push(p((b.label ? b.label + ' : ' : '') + (b.text || ''))); break;
      case 'warning': body.push(p('⚠ ' + b.text, { size: 9, color: '5A4600', bg: 'FFF8E1', padding: '0.15cm', margin: '0.2cm 0cm' })); break;
      case 'kv': body.push(table(null, b.rows.map(([k, v]) => [k, v && typeof v === 'object' ? v : String(v ?? '')]))); break;
      case 'table': body.push(table(b.head, b.rows)); break;
      case 'ctrl': {
        const badges = (b.badges || []).map((bd) => `[${bd.label}]`).join(' ');
        body.push(`<text:h text:style-name="H3" text:outline-level="3">${oesc(`${b.code} — ${b.titre}  ${badges}`)}</text:h>`);
        body.push(table(null, b.rows.map(([k, v]) => [k, v && typeof v === 'object' ? v : String(v ?? '')])));
        break;
      }
      case 'img': {
        if (!b.dataUrl) break;
        const name = `photo${++imgCounter}.jpg`;
        pictures[`Pictures/${name}`] = dataUrlToU8(b.dataUrl);
        body.push(imageBlock(b, name));
        break;
      }
      case 'conclusion': {
        const col = AVIS_COLORS[b.avis] || AVIS_COLORS.en_attente;
        const paras = String(b.texte || '').split('\n').map((l) => p(l, { size: 9.5, color: rgbHex(col.fg) })).join('');
        body.push(`<table:table table:name="Conclusion" table:style-name="Tmain"><table:table-column table:style-name="Tcol" style:column-width="17cm"/><table:table-row table:style-name="Trow"><table:table-cell table:style-name="${cstyleName({ chipBg: rgbHex(col.bg) }).name}" fo:border="0.06cm solid #${rgbHex(col.fg)}">${paras}</table:table-cell></table:table-row></table:table><text:p text:style-name="${pstyleName({})}"/>`);
        break;
      }
      case 'sig': {
        body.push(p(b.titre, { bold: true, size: 10.5, margin: '0.4cm 0cm 0cm 0cm' }));
        if (b.noms) body.push(p(b.noms, { size: 9.5 }));
        body.push(p('Signature et date :  ______________________________', { size: 9.5, color: '5B6B7C', margin: '0cm 0cm 0.6cm 0cm' }));
        break;
      }
      case 'pagebreak': body.push(p('', { breakBefore: true })); break;
    }
  }

  const manifestEntries = Object.keys(pictures).map((f) => `<manifest:file-entry manifest:full-path="${f}" manifest:media-type="image/jpeg"/>`).join('');
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
<manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
${manifestEntries}
</manifest:manifest>`;

  const cellStyleDefs = [...cstyles.values()].map(({ name, bg }) => {
    const fill = bg === 'PRIMARY' ? `#${primary}` : bg ? `#${bg}` : null;
    return `<style:style style:name="${name}" style:family="table-cell"><style:table-cell-properties fo:padding="0.1cm" fo:border="0.02cm solid #D8E0EA"${fill ? ` fo:background-color="${fill}"` : ''}/></style:style>`;
  }).join('\n');

  const styles = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.2">
<office:styles>
<style:default-style style:family="paragraph"><style:text-properties fo:font-size="10.5pt" fo:language="fr" fo:country="FR"/></style:default-style>
<style:style style:name="H1" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.5cm" fo:margin-bottom="0.25cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="14pt" fo:font-weight="bold" fo:color="#${primary}"/></style:style>
<style:style style:name="H2" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.15cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="12pt" fo:font-weight="bold" fo:color="#${primary}"/></style:style>
<style:style style:name="H3" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.3cm" fo:margin-bottom="0.1cm" fo:keep-with-next="always"/><style:text-properties fo:font-size="10.5pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Tmain" style:family="table"><style:table-properties table:align="margins" fo:margin="0cm" style:width="17cm"/></style:style>
<style:style style:name="Trow" style:family="table-row"><style:table-row-properties style:keep-together="always"/></style:style>
<style:style style:name="Tcol" style:family="table-column"/>
<style:style style:name="Gimg" style:family="graphic"><style:graphic-properties draw:wrap-influence-on-position="once-concurrent" style:vertical-pos="top" style:vertical-rel="paragraph" style:horizontal-pos="center" style:horizontal-rel="paragraph"/></style:style>
<style:style style:name="Glogo" style:family="graphic"><style:graphic-properties style:horizontal-pos="center" style:horizontal-rel="paragraph" style:vertical-pos="top" style:vertical-rel="paragraph"/></style:style>
${cellStyleDefs}
</office:styles>
<office:automatic-styles>
<style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="2.2cm" fo:margin-bottom="2cm" fo:margin-left="2cm" fo:margin-right="2cm"/><style:header-style/><style:footer-style/></style:page-layout>
<style:style style:name="hdrP" style:family="paragraph"><style:paragraph-properties fo:border-bottom="0.03cm solid #${primary}" fo:padding-bottom="0.1cm"/><style:text-properties fo:font-size="8pt" fo:color="#5B6B7C"/></style:style>
<style:style style:name="ftrP" style:family="paragraph"><style:paragraph-properties fo:border-top="0.02cm solid #C8D0DC" fo:padding-top="0.1cm"/><style:text-properties fo:font-size="8pt" fo:color="#5B6B7C"/></style:style>
</office:automatic-styles>
<office:master-styles>
<style:master-page style:name="Standard" style:page-layout-name="pm1">
<style:header><text:p text:style-name="hdrP">${oesc(model.headerText || '')}</text:p></style:header>
<style:footer><text:p text:style-name="ftrP">${oesc(`PV n° ${model.numero}${model.footerText ? ' — ' + model.footerText : ''}    Page `)}<text:page-number text:select-page="current">1</text:page-number></text:p></style:footer>
</style:master-page>
</office:master-styles>
</office:document-styles>`;

  const paraStyleDefs = [...pstyles.values()].map((s) => s.def.replace(/fo:color="#PRIMARY"/g, `fo:color="#${primary}"`)).join('\n');
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.2">
<office:automatic-styles>
${paraStyleDefs}
</office:automatic-styles>
<office:body><office:text>${body.join('')}</office:text></office:body>
</office:document-content>`;

  const meta = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.2"><office:meta><meta:generator>PV Étanchéité OA (hors ligne)</meta:generator></office:meta></office:document-meta>`;

  files['mimetype'] = [new TextEncoder().encode('application/vnd.oasis.opendocument.text'), { level: 0 }];
  files['content.xml'] = new TextEncoder().encode(content);
  files['styles.xml'] = new TextEncoder().encode(styles);
  files['meta.xml'] = new TextEncoder().encode(meta);
  files['META-INF/manifest.xml'] = new TextEncoder().encode(manifest);
  for (const [name, u8] of Object.entries(pictures)) files[name] = u8;

  const zip = fflate.zipSync(files, { level: 6 });
  const blob = new Blob([zip], { type: 'application/vnd.oasis.opendocument.text' });
  const { downloadBlob } = await import('../util.js');
  downloadBlob(blob, filename);
}

function dataUrlToU8(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
