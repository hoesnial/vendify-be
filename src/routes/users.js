const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const router = express.Router();

const { supabase } = require("../config/supabase");

// Health check
router.get("/health", (req, res) => {
  res.json({ status: "Users module working", timestamp: new Date() });
});

// Validation middleware
const validateRegister = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("full_name").notEmpty().withMessage("Full name is required"),
];

const validateLogin = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

/**
 * @route   POST /api/users/register
 * @desc    Register new user (buyer)
 * @access  Public
 */
router.post("/register", validateRegister, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { email, password, full_name, phone } = req.body;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        email,
        password_hash,
        full_name,
        phone,
        role: "buyer", // Default role
      })
      .select("id, email, full_name, phone, role, created_at")
      .single();

    if (error) throw error;

    // Generate JWT token
    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: newUser,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/users/login
 * @desc    Login user (buyer/admin)
 * @access  Public
 */
router.post("/login", validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { email, password, fcm_token } = req.body;

    // Find user
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .eq("is_active", true)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Update last login and FCM token
    const updates = { last_login: new Date().toISOString() };
    if (fcm_token) {
      updates.fcm_token = fcm_token;
    }

    await supabase.from("users").update(updates).eq("id", user.id);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Return user data without password
    const { password_hash, ...userData } = user;

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: userData,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, full_name, phone, role, created_at, last_login")
      .eq("id", req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { full_name, phone, fcm_token } = req.body;

    const updates = {};
    if (full_name) updates.full_name = full_name;
    if (phone) updates.phone = phone;
    if (fcm_token) updates.fcm_token = fcm_token;

    const { data: updatedUser, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", req.user.id)
      .select("id, email, full_name, phone, role")
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/users/password
 * @desc    Change password
 * @access  Private
 */
router.put(
  "/password",
  authenticateToken,
  [
    body("current_password")
      .notEmpty()
      .withMessage("Current password is required"),
    body("new_password")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { current_password, new_password } = req.body;

      // Get current user
      const { data: user } = await supabase
        .from("users")
        .select("password_hash")
        .eq("id", req.user.id)
        .single();

      // Verify current password
      const isValid = await bcrypt.compare(
        current_password,
        user.password_hash
      );
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const new_password_hash = await bcrypt.hash(new_password, 10);

      // Update password
      const { error } = await supabase
        .from("users")
        .update({ password_hash: new_password_hash })
        .eq("id", req.user.id);

      if (error) throw error;

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to change password",
        error: error.message,
      });
    }
  }
);

// Update user privilege/status
router.post("/manage", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { id, type, role, status } = req.body;

    if (!id || !type) {
      return res.status(400).json({
        success: false,
        message: "User ID and type are required"
      });
    }

    // Role validation
    const validRoles = ["admin", "super_admin", "technician", "inventory", "auditor", "buyer", "user", 
                        "SUPER_ADMIN", "ADMIN", "TECHNICIAN", "INVENTORY", "AUDITOR"]; // Add uppercase variants
    
    if (role && !validRoles.includes(role)) {
       return res.status(400).json({
        success: false,
        message: "Invalid role"
      });
    }

    if (type === 'admin_user') {
      // Manage Staff
      const updates = {};
      if (role) updates.role = role;
      if (status) updates.is_active = (status === 'active');

      const { error } = await supabase
        .from("admin_users")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;

    } else if (type === 'user') {
      // Manage Customer
      // Customers cannot change role (always buyer/user), only status
      const updates = {};
      if (status) updates.is_active = (status === 'active');
      
      if (role && role !== 'buyer' && role !== 'user' && role !== 'BUYER') {
         return res.status(400).json({
          success: false,
          message: "Cannot change customer role"
        });
      }

      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid user type"
      });
    }

    res.json({
      success: true,
      message: "User updated successfully"
    });

  } catch (error) {
    console.error("Manage user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message
    });
  }
});

