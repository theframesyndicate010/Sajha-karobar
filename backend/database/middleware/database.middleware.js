import { supabaseAdmin } from "../config/Supabase.js";

export const databaseMiddleware = async (req, res, next) => {
  try {
    // Attach Supabase admin client to request
    req.db = supabaseAdmin;
    next();
  } catch (err) {
    console.error('Database middleware error:', err);
    res.status(500).json({ error: 'Database middleware failed' });
  }
};
