import express from 'express';
const router = express.Router();
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { databaseMiddleware } from '../middleware/database.middleware.js';

router.get('/me', authMiddleware, tenantMiddleware, databaseMiddleware, async (req, res) => {
  try {
    const { data: tenant, error } = await req.db
      .from('tenants')
      .select('id, name')
      .eq('id', req.tenant_id)
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json({ tenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
