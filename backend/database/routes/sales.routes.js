import express from 'express';
import {
  createSale,
  getSales,
  getSalesByDateRange,
  deleteSale
} from '../controllers/sales.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { databaseMiddleware } from '../middleware/database.middleware.js';

const router = express.Router();

// Apply auth, tenant, and database middleware to all routes
router.use(authMiddleware, tenantMiddleware, databaseMiddleware);

// Create a new sale
router.post('/', createSale);

// Get all sales with optional filters
router.get('/', getSales);

// Get sales by date range
router.get('/date-range', getSalesByDateRange);

// Delete a sale
router.delete('/:saleId', deleteSale);

export default router;
