const bcrypt = require("bcryptjs");
const { supabase } = require("../config/supabase");
require("dotenv").config();

async function createAdmin() {
  const username = "admin";
  const password = "admin123";
  const email = "admin@vendingmachine.com";

  console.log(`🔄 Creating admin user: ${username}`);

  try {
    // 1. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    console.log("✅ Password hashed");

    // 2. Check if user exists (delete if so)
    const { data: existingUser } = await supabase
      .from("admin_users")
      .select("*")
      .eq("username", username)
      .single();

    if (existingUser) {
      console.log("⚠️ User found, deleting existing user...");
      await supabase.from("admin_users").delete().eq("username", username);
    }

    // 3. Insert new user
    const { data, error } = await supabase
      .from("admin_users")
      .insert([
        {
          username,
          email,
          password_hash: passwordHash,
          role: "SUPER_ADMIN",
          is_active: true,
        },
      ])
      .select();

    if (error) {
      throw error;
    }

    console.log("🎉 Admin user created successfully!");
    console.log("-----------------------------------");
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log("-----------------------------------");
  } catch (error) {
    console.error("❌ Failed to create admin:", error.message);
  }
}

createAdmin();
