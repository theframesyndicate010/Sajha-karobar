import express from 'express';
import {
  getRevenueByCategory,
  getTopSellingProducts,
  getStockLevels,
  getDashboardSummary,
  getSalesStatistics,
  getSalesChartData
} from '../controllers/dashboard.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { databaseMiddleware } from '../middleware/database.middleware.js';

const router = express.Router();

// Apply auth, tenant, and database middleware to all routes
router.use(authMiddleware, tenantMiddleware, databaseMiddleware);

// Get revenue by category
router.get('/revenue-by-category', getRevenueByCategory);

// Get top-selling products
router.get('/top-products', getTopSellingProducts);

// Get current stock levels
router.get('/stock-levels', getStockLevels);

// Get dashboard summary
router.get('/summary', getDashboardSummary);

// Get sales statistics
router.get('/sales-stats', getSalesStatistics);

// Get sales chart data
router.get('/sales-chart', getSalesChartData);

export default router;
