const mqtt = require('mqtt');

// Credentials from mqtt_service.dart
const BROKER_HOST = '5ab94abc71974f2c87741c0737fcb46e.s1.eu.hivemq.cloud';
const BROKER_PORT = 8883;
const USERNAME = 'espVenMac';
const PASSWORD = 'Password123';
const MACHINE_ID = 'VM01';

// Connection URL for TLS/SSL
const connectUrl = `mqtts://${BROKER_HOST}:${BROKER_PORT}`;

console.log(`Connecting to ${connectUrl}...`);

const client = mqtt.connect(connectUrl, {
  username: USERNAME,
  password: PASSWORD,
  clientId: `test_script_${Math.random().toString(16).substring(2, 8)}`,
  protocol: 'mqtts', // Force secure connection
});

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker');
  
  const topic = `vm/${MACHINE_ID}/telemetry`;
  // Sending Python/ESP style JSON as requested "json suhu"
  const payload = {
    temperature: 28.5,
    humidity: 60.2,
    timestamp: new Date().toISOString()
  };
  
  console.log(`📤 Publishing to ${topic}...`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Failed to publish:', err);
      process.exit(1);
    } else {
      console.log('✅ Message published successfully!');
      // Give it a moment to ensure it sends before closing
      setTimeout(() => {
        client.end();
        console.log('🔌 Disconnected');
      }, 500);
    }
  });
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err);
  client.end();
});

client.on('offline', () => {
    console.log('⚠️ MQTT Client Offline');
});

client.on('reconnect', () => {
    console.log('🔄 MQTT Reconnecting...');
});
