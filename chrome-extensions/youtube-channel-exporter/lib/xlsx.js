/* Tiny XLSX builder on top of ZipWriter. Produces a genuine .xlsx workbook
 * using inline strings (no shared-string table needed). Supports text cells,
 * number cells, and clickable hyperlinks. window.XlsxWriter.build(...) -> Blob
 */
(function () {
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function colLetter(idx) {
    let s = "";
    idx++;
    while (idx > 0) {
      const rem = (idx - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      idx = Math.floor((idx - 1) / 26);
    }
    return s;
  }

  /* rows: array of arrays. Each cell is either:
   *   - a string / number (plain), or
   *   - { text, link } for a hyperlink, or
   *   - { v, num:true } for an explicit number, or
   *   - { v, header:true } for a bold header cell.
   */
  function build(sheetName, rows) {
    const hyperlinks = [];
    let rowXml = "";

    rows.forEach((cells, r) => {
      const rowNum = r + 1;
      let cellsXml = "";
      cells.forEach((cell, c) => {
        const ref = colLetter(c) + rowNum;
        let style = "";
        let isNum = false;
        let value = cell;
        let link = null;
        let header = false;

        if (cell && typeof cell === "object") {
          if (cell.link) { link = cell.link; value = cell.text; }
          else value = cell.v;
          isNum = !!cell.num;
          header = !!cell.header;
        }

        if (header) style = ' s="1"';
        if (link) {
          style = ' s="2"';
          hyperlinks.push({ ref, target: link });
        }

        if (isNum && value !== "" && value != null && !isNaN(value)) {
          cellsXml += `<c r="${ref}"${style}><v>${value}</v></c>`;
        } else {
          cellsXml += `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(
            value == null ? "" : value
          )}</t></is></c>`;
        }
      });
      rowXml += `<row r="${rowNum}">${cellsXml}</row>`;
    });

    let hlXml = "";
    let relXml = "";
    if (hyperlinks.length) {
      hlXml =
        "<hyperlinks>" +
        hyperlinks
          .map((h, i) => `<hyperlink ref="${h.ref}" r:id="rId${i + 1}"/>`)
          .join("") +
        "</hyperlinks>";
      relXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        hyperlinks
          .map(
            (h, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(
                h.target
              )}" TargetMode="External"/>`
          )
          .join("") +
        "</Relationships>";
    }

    const sheet =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<cols><col min="1" max="1" width="60"/><col min="2" max="2" width="12"/>' +
      '<col min="3" max="5" width="34"/></cols>' +
      `<sheetData>${rowXml}</sheetData>${hlXml}</worksheet>`;

    const contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      "</Types>";

    const rootRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>";

    const workbook =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${esc(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

    const workbookRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>";

    // styles: s=0 default, s=1 bold header, s=2 blue underlined hyperlink
    const styles =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3">' +
      "<font><sz val=\"11\"/><name val=\"Calibri\"/></font>" +
      "<font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font>" +
      "<font><u/><color rgb=\"FF0563C1\"/><sz val=\"11\"/><name val=\"Calibri\"/></font>" +
      "</fonts>" +
      '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
      '<borders count="1"><border/></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      "</cellXfs>" +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>";

    const files = [
      { name: "[Content_Types].xml", data: contentTypes },
      { name: "_rels/.rels", data: rootRels },
      { name: "xl/workbook.xml", data: workbook },
      { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
      { name: "xl/styles.xml", data: styles },
      { name: "xl/worksheets/sheet1.xml", data: sheet },
    ];
    if (relXml) files.push({ name: "xl/worksheets/_rels/sheet1.xml.rels", data: relXml });

    return window.ZipWriter.build(files);
  }

  window.XlsxWriter = { build };
})();
