# RAASTA 6 — Devgarh District

A small, browser-playable vertical-slice prototype inspired by the supplied **RAASTA 6: Open World India** design brief. It focuses on a compact Kheda farm loop rather than attempting the full open world: move around the village, buy seeds, prepare a plot, sow, advance time, harvest, and sell at the mandi. The player look is a lightweight in-game interpretation of the supplied character reference (not a 3D scan or production character asset).

## Run

This is a dependency-free web prototype. From the repository root:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Then open `http://localhost:4173` (or the forwarded preview URL).

## Android APK

A native Android WebView wrapper is in `android-app/`. It loads the same game assets locally and does not require network access or permissions. To build a debug APK with Android SDK 35 and Java 17 installed:

```bash
gradle --no-daemon -p android-app assembleDebug
```

The APK is written to `android-app/app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions builds the APK, uploads the `raasta6-android-debug` artifact, and publishes a directly downloadable copy at `downloads/raasta6-debug.apk` on this branch.

## Controls

- **WASD / arrow keys:** move
- **Shift:** run
- **E / Enter:** interact with the nearby shop, plot, mandi, home, or farm board
- **R:** rest and advance one day
- **I:** inventory · **J:** journal · **Esc:** close a panel / save
- On narrow touch screens, use the on-screen joystick, Run, and E buttons.

## Prototype loop

1. Visit the general store and buy a mustard seed packet.
2. Plough the north plot, then sow the mustard.
3. Rest through two days to grow the crop.
4. Harvest and sell it at the mandi for ₹400.

Progress and player position are saved locally in the browser. This is an early gameplay mock-up, not a Unity build; the illustration, character, and world are canvas-drawn placeholders. There are no third-party game assets or network requirements.
