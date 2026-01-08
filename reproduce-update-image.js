// reproduce-update-image.js
const apiBase = "http://localhost:3001/api";
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    console.log("🔍 Fetching products...");
    const resList = await fetch(`${apiBase}/products/all`);
    const products = await resList.json();
    const target = products[0];
    
    console.log(`🎯 Target: ${target.id}`);

    // Create a dummy image file
    const dummyPath = path.join(__dirname, 'dummy.txt');
    fs.writeFileSync(dummyPath, 'This is a test image content');

    const formData = new FormData();
    formData.append("name", target.name + " (Img Update)");
    formData.append("price", target.price.toString());
    
    // Read file and append
    const fileContent = fs.readFileSync(dummyPath);
    const blob = new Blob([fileContent], { type: 'image/png' });
    formData.append("image", blob, "test.png");

    console.log("🚀 Sending PUT with Image...");
    const resUpdate = await fetch(`${apiBase}/products/${target.id}`, {
      method: "PUT",
      body: formData,
    });

    const result = await resUpdate.json();

    console.log(`📡 Status: ${resUpdate.status}`);
    console.log("📄 Response:", JSON.stringify(result, null, 2));

    // Cleanup
    fs.unlinkSync(dummyPath);

  } catch (e) {
    console.error("💥 Error:", e);
  }
}

run();
