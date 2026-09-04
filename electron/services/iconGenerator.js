const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
function crc32(buf) {
    let table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        table[i] = c;
    }

    let c = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
        c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xFF];
    }
    return (c ^ (-1)) >>> 0;
}

function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePngBuffer(width, height, pixelFn) {
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    // IHDR
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData.writeUInt8(8, 8); // 8-bit
    ihdrData.writeUInt8(6, 9); // RGBA
    ihdrData.writeUInt8(0, 10);
    ihdrData.writeUInt8(0, 11);
    ihdrData.writeUInt8(0, 12);
    const ihdrChunk = createChunk('IHDR', ihdrData);

    // IDAT raw scanlines
    const rawData = Buffer.alloc(height * (1 + width * 4));
    let offset = 0;

    for (let y = 0; y < height; y++) {
        rawData[offset++] = 0; // Filter: None
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = pixelFn(x, y, width, height);
            rawData[offset++] = Math.max(0, Math.min(255, Math.round(r)));
            rawData[offset++] = Math.max(0, Math.min(255, Math.round(g)));
            rawData[offset++] = Math.max(0, Math.min(255, Math.round(b)));
            rawData[offset++] = Math.max(0, Math.min(255, Math.round(a)));
        }
    }

    const compressed = zlib.deflateSync(rawData);
    const idatChunk = createChunk('IDAT', compressed);
    const iendChunk = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Distance to rounded rectangle
function distToRoundRect(x, y, rx, ry, rw, rh, rad) {
    const cx = Math.max(rx + rad, Math.min(x, rx + rw - rad));
    const cy = Math.max(ry + rad, Math.min(y, ry + rh - rad));
    const dx = x - cx;
    const dy = y - cy;
    return Math.sqrt(dx * dx + dy * dy);
}

// Draw Main App Icon (256x256, 64x64, 32x32, 16x16)
function appIconPixel(x, y, w, h) {
    const nx = x / w;
    const ny = y / h;
    
    // Background rounded rectangle
    const pad = w * 0.08;
    const radius = w * 0.22;
    const rw = w - pad * 2;
    const rh = h - pad * 2;

    const insideX = x >= pad && x <= pad + rw;
    const insideY = y >= pad && y <= pad + rh;

    let bgAlpha = 0;
    if (insideX && insideY) {
        // Corners
        const isTopLeft = x < pad + radius && y < pad + radius;
        const isTopRight = x > pad + rw - radius && y < pad + radius;
        const isBottomLeft = x < pad + radius && y > pad + rh - radius;
        const isBottomRight = x > pad + rw - radius && y > pad + rh - radius;

        if (isTopLeft || isTopRight || isBottomLeft || isBottomRight) {
            const d = distToRoundRect(x, y, pad, pad, rw, rh, radius);
            if (d <= radius) {
                bgAlpha = Math.min(1, Math.max(0, radius - d + 0.8));
            }
        } else {
            bgAlpha = 1;
        }
    }

    if (bgAlpha === 0) {
        return [0, 0, 0, 0];
    }

    // Gradient Background (Indigo #4f46e5 to Cyan #06b6d4)
    const t = (nx + ny) / 2;
    let r = (1 - t) * 79 + t * 6;
    let g = (1 - t) * 70 + t * 182;
    let b = (1 - t) * 229 + t * 212;

    // Outer Border Glow
    const edgeDist = Math.min(x - pad, pad + rw - x, y - pad, pad + rh - y);
    if (edgeDist < w * 0.03 && edgeDist >= 0) {
        r += 40; g += 40; b += 40;
    }

    // Foreground Elements: 3 Bar charts + Trendline
    // Bar 1 (left)
    const b1x = w * 0.25, b1w = w * 0.12, b1y = h * 0.55, b1h = h * 0.25;
    // Bar 2 (middle)
    const b2x = w * 0.44, b2w = w * 0.12, b2y = h * 0.42, b2h = h * 0.38;
    // Bar 3 (right)
    const b3x = w * 0.63, b3w = w * 0.12, b3y = h * 0.28, b3h = h * 0.52;

    const inBar1 = x >= b1x && x <= b1x + b1w && y >= b1y && y <= b1y + b1h;
    const inBar2 = x >= b2x && x <= b2x + b2w && y >= b2y && y <= b2y + b2h;
    const inBar3 = x >= b3x && x <= b3x + b3w && y >= b3y && y <= b3y + b3h;

    if (inBar1 || inBar2 || inBar3) {
        // Glowing White Bars with slight cyan tint
        return [255, 255, 255, bgAlpha * 255];
    }

    // Upward Trend Arrow / Line from (0.24, 0.50) to (0.76, 0.22)
    const p1x = w * 0.26, p1y = h * 0.52;
    const p2x = w * 0.50, p2y = h * 0.36;
    const p3x = w * 0.74, p3y = h * 0.22;

    const d1 = distToSegment(x, y, p1x, p1y, p2x, p2y);
    const d2 = distToSegment(x, y, p2x, p2y, p3x, p3y);
    const lineThickness = Math.max(1.5, w * 0.035);

    if (d1 <= lineThickness || d2 <= lineThickness) {
        return [56, 189, 248, bgAlpha * 255]; // Vivid Sky Blue #38bdf8
    }

    // Dot at p3
    const dotDist = Math.sqrt((x - p3x) * (x - p3x) + (y - p3y) * (y - p3y));
    if (dotDist <= lineThickness * 1.8) {
        return [16, 185, 129, bgAlpha * 255]; // Emerald Green dot
    }

    return [r, g, b, bgAlpha * 255];
}

