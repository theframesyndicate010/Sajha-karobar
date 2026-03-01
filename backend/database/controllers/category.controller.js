import { supabase } from "../config/Supabase.js";

export const getCategories = async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    
    console.log(`🏢 Tenant ID from middleware: ${tenantId}`);

    if (!tenantId) {
      console.error('❌ No tenant ID found');
      return res.status(401).json({ error: 'Tenant ID not found' });
    }

    // Get the tenant's shop_type_id
    const { data: tenant, error: tError } = await supabase
      .from('tenants')
      .select('shop_type_id')
      .eq('id', tenantId)
      .single();

    console.log('🏪 Tenant query result:', { tenant, tError });

    if (tError) {
      console.error('❌ Error fetching tenant:', tError);
    }

    if (!tenant?.shop_type_id) {
      console.log('⚠️ No shop_type_id found, returning all categories');
      
      // Fallback: return all categories
      const { data: categories, error: cError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (cError) {
        console.error('❌ Error fetching all categories:', cError);
        throw cError;
      }
      console.log(`✅ Found ${categories.length} categories (all):`, categories);
      return res.status(200).json(categories);
    }

    const shopTypeId = tenant.shop_type_id;

    // Fetch categories for this shop type
    const { data: categories, error: cError } = await supabase
      .from('categories')
      .select('*')
      .eq('shop_type_id', shopTypeId)
      .order('name', { ascending: true });

    if (cError) {
      console.error('❌ Categories error:', cError);
      throw cError;
    }

    console.log(`✅ Found ${categories.length} categories (filtered):`, categories);
    return res.status(200).json(categories);
  } catch (error) {
    console.error('❌ Get categories error:', error);
    return res.status(500).json({ error: error.message });
  }
};