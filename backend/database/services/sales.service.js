/**
 * SalesService - Handles all sales record operations
 * Manages automatic sales record creation from sell bills
 * Tracks sales metrics and provides sales analytics
 */

export class SalesService {
  /**
   * Create sales records from bill items
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} billId - Bill ID
   * @param {string} billDate - Bill date
   * @param {Array} items - Bill items to create sales records for
   * @returns {Promise<Array>} Array of created sales records
   */
  static async createSalesRecords(db, tenantId, billId, billDate, items) {
    const salesRecords = [];

    for (const item of items) {
      const { data: saleData, error: saleError } = await db
        .from('sales_records')
        .insert([
          {
            tenant_id: tenantId,
            bill_id: billId,
            product_name: item.product_name,
            quantity_sold: item.quantity,
            unit_price: item.unit_price,
            total_revenue: item.quantity * item.unit_price,
            sale_date: billDate,
            category: item.category || null
          }
        ])
        .select();

      if (saleError) {
        throw new Error(`Failed to create sales record: ${saleError.message}`);
      }

      if (saleData && saleData.length > 0) {
        salesRecords.push(saleData[0]);
      }
    }

    return salesRecords;
  }

  /**
   * Get sales records with optional filtering
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {Object} filters - Filter options (start_date, end_date, product_name)
   * @param {number} limit - Number of results to return
   * @param {number} offset - Number of results to skip
   * @returns {Promise<Object>} Sales records and count
   */
  static async getSales(db, tenantId, filters = {}, limit = 50, offset = 0) {
    let query = db
      .from('sales_records')
      .select('*')
      .eq('tenant_id', tenantId);

    if (filters.start_date) {
      query = query.gte('sale_date', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('sale_date', filters.end_date);
    }

    if (filters.product_name) {
      query = query.ilike('product_name', `%${filters.product_name}%`);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error, count } = await query
      .order('sale_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch sales: ${error.message}`);
    }

    return { data: data || [], count: count || 0 };
  }

  /**
   * Get sales by date range
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} Sales records in date range
   */
  static async getSalesByDateRange(db, tenantId, startDate, endDate) {
    if (!startDate || !endDate) {
      throw new Error('start_date and end_date are required');
    }

    const { data, error } = await db
      .from('sales_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch sales: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Delete sales records for a bill
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} billId - Bill ID
   * @returns {Promise<void>}
   */
  static async deleteSalesRecords(db, tenantId, billId) {
    const { error } = await db
      .from('sales_records')
      .delete()
      .eq('bill_id', billId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to delete sales records: ${error.message}`);
    }
  }

  /**
   * Get top selling products
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {number} limit - Number of top products to return
   * @returns {Promise<Array>} Top selling products
   */
  static async getTopSellingProducts(db, tenantId, limit = 10) {
    const { data: sales, error } = await db
      .from('sales_records')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Failed to fetch sales: ${error.message}`);
    }

    // Aggregate sales by product
    const productMap = {};
    (sales || []).forEach(sale => {
      const productName = sale.product_name;
      if (!productMap[productName]) {
        productMap[productName] = {
          product_name: productName,
          category: sale.category,
          total_quantity_sold: 0,
          total_revenue: 0,
          sales_count: 0
        };
      }
      productMap[productName].total_quantity_sold += sale.quantity_sold;
      productMap[productName].total_revenue += sale.total_revenue;
      productMap[productName].sales_count += 1;
    });

    // Sort by quantity sold and limit
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.total_quantity_sold - a.total_quantity_sold)
      .slice(0, limit);

    return topProducts;
  }

  /**
   * Get total revenue
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} startDate - Optional start date
   * @param {string} endDate - Optional end date
   * @returns {Promise<number>} Total revenue
   */
  static async getTotalRevenue(db, tenantId, startDate, endDate) {
    let query = db
      .from('sales_records')
      .select('total_revenue')
      .eq('tenant_id', tenantId);

    if (startDate) {
      query = query.gte('sale_date', startDate);
    }

    if (endDate) {
      query = query.lte('sale_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch revenue: ${error.message}`);
    }

    return (data || []).reduce((sum, record) => sum + (record.total_revenue || 0), 0);
  }

  /**
   * Get sales statistics
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @param {string} startDate - Optional start date
   * @param {string} endDate - Optional end date
   * @returns {Promise<Object>} Sales statistics
   */
  static async getSalesStatistics(db, tenantId, startDate, endDate) {
    let query = db
      .from('sales_records')
      .select('*')
      .eq('tenant_id', tenantId);

    if (startDate) {
      query = query.gte('sale_date', startDate);
    }

    if (endDate) {
      query = query.lte('sale_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch sales statistics: ${error.message}`);
    }

    const sales = data || [];
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
    const totalQuantity = sales.reduce((sum, s) => sum + (s.quantity_sold || 0), 0);

    return {
      total_sales: totalSales,
      total_revenue: totalRevenue,
      total_quantity_sold: totalQuantity,
      average_sale_amount: totalSales > 0 ? totalRevenue / totalSales : 0,
      average_quantity_per_sale: totalSales > 0 ? totalQuantity / totalSales : 0
    };
  }
}
