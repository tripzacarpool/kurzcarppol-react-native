# RaahEasy App Icons

## 🎨 Brand Identity

**App Name:** RaahEasy  
**Logo:** "Re" in bold modern typography  
**Colors:**

- Primary Gold: `#D4AF37`
- Dark Background: `#0A0A0A`
- Gradient: Gold (#D4AF37) to Darker Gold (#C5A028)

## 📱 Icon Files Generated

### SVG Files (Vector - Scalable)

- `icon.svg` - Main app icon (1024x1024) with rounded corners
- `adaptive-icon.svg` - Android adaptive icon (1024x1024) no rounded corners
- `favicon.svg` - Web favicon (48x48)

### Usage

The SVG files are ready to use and will work for web platforms. For iOS and Android, you may need to convert them to PNG format.

## 🔄 Converting SVG to PNG (if needed)

### Option 1: Online Tools

1. Go to https://cloudconvert.com/svg-to-png
2. Upload each SVG file
3. Convert at these sizes:
   - `icon.svg` → `icon.png` (1024x1024)
   - `adaptive-icon.svg` → `adaptive-icon.png` (1024x1024)
   - `favicon.svg` → `favicon.png` (48x48)
4. Replace the files in the `assets/` folder

### Option 2: Using ImageMagick (CLI)

```bash
# Install ImageMagick first
# brew install imagemagick (macOS)
# apt-get install imagemagick (Linux)

# Convert icons
cd assets
magick icon.svg -resize 1024x1024 icon.png
magick adaptive-icon.svg -resize 1024x1024 adaptive-icon.png
magick favicon.svg -resize 48x48 favicon.png
```

### Option 3: Use Node.js Script

```bash
node generate-icons.js
# Then use an online converter or ImageMagick
```

## 🚀 After Icon Update

1. **Clean build cache:**

   ```bash
   npx expo prebuild --clean
   ```

2. **For Android:**

   ```bash
   cd android
   ./gradlew clean
   cd ..
   npx expo run:android
   ```

3. **For iOS:**

   ```bash
   cd ios
   rm -rf build
   pod install
   cd ..
   npx expo run:ios
   ```

4. **For Web:**
   ```bash
   npx expo export:web
   ```

## 📝 Branding Updates Made

- ✅ App name changed to "RaahEasy"
- ✅ Package name: `com.raaheasy.app`
- ✅ URL scheme: `raaheasyapp://`
- ✅ App slug: `raaheasy`
- ✅ Backend package: `raaheasy-backend`
- ✅ Icon created with "Re" logo
- ✅ Favicon added for web
- ✅ Gold gradient brand colors applied

## 🎯 Design Philosophy

The "Re" logo represents:

- **R** - Raah (Path/Way in Hindi/Urdu)
- **e** - Easy (Simple, hassle-free)
- Bold, modern typography for trust and reliability
- Gold color symbolizes premium service and value
- Clean, minimalist design for instant recognition
