const mqtt = require('mqtt');

// Mirroring the settings from vending-fe/lib/mqtt.ts
const protocol = 'wss';
const host = '9fde2eecc93040ba86ea98e093528087.s1.eu.hivemq.cloud';
const port = 8884;
const path = '/mqtt';
const url = `${protocol}://${host}:${port}${path}`;

const options = {
    clientId: 'test_wss_' + Math.random().toString(16).substr(2, 8),
    username: 'hoescodes',
    password: '010702Bdg',
    keepalive: 60,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
};

console.log(`🔌 Connecting to HiveMQ via WSS (simulate browser)...`);
console.log(`URL: ${url}`);

const client = mqtt.connect(url, options);

client.on('connect', () => {
    console.log('✅ WSS CONNECTED! (Port 8884 is open and working)');
    client.subscribe('vm/+/dispense_result', (err) => {
        if (!err) {
            console.log('📡 Subscribed to vm/+/dispense_result');
            console.log('⏳ Waiting for messages...');
            
            // Publish a test message to self
            client.publish('vm/VM01/dispense_result', JSON.stringify({ test: "Hello WSS" }));
        }
    });
});

client.on('message', (topic, message) => {
    console.log(`📨 Received on [${topic}]: ${message.toString()}`);
    console.log('🎉 Loopback Test Passed!');
    client.end();
});

client.on('error', (err) => {
    console.error('❌ WSS Error:', err.message);
    client.end();
});

client.on('offline', () => {
    console.log('⚠️ Client Offline');
});
