// reproduce-update.js
const apiBase = "http://localhost:3001/api";

async function run() {
  try {
    console.log("🔍 Fetching products to find a target...");
    const resList = await fetch(`${apiBase}/products/all`);
    const products = await resList.json();
    
    if (!products || products.length === 0) {
      console.error("❌ No products found to update.");
      return;
    }

    const target = products[0];
    console.log(`🎯 Target Product: ${target.id} (${target.name})`);

    // Prepare FormData update (mimicking frontend)
    // We used 'multipart/form-data' in frontend
    const formData = new FormData();
    formData.append("name", target.name + " (Updated)");
    formData.append("price", target.price);
    // formData.append("is_active", "true"); 
    // Intentionally NOT sending image to test that path

    console.log("🚀 Sending PUT request...");
    const resUpdate = await fetch(`${apiBase}/products/${target.id}`, {
      method: "PUT",
      body: formData,
    });

    const result = await resUpdate.json();

    console.log(`📡 Status: ${resUpdate.status}`);
    console.log("📄 Response:", JSON.stringify(result, null, 2));

  } catch (e) {
    console.error("💥 Script Error:", e);
  }
}

run();
