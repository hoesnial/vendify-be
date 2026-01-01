const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPassword() {
  const email = 'admin@vendingmachine.com';
  const newPassword = 'admin123';
  
  console.log(`Resetting password for ${email}...`);
  
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    
    const { data, error } = await supabase
      .from('admin_users')
      .update({ password_hash: hash })
      .eq('email', email)
      .select();
      
    if (error) throw error;
    
    if (data && data.length > 0) {
       console.log("✅ Password reset successful!");
       console.log("New Hash:", hash);
    } else {
       console.log("❌ User not found or update failed.");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

resetPassword();
