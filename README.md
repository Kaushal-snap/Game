# RAASTA 6 — Devgarh District

A small **3D third-person Android/WebGL vertical slice** for the fictional Devgarh District. This is an original Indian village/farm game concept—not a recreation of GTA characters, maps, missions, branding, or assets. The supplied front portrait is cropped and used as a face texture on Arjun’s 3D head; the body, clothes, animation, and village are procedural prototype assets, not a scanned/production character model.

## Play the browser build

```bash
npm ci
npm run dev
```

Open the forwarded preview URL (the development server binds to `0.0.0.0:4173`). The release/offline bundle is generated in `dist/` with `npm run build`.

## Controls

- **WASD / arrow keys:** move relative to the follow camera
- **Shift:** run
- **Drag:** rotate the third-person camera
- **E / Enter:** interact with the nearby shop, fields, mandi, or farmhouse
- **R:** rest and advance a day · **I:** bag · **J:** journal · **Esc:** save/close
- Touch screens: left virtual stick, drag the world to look, and use the Run/E buttons.
- Tap **HIGH** to cycle Balanced, High, and Ultra render settings. The best stable setting varies by phone and heat.

## First farm loop

Buy mustard seeds at the general store, plough and sow the north field, rest through two days, harvest, then sell the crop at the mandi. State is saved locally and the game runs without a network connection.

## Android APK

The Android WebView wrapper loads the local bundled WebGL game offline. A debug APK is produced by the `Build Android APK` GitHub Actions workflow after each push to an `arena/*` branch. The workflow publishes it at `downloads/raasta6-debug.apk` and also uploads a 14-day Actions artifact. Install the APK on Android and allow installs from the source you downloaded it with if prompted.

The renderer uses PBR-style materials, shadows, a day/night light cycle, instanced vegetation, and scalable resolution/shadow settings. **Ultra is a best-effort preset, not a promise of console-level graphics or stable frame rate on every Android device.** Profile the APK on the target phone before adding larger maps or more simulation systems.
