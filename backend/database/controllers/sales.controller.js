import { supabase } from '../config/Supabase.js';

// Create a new sale
export const createSale = async (req, res, next) => {
  try {
    const {
      product_id,
      quantity_sold,
      unit_price,
      total_amount,
      sale_date,
      notes
    } = req.body;

    console.log('📝 Creating sale:', { product_id, quantity_sold, unit_price, total_amount });

    // Validate required fields
    if (!product_id || !quantity_sold || !unit_price || !total_amount) {
      const error = new Error('Missing required fields');
      error.status = 400;
      throw error;
    }

    const db = req.db;

    // Check stock availability
    const { data: productData, error: productError } = await db
      .from('products')
      .select('id, stock_quantity')
      .eq('id', product_id)
      .eq('tenant_id', req.tenant_id)
      .single();

    if (productError || !productData) {
      const error = new Error('Product not found');
      error.status = 404;
      throw error;
    }

    if (productData.stock_quantity < quantity_sold) {
      const error = new Error(`Insufficient stock. Available: ${productData.stock_quantity}, Requested: ${quantity_sold}`);
      error.status = 400;
      throw error;
    }

    // Create sale record
    const { data: saleData, error: saleError } = await db
      .from('sales')
      .insert([{
        tenant_id: req.tenant_id,
        product_id,
        quantity_sold,
        unit_price,
        total_amount,
        sale_date: sale_date || new Date().toISOString().split('T')[0],
        notes: notes || null,
        created_at: new Date().toISOString()
      }])
      .select();

    if (saleError) {
      console.error('❌ Error creating sale:', saleError);
      const error = new Error(saleError.message || 'Failed to create sale');
      error.status = 500;
      throw error;
    }

    // Decrement stock quantity after successful sale
    const newStockQty = productData.stock_quantity - quantity_sold;
    const { error: stockError } = await db
      .from('products')
      .update({ stock_quantity: newStockQty })
      .eq('id', product_id)
      .eq('tenant_id', req.tenant_id);

    if (stockError) {
      console.error('⚠️ Sale created but stock update failed:', stockError);
    } else {
      console.log(`📦 Stock updated: ${productData.stock_quantity} → ${newStockQty}`);
    }

    console.log('✅ Sale created successfully:', saleData[0]);
    res.status(201).json(saleData[0]);
  } catch (err) {
    console.error('❌ Error in createSale:', err);
    next(err);
  }
};

// Get all sales
export const getSales = async (req, res, next) => {
  try {
    const db = req.db;
    const { start_date, end_date, product_id } = req.query;

    let query = db
      .from('sales')
      .select('*, products(name, price, category_id)')
      .eq('tenant_id', req.tenant_id);

    if (start_date) {
      query = query.gte('sale_date', start_date);
    }

    if (end_date) {
      query = query.lte('sale_date', end_date);
    }

    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    const { data, error } = await query.order('sale_date', { ascending: false });

    if (error) {
      const dbError = new Error(error.message || 'Failed to fetch sales');
      dbError.status = 500;
      throw dbError;
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
};

// Get sales by date range
export const getSalesByDateRange = async (req, res, next) => {
  try {
    const db = req.db;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      const error = new Error('start_date and end_date are required');
      error.status = 400;
      throw error;
    }

    const { data, error } = await db
      .from('sales')
      .select('*, products(name, price)')
      .eq('tenant_id', req.tenant_id)
      .gte('sale_date', start_date)
      .lte('sale_date', end_date)
      .order('sale_date', { ascending: false });

    if (error) {
      const dbError = new Error(error.message || 'Failed to fetch sales');
      dbError.status = 500;
      throw dbError;
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
};

// Delete a sale and restore stock
export const deleteSale = async (req, res, next) => {
  try {
    const { saleId } = req.params;
    const db = req.db;

    // First get the sale to know product_id and quantity for stock restoration
    const { data: saleRecord, error: fetchError } = await db
      .from('sales')
      .select('product_id, quantity_sold')
      .eq('id', saleId)
      .eq('tenant_id', req.tenant_id)
      .single();

    if (fetchError || !saleRecord) {
      const notFoundError = new Error('Sale not found');
      notFoundError.status = 404;
      throw notFoundError;
    }

    const { data, error } = await db
      .from('sales')
      .delete()
      .eq('id', saleId)
      .eq('tenant_id', req.tenant_id)
      .select();

    if (error) {
      const dbError = new Error(error.message || 'Failed to delete sale');
      dbError.status = 500;
      throw dbError;
    }

    if (!data || data.length === 0) {
      const notFoundError = new Error('Sale not found');
      notFoundError.status = 404;
      throw notFoundError;
    }

    // Restore stock quantity
    const { data: product } = await db
      .from('products')
      .select('stock_quantity')
      .eq('id', saleRecord.product_id)
      .single();

    if (product) {
      await db
        .from('products')
        .update({ stock_quantity: (product.stock_quantity || 0) + saleRecord.quantity_sold })
        .eq('id', saleRecord.product_id)
        .eq('tenant_id', req.tenant_id);
      console.log(`📦 Stock restored: +${saleRecord.quantity_sold} for product ${saleRecord.product_id}`);
    }

    res.json({ message: 'Sale deleted successfully' });
  } catch (err) {
    next(err);
  }
};
