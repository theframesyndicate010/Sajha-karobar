import { supabase } from "../../config/supabase.js";

export const getData = async (req, res) => {
  const { data, error } = await supabase
    .from("app_data")
    .select("*");

  if (error) return res.status(400).json({ error: error.message });

  res.json({ data });
};

export const createData = async (req, res) => {
  const { data: payload } = req.body;

  const { data, error } = await supabase
    .from("app_data")
    .insert({ data: payload })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.json({ data });
};
