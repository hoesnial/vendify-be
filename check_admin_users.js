const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log("Current directory:", process.cwd());
console.log("Env file path:", path.resolve(__dirname, '.env'));
console.log("Supabase URL found:", !!supabaseUrl);
console.log("Supabase Key found:", !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Checked SUPABASE_URL, VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminUsers() {
  console.log("Fetching admin_users...");
  
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, username, email, role, is_active, password_hash');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${data.length} users:`);
  data.forEach(u => {
    console.log(`- ID: ${u.id}`);
    console.log(`  Username: ${u.username}`);
    console.log(`  Email: ${u.email}`);
    console.log(`  Role: ${u.role}`);
    console.log(`  Active: ${u.is_active}`);
    console.log(`  Hash Start: ${u.password_hash ? u.password_hash.substring(0, 10) + '...' : 'NULL'}`);
    console.log('-------------------');
  });
}

checkAdminUsers();
