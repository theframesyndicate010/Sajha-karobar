import express from 'express';
const router = express.Router();

import { supabase, supabaseAdmin } from '../config/Supabase.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';

// Temporary debug route to inspect shop_types table
router.get('/debug/shop-types', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('shop_types')
      .select('*');

    if (error) {
      return res.status(500).json({ error: `Failed to fetch shop types: ${error.message}` });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `An unexpected error occurred: ${err.message}` });
  }
});

router.get('/data', authMiddleware, tenantMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('app_data')
    .select('*')
    .eq('tenant_id', req.tenant_id);

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

router.post('/data', authMiddleware, tenantMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('app_data').insert({
    tenant_id: req.tenant_id,
    data: req.body
  });

  if (error) return res.status(400).json({ error: error.message });

  res.json(data);
});

export default router;