// Add new user (Admin/Staff)
router.post("/add", authenticateToken, authenticateAdmin, [
    body("username").notEmpty().withMessage("Username is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password min 6 chars"),
    body("role").isIn(["admin", "super_admin", "technician", "inventory", "auditor"]).withMessage("Invalid role")
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { username, email, password, role } = req.body;
        const password_hash = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from("admin_users")
            .insert({
                username,
                email,
                password_hash,
                role: role.toUpperCase(),
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: "Admin user created successfully",
            data
        });
    } catch (error) {
        console.error("Add user error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete user
router.delete("/:type/:id", authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const { type, id } = req.params;
        let table = "";

        if (type === "admin_user") table = "admin_users";
        else if (type === "user") table = "users";
        else return res.status(400).json({ success: false, message: "Invalid user type" });

        // Prevent self-deletion
        if (table === "admin_users" && parseInt(id) === req.user.id) {
             return res.status(400).json({ success: false, message: "Cannot delete yourself" });
        }

        const { error } = await supabase
            .from(table)
            .delete()
            .eq("id", id);

        if (error) throw error;

        res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/users/all
 * @desc    Get all users (admin only) - Combined View
 * @access  Private (Admin)
 */
router.get("/all", authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    console.log("Fetching all users...");

    // 1. Fetch Staff (admin_users)
    const { data: staff, error: staffError } = await supabase
      .from("admin_users")
      .select("id, email, username, role, is_active, created_at, last_login")
      .order("created_at", { ascending: false });

    if (staffError) {
       console.error("Error fetching admin_users:", staffError);
       throw staffError;
    }
    console.log(`Fetched ${staff?.length} staff records`);

    // 2. Fetch Customers (users)
    // 2. Fetch Customers (users) - resiliently
    let customers = [];
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        // Check for "missing table" error codes (PGRST205 or 42P01)
        if (error.code === 'PGRST205' || error.code === '42P01' || error.message.includes("Could not find the table")) {
           console.warn("⚠️ 'users' table missing. Skipping customers fetch.");
           customers = [];
        } else {
           throw error; // Throw other real errors
        }
      } else {
        customers = data;
      }
    } catch (e) {
       console.warn("⚠️ Failed to fetch customers (non-fatal):", e.message);
       customers = [];
    }
    
    console.log(`Fetched ${customers?.length || 0} customer records`);

    // 3. Format & Combine
    const safeStaff = staff || [];
    const formattedStaff = safeStaff.map(user => ({
      id: user.id || Math.random(), // Fallback ID
      type: 'admin_user',
      name: user.username || "Unknown Staff",
      email: user.email || "-",
      phone: "-", 
      role: user.role || "admin",
      status: user.is_active ? "active" : "locked",
      createdAt: user.created_at || new Date().toISOString(),
      lastLogin: user.last_login || null
    }));

    const safeCustomers = customers || [];
    const formattedCustomers = safeCustomers.map(user => ({
      id: user.id || Math.random(), 
      type: 'user', 
      name: user.full_name || user.name || user.username || "Customer", 
      email: user.email || "-",
      phone: user.phone || "-", 
      role: "buyer", 
      status: user.is_active ? "active" : "locked",
      createdAt: user.created_at || new Date().toISOString(),
      lastLogin: user.last_login || null
    }));

    // Combine and Sort
    const allUsers = [...formattedStaff, ...formattedCustomers].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    console.log(`Sending ${allUsers.length} total users`);

    res.json({
      success: true,
      data: allUsers,
      total: allUsers.length,
    });
  } catch (error) {
    console.error("Get all users CRITICAL error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message || "Unknown Server Error",
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});



// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "default-secret-key",
    (err, user) => {
      if (err) {
        console.error("JWT Verify Error:", err.message);
        return res.status(403).json({
          success: false,
          message: "Invalid or expired token",
        });
      }
      req.user = user;
      next();
    }
  );
}

// Middleware to check if user is admin
function authenticateAdmin(req, res, next) {
  console.log("Admin Middleware Check:", req.user); // Debug log

  if (!req.user || !req.user.role) {
      console.error("Admin Check Failed: No user/role in request");
      return res.status(403).json({
          success: false,
          message: "Unauthorized: No user role found"
      });
  }

  // Accept both 'admin' and 'super_admin' roles
  const allowedRoles = ["admin", "super_admin", "SUPER_ADMIN", "ADMIN"];

  if (!allowedRoles.includes(req.user.role)) {
    console.warn(`Admin Check Failed: Role '${req.user.role}' not allowed`);
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
      userRole: req.user.role, 
    });
  }
  next();
}

module.exports = router;
