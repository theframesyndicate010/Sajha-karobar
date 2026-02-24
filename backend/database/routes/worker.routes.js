import express from "express";
import {
    addWorker,
    getAllWorkers,
    getWorkerById,
    updateWorker,
    deleteWorker,
    recordPayment,
    getPaymentHistory
} from "../controllers/worker.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { tenantMiddleware } from "../middleware/tenant.middleware.js";

const router = express.Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware, tenantMiddleware);

// Add a new worker
router.post("/", addWorker);

// Get all workers
router.get("/", getAllWorkers);

// Record salary payment
router.post("/payments", recordPayment);

// Get payment history for a worker
router.get("/payments/:workerId", getPaymentHistory);

// Get a single worker by ID
router.get("/:id", getWorkerById);

// Update a worker
router.put("/:id", updateWorker);

// Delete a worker
router.delete("/:id", deleteWorker);

export default router;
