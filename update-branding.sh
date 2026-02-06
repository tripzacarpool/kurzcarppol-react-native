#!/bin/bash

# RaahEasy Branding Update Script
# This script completes the rebranding from TripZa to RaahEasy

echo "🎨 RaahEasy Branding Update"
echo "=========================="
echo ""

# 1. Rename Android package directory (if not already done)
echo "📱 Step 1: Updating Android package structure..."
ANDROID_JAVA_PATH="android/app/src/main/java/com"
if [ -d "$ANDROID_JAVA_PATH/tripza" ]; then
    mv "$ANDROID_JAVA_PATH/tripza" "$ANDROID_JAVA_PATH/raaheasy"
    echo "✓ Renamed package directory: tripza → raaheasy"
else
    echo "✓ Package directory already renamed or using new structure"
fi








# 2. Clean build caches
echo ""
echo "🧹 Step 2: Cleaning build caches..."
rm -rf node_modules/.cache
rm -rf .expo
rm -rf android/build
rm -rf android/app/build
rm -rf ios/build
echo "✓ Build caches cleaned"

# 3. Update package-lock.json
echo ""
echo "📦 Step 3: Updating package-lock.json..."
if [ -f "backend/package-lock.json" ]; then
    sed -i 's/"tripza-backend"/"raaheasy-backend"/g' backend/package-lock.json
    echo "✓ Backend package-lock.json updated"
fi

# 4. Instructi



ons for manual steps
echo ""
echo "✅ Automated updates complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Run: npm install (or yarn install)"
echo "2. Run: cd backend && npm install"
echo "3. Convert SVG icons to PNG (if needed for native apps):"
echo "   - assets/icon.svg → assets/icon.png (1024x1024)"
echo "   - assets/adaptive-icon.svg → assets/adaptive-icon.png (1024x1024)"
echo "4. Run: npx expo prebuild --clean"
echo "5. For Android: npx expo run:android"
echo "6. For iOS: npx expo run:ios"
echo ""
echo "🎯 Branding Updated:"
echo "  App Name: RaahEasy"
echo "  Package: com.raaheasy.app"
echo "  Scheme: raaheasyapp://"
echo "  Logo: 'Re' in gold gradient"
echo ""
echo "💡 See assets/ICON_README.md for icon details"
