#include "ESPBLESDK.h"

ESPBLESDK::ESPBLESDK() {}

void ESPBLESDK::begin(const char* deviceName) {
  BLEDevice::init(deviceName);

  server_ = BLEDevice::createServer();
  serverCallbacks_ = new ServerCallbacks(this);
  server_->setCallbacks(serverCallbacks_);

  BLEService* service = server_->createService(ESPBLESDK_SERVICE_UUID);

  telemetryChar_ = service->createCharacteristic(
      ESPBLESDK_TELEMETRY_CHAR_UUID,
      BLECharacteristic::PROPERTY_NOTIFY);
  telemetryChar_->addDescriptor(new BLE2902());

  commandChar_ = service->createCharacteristic(
      ESPBLESDK_COMMAND_CHAR_UUID,
      BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  commandChar_->setCallbacks(this);

  service->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(ESPBLESDK_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
}

void ESPBLESDK::sendTelemetry(JsonDocument& doc) {
  if (!telemetryChar_ || !connected_) return;

  String payload;
  serializeJson(doc, payload);
  telemetryChar_->setValue(payload.c_str());
  telemetryChar_->notify();
}

void ESPBLESDK::onCommand(ESPBLECommandHandler handler) {
  commandHandler_ = handler;
}

void ESPBLESDK::onWrite(BLECharacteristic* characteristic) {
  if (characteristic != commandChar_ || !commandHandler_) return;

  String raw = characteristic->getValue();
  if (raw.length() == 0) return;

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, raw);
  if (err) return;

  const char* cmd = doc["cmd"] | "";
  if (cmd[0] == '\0') return;

  commandHandler_(String(cmd), doc.as<JsonObject>());
}