const http = require('http');

const MACHINE_ID = "VM01";
const PORT = 3001;

// Function to send a single temperature reading
function sendReading(temp, humidity) {
  const data = JSON.stringify({
    machine_id: MACHINE_ID,
    value: temp,
    humidity: humidity
  });

  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/temperature/log',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => { responseData += chunk; });
    res.on('end', () => {
      console.log(`[${res.statusCode}] Sent: ${temp}°C, Response: ${responseData}`);
    });
  });

  req.on('error', (error) => {
    console.error('Error sending data:', error.message);
  });

  req.write(data);
  req.end();
}

console.log("🚀 Starting Sensor Simulation...");
console.log(`Target: http://localhost:${PORT}/api/temperature/log`);

// Send 5 readings with slight variations
let count = 0;
const interval = setInterval(() => {
  if (count >= 5) {
    clearInterval(interval);
    console.log("✅ Simulation complete! Check your dashboard.");
    return;
  }

  // Generate random pleasant temp between 4.0 and 6.0
  const randomTemp = (4 + Math.random() * 2).toFixed(1);
  const randomHumidity = (40 + Math.random() * 10).toFixed(1);

  sendReading(randomTemp, randomHumidity);
  count++;
}, 1000); // Send every 1 second
