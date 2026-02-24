import express from 'express';
import { getCategories } from '../controllers/category.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';

const router = express.Router();

// Apply auth and tenant middleware
router.use(authMiddleware, tenantMiddleware);

// Get categories for the tenant's shop type
router.get('/', getCategories);

export default router;