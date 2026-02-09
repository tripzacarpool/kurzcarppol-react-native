# Running App on PC Emulator + Physical Device

## Quick Setup

### 1. Install Android Studio

- Download: https://developer.android.com/studio
- Install with default settings (includes Android SDK and AVD)

### 2. Set Environment Variables (Windows)

Add to System Environment Variables:

```
ANDROID_HOME = C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk
```

Add to Path:

```
%ANDROID_HOME%\emulator
%ANDROID_HOME%\platform-tools
```

### 3. Create Emulator via Command Line

```bash
# List available system images
sdkmanager --list

# Install Android 13 system image
sdkmanager "system-images;android-33;google_apis;x86_64"

# Create AVD
avdmanager create avd -n Pixel_5_API_33 -k "system-images;android-33;google_apis;x86_64" -d "pixel_5"

# List created AVDs
emulator -list-avds
```

### 4. Start Emulator

```bash
# Start emulator
emulator -avd Pixel_5_API_33

# Or with GPU acceleration
emulator -avd Pixel_5_API_33 -gpu host
```

### 5. Run Your App

**Terminal 1 - Backend:**

```bash
cd backend
npm run dev
```

**Terminal 2 - Expo:**

```bash
npx expo start
# Press 'a' for Android emulator
# Scan QR code on physical device
```

## Testing Both Accounts

1. **PC Emulator**: Login as **Driver** (ridepartner@gmail.com)
2. **Physical Device**: Login as **Passenger** (your passenger account)

## Troubleshooting

### Emulator won't start

- Enable virtualization in BIOS (Intel VT-x or AMD-V)
- Install HAXM: `sdkmanager "extras;intel;Hardware_Accelerated_Execution_Manager"`

### App won't connect to backend

- Make sure backend is running on `http://localhost:5000`
- Emulator uses `10.0.2.2` to access host's localhost
- Physical device needs your PC's IP address (e.g., `192.168.0.102:5000`)

### Check current backend URL in app

Look at `lib/api.ts` - it should detect if running on emulator:

```typescript
const API_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:5000' // Emulator
    : 'http://192.168.0.102:5000'; // Physical device
```

## Quick Commands

```bash
# Check if emulator is connected
adb devices

# Restart expo
npx expo start --clear

# View logs
# Emulator: See logs in terminal
# Physical: Shake device → Show Dev Menu → Remote JS Debugging
```
