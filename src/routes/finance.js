const express = require("express");
const router = express.Router();
const db = require("../config/database");
const moment = require("moment");

// Get finance summary (Total Revenue, Transactions, Recent History)
router.get("/summary", async (req, res) => {
  try {
    const isSupabase = process.env.USE_SUPABASE === "true";
    let totalRevenue = 0;
    let totalTransactions = 0;
    let recentTransactions = [];
    let monthlyData = [];
    let salesToday = 0;
    let percentageChange = 0;

    if (isSupabase) {
      const supabase = db.getClient();

      // 1. Total Revenue & Transactions (SUCCESS status)
      // Note: Supabase doesn't have a direct 'sum' in simple query builder easily without rpc, 
      // but we can fetch all or use a specific query if the dataset is small, or use .select(count)
      // For scalability, we might want to create a Database Function, but for now let's query successfully paid orders.
      
      const { data: orders, error } = await supabase
        .from("orders")
        .select("total_amount, created_at, id, status, customer_phone")
        .in("status", ["SUCCESS", "PAID", "COMPLETED", "DISPENSING", "PENDING_DISPENSE"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      totalTransactions = orders.length;
      totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      
      // Recent transactions (top 10)
      recentTransactions = orders.slice(0, 10).map(order => ({
        id: order.id,
        date: order.created_at,
        amount: order.total_amount,
        status: order.status,
        customer: order.customer_phone || "Guest"
      }));

      // Group by month for chart (last 6 months)
      const last6Months = {};
      for (let i = 5; i >= 0; i--) {
        const monthKey = moment().subtract(i, "months").format("MMM YYYY");
        last6Months[monthKey] = 0;
      }

      orders.forEach(order => {
        const monthKey = moment(order.created_at).format("MMM YYYY");
        if (last6Months[monthKey] !== undefined) {
          last6Months[monthKey] += order.total_amount;
        }
      });

      monthlyData = Object.keys(last6Months).map(key => ({
        month: key,
        revenue: last6Months[key]
      }));

      // Calculate Sales Today
      const startOfToday = moment().startOf('day');
      salesToday = orders
        .filter(order => moment(order.created_at).isAfter(startOfToday))
        .reduce((sum, order) => sum + (order.total_amount || 0), 0);
      
      const salesYesterday = orders
         .filter(order => moment(order.created_at).isBetween(moment().subtract(1, 'days').startOf('day'), startOfToday))
         .reduce((sum, order) => sum + (order.total_amount || 0), 0);

      // Percentage change
      percentageChange = 0;
      if (salesYesterday > 0) {
          percentageChange = Math.round(((salesToday - salesYesterday) / salesYesterday) * 100);
      } else if (salesToday > 0) {
          percentageChange = 100;
      }

    } else {
      // Logic for local SQLite/MySQL if needed (fallback)
      // Assuming Supabase is the main driver as per previous context
      return res.status(501).json({ error: "Local DB not implemented for finance yet" });
    }

    res.json({
      totalRevenue,
      totalTransactions,
      averageOrderValue: totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0,
      recentTransactions,
      monthlyData,
      salesToday,
      percentageChange
    });
  } catch (error) {
    console.error("Finance API Error:", error);
    res.status(500).json({ error: "Failed to fetch finance summary" });
  }
});

module.exports = router;
