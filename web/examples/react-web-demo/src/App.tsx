import { useState } from "react";
import { useESPBLEDevice } from "esp-ble-sdk";
import styles from "./App.module.css";

type SmartHomeTelemetry = {
  armed: boolean;
  led: boolean;
  temp: number;
  battery: number;
};

export default function App() {
  const {
    connected,
    telemetry,
    connect,
    disconnect,
    sendCommand,
  } = useESPBLEDevice<SmartHomeTelemetry>({ namePrefix: "ESP-" });
  const [brightness, setBrightness] = useState(0.5);

  if (!connected) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>ESP32 Control Panel</h1>
          <p className={styles.subtext}>
            Connect your device via Web Bluetooth to get started.
          </p>
          <button className={styles.connectBtn} onClick={connect}>
            Connect Device
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>ESP32 Control Panel</h1>

        <div className={styles.status}>
          <p>
            <strong>Status:</strong>{" "}
            <span className={styles.connectedBadge}>Connected</span>
          </p>
          <p>
            <strong>Temperature:</strong> {telemetry?.temp ?? "—"} °C
          </p>
          <p>
            <strong>Battery:</strong> {telemetry?.battery ?? "—"}%
          </p>
          <p>
            <strong>Led:</strong> {telemetry?.led ? "On" : "Off"} °C
          </p>

          <p>
            <strong>System State:</strong>{" "}
            {telemetry?.armed ? "ARMED" : "DISARMED"}
          </p>
        </div>

        <div className={styles.btnGroup}>
          <button className={styles.btn} onClick={() => sendCommand("armAlarm")}>
            Arm
          </button>
          <button className={styles.btn} onClick={() => sendCommand("disarmAlarm")}>
            Disarm
          </button>
        </div>

        <div className={styles.btnGroup}>
          <button className={styles.btn} onClick={() => sendCommand("logHelloWorld")}>
            Log Hello World
          </button>
        </div>

        <div className={styles.row}>
          <label htmlFor="brightness">Brightness ({brightness.toFixed(1)})</label>
          <input
            id="brightness"
            className={styles.slider}
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
          />
          <button
            className={styles.btn}
            onClick={() => sendCommand("setBrightness", { value: brightness })}
          >
            Set Brightness
          </button>
        </div>

        <button className={styles.disconnectBtn} onClick={disconnect}>
          Disconnect
        </button>
      </div>
    </div>
  );
}
