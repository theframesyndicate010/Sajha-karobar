import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { getMe, updateMe } from '../controllers/user.controller.js';

const router = express.Router();

// All user routes need auth and tenant validation
router.use(authMiddleware);
router.use(tenantMiddleware);

router.get('/me', getMe);
router.put('/me', updateMe);

export default router;