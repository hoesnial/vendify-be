require('dotenv').config();

console.log("🔍 Checking Midtrans Environment Variables...");
console.log(`PAYMENT_SERVER_KEY: ${process.env.PAYMENT_SERVER_KEY ? "✅ Present" : "❌ MISSING"}`);
console.log(`PAYMENT_CLIENT_KEY: ${process.env.PAYMENT_CLIENT_KEY ? "✅ Present" : "❌ MISSING"}`);
console.log(`PAYMENT_IS_PRODUCTION: ${process.env.PAYMENT_IS_PRODUCTION}`);

const midtransClient = require('midtrans-client');
try {
    let snap = new midtransClient.Snap({
        isProduction: process.env.PAYMENT_IS_PRODUCTION === 'true',
        serverKey: process.env.PAYMENT_SERVER_KEY,
        clientKey: process.env.PAYMENT_CLIENT_KEY
    });
    console.log("✅ Midtrans Snap initialized successfully.");
} catch (error) {
    console.error("❌ Failed to initialize Snap:", error.message);
}
