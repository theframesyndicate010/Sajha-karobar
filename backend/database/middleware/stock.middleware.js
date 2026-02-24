export const checkStockAvailability = async (req, res, next) => {
  try {
    const { bill_type, items } = req.body;
    const db = req.db;

    // Only check stock for sell bills
    if (bill_type !== 'sell') {
      return next();
    }

    // Validate items exist
    if (!items || items.length === 0) {
      const error = new Error('No items in bill');
      error.status = 400;
      throw error;
    }

    // Check stock for each item
    for (const item of items) {
      // Get product by name (scoped to tenant)
      const { data: productData, error: productError } = await db
        .from('products')
        .select('id, name, stock_quantity')
        .eq('tenant_id', req.tenant_id)
        .ilike('name', item.product_name)
        .single();

      // If product not found in inventory, skip stock check (allow bill creation)
      if (productError || !productData) {
        console.warn(`⚠️ Product "${item.product_name}" not found in inventory, skipping stock check`);
        continue;
      }

      // Check if stock is available
      if (productData.stock_quantity <= 0) {
        const error = new Error(`Product "${item.product_name}" is out of stock`);
        error.status = 400;
        throw error;
      }

      // Check if requested quantity is available
      if (productData.stock_quantity < item.quantity) {
        const error = new Error(`Insufficient stock for "${item.product_name}". Available: ${productData.stock_quantity}, Requested: ${item.quantity}`);
        error.status = 400;
        throw error;
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};
