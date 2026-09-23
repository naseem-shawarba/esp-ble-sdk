#include "ESPBLESDK.h"

#ifndef LED_BUILTIN
#define LED_PIN 15  // GPIO 8 is standard on ESP32-C3
#else
#define LED_PIN LED_BUILTIN
#endif

ESPBLESDK ble;

bool armed = false;
bool ledState = false;
int brightness = 0;

void handleCommand(const String& cmd, JsonObject payload) {
  if (cmd == "armAlarm") {
    armed = true;
  } else if (cmd == "disarmAlarm") {
    armed = false;
  } else if (cmd == "logHelloWorld") {
    Serial.print("Hello World\n");
    
  }else if(cmd == "setBrightness"){
    brightness = payload["value"] | 0;
    Serial.printf("New brightness: %d\n", brightness);
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

  ble.begin("ESP-SmartHome");
  ble.onCommand(handleCommand);
}

void loop() {
  StaticJsonDocument<128> telemetry;
  telemetry["armed"] = armed;
  telemetry["led"] = ledState;
  telemetry["temp"] = 21.5;
  telemetry["battery"] = 87.0;
  
  ble.sendTelemetry(telemetry);
  delay(500);
}