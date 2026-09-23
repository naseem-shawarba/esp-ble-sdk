export interface ESPBLEDeviceOptions {
  /** Bluetooth device name prefix to filter for when scanning (e.g. "ESP-"). */
  namePrefix?: string;
  /** Override the default service UUID. */
  serviceUUID?: string;
  /** Override the default telemetry characteristic UUID (ESP32 -> browser). */
  telemetryCharacteristicUUID?: string;
  /** Override the default command characteristic UUID (browser -> ESP32). */
  commandCharacteristicUUID?: string;
  /** Max automatic reconnect attempts after an unexpected disconnect. Default: 5. */
  maxReconnectAttempts?: number;
}

export type Telemetry = Record<string, unknown>;
export type TelemetryHandler<T = Telemetry> = (data: T) => void;

