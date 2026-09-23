import { useCallback, useEffect, useMemo, useState } from 'react';
import { ESPBLEDevice } from '../ESPBLEDevice';
import { ESPBLEDeviceOptions, Telemetry } from '../types';

export interface UseESPBLEDeviceResult<T = Telemetry> {
  connected: boolean;
  telemetry: T | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendCommand: (cmd: string, payload?: Record<string, unknown>) => Promise<void>;
}

/** React hook wrapper around ESPBLEDevice. Creates one device instance per component. */
export function useESPBLEDevice<T = Telemetry>(
  options: ESPBLEDeviceOptions = {},
): UseESPBLEDeviceResult<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const device = useMemo(() => new ESPBLEDevice<T>(options), []);
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState<T | null>(null);

  useEffect(() => {
    const onConnected = () => setConnected(true);
    const onDisconnected = () => setConnected(false);

    device.addEventListener('connected', onConnected);
    device.addEventListener('disconnected', onDisconnected);
    const unsubscribeTelemetry = device.onTelemetry(setTelemetry);

    return () => {
      device.removeEventListener('connected', onConnected);
      device.removeEventListener('disconnected', onDisconnected);
      unsubscribeTelemetry();
      device.disconnect();
    };
  }, [device]);

  const connect = useCallback(() => device.connect(), [device]);
  const disconnect = useCallback(() => device.disconnect(), [device]);
  const sendCommand = useCallback(
  (cmd: string, payload?: Record<string, unknown>) => device.sendCommand(cmd, payload),
  [device]
);

  return { connected, telemetry, connect, disconnect, sendCommand };
}