function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
}

// Draw Tray Icon (Crisp High-Contrast 32x32)
function trayIconPixel(x, y, w, h) {
    const pad = w * 0.06;
    const radius = w * 0.24;
    const rw = w - pad * 2;
    const rh = h - pad * 2;

    const insideX = x >= pad && x <= pad + rw;
    const insideY = y >= pad && y <= pad + rh;

    let bgAlpha = 0;
    if (insideX && insideY) {
        const isTopLeft = x < pad + radius && y < pad + radius;
        const isTopRight = x > pad + rw - radius && y < pad + radius;
        const isBottomLeft = x < pad + radius && y > pad + rh - radius;
        const isBottomRight = x > pad + rw - radius && y > pad + rh - radius;

        if (isTopLeft || isTopRight || isBottomLeft || isBottomRight) {
            const d = distToRoundRect(x, y, pad, pad, rw, rh, radius);
            if (d <= radius) {
                bgAlpha = Math.min(1, Math.max(0, radius - d + 0.8));
            }
        } else {
            bgAlpha = 1;
        }
    }

    if (bgAlpha === 0) return [0, 0, 0, 0];

    // High contrast vivid Blue gradient for System Tray
    const t = (x + y) / (w + h);
    const r = (1 - t) * 79 + t * 6;
    const g = (1 - t) * 70 + t * 182;
    const b = (1 - t) * 229 + t * 240;

    // Bars
    const b1x = w * 0.24, b1w = w * 0.14, b1y = h * 0.54, b1h = h * 0.28;
    const b2x = w * 0.43, b2w = w * 0.14, b2y = h * 0.40, b2h = h * 0.42;
    const b3x = w * 0.62, b3w = w * 0.14, b3y = h * 0.26, b3h = h * 0.56;

    if ((x >= b1x && x <= b1x + b1w && y >= b1y && y <= b1y + b1h) ||
        (x >= b2x && x <= b2x + b2w && y >= b2y && y <= b2y + b2h) ||
        (x >= b3x && x <= b3x + b3w && y >= b3y && y <= b3y + b3h)) {
        return [255, 255, 255, bgAlpha * 255];
    }

    // Trend Dot
    const p3x = w * 0.72, p3y = h * 0.22;
    const dotDist = Math.sqrt((x - p3x) * (x - p3x) + (y - p3y) * (y - p3y));
    if (dotDist <= w * 0.09) {
        return [56, 189, 248, bgAlpha * 255];
    }

    return [r, g, b, bgAlpha * 255];
}

