const { supabase } = require('./src/config/supabase');

async function checkUsersTable() {
  console.log("Checking if 'users' table exists...");
  const { data, error } = await supabase
    .from('users')
    .select('count')
    .limit(1);

  if (error) {
    console.error("Error accessing 'users' table:", error);
    if (error.code === '42P01') {
        console.log("CONFIRMED: Table 'users' does not exist.");
    }
  } else {
    console.log("Table 'users' exists.");
  }
}

checkUsersTable();
