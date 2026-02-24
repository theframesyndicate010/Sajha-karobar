/**
 * BillService - Handles all bill-related operations
 * Manages bill creation, updates, deletion, and payment tracking
 * Ensures atomic operations and tenant isolation
 */

export class BillService {
  /**
   * Create a new bill with items and automatic stock adjustment
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {Object} billData - Bill data including items
   * @returns {Promise<Object>} Created bill with ID
   * @throws {Error} If validation fails or stock is insufficient
   */
  static async createBill(db, tenantId, billData) {
    const {
      bill_number,
      bill_title,
      bill_date,
      bill_type,
      party_name,
      contact_number,
      email,
      address,
      subtotal,
      discount_percent,
      discount_amount,
      total_amount,
      payment_method,
      payment_type,
      paid_amount,
      remaining_balance,
      notes,
      items
    } = billData;

    // Validate required fields
    if (!bill_number || !bill_title || !bill_date || !bill_type || !party_name || !total_amount) {
      throw new Error('Missing required fields: bill_number, bill_title, bill_date, bill_type, party_name, total_amount');
    }

    // Validate bill_type
    if (!['sell', 'buy'].includes(bill_type)) {
      throw new Error('Invalid bill_type. Must be "sell" or "buy"');
    }

    // Validate payment_type
    if (payment_type && !['full', 'partial'].includes(payment_type)) {
      throw new Error('Invalid payment_type. Must be "full" or "partial"');
    }

    // Validate items
    if (!items || items.length === 0) {
      throw new Error('Bill must contain at least one item');
    }

    // Validate each item
    for (const item of items) {
      if (!item.product_name || item.quantity === undefined || !item.unit_price || !item.unit) {
        throw new Error('Each item must have product_name, quantity, unit_price, and unit');
      }
      if (item.quantity <= 0) {
        throw new Error('Item quantity must be greater than 0');
      }
      if (item.unit_price < 0) {
        throw new Error('Item unit_price cannot be negative');
      }
    }

    // For sell bills, validate stock availability
    if (bill_type === 'sell') {
      for (const item of items) {
        const { data: productData, error: productError } = await db
          .from('products')
          .select('stock_quantity')
          .eq('tenant_id', tenantId)
          .ilike('name', item.product_name)
          .single();

        if (productError || !productData) {
          throw new Error(`Product "${item.product_name}" not found in inventory`);
        }

        if (productData.stock_quantity < item.quantity) {
          throw new Error(
            `Insufficient stock for "${item.product_name}". Available: ${productData.stock_quantity}, Requested: ${item.quantity}`
          );
        }
      }
    }

    // Calculate payment status
    const calculatedRemainingBalance = payment_type === 'full' ? 0 : (total_amount - (paid_amount || 0));
    const status = (paid_amount || 0) >= total_amount ? 'paid' : ((paid_amount || 0) > 0 ? 'partially_paid' : 'unpaid');

    // Insert bill
    const { data: billInsertData, error: billError } = await db
      .from('bills')
      .insert([
        {
          tenant_id: tenantId,
          bill_number,
          bill_title,
          bill_date,
          bill_type,
          party_name,
          contact_number: contact_number || null,
          email: email || null,
          address: address || null,
          subtotal: subtotal || 0,
          discount_percent: discount_percent || 0,
          discount_amount: discount_amount || 0,
          total_amount,
          payment_method: payment_method || null,
          payment_type: payment_type || 'full',
          paid_amount: paid_amount || 0,
          remaining_balance: calculatedRemainingBalance,
          notes: notes || null,
          status
        }
      ])
      .select();

    if (billError) {
      throw new Error(`Failed to create bill: ${billError.message}`);
    }

    const billId = billInsertData[0].id;

    // Insert bill items
    const billItems = items.map(item => ({
      bill_id: billId,
      product_name: item.product_name,
      quantity: item.quantity,
      min_size: item.min_size || null,
      max_size: item.max_size || null,
      unit: item.unit,
      unit_price: item.unit_price,
      category: item.category || null,
      total: item.quantity * item.unit_price
    }));

    const { error: itemsError } = await db
      .from('bill_items')
      .insert(billItems);

    if (itemsError) {
      // Rollback bill creation
      await db.from('bills').delete().eq('id', billId);
      throw new Error(`Failed to add bill items: ${itemsError.message}`);
    }

    // Apply stock adjustments
    for (const item of items) {
      const { data: productData } = await db
        .from('products')
        .select('id, stock_quantity')
        .eq('tenant_id', tenantId)
        .ilike('name', item.product_name)
        .single();

      if (productData) {
        const previousQuantity = productData.stock_quantity;
        let newQuantity = previousQuantity;

        if (bill_type === 'sell') {
          newQuantity = previousQuantity - item.quantity;
        } else if (bill_type === 'buy') {
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
              quantity_change: bill_type === 'sell' ? -item.quantity : item.quantity,
              operation_type: bill_type,
              bill_id: billId,
              previous_quantity: previousQuantity,
              new_quantity: newQuantity
            }
          ]);
      }
    }

    // Create sales records for sell bills
    if (bill_type === 'sell') {
      for (const item of items) {
        await db
          .from('sales_records')
          .insert([
            {
              tenant_id: tenantId,
              bill_id: billId,
              product_name: item.product_name,
              quantity_sold: item.quantity,
              unit_price: item.unit_price,
              total_revenue: item.quantity * item.unit_price,
              sale_date: bill_date,
              category: item.category || null
            }
          ]);
      }
    }

    return billInsertData[0];
  }

  /**
   * Get bills with optional filtering and pagination
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {Object} filters - Filter options (bill_type, payment_type, start_date, end_date)
   * @param {number} limit - Number of results to return
   * @param {number} offset - Number of results to skip
   * @returns {Promise<Array>} Array of bills
   */
  static async getBills(db, tenantId, filters = {}, limit = 50, offset = 0) {
    let query = db
      .from('bills')
      .select('*')
      .eq('tenant_id', tenantId);

    if (filters.bill_type) {
      query = query.eq('bill_type', filters.bill_type);
    }

    if (filters.payment_type) {
      query = query.eq('payment_type', filters.payment_type);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.start_date) {
      query = query.gte('bill_date', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('bill_date', filters.end_date);
    }

    const { data, error, count } = await query
      .order('bill_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch bills: ${error.message}`);
    }

    return { data: data || [], count: count || 0 };
  }

  /**
   * Get bill by ID with items and payment history
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} billId - Bill ID
   * @returns {Promise<Object>} Bill with items and payments
   */
  static async getBillById(db, tenantId, billId) {
    const { data: billData, error: billError } = await db
      .from('bills')
      .select('*')
      .eq('id', billId)
      .eq('tenant_id', tenantId)
      .single();

    if (billError || !billData) {
      throw new Error('Bill not found');
    }

    // Get bill items
    const { data: itemsData, error: itemsError } = await db
      .from('bill_items')
      .select('*')
      .eq('bill_id', billId);

    if (itemsError) {
      throw new Error(`Failed to fetch bill items: ${itemsError.message}`);
    }

    return {
      bill: billData,
      items: itemsData || []
    };
  }

  /**
   * Update bill details
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} billId - Bill ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated bill
   */
  static async updateBill(db, tenantId, billId, updateData) {
    const { data, error } = await db
      .from('bills')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', billId)
      .eq('tenant_id', tenantId)
      .select();

    if (error) {
      throw new Error(`Failed to update bill: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Bill not found');
    }

    return data[0];
  }

  /**
   * Record payment for a bill
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} billId - Bill ID
   * @param {number} paymentAmount - Amount paid
   * @param {string} paymentDate - Payment date
   * @param {string} paymentMethod - Payment method
   * @param {string} notes - Payment notes
   * @returns {Promise<Object>} Updated bill with payment info
   */
  static async recordPayment(db, tenantId, billId, paymentAmount, paymentDate, paymentMethod, notes) {
    if (!paymentAmount || !paymentDate) {
      throw new Error('Payment amount and date are required');
    }

    if (paymentAmount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    // Get current bill
    const { data: billData, error: billError } = await db
      .from('bills')
      .select('*')
      .eq('id', billId)
      .eq('tenant_id', tenantId)
      .single();

    if (billError || !billData) {
      throw new Error('Bill not found');
    }

    // Calculate new payment info
    const newPaidAmount = billData.paid_amount + paymentAmount;
    if (newPaidAmount > billData.total_amount) {
      throw new Error(`Payment amount exceeds bill total. Bill total: ${billData.total_amount}, Already paid: ${billData.paid_amount}, Payment: ${paymentAmount}`);
    }

    const newRemainingBalance = billData.total_amount - newPaidAmount;
    const newStatus = newPaidAmount >= billData.total_amount ? 'paid' : 'partially_paid';

    // Update bill
    const { data: updatedBill, error: updateError } = await db
      .from('bills')
      .update({
        paid_amount: newPaidAmount,
        remaining_balance: newRemainingBalance,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', billId)
      .select();

    if (updateError) {
      throw new Error(`Failed to update bill: ${updateError.message}`);
    }

    return updatedBill[0];
  }

  /**
   * Delete bill and reverse stock adjustments
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} billId - Bill ID
   * @returns {Promise<void>}
   */
  static async deleteBill(db, tenantId, billId) {
    // Get bill details
    const { data: billData, error: billError } = await db
      .from('bills')
      .select('*')
      .eq('id', billId)
      .eq('tenant_id', tenantId)
      .single();

    if (billError || !billData) {
      throw new Error('Bill not found');
    }

    // Get bill items
    const { data: itemsData } = await db
      .from('bill_items')
      .select('*')
      .eq('bill_id', billId);

    // Reverse stock adjustments
    if (itemsData && itemsData.length > 0) {
      for (const item of itemsData) {
        const { data: productData } = await db
          .from('products')
          .select('id, stock_quantity')
          .eq('tenant_id', tenantId)
          .ilike('name', item.product_name)
          .single();

        if (productData) {
          const previousQuantity = productData.stock_quantity;
          let newQuantity = previousQuantity;

          // Reverse the stock adjustment
          if (billData.bill_type === 'sell') {
            newQuantity = previousQuantity + item.quantity;
          } else if (billData.bill_type === 'buy') {
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
                quantity_change: billData.bill_type === 'sell' ? item.quantity : -item.quantity,
                operation_type: billData.bill_type === 'sell' ? 'buy' : 'sell',
                bill_id: billId,
                previous_quantity: previousQuantity,
                new_quantity: newQuantity
              }
            ]);
        }
      }
    }

    // Delete sales records if sell bill
    if (billData.bill_type === 'sell') {
      await db
        .from('sales_records')
        .delete()
        .eq('bill_id', billId);
    }

    // Delete bill (cascades to bill_items)
    const { error: deleteError } = await db
      .from('bills')
      .delete()
      .eq('id', billId);

    if (deleteError) {
      throw new Error(`Failed to delete bill: ${deleteError.message}`);
    }
  }
}
