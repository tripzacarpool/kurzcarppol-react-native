# Android Setup for RaahEasy

## Quick Setup Steps

### Option 1: Install Android Studio (Required for Emulator)

1. **Download Android Studio:**
   - Visit: https://developer.android.com/studio
   - Download and install

2. **Set up Android SDK:**
   - Open Android Studio
   - Go to: File → Settings → Appearance & Behavior → System Settings → Android SDK
   - Note the SDK Location (e.g., C:\Users\YourName\AppData\Local\Android\Sdk)

3. **Add to System PATH (Windows):**

   ```
   - Press Win + X → System → Advanced system settings
   - Click "Environment Variables"
   - Under "System variables", find "Path", click Edit
   - Add these two paths:
     C:\Users\YourName\AppData\Local\Android\Sdk\platform-tools
     C:\Users\YourName\AppData\Local\Android\Sdk\emulator
   - Click OK
   ```

4. **Create Android Emulator:**
   - Open Android Studio
   - Tools → Device Manager (or AVD Manager)
   - Click "Create Device"
   - Select Pixel 5 → Next
   - Download Android 13 (Tiramisu) system image → Next
   - Finish

5. **Start Emulator and Run App:**
   ```bash
   # Start emulator from Android Studio Device Manager
   # Then in your terminal:
   cd d:/kurzcarppol-react-native
   npx expo start
   # Press 'a' for Android
   ```

### Option 2: Use Physical Android Device (Faster Setup)

1. **Install Expo Go:**
   - Open Play Store on your Android phone
   - Search "Expo Go"
   - Install

2. **Enable USB Debugging (optional for USB connection):**
   - Settings → About Phone → Tap "Build Number" 7 times
   - Back → Developer Options → Enable USB Debugging

3. **Run App:**
   ```bash
   cd d:/kurzcarppol-react-native
   npx expo start
   # Scan QR code with Expo Go app
   ```

### Option 3: Use Development Build (What You Downloaded)

The .apk you downloaded from EAS Build can be installed directly:

1. **Transfer APK to Phone:**
   - Email it to yourself or use USB

2. **Install:**
   - Open the .apk file on your phone
   - Allow installation from unknown sources if prompted
   - Install

3. **Run:**
   ```bash
   cd d:/kurzcarppol-react-native
   npx expo start --dev-client
   # Scan QR code with your RaahEasy app
   ```

## Verification

After setup, verify ADB works:

```bash
adb devices
```

Should show your device/emulator.
