#ifndef ESPBLESDK_H
#define ESPBLESDK_H

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>

#define ESPBLESDK_SERVICE_UUID        "620478f0-d5dc-492a-84e9-335915efe331"
#define ESPBLESDK_TELEMETRY_CHAR_UUID "620478f1-d5dc-492a-84e9-335915efe331"
#define ESPBLESDK_COMMAND_CHAR_UUID   "620478f2-d5dc-492a-84e9-335915efe331"

typedef void (*ESPBLECommandHandler)(const String& cmd, JsonObject payload);

class ESPBLESDK : public BLECharacteristicCallbacks {
public:
  ESPBLESDK();
  void begin(const char* deviceName = "ESP32-BLE");
  void sendTelemetry(JsonDocument& doc);
  void onCommand(ESPBLECommandHandler handler);

  void onWrite(BLECharacteristic* characteristic) override;
  void setConnected(bool connected) { connected_ = connected; }

private:
  BLEServer* server_ = nullptr;
  BLECharacteristic* telemetryChar_ = nullptr;
  BLECharacteristic* commandChar_ = nullptr;
  ESPBLECommandHandler commandHandler_ = nullptr;
  bool connected_ = false;

  class ServerCallbacks : public BLEServerCallbacks {
  public:
    ServerCallbacks(ESPBLESDK* sdk) : sdk_(sdk) {}
    void onConnect(BLEServer* server) override { sdk_->setConnected(true); }
    void onDisconnect(BLEServer* server) override {
      sdk_->setConnected(false);
      BLEDevice::startAdvertising();
    }
  private:
    ESPBLESDK* sdk_;
  };

  ServerCallbacks* serverCallbacks_ = nullptr;
};

#endif