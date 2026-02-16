
const fs = require('fs');
const path = require('path');

function createBMP(width, height, color, filename) {
    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const fileSize = 54 + rowSize * height;
    const buffer = Buffer.alloc(fileSize);

    // BMP Header
    buffer.write('BM', 0);
    buffer.writeUInt32LE(fileSize, 2);
    buffer.writeUInt32LE(54, 10); // Offset to pixel data

    // DIB Header
    buffer.writeUInt32LE(40, 14); // Header size
    buffer.writeInt32LE(width, 18);
    buffer.writeInt32LE(height, 22); // Top-down
    buffer.writeUInt16LE(1, 26); // Planes
    buffer.writeUInt16LE(24, 28); // Bit count (24-bit)
    buffer.writeUInt32LE(0, 30); // Compression (BI_RGB)
    buffer.writeUInt32LE(rowSize * height, 34); // Image size

    // Pixel Data
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const offset = 54 + (height - 1 - y) * rowSize + x * 3;
            buffer.writeUInt8(b, offset);
            buffer.writeUInt8(g, offset + 1);
            buffer.writeUInt8(r, offset + 2);
        }
    }

    fs.writeFileSync(filename, buffer);
    console.log(`Created ${filename} (${width}x${height})`);
}

const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
    console.error(`Build dir not found: ${buildDir}`);
    // Create it if missing (unlikely in this existing project)
    fs.mkdirSync(buildDir);
}

// Dark Blue-ish Black #060912 (matching app background)
const color = 0x060912;

createBMP(164, 314, color, path.join(buildDir, 'installerSidebar.bmp'));
createBMP(150, 57, color, path.join(buildDir, 'installerHeader.bmp'));
