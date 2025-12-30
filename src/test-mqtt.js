const mqtt = require('mqtt');

// User Provided Credentials
const HOST = "5ab94abc71974f2c87741c0737fcb46e.s1.eu.hivemq.cloud";
const USERNAME = "espVenMac";
const PASSWORD = "Password123";

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
    client.end();
});

client.on('error', (err) => {
    console.error('\n❌ GAGAL: Koneksi Error:', err.message);
    if (err.message.includes("certificate")) {
        console.log("   (Masalah sertifikat SSL/TLS)");
    }
    client.end();
});

client.on('packetreceive', (packet) => {
    // console.log(`Packet: ${packet.cmd}`);
});
