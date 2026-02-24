import express from "express";
import {
    createBill,
    getBills,
    getBillById,
    updateBill,
    recordPayment,
    deleteBill,
    getBillStats,
    updateBillItem,
    deleteBillItem
} from "../controllers/bill.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { tenantMiddleware } from "../middleware/tenant.middleware.js";
import { databaseMiddleware } from "../middleware/database.middleware.js";
import { checkStockAvailability } from "../middleware/stock.middleware.js";

const router = express.Router();

// Apply auth, tenant, and database middleware to all routes
router.use(authMiddleware, tenantMiddleware, databaseMiddleware);

// Create a new bill (with stock check)
router.post("/", checkStockAvailability, createBill);

// Get all bills with filters
router.get("/", getBills);

// Get bill statistics
router.get("/stats", getBillStats);

// Get bill by ID with items and payments
router.get("/:billId", getBillById);

// Update bill details
router.put("/:billId", updateBill);

// Update bill item
router.put("/:billId/items/:itemId", updateBillItem);

// Delete bill item
router.delete("/:billId/items/:itemId", deleteBillItem);

// Record payment for a bill
router.post("/:billId/payments", recordPayment);

// Delete a bill
router.delete("/:billId", deleteBill);

export default router;
