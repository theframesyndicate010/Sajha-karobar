/**
 * StockService - Handles all stock-related operations
 * Manages stock validation, adjustments, and reversals
 * Ensures atomic operations and consistency
 */

export class StockService {
  /**
   * Validate stock availability for sell bills
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {Array} items - Items to validate
   * @returns {Promise<Object>} Validation result with errors if any
   */
  static async validateStockAvailability(db, tenantId, items) {
    const errors = [];

    for (const item of items) {
      const { data: productData, error: productError } = await db
        .from('products')
        .select('stock_quantity')
        .eq('tenant_id', tenantId)
        .ilike('name', item.product_name)
        .single();

      if (productError || !productData) {
        errors.push({
          product_name: item.product_name,
          error: 'Product not found in inventory'
        });
        continue;
      }

      if (productData.stock_quantity < item.quantity) {
        errors.push({
          product_name: item.product_name,
          required: item.quantity,
          available: productData.stock_quantity
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Adjust stock for a bill (atomic operation)
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} billId - Bill ID
   * @param {string} billType - Type of bill ('sell' or 'buy')
   * @param {Array} items - Items to adjust stock for
   * @returns {Promise<Array>} Array of stock adjustments made
   */
  static async adjustStock(db, tenantId, billId, billType, items) {
    const adjustments = [];

    for (const item of items) {
      const { data: productData } = await db
        .from('products')
        .select('id, stock_quantity')
        .eq('tenant_id', tenantId)
        .ilike('name', item.product_name)
        .single();

      if (!productData) {
        // For buy bills, create product if it doesn't exist
        if (billType === 'buy') {
          const { data: newProduct } = await db
            .from('products')
            .insert([
              {
                tenant_id: tenantId,
                name: item.product_name,
                price: item.unit_price,
                stock_quantity: item.quantity,
                created_at: new Date().toISOString()
              }
            ])
            .select()
            .single();

          if (newProduct) {
            adjustments.push({
              product_id: newProduct.id,
              product_name: item.product_name,
              quantity_change: item.quantity,
              operation_type: billType,
              previous_quantity: 0,
              new_quantity: item.quantity
            });
          }
        }
        continue;
      }

      const previousQuantity = productData.stock_quantity;
      let newQuantity = previousQuantity;

      if (billType === 'sell') {
        newQuantity = previousQuantity - item.quantity;
      } else if (billType === 'buy') {
        newQuantity = previousQuantity + item.quantity;
      }

      // Update product stock
      await db
        .from('products')
        .update({ stock_quantity: newQuantity })
        .eq('id', productData.id);

      // Log stock adjustment
      await db
        .from('stock_adjustments')
        .insert([
          {
            tenant_id: tenantId,
            product_id: productData.id,
            product_name: item.product_name,
            quantity_change: billType === 'sell' ? -item.quantity : item.quantity,
            operation_type: billType,
            bill_id: billId,
            previous_quantity: previousQuantity,
            new_quantity: newQuantity
          }
        ]);

      adjustments.push({
        product_id: productData.id,
        product_name: item.product_name,
        quantity_change: billType === 'sell' ? -item.quantity : item.quantity,
        operation_type: billType,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity
      });
    }

    return adjustments;
  }

  /**
   * Reverse stock adjustments for a bill
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} billId - Bill ID
   * @param {string} billType - Type of bill ('sell' or 'buy')
   * @param {Array} items - Items to reverse stock for
   * @returns {Promise<Array>} Array of reversals made
   */
  static async reverseStockAdjustment(db, tenantId, billId, billType, items) {
    const reversals = [];

    for (const item of items) {
      const { data: productData } = await db
        .from('products')
        .select('id, stock_quantity')
        .eq('tenant_id', tenantId)
        .ilike('name', item.product_name)
        .single();

      if (!productData) {
        continue;
      }

      const previousQuantity = productData.stock_quantity;
      let newQuantity = previousQuantity;

      // Reverse the adjustment
      if (billType === 'sell') {
        newQuantity = previousQuantity + item.quantity;
      } else if (billType === 'buy') {
        newQuantity = previousQuantity - item.quantity;
      }

      // Update product stock
      await db
        .from('products')
        .update({ stock_quantity: newQuantity })
        .eq('id', productData.id);

      // Log reversal
      await db
        .from('stock_adjustments')
        .insert([
          {
            tenant_id: tenantId,
            product_id: productData.id,
            product_name: item.product_name,
            quantity_change: billType === 'sell' ? item.quantity : -item.quantity,
            operation_type: billType === 'sell' ? 'buy' : 'sell',
            bill_id: billId,
            previous_quantity: previousQuantity,
            new_quantity: newQuantity
          }
        ]);

      reversals.push({
        product_id: productData.id,
        product_name: item.product_name,
        quantity_change: billType === 'sell' ? item.quantity : -item.quantity,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity
      });
    }

    return reversals;
  }

  /**
   * Get current stock level for a product
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} productName - Product name
   * @returns {Promise<number>} Current stock quantity
   */
  static async getStockLevel(db, tenantId, productName) {
    const { data: productData, error } = await db
      .from('products')
      .select('stock_quantity')
      .eq('tenant_id', tenantId)
      .ilike('name', productName)
      .single();

    if (error || !productData) {
      return 0;
    }

    return productData.stock_quantity;
  }

  /**
   * Get stock adjustment history for a bill
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} billId - Bill ID
   * @returns {Promise<Array>} Array of stock adjustments
   */
  static async getStockAdjustmentHistory(db, tenantId, billId) {
    const { data, error } = await db
      .from('stock_adjustments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('bill_id', billId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch stock adjustment history: ${error.message}`);
    }

    return data || [];
  }
}
