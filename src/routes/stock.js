const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");

const router = express.Router();

// Set to true after applying src/database/migrations/02_stock_trigger.sql
const USE_DB_TRIGGER = true;

// Validation middleware
const validateStockUpdate = [
  body("slot_id").isInt({ min: 1 }).withMessage("Valid slot_id is required"),
  body("quantity").isInt({ min: 0 }).withMessage("Valid quantity is required"),
  body("change_type")
    .isIn(["RESTOCK", "MANUAL_ADJUST", "AUDIT", "REMOVE"])
    .withMessage("Valid change_type is required"),
  body("reason")
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage("Reason must be string max 200 chars"),
];

// Get stock levels for machine
router.get("/:machine_id", async (req, res) => {
  try {
    const { machine_id } = req.params;

    if (process.env.USE_SUPABASE === "true") {
      const supabase = db.getClient();
      const { data: slots, error } = await supabase
        .from("slots")
        .select(`
          id,
          slot_number,
          current_stock,
          capacity,
          is_active,
          product_id,
          products (
            name,
            image_url
          )
        `)
        .eq("machine_id", machine_id)
        .order("slot_number", { ascending: true });

      if (error) throw error;

      // Transform and calculate levels
      const stock = slots.map(s => {
        const percentage = (s.current_stock / s.capacity) * 100;
        let level = "FULL";
        if (s.current_stock === 0) level = "EMPTY";
        else if (s.current_stock <= s.capacity * 0.2) level = "LOW";
        else if (s.current_stock <= s.capacity * 0.5) level = "MEDIUM";

        return {
          slot_id: s.id,
          slot_number: s.slot_number,
          current_stock: s.current_stock,
          capacity: s.capacity,
          is_active: s.is_active,
          product_id: s.product_id,
          product_name: s.products?.name,
          image_url: s.products?.image_url,
          stock_percentage: parseFloat(percentage.toFixed(2)),
          stock_level: level
        };
      });

      const summary = {
        total_slots: stock.length,
        empty_slots: stock.filter((s) => s.stock_level === "EMPTY").length,
        low_stock_slots: stock.filter((s) => s.stock_level === "LOW").length,
        active_slots: stock.filter((s) => s.is_active).length,
      };

      res.json({
        machine_id,
        summary,
        slots: stock,
      });

    } else {
      // MySQL Implementation
      const stock = await db.query(
        `
        SELECT 
          s.id as slot_id,
          s.slot_number,
          s.current_stock,
          s.capacity,
          s.is_active,
          p.id as product_id,
          p.name as product_name,
          p.image_url,
          ROUND((s.current_stock / s.capacity) * 100, 2) as stock_percentage,
          CASE 
            WHEN s.current_stock = 0 THEN 'EMPTY'
            WHEN s.current_stock <= (s.capacity * 0.2) THEN 'LOW'
            WHEN s.current_stock <= (s.capacity * 0.5) THEN 'MEDIUM'
            ELSE 'FULL'
          END as stock_level
        FROM slots s
        LEFT JOIN products p ON s.product_id = p.id
        WHERE s.machine_id = ?
        ORDER BY s.slot_number ASC
      `,
        [machine_id]
      );

      // Calculate summary
      const summary = {
        total_slots: stock.length,
        empty_slots: stock.filter((s) => s.stock_level === "EMPTY").length,
        low_stock_slots: stock.filter((s) => s.stock_level === "LOW").length,
        active_slots: stock.filter((s) => s.is_active).length,
      };

      res.json({
        machine_id,
        summary,
        slots: stock,
      });
    }
  } catch (error) {
    console.error("Get stock error:", error);
    res.status(500).json({
      error: "Failed to get stock levels",
    });
  }
});

