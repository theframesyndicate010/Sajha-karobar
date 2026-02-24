/**
 * DashboardService - Handles all dashboard analytics operations
 * Provides real-time metrics and business insights
 * Ensures tenant isolation on all queries
 */

export class DashboardService {
  /**
   * Get dashboard summary with key metrics
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object>} Dashboard summary metrics
   */
  static async getDashboardSummary(db, tenantId) {
    try {
      // Get products
      const { data: products } = await db
        .from('products')
        .select('stock_quantity')
        .eq('tenant_id', tenantId);

      // Get sales
      const { data: sales } = await db
        .from('sales_records')
        .select('total_revenue, quantity_sold')
        .eq('tenant_id', tenantId);

      // Get bills
      const { data: bills } = await db
        .from('bills')
        .select('total_amount, bill_type')
        .eq('tenant_id', tenantId);

      const totalProducts = products?.length || 0;
      const totalStock = products?.reduce((sum, p) => sum + (p.stock_quantity || 0), 0) || 0;
      const outOfStockCount = products?.filter(p => p.stock_quantity === 0).length || 0;
      const lowStockCount = products?.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 10).length || 0;

      const totalSales = sales?.length || 0;
      const totalRevenue = sales?.reduce((sum, s) => sum + (s.total_revenue || 0), 0) || 0;
      const totalQuantitySold = sales?.reduce((sum, s) => sum + (s.quantity_sold || 0), 0) || 0;
      const averageSale = totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : 0;

      const totalBills = bills?.length || 0;
      const sellBills = bills?.filter(b => b.bill_type === 'sell').length || 0;
      const buyBills = bills?.filter(b => b.bill_type === 'buy').length || 0;

      return {
        total_products: totalProducts,
        total_stock: totalStock,
        out_of_stock_count: outOfStockCount,
        low_stock_count: lowStockCount,
        total_sales: totalSales,
        total_revenue: totalRevenue,
        total_quantity_sold: totalQuantitySold,
        average_sale: parseFloat(averageSale),
        total_bills: totalBills,
        sell_bills: sellBills,
        buy_bills: buyBills
      };
    } catch (error) {
      throw new Error('Failed to fetch dashboard summary: ' + error.message);
    }
  }

  /**
   * Get revenue by category
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Array>} Revenue breakdown by category
   */
  static async getRevenueByCategory(db, tenantId) {
    try {
      const { data: sales } = await db
        .from('sales_records')
        .select('*')
        .eq('tenant_id', tenantId);

      // Aggregate by category
      const categoryMap = {};
      (sales || []).forEach(sale => {
        const category = sale.category || 'Uncategorized';
        if (!categoryMap[category]) {
          categoryMap[category] = {
            category_name: category,
            total_sales: 0,
            total_quantity_sold: 0,
            total_revenue: 0
          };
        }
        categoryMap[category].total_sales += 1;
        categoryMap[category].total_quantity_sold += sale.quantity_sold;
        categoryMap[category].total_revenue += sale.total_revenue;
      });

      const totalRevenue = Object.values(categoryMap).reduce((sum, cat) => sum + cat.total_revenue, 0);

      // Calculate percentage
      const result = Object.values(categoryMap).map(cat => ({
        ...cat,
        percentage_of_total: totalRevenue > 0 ? ((cat.total_revenue / totalRevenue) * 100).toFixed(2) : 0
      }));

      return result.sort((a, b) => b.total_revenue - a.total_revenue);
    } catch (error) {
      throw new Error('Failed to fetch revenue by category: ' + error.message);
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
    try {
      const { data: sales } = await db
        .from('sales_records')
        .select('*')
        .eq('tenant_id', tenantId);

      // Aggregate by product
      const productMap = {};
      (sales || []).forEach(sale => {
        const productName = sale.product_name;
        if (!productMap[productName]) {
          productMap[productName] = {
            product_name: productName,
            category: sale.category,
            total_quantity_sold: 0,
            total_revenue: 0,
            sales_count: 0,
            rank: 0
          };
        }
        productMap[productName].total_quantity_sold += sale.quantity_sold;
        productMap[productName].total_revenue += sale.total_revenue;
        productMap[productName].sales_count += 1;
      });

      // Sort by quantity sold and add rank
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.total_quantity_sold - a.total_quantity_sold)
        .slice(0, limit)
        .map((product, index) => ({
          ...product,
          rank: index + 1
        }));

      return topProducts;
    } catch (error) {
      throw new Error('Failed to fetch top products: ' + error.message);
    }
  }

  /**
   * Get current stock levels
   * @param {Object} db - Supabase database client
   * @param {string} tenantId - Tenant ID for isolation
   * @returns {Promise<Object>} Stock summary and product details
   */
  static async getStockLevels(db, tenantId) {
    try {
      const { data: products } = await db
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('stock_quantity', { ascending: true });

      const productList = (products || []).map(product => ({
        product_name: product.name,
        current_stock: product.stock_quantity,
        category: product.category_id,
        price: product.price
      }));

      const totalProducts = productList.length;
      const lowStockCount = productList.filter(p => p.current_stock > 0 && p.current_stock <= 10).length;
      const outOfStockCount = productList.filter(p => p.current_stock === 0).length;

      return {
        total_products: totalProducts,
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        products: productList
      };
    } catch (error) {
      throw new Error('Failed to fetch stock levels: ' + error.message);
    }
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
    try {
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

      const { data: sales } = await query;

      const totalSales = (sales || []).length;
      const totalRevenue = (sales || []).reduce((sum, s) => sum + (s.total_revenue || 0), 0);
      const totalQuantity = (sales || []).reduce((sum, s) => sum + (s.quantity_sold || 0), 0);

      return {
        period: startDate && endDate ? `${startDate} to ${endDate}` : 'All time',
        total_sales: totalSales,
        total_revenue: totalRevenue,
        total_quantity_sold: totalQuantity,
        average_order_value: totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : 0,
        average_quantity_per_sale: totalSales > 0 ? (totalQuantity / totalSales).toFixed(2) : 0
      };
    } catch (error) {
      throw new Error('Failed to fetch sales statistics: ' + error.message);
    }
  }
}