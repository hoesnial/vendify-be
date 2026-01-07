require('dotenv').config();
const { supabase } = require('./src/config/supabase');

async function checkStock() {
    console.log("🔍 Checking Stock Status for Order ORD-20260107-B71EC06F & Slot 1");
    
    // 1. Check Slot 1 Stock
    const { data: slot, error: slotError } = await supabase
        .from('slots')
        .select('*')
        .eq('machine_id', 'VM01')
        .eq('slot_number', 1)
        .single();
        
    if(slot) {
        console.log(`📦 Current Stock Slot 1: ${slot.current_stock}`);
    } else {
        console.log(`❌ Error fetching slot: ${slotError?.message}`);
    }

    // 2. Check Stock Logs
    const { data: logs, error: logsError } = await supabase
        .from('stock_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    console.log("\n📜 Recent Stock Logs:");
    if(logs) {
        logs.forEach(log => {
            console.log(`   [${log.created_at}] Slot ${log.slot_id}: Change ${log.quantity_change} (Before: ${log.quantity_before} -> After: ${log.quantity_after}) | Reason: ${log.reason}`);
        });
    } else {
        console.log(`   No logs found or error: ${logsError?.message}`);
    }
}

checkStock();
