const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET /:machine_id - Get temperature logs
router.get("/:machine_id", async (req, res) => {
  try {
    const { machine_id } = req.params;
    const limit = parseInt(req.query.limit) || 24; // Default last 24 readings

    let data;
    
    if (process.env.USE_SUPABASE === "true") {
      const supabase = db.getClient();
      const { data: logs, error } = await supabase
        .from("temperature_logs")
        .select("*")
        .eq("machine_id", machine_id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Supabase Error:", error);
        throw error;
      }
      
      // Reverse to chronological order for charts
      data = logs ? logs.reverse() : [];
    } else {
      // MySQL: Ensure table exists (simple migration check)
      await db.query(`
        CREATE TABLE IF NOT EXISTS temperature_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          machine_id VARCHAR(50) NOT NULL,
          value FLOAT NOT NULL,
          humidity FLOAT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const logs = await db.query(
        "SELECT * FROM temperature_logs WHERE machine_id = ? ORDER BY created_at DESC LIMIT ?",
        [machine_id, limit]
      );
      
      data = logs.reverse();
    }

    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Get temperature error details:", error);
    res.status(500).json({ error: "Failed to get temperature data", details: error.message });
  }
});

// POST /log - Log new temperature (for ESP32/MQTT)
router.post("/log", async (req, res) => {
  try {
    const { machine_id, value, humidity } = req.body;

    if (!machine_id || value === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let newLog;

    if (process.env.USE_SUPABASE === "true") {
      const supabase = db.getClient();
      const { data, error } = await supabase
        .from("temperature_logs")
        .insert([{ machine_id, value: parseFloat(value), humidity: parseFloat(humidity || 0) }])
        .select()
        .single();

      if (error) throw error;
      newLog = data;
    } else {
      // MySQL
      await db.query(`
        CREATE TABLE IF NOT EXISTS temperature_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          machine_id VARCHAR(50) NOT NULL,
          value FLOAT NOT NULL,
          humidity FLOAT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = await db.query(
        "INSERT INTO temperature_logs (machine_id, value, humidity) VALUES (?, ?, ?)",
        [machine_id, parseFloat(value), parseFloat(humidity || 0)]
      );
      
      newLog = { id: result.insertId, machine_id, value, humidity, created_at: new Date() };
    }

    res.json({
      success: true,
      data: newLog,
      message: "Temperature logged successfully"
    });
  } catch (error) {
    console.error("Log temperature error:", error);
    res.status(500).json({ error: "Failed to log temperature" });
  }
});

module.exports = router;
