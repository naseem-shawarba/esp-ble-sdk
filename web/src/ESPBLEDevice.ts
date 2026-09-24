import {
  CONNECT_TIMEOUT_MS,
  DEFAULT_COMMAND_CHARACTERISTIC_UUID,
  DEFAULT_SERVICE_UUID,
  DEFAULT_TELEMETRY_CHARACTERISTIC_UUID,
} from "./constants";
import { ESPBLEDeviceOptions, Telemetry, TelemetryHandler } from "./types";
import { delay, withTimeout } from "./utils";

/**
 * A typed client for talking to an ESP32 device running the matching
 * ESPBLESDK firmware library, over Web Bluetooth.
 *
 * Handles connecting, subscribing to live telemetry, sending commands,
 * and automatically reconnecting after an unexpected disconnect.
 */
export class ESPBLEDevice<T = Telemetry> extends EventTarget {
  private readonly serviceUUID: string;
  private readonly telemetryUUID: string;
  private readonly commandUUID: string;
  private readonly maxReconnectAttempts: number;

  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private telemetryChar: BluetoothRemoteGATTCharacteristic | null = null;
  private commandChar: BluetoothRemoteGATTCharacteristic | null = null;

  private reconnectAttempts = 0;
  private userDisconnected = false;

  constructor(private readonly options: ESPBLEDeviceOptions = {}) {
    super();
    this.serviceUUID = options.serviceUUID ?? DEFAULT_SERVICE_UUID;
    this.telemetryUUID =
      options.telemetryCharacteristicUUID ??
      DEFAULT_TELEMETRY_CHARACTERISTIC_UUID;
    this.commandUUID =
      options.commandCharacteristicUUID ?? DEFAULT_COMMAND_CHARACTERISTIC_UUID;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  }

  /** True while a GATT connection is currently established. */
  get connected(): boolean {
    return this.server?.connected ?? false;
  }

  /**
   * Opens the browser's device picker, then connects to the chosen
   * device's GATT server and subscribes to telemetry.
   */
  async connect(): Promise<void> {
    this.userDisconnected = false;

    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: this.options.namePrefix
          ? [
              {
                namePrefix: this.options.namePrefix,
                services: [this.serviceUUID],
              },
            ]
          : [{ services: [this.serviceUUID] }],
      });

      this.device.addEventListener(
        "gattserverdisconnected",
        this.handleUnexpectedDisconnect,
      );

      await this.openGattConnection();
    } catch (error) {
      console.error("ESPBLEDevice: connect() failed", error);
      this.dispatchEvent(new CustomEvent("error", { detail: error }));
      throw error;
    }
  }

  /** Closes the connection and stops any automatic reconnect attempts. */
  disconnect(): void {
    this.userDisconnected = true;
    this.reconnectAttempts = 0;
    this.dispatchEvent(new Event("disconnected"));
    this.device?.gatt?.disconnect();
  }

  /** Subscribes to telemetry updates. Returns a function that unsubscribes. */
  onTelemetry(handler: TelemetryHandler<T>): () => void {
    const listener = (event: Event) =>
      handler((event as CustomEvent<T>).detail);
    this.addEventListener("telemetry", listener);
    return () => this.removeEventListener("telemetry", listener);
  }

  /** Sends an arbitrary command. Most apps will prefer the typed helpers below. */
  async sendCommand(
    cmd: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.commandChar) {
      throw new Error("ESPBLEDevice: not connected. Call connect() first.");
    }
    const message = JSON.stringify({ cmd, ...payload });
    await this.commandChar.writeValueWithoutResponse(
      new TextEncoder().encode(message),
    );
  }

  private async openGattConnection(): Promise<void> {
    if (!this.device?.gatt) {
      throw new Error("ESPBLEDevice: no device selected.");
    }

    this.server = await withTimeout(
      this.device.gatt.connect(),
      CONNECT_TIMEOUT_MS,
      "ESPBLEDevice: timed out connecting to GATT server.",
    );
    const service = await this.server.getPrimaryService(this.serviceUUID);

    this.telemetryChar = await service.getCharacteristic(this.telemetryUUID);
    this.commandChar = await service.getCharacteristic(this.commandUUID);

    this.telemetryChar.addEventListener(
      "characteristicvaluechanged",
      this.handleTelemetryValue,
    );
    await this.telemetryChar.startNotifications();

    this.reconnectAttempts = 0;
    this.dispatchEvent(new Event("connected"));
  }

  private handleTelemetryValue = (event: Event): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (!characteristic.value) return;

    try {
      const text = new TextDecoder().decode(characteristic.value);
      const data = JSON.parse(text) as T;
      this.dispatchEvent(new CustomEvent("telemetry", { detail: data }));
    } catch (error) {
      console.warn(
        "ESPBLEDevice: received a telemetry payload that was not valid JSON.",
        error,
      );
    }
  };

  private handleUnexpectedDisconnect = (): void => {
    this.dispatchEvent(new Event("disconnected"));
    if (!this.userDisconnected) {
      void this.attemptReconnect();
    }
  };

  private async attemptReconnect(): Promise<void> {
    if (this.userDisconnected) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.dispatchEvent(new Event("reconnect-failed"));
      return;
    }

    console.log("attemp before delay",this.reconnectAttempts)
    this.reconnectAttempts += 1;
    const delayMs = Math.min(1000 * 2 ** this.reconnectAttempts, 10_000);
    await delay(delayMs);
    console.log("attemp after delay")


    if (this.userDisconnected) {
      return;
    }

    try {
      await this.openGattConnection();
    } catch {
      await this.attemptReconnect();
    }
  }
}