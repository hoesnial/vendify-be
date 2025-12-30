const express = require("express");
const db = require("../config/database");

const router = express.Router();

// Get machine info
router.get("/:machine_id", async (req, res) => {
  try {
    const { machine_id } = req.params;

    if (process.env.USE_SUPABASE === "true") {
      const supabase = db.getClient();
      
      const { data: machine, error: machineError } = await supabase
        .from("machines")
        .select("*")
        .eq("id", machine_id)
        .single();

      if (machineError || !machine) {
        return res.status(404).json({
          error: "Machine not found",
        });
      }

      const { data: slots, error: slotsError } = await supabase
        .from("slots")
        .select(`
          *,
          products (
            name,
            image_url
          )
        `)
        .eq("machine_id", machine_id)
        .order("slot_number", { ascending: true });

      if (slotsError) throw slotsError;

      // Transform slots to match MySQL structure
      const transformedSlots = slots.map(s => ({
        ...s,
        product_name: s.products?.name,
        image_url: s.products?.image_url
      }));

      res.json({
        ...machine,
        slots: transformedSlots,
      });
    } else {
      // MySQL Implementation
      const machine = await db.query(
        "SELECT * FROM machines WHERE id = ?",
        [machine_id]
      );

      if (machine.length === 0) {
        return res.status(404).json({
          error: "Machine not found",
        });
      }

      const machineInfo = machine[0];

      const slots = await db.query(
        `
        SELECT s.*, p.name as product_name, p.image_url
        FROM slots s
        LEFT JOIN products p ON s.product_id = p.id
        WHERE s.machine_id = ?
        ORDER BY s.slot_number ASC
        `,
        [machine_id]
      );

      res.json({
        ...machineInfo,
        slots,
      });
    }
  } catch (error) {
    console.error("Get machine error:", error);
    res.status(500).json({
      error: "Failed to get machine info",
    });
  }
});

// Update machine status
router.post("/:machine_id/status", async (req, res) => {
  try {
    const { machine_id } = req.params;
    const { status } = req.body;

    if (!["ONLINE", "OFFLINE", "MAINTENANCE"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status",
      });
    }

    if (process.env.USE_SUPABASE === "true") {
      const supabase = db.getClient();
      const { error } = await supabase
        .from("machines")
        .update({ status, last_seen: new Date().toISOString() })
        .eq("id", machine_id);

      if (error) throw error;
    } else {
      await db.query(
        `
        UPDATE machines 
        SET status = ?, last_seen = NOW() 
        WHERE id = ?
      `,
        [status, machine_id]
      );
    }

    res.json({
      machine_id,
      status,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Update machine status error:", error);
    res.status(500).json({
      error: "Failed to update machine status",
    });
  }
});

// Get machine statistics
router.get("/:machine_id/stats", async (req, res) => {
  try {
    if (process.env.USE_SUPABASE === "true") {
      // Basic stats for Supabase (full analytics pending)
      res.json({
        sales_stats: { total_orders: 0, total_revenue: 0 },
        stock_levels: [],
        popular_products: []
      });
      return;
    }

    const { machine_id } = req.params;
    const { period = "24h" } = req.query;
    
    // ... Existing MySQL Stats Logic ...
    let timeCondition = "";
    switch (period) {
      case "1h":
        timeCondition = "AND o.created_at >= NOW() - INTERVAL 1 HOUR";
        break;
      case "24h":
        timeCondition = "AND o.created_at >= NOW() - INTERVAL 24 HOUR";
        break;
      case "7d":
        timeCondition = "AND o.created_at >= NOW() - INTERVAL 7 DAY";
        break;
      case "30d":
        timeCondition = "AND o.created_at >= NOW() - INTERVAL 30 DAY";
        break;
    }

    // Sales statistics
    const salesStats = await db.query(
      `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_orders,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount ELSE 0 END), 0) as total_revenue
      FROM orders o
      WHERE machine_id = ? ${timeCondition}
    `,
      [machine_id]
    );

    // Stock levels
    const stockLevels = await db.query(
      `
      SELECT 
        s.slot_number,
        p.name as product_name,
        s.current_stock,
        s.capacity,
        ROUND((s.current_stock / s.capacity) * 100, 2) as stock_percentage
      FROM slots s
      LEFT JOIN products p ON s.product_id = p.id
      WHERE s.machine_id = ?
      ORDER BY s.slot_number ASC
    `,
      [machine_id]
    );

    // Popular products
    const popularProducts = await db.query(
      `
      SELECT 
        p.name,
        COUNT(*) as order_count,
        SUM(o.quantity) as total_quantity,
        SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total_amount ELSE 0 END) as revenue
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.machine_id = ? ${timeCondition}
      GROUP BY p.id, p.name
      ORDER BY order_count DESC
      LIMIT 5
    `,
      [machine_id]
    );

    res.json({
      machine_id,
      period,
      sales_stats: salesStats[0],
      stock_levels: stockLevels,
      popular_products: popularProducts,
    });
  } catch (error) {
    console.error("Get machine stats error:", error);
    res.status(500).json({
      error: "Failed to get machine statistics",
    });
  }
});

// Assign product to slot
router.post("/:machine_id/slots/assign", async (req, res) => {
  try {
    const { machine_id } = req.params;
    const { slot_id, product_id } = req.body;

    if (!slot_id || !product_id) {
      return res.status(400).json({
        error: "slot_id and product_id are required",
      });
    }

    if (process.env.USE_SUPABASE === "true") {
      const supabase = db.getClient();
      
      const { data: updatedSlot, error } = await supabase
        .from("slots")
        .update({ product_id })
        .eq("id", slot_id)
        .eq("machine_id", machine_id)
        .select(`
          *,
          products (
            name,
            image_url
          )
        `)
        .single();

      if (error) throw error;
      if (!updatedSlot) return res.status(404).json({ error: "Slot not found" });

      res.json({
        message: "Slot updated successfully",
        slot: {
            ...updatedSlot,
            product_name: updatedSlot.products?.name,
            image_url: updatedSlot.products?.image_url
        }
      });
    } else {
      // MySQL Implementation
      const slot = await db.query(
        "SELECT * FROM slots WHERE id = ? AND machine_id = ?",
        [slot_id, machine_id]
      );

      if (slot.length === 0) {
        return res.status(404).json({
          error: "Slot not found",
        });
      }

      await db.query(
        "UPDATE slots SET product_id = ? WHERE id = ?",
        [product_id, slot_id]
      );

      const updatedSlot = await db.query(
          `
          SELECT s.*, p.name as product_name, p.image_url
          FROM slots s
          LEFT JOIN products p ON s.product_id = p.id
          WHERE s.id = ?
          `,
          [slot_id]
      );

      res.json({
          message: "Slot updated successfully",
          slot: updatedSlot[0]
      });
    }
  } catch (error) {
    console.error("Assign slot error:", error);
    res.status(500).json({
      error: "Failed to assign slot",
    });
  }
});

module.exports = router;
