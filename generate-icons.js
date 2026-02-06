// Script to generate RaahEasy app icons with "Re" logo
// Run with: node generate-icons.js

const fs = require('fs');
const path = require('path');

// SVG template for the "Re" logo icon
const createIconSVG = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background with gradient -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#D4AF37;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#C5A028;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bgGradient)"/>
  
  <!-- Re text with modern styling -->
  <text 
    x="50%" 
    y="52%" 
    font-family="'SF Pro Display', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" 
    font-size="${size * 0.42}" 
    font-weight="800" 
    fill="#0A0A0A" 
    text-anchor="middle" 
    dominant-baseline="middle"
    letter-spacing="${size * -0.02}"
    filter="url(#shadow)"
  >Re</text>
  
  <!-- Subtle accent line -->
  <rect x="${size * 0.2}" y="${size * 0.78}" width="${size * 0.6}" height="${size * 0.02}" rx="${size * 0.01}" fill="#0A0A0A" opacity="0.3"/>
</svg>`;

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate icons
const icons = [
  { name: 'icon.png', size: 1024 },
  { name: 'adaptive-icon.png', size: 1024 },
  { name: 'favicon.png', size: 48 },
];

icons.forEach((icon) => {
  const svgContent = createIconSVG(icon.size);
  const svgPath = path.join(assetsDir, icon.name.replace('.png', '.svg'));
  fs.writeFileSync(svgPath, svgContent);
  console.log(
    `✓ Created ${icon.name.replace('.png', '.svg')} (${icon.size}x${icon.size})`,
  );
});

console.log('\n📱 RaahEasy icon SVGs generated!');
console.log('\nNext steps:');
console.log('1. Convert SVG files to PNG using an online tool or:');
console.log('   - icon.svg → icon.png (1024x1024)');
console.log('   - adaptive-icon.svg → adaptive-icon.png (1024x1024)');
console.log('   - favicon.svg → favicon.png (48x48)');
console.log('2. Or use these SVG files directly in web version');
console.log('3. Run: npx expo prebuild --clean');
console.log('4. Rebuild your app');
