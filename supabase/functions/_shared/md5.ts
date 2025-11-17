/*
 * MD5 implementation in TypeScript.
 * Copyright (c) 2024 Zozodoank
 * Released under the MIT license.
 *
 * This is a dependency-free implementation to ensure compatibility
 * with constrained environments like Supabase Edge Functions where
 * external module resolution can be problematic.
 */
// Left-rotate a 32-bit number
function rotl(x, n) {
    return (x << n) | (x >>> (32 - n));
}
// Convert a string to a sequence of little-endian words
function stringToWords(str) {
    const len = str.length;
    const words = [];
    for (let i = 0; i < len; i += 4) {
        words[i >> 2] = str.charCodeAt(i) |
            (str.charCodeAt(i + 1) << 8) |
            (str.charCodeAt(i + 2) << 16) |
            (str.charCodeAt(i + 3) << 24);
    }
    return words;
}
// Constants for MD5 transformations
const S = [
    [7, 12, 17, 22],
    [5, 9, 14, 20],
    [4, 11, 16, 23],
    [6, 10, 15, 21]
];
// MD5 basic functions
const F = (x, y, z) => (x & y) | (~x & z);
const G = (x, y, z) => (x & z) | (y & ~z);
const H = (x, y, z) => x ^ y ^ z;
const I = (x, y, z) => y ^ (x | ~z);
const FF = (a, b, c, d, x, s, ac) => rotl((a + F(b, c, d) + x + ac), s) + b;
const GG = (a, b, c, d, x, s, ac) => rotl((a + G(b, c, d) + x + ac), s) + b;
const HH = (a, b, c, d, x, s, ac) => rotl((a + H(b, c, d) + x + ac), s) + b;
const II = (a, b, c, d, x, s, ac) => rotl((a + I(b, c, d) + x + ac), s) + b;
export function md5(str) {
    const T = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
        0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
        0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
        0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
        0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
        0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
        0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
        0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
        0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
        0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
        0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
        0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
        0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
        0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
        0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
        0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
    ];
    const x = stringToWords(str);
    const len = str.length * 8;
    x[len >> 5] |= 0x80 << (len % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;
    let a = 0x67452301;
    let b = 0xefcdab89;
    let c = 0x98badcfe;
    let d = 0x10325476;
    for (let i = 0; i < x.length; i += 16) {
        const AA = a, BB = b, CC = c, DD = d;
        a = FF(a, b, c, d, x[i + 0], S[0][0], T[0]);
        d = FF(d, a, b, c, x[i + 1], S[0][1], T[1]);
        c = FF(c, d, a, b, x[i + 2], S[0][2], T[2]);
        b = FF(b, c, d, a, x[i + 3], S[0][3], T[3]);
        a = FF(a, b, c, d, x[i + 4], S[0][0], T[4]);
        d = FF(d, a, b, c, x[i + 5], S[0][1], T[5]);
        c = FF(c, d, a, b, x[i + 6], S[0][2], T[6]);
        b = FF(b, c, d, a, x[i + 7], S[0][3], T[7]);
        a = FF(a, b, c, d, x[i + 8], S[0][0], T[8]);
        d = FF(d, a, b, c, x[i + 9], S[0][1], T[9]);
        c = FF(c, d, a, b, x[i + 10], S[0][2], T[10]);
        b = FF(b, c, d, a, x[i + 11], S[0][3], T[11]);
        a = FF(a, b, c, d, x[i + 12], S[0][0], T[12]);
        d = FF(d, a, b, c, x[i + 13], S[0][1], T[13]);
        c = FF(c, d, a, b, x[i + 14], S[0][2], T[14]);
        b = FF(b, c, d, a, x[i + 15], S[0][3], T[15]);
        a = GG(a, b, c, d, x[i + 1], S[1][0], T[16]);
        d = GG(d, a, b, c, x[i + 6], S[1][1], T[17]);
        c = GG(c, d, a, b, x[i + 11], S[1][2], T[18]);
        b = GG(b, c, d, a, x[i + 0], S[1][3], T[19]);
        a = GG(a, b, c, d, x[i + 5], S[1][0], T[20]);
        d = GG(d, a, b, c, x[i + 10], S[1][1], T[21]);
        c = GG(c, d, a, b, x[i + 15], S[1][2], T[22]);
        b = GG(b, c, d, a, x[i + 4], S[1][3], T[23]);
        a = GG(a, b, c, d, x[i + 9], S[1][0], T[24]);
        d = GG(d, a, b, c, x[i + 14], S[1][1], T[25]);
        c = GG(c, d, a, b, x[i + 3], S[1][2], T[26]);
        b = GG(b, c, d, a, x[i + 8], S[1][3], T[27]);
        a = GG(a, b, c, d, x[i + 13], S[1][0], T[28]);
        d = GG(d, a, b, c, x[i + 2], S[1][1], T[29]);
        c = GG(c, d, a, b, x[i + 7], S[1][2], T[30]);
        b = GG(b, c, d, a, x[i + 12], S[1][3], T[31]);
        a = HH(a, b, c, d, x[i + 5], S[2][0], T[32]);
        d = HH(d, a, b, c, x[i + 8], S[2][1], T[33]);
        c = HH(c, d, a, b, x[i + 11], S[2][2], T[34]);
        b = HH(b, c, d, a, x[i + 14], S[2][3], T[35]);
        a = HH(a, b, c, d, x[i + 1], S[2][0], T[36]);
        d = HH(d, a, b, c, x[i + 4], S[2][1], T[37]);
        c = HH(c, d, a, b, x[i + 7], S[2][2], T[38]);
        b = HH(b, c, d, a, x[i + 10], S[2][3], T[39]);
        a = HH(a, b, c, d, x[i + 13], S[2][0], T[40]);
        d = HH(d, a, b, c, x[i + 0], S[2][1], T[41]);
        c = HH(c, d, a, b, x[i + 3], S[2][2], T[42]);
        b = HH(b, c, d, a, x[i + 6], S[2][3], T[43]);
        a = HH(a, b, c, d, x[i + 9], S[2][0], T[44]);
        d = HH(d, a, b, c, x[i + 12], S[2][1], T[45]);
        c = HH(c, d, a, b, x[i + 15], S[2][2], T[46]);
        b = HH(b, c, d, a, x[i + 2], S[2][3], T[47]);
        a = II(a, b, c, d, x[i + 0], S[3][0], T[48]);
        d = II(d, a, b, c, x[i + 7], S[3][1], T[49]);
        c = II(c, d, a, b, x[i + 14], S[3][2], T[50]);
        b = II(b, c, d, a, x[i + 5], S[3][3], T[51]);
        a = II(a, b, c, d, x[i + 12], S[3][0], T[52]);
        d = II(d, a, b, c, x[i + 3], S[3][1], T[53]);
        c = II(c, d, a, b, x[i + 10], S[3][2], T[54]);
        b = II(b, c, d, a, x[i + 1], S[3][3], T[55]);
        a = II(a, b, c, d, x[i + 8], S[3][0], T[56]);
        d = II(d, a, b, c, x[i + 15], S[3][1], T[57]);
        c = II(c, d, a, b, x[i + 6], S[3][2], T[58]);
        b = II(b, c, d, a, x[i + 13], S[3][3], T[59]);
        a = II(a, b, c, d, x[i + 4], S[3][0], T[60]);
        d = II(d, a, b, c, x[i + 11], S[3][1], T[61]);
        c = II(c, d, a, b, x[i + 2], S[3][2], T[62]);
        b = II(b, c, d, a, x[i + 9], S[3][3], T[63]);
        a = (a + AA) | 0;
        b = (b + BB) | 0;
        c = (c + CC) | 0;
        d = (d + DD) | 0;
    }
    const toHex = (n) => {
        let s = "", t;
        for (let i = 0; i < 4; i++) {
            t = (n >> (i * 8)) & 0xff;
            s += ((t < 16) ? "0" : "") + t.toString(16);
        }
        return s;
    };
    return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}
