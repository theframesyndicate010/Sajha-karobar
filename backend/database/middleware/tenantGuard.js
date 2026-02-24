import { supabase } from "../config/Supabase.js";

export const tenantMiddleware = async (req, res, next) => {
  try {
    // Get tenant_id from authenticated user
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user's tenant from users table
    const { data: userData, error } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (error || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add tenant_id to request for use in controllers
    req.tenant_id = userData.tenant_id;
    
    next();
  } catch (err) {
    res.status(500).json({ error: 'Tenant validation failed' });
  }
};