// Update stock (restock/adjust)
// Update stock (restock/adjust)
router.post("/update", validateStockUpdate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      });
    }

    const {
      slot_id,
      quantity,
      change_type,
      reason,
      expected_current_stock, // OCC Value
      performed_by = "system",
    } = req.body;

    if (process.env.USE_SUPABASE === "true") {
      const supabase = db.getClient();
      
      // Get current slot info
      const { data: slotInfo, error: slotError } = await supabase
        .from("slots")
        .select(`
          *,
          machines (id)
        `)
        .eq("id", slot_id)
        .single();
      
      if (slotError || !slotInfo) {
          return res.status(404).json({ error: "Slot not found" });
      }

      // OPTIMISTIC CONCURRENCY CHECK
      if (expected_current_stock !== undefined) {
          if (Number(expected_current_stock) !== Number(slotInfo.current_stock)) {
              console.warn(`[StockUpdate] OCC Mismatch. Exp: ${expected_current_stock}, Act: ${slotInfo.current_stock}`);
              return res.status(409).json({
                  error: "Data has changed",
                  message: "Stok telah berubah di server. Silakan refresh dan coba lagi.",
                  current_stock: slotInfo.current_stock
              });
          }
      }

      console.log(`[StockUpdate] Req: ID=${slot_id} Type=${change_type} Qty=${quantity}`);
      const quantity_before = slotInfo.current_stock;
      console.log(`[StockUpdate] Before: ${quantity_before}`);
      
      // === IDEMPOTENCY CHECK START ===
      const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
      let dbChangeType = change_type;
      if (change_type === "REMOVE") dbChangeType = "MANUAL_ADJUST";
      
      const { data: recentLogs } = await supabase
        .from("stock_logs")
        .select("*")
        .eq("slot_id", slot_id)
        .eq("change_type", dbChangeType)
        .gte("created_at", fiveSecondsAgo)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentLogs && recentLogs.length > 0) {
          const recent = recentLogs[0];
          // Check for exact duplicate logic
          let isDuplicate = false;
          
          if (change_type === "RESTOCK" && recent.quantity_change === quantity) isDuplicate = true;
          if (change_type === "REMOVE" && recent.quantity_change === -quantity) isDuplicate = true;
          // For MANUAL_ADJUST, we check if quantity_after matches what we want to set?
          // But recent.quantity_change is delta.
          // Let's assume manual adjust sets absolute, so quantity_after should match.
          if (change_type === "MANUAL_ADJUST") {
               // Calculate what our AFTER would be
               const proposed_after = Math.min(Math.max(quantity, 0), slotInfo.capacity);
               if (recent.quantity_after === proposed_after) isDuplicate = true;
          }

          if (isDuplicate) {
             console.warn(`[StockUpdate] ⚠️ DUPLICATE DETECTED (Log ID: ${recent.id}). Ignoring.`);
             return res.json({
                 slot_id,
                 machine_id: slotInfo.machine_id,
                 slot_number: slotInfo.slot_number,
                 change_type,
                 quantity_before: recent.quantity_before, // Return existing
                 quantity_after: recent.quantity_after,
                 quantity_change: recent.quantity_change,
                 reason: "Duplicate Request (Cached)",
                 performed_by,
                 updated_at: recent.created_at,
                 is_duplicate: true
             });
          }
      }
      // === IDEMPOTENCY CHECK END ===

      let quantity_after = quantity;
      let quantity_change = 0;

      // Calculate quantity change based on type
      if (change_type === "RESTOCK") {
        quantity_after = Math.min(quantity_before + quantity, slotInfo.capacity);
        quantity_change = quantity_after - quantity_before;
      } else if (change_type === "MANUAL_ADJUST") {
        quantity_after = Math.min(Math.max(quantity, 0), slotInfo.capacity);
        quantity_change = quantity_after - quantity_before;
      } else if (change_type === "REMOVE") {
        quantity_after = Math.max(quantity_before - quantity, 0);
        quantity_change = quantity_after - quantity_before;
      } else if (change_type === "AUDIT") {
        quantity_after = Math.min(Math.max(quantity, 0), slotInfo.capacity);
        quantity_change = quantity_after - quantity_before;
      }
      console.log(`[StockUpdate] Calc: ${quantity_before} -> ${quantity_after} (Change: ${quantity_change})`);

      // Update slot stock
      if (!USE_DB_TRIGGER) {
        const { error: updateError } = await supabase
          .from("slots")
          .update({ current_stock: quantity_after })
          .eq("id", slot_id);

        if (updateError) throw updateError;
      }

      // Log stock change
      const { error: logError } = await supabase
        .from("stock_logs")
        .insert({
            machine_id: slotInfo.machine_id,
            slot_id: slot_id,
            change_type: change_type === "REMOVE" ? "MANUAL_ADJUST" : change_type,
            quantity_before: quantity_before,
            quantity_after: quantity_after,
            quantity_change: quantity_change,
            reason: reason,
            performed_by: performed_by
        });

      if (logError) throw logError;

      res.json({
        slot_id,
        machine_id: slotInfo.machine_id,
        slot_number: slotInfo.slot_number,
        change_type,
        quantity_before,
        quantity_after,
        quantity_change,
        reason,
        performed_by,
        updated_at: new Date().toISOString(),
      });

    } else {
        // MySQL Implementation
        const slot = await db.query(
        `
        SELECT s.*, m.id as machine_id
        FROM slots s
        JOIN machines m ON s.machine_id = m.id
        WHERE s.id = ?
        `,
        [slot_id]
        );

        if (slot.length === 0) {
        return res.status(404).json({
            error: "Slot not found",
        });
        }

        const slotInfo = slot[0];

        // OPTIMISTIC CONCURRENCY CHECK
        if (expected_current_stock !== undefined) {
            if (Number(expected_current_stock) !== Number(slotInfo.current_stock)) {
                return res.status(409).json({
                    error: "Data has changed",
                    message: "Stok telah berubah di server. Silakan refresh dan coba lagi.",
                    current_stock: slotInfo.current_stock
                });
            }
        }

        const quantity_before = slotInfo.current_stock;
        let quantity_after = quantity;
        let quantity_change = 0;

        // Calculate quantity change based on type
        if (change_type === "RESTOCK") {
        quantity_after = Math.min(quantity_before + quantity, slotInfo.capacity);
        quantity_change = quantity_after - quantity_before;
        } else if (change_type === "MANUAL_ADJUST") {
        quantity_after = Math.min(Math.max(quantity, 0), slotInfo.capacity);
        quantity_change = quantity_after - quantity_before;
        } else if (change_type === "REMOVE") {
        quantity_after = Math.max(quantity_before - quantity, 0);
        quantity_change = quantity_after - quantity_before;
        } else if (change_type === "AUDIT") {
        quantity_after = Math.min(Math.max(quantity, 0), slotInfo.capacity);
        quantity_change = quantity_after - quantity_before;
        }

        await db.transaction(async (connection) => {
        // Update slot stock
        await connection.execute(
            `
            UPDATE slots SET current_stock = ? WHERE id = ?
        `,
            [quantity_after, slot_id]
        );

        // Log stock change
        await connection.execute(
            `
            INSERT INTO stock_logs (machine_id, slot_id, change_type, quantity_before, quantity_after, quantity_change, reason, performed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
            [
            slotInfo.machine_id,
            slot_id,
            change_type === "REMOVE" ? "MANUAL_ADJUST" : change_type,
            quantity_before,
            quantity_after,
            quantity_change,
            reason,
            performed_by,
            ]
        );
        });

        res.json({
        slot_id,
        machine_id: slotInfo.machine_id,
        slot_number: slotInfo.slot_number,
        change_type,
        quantity_before,
        quantity_after,
        quantity_change,
        reason,
        performed_by,
        updated_at: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error("Update stock error:", error);
    res.status(500).json({
      error: "Failed to update stock",
      details: error.message,
      fullError: error
    });
  }
});

// Get stock logs
router.get("/logs/:machine_id", async (req, res) => {
  try {
    const { machine_id } = req.params;
    const { limit = 50, offset = 0, change_type } = req.query;

    const supabase = db.getClient();

    // Build query
    let query = supabase
      .from("stock_logs")
      .select(
        `
        *,
        slots!inner(
          slot_number,
          products(name)
        )
      `
      )
      .eq("machine_id", machine_id)
      .order("created_at", { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (change_type) {
      query = query.eq("change_type", change_type);
    }

    const { data: logs, error, count } = await query;

    if (error) throw error;

    // Transform data to match expected format
    const transformedLogs = logs.map((log) => ({
      ...log,
      slot_number: log.slots?.slot_number,
      product_name: log.slots?.products?.name,
    }));

    res.json({
      machine_id,
      logs: transformedLogs,
      total: count || logs.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error("Get stock logs error:", error);
    res.status(500).json({
      error: "Failed to get stock logs",
    });
  }
});

// Report current stock snapshot
router.post("/report/:machine_id", async (req, res) => {
  try {
    const { machine_id } = req.params;

    const stock = await db.query(
      `
      SELECT 
        s.id as slot_id,
        s.slot_number,
        s.current_stock,
        s.capacity,
        p.name as product_name
      FROM slots s
      LEFT JOIN products p ON s.product_id = p.id
      WHERE s.machine_id = ?
      ORDER BY s.slot_number ASC
    `,
      [machine_id]
    );

    // Update machine last_seen
    await db.query(
      `
      UPDATE machines SET last_seen = NOW() WHERE id = ?
    `,
      [machine_id]
    );

    // Log the stock report
    for (const slot of stock) {
      await db.query(
        `
        INSERT INTO stock_logs (machine_id, slot_id, change_type, quantity_before, quantity_after, quantity_change, reason, performed_by)
        VALUES (?, ?, 'AUDIT', ?, ?, 0, 'Automated stock report', 'system')
      `,
        [machine_id, slot.slot_id, slot.current_stock, slot.current_stock]
      );
    }

    res.json({
      machine_id,
      reported_at: new Date().toISOString(),
      stock_count: stock.length,
      stock_snapshot: stock,
    });
  } catch (error) {
    console.error("Stock report error:", error);
    res.status(500).json({
      error: "Failed to process stock report",
    });
  }
});

module.exports = router;
