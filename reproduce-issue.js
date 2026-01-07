require('dotenv').config();
const mqttService = require('./src/services/mqttService');
const { supabase } = require('./src/config/supabase'); // Directly use supabase from config

async function runTest() {
    console.log("🧪 Starting Reproduction Test...");

    // 1. Get a recent pending or completed order to test with
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    if (error || !order) {
        console.error("❌ No order found to test:", error);
        return;
    }

    console.log(`📋 Testing with Order ID: ${order.id} (Slot ${order.slot_id})`);

    // 2. Get Stock Before
    const { data: slotBefore } = await supabase
        .from('slots')
        .select('current_stock')
        .eq('id', order.slot_id)
        .single();
    console.log(`📦 Stock Before: ${slotBefore?.current_stock}`);

    // 3. Simulate Mobile Payload (MISSING SLOT)
    const payload = {
        orderId: order.id,
        success: true,
        // message: "Simulated from script"
        // Intentionally OMITTING 'slot'
    };

    console.log("🚀 Calling handleDispenseResult with payload:", payload);

    try {
        await mqttService.handleDispenseResult(process.env.MACHINE_ID || 'VM01', payload);
    } catch (e) {
        console.error("💥 CRASH during handler:", e);
    }

    // 4. Get Stock After
    const { data: slotAfter } = await supabase
        .from('slots')
        .select('current_stock')
        .eq('id', order.slot_id)
        .single();
    console.log(`📦 Stock After: ${slotAfter?.current_stock}`);
    
    if (slotBefore.current_stock > slotAfter.current_stock) {
        console.log("✅ SUCCESS: Stock decreased!");
    } else {
        console.log("❌ FAILURE: Stock did not change.");
    }
    
    process.exit(0);
}

runTest();
