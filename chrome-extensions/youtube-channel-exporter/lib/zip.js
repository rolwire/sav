/* Minimal self-contained ZIP writer (STORE / no compression) + CRC32.
 * Enough to assemble a valid .xlsx (which is just a zip). No dependencies,
 * so it runs under the extension's strict Content-Security-Policy.
 * Exposes: window.ZipWriter
 */
(function () {
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
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  const enc = new TextEncoder();
  const toBytes = (d) => (typeof d === "string" ? enc.encode(d) : d);

  // DOS date/time (fixed timestamp is fine for our purpose)
  const DOS_TIME = 0;
  const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;

  function u16(n) { return [n & 0xff, (n >>> 8) & 0xff]; }
  function u32(n) { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]; }

  // files: [{ name, data }]  -> Blob
  function build(files) {
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const f of files) {
      const nameBytes = enc.encode(f.name);
      const data = toBytes(f.data);
      const crc = crc32(data);
      const size = data.length;

      const local = [].concat(
        u32(0x04034b50),      // local file header signature
        u16(20),              // version needed
        u16(0),               // flags
        u16(0),               // compression = store
        u16(DOS_TIME),
        u16(DOS_DATE),
        u32(crc),
        u32(size),            // compressed size
        u32(size),            // uncompressed size
        u16(nameBytes.length),
        u16(0)                // extra length
      );
      const localHeader = new Uint8Array(local);
      chunks.push(localHeader, nameBytes, data);

      const cdir = [].concat(
        u32(0x02014b50),      // central dir signature
        u16(20),              // version made by
        u16(20),              // version needed
        u16(0),               // flags
        u16(0),               // compression
        u16(DOS_TIME),
        u16(DOS_DATE),
        u32(crc),
        u32(size),
        u32(size),
        u16(nameBytes.length),
        u16(0),               // extra
        u16(0),               // comment
        u16(0),               // disk number
        u16(0),               // internal attrs
        u32(0),               // external attrs
        u32(offset)           // local header offset
      );
      central.push({ header: new Uint8Array(cdir), name: nameBytes });

      offset += localHeader.length + nameBytes.length + data.length;
    }

    const centralStart = offset;
    let centralSize = 0;
    for (const c of central) {
      chunks.push(c.header, c.name);
      centralSize += c.header.length + c.name.length;
    }

    const end = new Uint8Array([].concat(
      u32(0x06054b50),        // end of central dir
      u16(0), u16(0),
      u16(central.length),
      u16(central.length),
      u32(centralSize),
      u32(centralStart),
      u16(0)                  // comment length
    ));
    chunks.push(end);

    return new Blob(chunks, { type: "application/zip" });
  }

  window.ZipWriter = { build, crc32 };
})();
