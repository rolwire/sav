/*
 * Minimal, dependency-free XLSX writer.
 *
 * A .xlsx file is a ZIP archive of XML parts. Chrome extensions can't pull
 * SheetJS from a CDN (CSP + no network), so this builds a genuine Office Open
 * XML workbook by hand and packs it with a tiny STORE-method (no compression)
 * ZIP writer. The result opens natively in Excel, Google Sheets and LibreOffice.
 *
 * Public API (attached to window.XLSXLite):
 *   buildXlsx(sheetName, columns, rows) -> Uint8Array
 *   buildCsv(columns, rows) -> string
 *   download(filenameBase, ext, data)   -> triggers a browser download
 *
 * columns: [{ key, header, type: 'string'|'number'|'link', width, label }]
 *   type 'link' renders a clickable HYPERLINK(); `label` (a row key) supplies
 *   the visible text, else the URL itself is shown.
 */
(() => {
  // ---- CRC32 (for ZIP entries) ------------------------------------------
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  const enc = new TextEncoder();
  const bytes = (str) => enc.encode(str);

  // ---- ZIP (STORE method, no compression) -------------------------------
  function zip(files) {
    const chunks = [];
    const central = [];
    let offset = 0;

    const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
    const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

    for (const f of files) {
      const nameBytes = bytes(f.name);
      const data = f.data instanceof Uint8Array ? f.data : bytes(f.data);
      const crc = crc32(data);
      const size = data.length;

      const local = [].concat(
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(size), u32(size),
        u16(nameBytes.length), u16(0)
      );
      chunks.push(new Uint8Array(local), nameBytes, data);

      const central1 = [].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(size), u32(size),
        u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0),
        u32(offset)
      );
      central.push(new Uint8Array(central1), nameBytes);

      offset += local.length + nameBytes.length + size;
    }

    let centralSize = 0;
    for (const c of central) centralSize += c.length;

    const eocd = new Uint8Array(
      [].concat(
        u32(0x06054b50), u16(0), u16(0),
        u16(files.length), u16(files.length),
        u32(centralSize), u32(offset), u16(0)
      )
    );

    let total = offset + centralSize + eocd.length;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) { out.set(c, pos); pos += c.length; }
    for (const c of central) { out.set(c, pos); pos += c.length; }
    out.set(eocd, pos);
    return out;
  }

  // ---- XML helpers ------------------------------------------------------
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const colLetter = (i) => {
    let s = "";
    i += 1;
    while (i > 0) {
      const m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  };

  function cell(ref, value, type, styleId) {
    const s = styleId ? ` s="${styleId}"` : "";
    if (type === "number" && value !== "" && value != null && !isNaN(value)) {
      return `<c r="${ref}"${s}><v>${value}</v></c>`;
    }
    if (type === "formula") {
      return `<c r="${ref}"${s} t="str"><f>${esc(value)}</f></c>`;
    }
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
  }

  function buildSheet(columns, rows) {
    const lastCol = colLetter(columns.length - 1);
    const lastRow = rows.length + 1;

    const colsXml =
      "<cols>" +
      columns
        .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 18}" customWidth="1"/>`)
        .join("") +
      "</cols>";

    // Header row (style 1 = bold/white on red).
    let sheetRows = `<row r="1">`;
    columns.forEach((c, i) => {
      sheetRows += cell(`${colLetter(i)}1`, c.header, "string", 1);
    });
    sheetRows += "</row>";

    rows.forEach((row, r) => {
      const rn = r + 2;
      sheetRows += `<row r="${rn}">`;
      columns.forEach((c, i) => {
        const ref = `${colLetter(i)}${rn}`;
        const raw = row[c.key];
        if (c.type === "link") {
          if (raw) {
            const label = c.label ? row[c.label] || raw : raw;
            const url = String(raw).replace(/"/g, '""');
            const text = String(label).replace(/"/g, '""');
            sheetRows += cell(ref, `HYPERLINK("${url}","${text}")`, "formula", 2);
          } else {
            sheetRows += cell(ref, "", "string");
          }
        } else if (c.type === "number") {
          sheetRows += cell(ref, raw == null || raw === "" ? "" : raw, "number");
        } else {
          sheetRows += cell(ref, raw, "string");
        }
      });
      sheetRows += "</row>";
    });

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${colsXml}
<sheetData>${sheetRows}</sheetData>
<autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`;
  }

  const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = (sheetName) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFCC0000"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  function buildXlsx(sheetName, columns, rows) {
    const files = [
      { name: "[Content_Types].xml", data: CONTENT_TYPES },
      { name: "_rels/.rels", data: ROOT_RELS },
      { name: "xl/workbook.xml", data: workbookXml(sheetName || "Sheet1") },
      { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS },
      { name: "xl/styles.xml", data: STYLES },
      { name: "xl/worksheets/sheet1.xml", data: buildSheet(columns, rows) },
    ];
    return zip(files);
  }

  function buildCsv(columns, rows) {
    const q = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [columns.map((c) => q(c.header)).join(",")];
    for (const row of rows) {
      lines.push(columns.map((c) => q(row[c.key])).join(","));
    }
    return "﻿" + lines.join("\r\n");
  }

  function download(filenameBase, ext, data) {
    const mime =
      ext === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv;charset=utf-8";
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenameBase}.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1500);
  }

  window.XLSXLite = { buildXlsx, buildCsv, download };
})();
