const db = require('../src/config/database');

async function checkData() {
  console.log("🔍 Checking Database for VM01...");
  
  try {
    if (process.env.USE_SUPABASE === 'true') {
      const supabase = db.getClient();
      
      // Check Machine
      const { data: machine, error: mError } = await supabase
        .from('machines')
        .select('*')
        .eq('id', 'VM01')
        .single();
        
      if (mError || !machine) {
        console.error("❌ Machine 'VM01' NOT FOUND in Supabase!");
        console.log("💡 Tip: You must create the machine first.");
      } else {
        console.log("✅ Machine 'VM01' found:", machine.name);
      }

      // Check Slots
      const { data: slots, error: sError } = await supabase
        .from('slots')
        .select('*')
        .eq('machine_id', 'VM01');
        
      console.log(`📊 Found ${slots?.length || 0} slots for VM01.`);
      if (slots && slots.length > 0) {
        slots.forEach(s => console.log(`   - Slot ${s.slot_number}: Stock=${s.current_stock}`));
      } else {
        console.warn("⚠️ No slots found! The simulation updates slots, so they must exist.");
      }
      
    } else {
      console.log("Skipping MySQL check (USE_SUPABASE is true)");
    }
  } catch (err) {
    console.error("Error checking DB:", err);
  }
}

checkData();
