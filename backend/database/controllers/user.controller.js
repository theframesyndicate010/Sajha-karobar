import { supabase } from "../config/Supabase.js";

export const getMe = async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", req.user.id)
    .eq("tenant_id", req.tenant_id) // Add tenant filter
    .eq("shop_type", req.body.shopType)
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ user: data });
};

export const updateMe = async (req, res) => {
  const { name } = req.body;

  const { data, error } = await supabase
    .from("users")
    .update({ name })
    .eq("id", req.user.id)
    .eq("tenant_id", req.tenant_id) // Add tenant filter
    .eq("shop_type", req.body.shopType)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ user: data });
};