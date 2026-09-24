# esp-ble-sdk

[![npm version](https://img.shields.io/npm/v/esp-ble-sdk.svg)](https://www.npmjs.com/package/esp-ble-sdk)
[![license](https://img.shields.io/npm/l/esp-ble-sdk.svg)](https://github.com/naseem-shawarba/esp-ble-sdk/blob/main/LICENSE)

A typed SDK for building web apps that talk directly to an ESP32 over Bluetooth
Low Energy. No phone app, no cloud account, no native code. A small
Arduino/ESP-IDF firmware library on one side, a TypeScript client on the
other, both already speaking the same protocol so you're not hand-matching
UUIDs and parsing raw byte arrays every time.

## Why this exists

Every ESP32 + Web Bluetooth tutorial has you doing the same thing from
scratch: define a GATT service, define characteristics, subscribe to
notifications, parse raw bytes, write raw bytes back. It works. You just end
up rewriting it for every project, firmware side and JS side both.

So this SDK picks one protocol and sticks to it: a telemetry channel
(device → browser) and a command channel (browser → device), both just
small JSON payloads, with a typed client for each side.

## What's in here

```
esp-ble-sdk/
├── src/                              TypeScript client library
│   ├── ESPBLEDevice.ts               Core class: connect, subscribe, send commands
│   ├── react/useESPBLEDevice.ts      Optional React hook wrapper
│   ├── types.ts
│   └── index.ts
├── firmware/                         Arduino/ESP-IDF companion library
│   ├── ESPBLESDK.h
│   ├── ESPBLESDK.cpp
│   └── examples/SmartHomeExample/SmartHomeExample.ino
└── examples/
    ├── vanilla-web-demo/index.html   Single-file demo, no build step
    └── react-web-demo/               Vite + React demo (npm install && npm run dev)
```

## Installation

- **JS/TS client:** `npm install esp-ble-sdk`
- **Firmware library:** search "ESPBLESDK" in the Arduino Library Manager
  (Sketch → Include Library → Manage Libraries), or add it via PlatformIO's
  registry.

## Quick start

### 1. Flash the ESP32

Requires the ESP32 Arduino core (`BLEDevice`, `BLE2902`, etc. — installed by
default with the ESP32 board package) and [ArduinoJson](https://arduinojson.org/).
Install ESPBLESDK via the Arduino Library Manager (see above), or copy
`firmware/ESPBLESDK.h` and `firmware/ESPBLESDK.cpp` into your sketch folder
directly, then:

```cpp
#include "ESPBLESDK.h"

ESPBLESDK ble;
bool armed = false;
float brightness = 0.0f; // 0.0–1.0

void handleCommand(const String& cmd, JsonObject payload) {
  if (cmd == "armAlarm") armed = true;
  else if (cmd == "disarmAlarm") armed = false;
  else if (cmd == "setBrightness") brightness = payload["value"] | 0.0f;
  else if (cmd == "logHelloWorld") Serial.print("Hello World\n");
}

void setup() {
  Serial.begin(115200);
  ble.begin("ESP-SmartHome");   // this becomes the BLE device name
  ble.onCommand(handleCommand);
}

void loop() {
  StaticJsonDocument<128> telemetry;
  telemetry["armed"] = armed;
  telemetry["temp"] = 21.5;    // replace with a real sensor read
  telemetry["battery"] = 87.0; // percent, replace with a real sensor read
  ble.sendTelemetry(telemetry);
  delay(2000);
}
```

The full sketch, including an LED brightness command and a `logHelloWorld`
debug command, is in `firmware/examples/SmartHomeExample/`.

### 2. Talk to it from a web app

```bash
npm install esp-ble-sdk
npm run build   # compiles src/ to dist/, needed before the demo page can import it
```

```ts
import { ESPBLEDevice } from 'esp-ble-sdk';

type SmartHomeTelemetry = {
  armed: boolean;
  led: boolean;
  temp: number;
  battery: number;
};

const device = new ESPBLEDevice<SmartHomeTelemetry>({ namePrefix: 'ESP-' });

device.onTelemetry((data) => {
  // data is typed as SmartHomeTelemetry, not `any`
  console.log('armed:', data.armed, 'temp:', data.temp, 'battery:', data.battery);
});

document.querySelector('#connect')!.addEventListener('click', () => device.connect());
document.querySelector('#arm')!.addEventListener('click', () => device.sendCommand('armAlarm'));
document.querySelector('#brightness')!.addEventListener('input', (e) =>
  device.sendCommand('setBrightness', { value: Number(e.target.value) }) // e.g. 0.5
);
```

Or just open `examples/vanilla-web-demo/index.html` in Chrome or Edge (Web
Bluetooth needs one of those, served over `https://` or `localhost`) after
running `npm run build`. The demo imports straight from `dist/`, no bundler
needed. For a fuller example with a control panel UI, `cd
examples/react-web-demo && npm install && npm run dev`.

### 3. Or use the React hook

```tsx
import { useESPBLEDevice } from 'esp-ble-sdk';

function SmartHomePanel() {
  const { connected, telemetry, connect, sendCommand } =
    useESPBLEDevice<SmartHomeTelemetry>({ namePrefix: 'ESP-' });

  if (!connected) return <button onClick={connect}>Connect</button>;

  return (
    <div>
      <p>Temp: {telemetry?.temp ?? '—'}°C · Armed: {String(telemetry?.armed)}</p>
      <button onClick={() => sendCommand('armAlarm')}>Arm</button>
      <button onClick={() => sendCommand('disarmAlarm')}>Disarm</button>
    </div>
  );
}
```

## Protocol

One BLE service, two characteristics, both carrying UTF-8 JSON:

| | UUID | Direction | Properties |
|---|---|---|---|
| Service | `620478f0-d5dc-492a-84e9-335915efe331` | — | — |
| Telemetry | `620478f1-d5dc-492a-84e9-335915efe331` | ESP32 → browser | Notify |
| Command | `620478f2-d5dc-492a-84e9-335915efe331` | browser → ESP32 | Write |

- **Telemetry** is any flat JSON object. `sendTelemetry()` just serializes
  whatever `JsonDocument` you give it on the firmware side, and the client
  hands it to `onTelemetry()` as-is.
- **Commands** are `{ "cmd": "...", ...payload }`. `sendCommand(cmd, payload?)`
  builds that object and writes it; the command names themselves (`armAlarm`,
  `setBrightness`, ...) are just whatever your firmware's `onCommand` checks
  for, not part of the SDK.

Pass `serviceUUID` / `telemetryCharacteristicUUID` / `commandCharacteristicUUID`
in `ESPBLEDeviceOptions` (and update the matching `#define`s in
`ESPBLESDK.h`) if you need to avoid colliding with another service on the
same device.

## API reference

### `ESPBLEDevice<T = Telemetry>`

`new ESPBLEDevice<T>(options?: ESPBLEDeviceOptions)`

`T` types the shape of your telemetry payload — `onTelemetry`'s handler
receives `T` instead of a bag of `unknown`s. Defaults to
`Record<string, unknown>` if you don't pass one.

| Option | Type | Default | Description |
|---|---|---|---|
| `namePrefix` | `string` | none (no name filter) | Filters the browser's device picker to devices whose advertised name starts with this. If omitted, the picker filters by `serviceUUID` instead, so you'll see any nearby device advertising that service regardless of name. |
| `serviceUUID` | `string` | `620478f0-d5dc-492a-84e9-335915efe331` | The BLE service UUID to connect to. Only override this if you changed the matching `#define` in `ESPBLESDK.h` on the firmware side. |
| `telemetryCharacteristicUUID` | `string` | `620478f1-d5dc-492a-84e9-335915efe331` | The notify characteristic the device publishes telemetry on. Must match the firmware. |
| `commandCharacteristicUUID` | `string` | `620478f2-d5dc-492a-84e9-335915efe331` | The write characteristic commands are sent to. Must match the firmware. |
| `maxReconnectAttempts` | `number` | `5` | How many times to retry after an unexpected disconnect before giving up and firing `reconnect-failed`. Retry delay backs off exponentially (1s, 2s, 4s... capped at 10s). Doesn't apply after a manual `disconnect()`. |

| Member | Description |
|---|---|
| `connect()` | Opens the browser's device picker and connects |
| `disconnect()` | Disconnects and stops auto-reconnect |
| `connected` | `boolean` getter |
| `onTelemetry(handler)` | Subscribes; returns an unsubscribe function |
| `sendCommand(cmd, payload?)` | Sends `{ cmd, ...payload }` |
| Events: `connected`, `disconnected`, `reconnect-failed` | Standard `EventTarget` events, usable via `addEventListener` |

### `useESPBLEDevice<T = Telemetry>(options?)` (React)

Returns `{ connected, telemetry, connect, disconnect, sendCommand }`, with
`telemetry: T | null`. Creates one `ESPBLEDevice<T>` per component and
disconnects it on unmount.

## Notes and current limitations

- Telemetry payloads have to fit in one BLE notification, typically
  ~180–500 bytes depending on negotiated MTU. Fine for sensor readings and
  state, not for large data dumps.
- JSON-over-BLE costs some bandwidth, but you can just `console.log`
  whatever comes through instead of decoding a binary blob. Worth revisiting
  if you outgrow it.
- Commands go out via `writeValueWithoutResponse`, so delivery isn't
  acknowledged. Need guaranteed delivery? Switch to `writeValue` in
  `ESPBLEDevice.sendCommand` and add your own ack pattern.
- Web Bluetooth only runs in Chromium-based browsers (Chrome, Edge) over
  HTTPS or `localhost`. Browser limitation, not this library's.

## License

MIT, both the TypeScript package and the firmware library. Embed either side
in your own project, closed-source included.