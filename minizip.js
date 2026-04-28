// minizip.js — Minimal ZIP file builder in pure JavaScript
// No external dependencies. Creates a valid .zip blob from files.

const MiniZip = (() => {
  function crc32(buf) {
    const table = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c;
      }
      return t;
    })();
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function str2bytes(str) {
    return new TextEncoder().encode(str);
  }

  function u16(n) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  }

  function u32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  }

  function concat(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of arrays) { out.set(a, off); off += a.length; }
    return out;
  }

  function dosDate() {
    const d = new Date();
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    return { date, time };
  }

  return {
    create() {
      const files = [];

      return {
        addFile(name, data /* Uint8Array */) {
          const nameBytes = str2bytes(name);
          const crc = crc32(data);
          const { date, time } = dosDate();
          files.push({ name, nameBytes, data, crc, date, time });
        },

        toBlob() {
          const localHeaders = [];
          const centralDirs = [];
          let offset = 0;

          for (const f of files) {
            // Local file header
            const lh = concat(
              new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // signature
              u16(20),           // version needed
              u16(0),            // flags
              u16(0),            // compression (stored)
              u16(f.time),       // mod time
              u16(f.date),       // mod date
              u32(f.crc),        // crc32
              u32(f.data.length),// compressed size
              u32(f.data.length),// uncompressed size
              u16(f.nameBytes.length), // name length
              u16(0),            // extra length
              f.nameBytes
            );

            localHeaders.push(concat(lh, f.data));

            // Central directory entry
            const cd = concat(
              new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // signature
              u16(20),           // version made by
              u16(20),           // version needed
              u16(0),            // flags
              u16(0),            // compression
              u16(f.time),
              u16(f.date),
              u32(f.crc),
              u32(f.data.length),
              u32(f.data.length),
              u16(f.nameBytes.length),
              u16(0),            // extra
              u16(0),            // comment
              u16(0),            // disk start
              u16(0),            // internal attr
              u32(0),            // external attr
              u32(offset),       // local header offset
              f.nameBytes
            );

            centralDirs.push(cd);
            offset += lh.length + f.data.length;
          }

          const cdData = concat(...centralDirs);
          const cdSize = cdData.length;
          const cdOffset = offset;

          // End of central directory
          const eocd = concat(
            new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // signature
            u16(0),              // disk number
            u16(0),              // disk with cd
            u16(files.length),   // entries on disk
            u16(files.length),   // total entries
            u32(cdSize),         // cd size
            u32(cdOffset),       // cd offset
            u16(0)               // comment length
          );

          const all = concat(...localHeaders, cdData, eocd);
          return new Blob([all], { type: "application/zip" });
        }
      };
    }
  };
})();
