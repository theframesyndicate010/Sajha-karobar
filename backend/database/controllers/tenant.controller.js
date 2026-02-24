import { supabase } from "../../config/supabase.js";

export const getMyTenant = async (req, res) => {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ tenant: data });
};
