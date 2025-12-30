const mqtt = require('mqtt');

// Configuration
// Using public broker for testing (same as backend default)
const BROKER_URL = process.env.MQTT_BROKER_URL || "ws://broker.emqx.io:8083/mqtt";
const MACHINE_ID = "VM01";
const TOPIC = `vm/${MACHINE_ID}/telemetry`;

console.log(`🔌 Connecting to MQTT Broker: ${BROKER_URL}`);
const client = mqtt.connect(BROKER_URL);

client.on('connect', () => {
  console.log('✅ Connected to MQTT Broker');
  
  // Simulate Ultrasonic Data
  // Level: FULL (<5cm), MEDIUM (5-15cm), LOW (15-25cm), EMPTY (>25cm)
  const payload = {
    status: "ONLINE",
    door: "CLOSED",
    rssi: -45,
    fw: "v1.0.2",
    slots: [
      { id: 1, level: "FULL" },    // Slot 1 is full
      { id: 2, level: "MEDIUM" },  // Slot 2 is half full
      { id: 3, level: "EMPTY" },   // Slot 3 is empty
      { id: 4, level: "LOW" },     // Slot 4 is low
      { id: 5, level: "FULL" }     // Slot 5 is full
    ]
  };

  const message = JSON.stringify(payload);
  
  console.log(`📤 Sending Telemetry to ${TOPIC}:`);
  console.log(JSON.stringify(payload, null, 2));

  client.publish(TOPIC, message, { qos: 0 }, (err) => {
    if (err) {
      console.error('❌ Failed to publish:', err);
    } else {
      console.log('✅ Data sent successfully!');
    }
    
    // Close connection after sending
    setTimeout(() => {
      client.end();
      console.log('🔌 Disconnected');
    }, 1000);
  });
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err);
  client.end();
});