// Convert PNG buffers into a valid Windows .ico file
function createIco(pngBuffers) {
    const count = pngBuffers.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type 1 = ICO
    header.writeUInt16LE(count, 4); // Number of images

    let offset = 6 + count * 16;
    const dirEntries = [];
    const imageBodies = [];

    for (const { width, height, buffer } of pngBuffers) {
        const entry = Buffer.alloc(16);
        entry.writeUInt8(width === 256 ? 0 : width, 0);
        entry.writeUInt8(height === 256 ? 0 : height, 1);
        entry.writeUInt8(0, 2); // Color palette
        entry.writeUInt8(0, 3); // Reserved
        entry.writeUInt16LE(1, 4); // Color planes
        entry.writeUInt16LE(32, 6); // Bits per pixel
        entry.writeUInt32LE(buffer.length, 8); // Size of image data
        entry.writeUInt32LE(offset, 12); // Offset of image data

        dirEntries.push(entry);
        imageBodies.push(buffer);
        offset += buffer.length;
    }

    return Buffer.concat([header, ...dirEntries, ...imageBodies]);
}

function buildAllIcons() {
    const assetsDir = path.join(__dirname, '../../assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const png256 = generatePngBuffer(256, 256, appIconPixel);
    const png64 = generatePngBuffer(64, 64, appIconPixel);
    const png32 = generatePngBuffer(32, 32, appIconPixel);
    const png16 = generatePngBuffer(16, 16, appIconPixel);
    const trayPng = generatePngBuffer(32, 32, trayIconPixel);

    const ico = createIco([
        { width: 256, height: 256, buffer: png256 },
        { width: 64, height: 64, buffer: png64 },
        { width: 32, height: 32, buffer: png32 },
        { width: 16, height: 16, buffer: png16 }
    ]);

    fs.writeFileSync(path.join(assetsDir, 'icon.png'), png256);
    fs.writeFileSync(path.join(assetsDir, 'icon-64.png'), png64);
    fs.writeFileSync(path.join(assetsDir, 'icon-32.png'), png32);
    fs.writeFileSync(path.join(assetsDir, 'icon-16.png'), png16);
    fs.writeFileSync(path.join(assetsDir, 'tray.png'), trayPng);
    fs.writeFileSync(path.join(assetsDir, 'icon.ico'), ico);

    // Also copy to src/assets for in-app or HTML references if needed
    const srcAssetsDir = path.join(__dirname, '../../src/assets');
    if (fs.existsSync(srcAssetsDir)) {
        try {
            fs.writeFileSync(path.join(srcAssetsDir, 'icon.png'), png256);
            fs.writeFileSync(path.join(srcAssetsDir, 'tray.png'), trayPng);
        } catch (_) {}
    }

    const iconPath = path.join(assetsDir, 'icon.png');
    const trayPath = path.join(assetsDir, 'tray.png');
    const iconIcoPath = path.join(assetsDir, 'icon.ico');

    return { iconPath, trayPath, iconIcoPath };
}

function ensureIcons() {
    const assetsDir = path.join(__dirname, '../../assets');
    const iconPath = path.join(assetsDir, 'icon.png');
    const trayPath = path.join(assetsDir, 'tray.png');
    const iconIcoPath = path.join(assetsDir, 'icon.ico');

    // Always ensure fresh valid icons with proper sizing
    if (!fs.existsSync(iconPath) || !fs.existsSync(trayPath) || !fs.existsSync(iconIcoPath)) {
        return buildAllIcons();
    }

    return { iconPath, trayPath, iconIcoPath };
}

module.exports = { ensureIcons, buildAllIcons };
