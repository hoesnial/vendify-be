const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const brokerUrl = process.env.MQTT_BROKER_URL || '';
const username = process.env.MQTT_USERNAME || '';
const password = process.env.MQTT_PASSWORD || '';

console.log(JSON.stringify({
  brokerUrl,
  username,
  password
}));
