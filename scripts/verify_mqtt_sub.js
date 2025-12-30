const mqtt = require('mqtt');

const BROKER_URL = "ws://broker.emqx.io:8083/mqtt";
const TOPIC = "vm/VM01/telemetry";

console.log(`🕵️ Listening on ${BROKER_URL} for topic: ${TOPIC}`);
const client = mqtt.connect(BROKER_URL);

client.on('connect', () => {
  console.log('✅ Connected to Broker. Waiting for messages...');
  client.subscribe(TOPIC);
});

client.on('message', (topic, message) => {
  console.log(`\n📬 RECEIVED MESSAGE on ${topic}:`);
  console.log(message.toString());
  console.log("✅ Broker works! If backend didn't update, backend is not listening.");
  process.exit(0);
});

setTimeout(() => {
  console.log("⏰ Timeout! No message received in 10 seconds.");
  client.end();
  process.exit(1);
}, 10000);
