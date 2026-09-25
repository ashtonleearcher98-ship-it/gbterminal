import { QRCode, QRErrorCorrectLevel } from './vendor/qr-core.js';

// Both symbols carry the same 128-bit token as BLE and manual entry.
// Neither symbol carries an amount, card number, account ID, or authority to debit.
export function paymentPayload(token) {
  if (!/^[0-9a-f]{32}$/i.test(token)) throw new Error('Invalid payment token');
  return `GW1-${token.toUpperCase()}`;
}

export function qrSvg(payload) {
  if (!/^GW1-[0-9A-F]{32}$/.test(payload)) throw new Error('Invalid payment payload');
  const qr = new QRCode(0, QRErrorCorrectLevel.M);
  qr.addData(payload);
  qr.make();
  const n = qr.getModuleCount(), size = n + 8;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="white" d="M0 0h${size}v${size}H0z"/><path fill="black" d="`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) svg += `M${x+4} ${y+4}h1v1h-1z`;
  return svg + '"/></svg>';
}

// Code 39 narrow/wide patterns (9 bars/spaces each), with the standard *
// start/stop character. Pattern values align with the Code 39 specification.
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';
const encodings = [
  0x034,0x121,0x061,0x160,0x031,0x130,0x070,0x025,0x124,0x064,
  0x109,0x049,0x148,0x019,0x118,0x058,0x00D,0x10C,0x04C,0x01C,
  0x103,0x043,0x142,0x013,0x112,0x052,0x007,0x106,0x046,0x016,
  0x181,0x0C1,0x1C0,0x091,0x190,0x0D0,0x085,0x184,0x0C4,0x0A8,
  0x0A2,0x08A,0x02A
];
export function code39Svg(payload) {
  if (!/^GW1-[0-9A-F]{32}$/.test(payload)) throw new Error('Invalid payment payload');
  const chars = `*${payload}*`;
  let x = 14, bars = '';
  for (const char of chars) {
    const code = char === '*' ? 0x094 : encodings[alphabet.indexOf(char)];
    if (code === undefined) throw new Error('Unsupported barcode character');
    for (let i = 0; i < 9; i++) {
      const width = (code >> (8 - i)) & 1 ? 3 : 1;
      if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${width}" height="64"/>`;
      x += width;
    }
    x++; // Inter-character gap.
  }
  const width = x + 13;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 64" shape-rendering="crispEdges"><path fill="white" d="M0 0h${width}v64H0z"/><g fill="black">${bars}</g></svg>`;
}

export function svgData(svg) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
