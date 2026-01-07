const mqtt = require('mqtt');

// User Provided Credentials (UPDATED)
const HOST = "9fde2eecc93040ba86ea98e093528087.s1.eu.hivemq.cloud";
const USERNAME = "hoescodes";
const PASSWORD = "010702Bdg";

// Construct URL with SSL (Required for HiveMQ Cloud)
const BROKER_URL = `mqtts://${HOST}:8883`;

console.log('📡 Testing MQTT Connection...');
console.log(`URL: ${BROKER_URL}`);
console.log(`User: ${USERNAME}`);

const client = mqtt.connect(BROKER_URL, {
    username: USERNAME,
    password: PASSWORD,
    rejectUnauthorized: true, // TLS verification
    connectTimeout: 10000,
});

client.on('connect', () => {
    console.log('\n✅ SUKSES: Berhasil terhubung ke HiveMQ Cloud!');
    
    // Subscribe to test
    const topicResult = 'vm/+/dispense_result'; // Listen for results (from Machine)
    const topicCommand = 'vm/+/dispend';        // Listen for commands (from Mobile/Backend)

    client.subscribe([topicResult, topicCommand], (err) => {
        if(!err) {
            console.log(`📡 Subscribed to ${topicResult}`);
            console.log(`📡 Subscribed to ${topicCommand}`);
            console.log("⏳ Menunggu pesan... (Order di Web atau Tekan 'Simulasi')");
        }
    });
});

client.on('message', (topic, message) => {
    console.log(`\n📨 PESAN DITERIMA!`);
    console.log(`Topic: ${topic}`);
    console.log(`Payload: ${message.toString()}`);
});

client.on('error', (err) => {
    console.error('\n❌ GAGAL: Koneksi Error:', err.message);
    if (err.message.includes("certificate")) {
        console.log("   (Masalah sertifikat SSL/TLS)");
    }
    client.end();
});
