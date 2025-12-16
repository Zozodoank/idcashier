/*
 * A dependency-free, standard-compliant MD5 implementation for TypeScript.
 * This version is self-contained and verified to avoid bundler issues
 * in Supabase Edge Functions (Deno).
 *
 * Based on the public domain implementation by Paul Johnston.
 */

// Private helper functions
function safe_add(x: number, y: number): number {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
}

function bit_rol(num: number, cnt: number): number {
  return (num << cnt) | (num >>> (32 - cnt));
}

// These functions implement the four basic operations of MD5.
function md5_cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
}
function md5_ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return md5_cmn((b & c) | (~b & d), a, b, x, s, t);
}
function md5_gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return md5_cmn((b & d) | (c & ~d), a, b, x, s, t);
}
function md5_hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return md5_cmn(c ^ (b | ~d), a, b, x, s, t);
}

// Calculate the MD5 of an array of little-endian words, and a bit length.
function binl_md5(x: number[], len: number): number[] {
  // Ensure the array is large enough for padding and length
  const n = (((len + 64) >>> 9) << 4) + 15;
  while (x.length <= n) x.push(0);

  /* append padding */
  x[len >> 5] |= 0x80 << (len % 32);
  x[n - 1] = len;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const old_a = a;
    const old_b = b;
    const old_c = c;
    const old_d = d;

    // Round 1
    a = md5_ff(a, b, c, d, x[i + 0], 7, -680876936);
    d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);

    // Round 2
    a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5_gg(b, c, d, a, x[i + 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

    // Round 3
    a = md5_hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5_hh(d, a, b, c, x[i + 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651);

    // Round 4
    a = md5_ii(a, b, c, d, x[i + 0], 6, -198630844);
    d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551);

    a = safe_add(a, old_a);
    b = safe_add(b, old_b);
    c = safe_add(c, old_c);
    d = safe_add(d, old_d);
  }
  return [a, b, c, d];
}

// Convert string (UTF-8) to little-endian words
function str_to_binl(str: string): number[] {
  const bytes = new TextEncoder().encode(str);
  const bin: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    bin[i >> 2] = (bin[i >> 2] | 0) | (bytes[i] << ((i % 4) * 8));
  }
  return bin;
}

// Convert little-endian word array to hex string
function binl_to_hex(binarray: number[]): string {
  const hex_tab = "0123456789abcdef";
  let str = "";
  for (let i = 0; i < binarray.length * 4; i++) {
    const byte = (binarray[i >> 2] >>> ((i % 4) * 8)) & 0xff;
    str += hex_tab.charAt((byte >>> 4) & 0x0f) + hex_tab.charAt(byte & 0x0f);
  }
  return str;
}

export function md5(str: string): string {
  // Use UTF-8 byte length for correct bit length
  const utf8Bytes = new TextEncoder().encode(str);
  return binl_to_hex(binl_md5(str_to_binl(str), utf8Bytes.length * 8));
}