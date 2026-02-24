import { supabase } from '../config/Supabase.js';

// Get revenue by category
export const getRevenueByCategory = async (req, res, next) => {
  try {
    const db = req.db;
    const { start_date, end_date } = req.query;

    let query = `
      SELECT
        c.id,
        c.name AS category_name,
        COUNT(DISTINCT s.id) AS total_sales,
        COALESCE(SUM(s.quantity_sold), 0) AS total_quantity_sold,
        COALESCE(SUM(s.total_amount), 0) AS total_revenue,
        ROUND(COALESCE(AVG(s.total_amount), 0)::numeric, 2) AS average_sale_amount,
        MAX(s.sale_date) AS last_sale_date
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.tenant_id = '${req.tenant_id}'
      LEFT JOIN sales s ON p.id = s.product_id
    `;

    if (start_date && end_date) {
      query += ` WHERE s.sale_date >= '${start_date}' AND s.sale_date <= '${end_date}'`;
    }

    query += ` GROUP BY c.id, c.name ORDER BY total_revenue DESC`;

    const { data, error } = await db.rpc('execute_query', { query_text: query }).catch(() => {
      // Fallback: use direct query
      return db
        .from('sales')
        .select('*, products(category_id)')
        .eq('tenant_id', req.tenant_id);
    });

    if (error) {
      console.error('Error fetching revenue by category:', error);
      // Return aggregated data from sales
      const { data: sales } = await db
        .from('sales')
        .select('*, products(category_id, name)')
        .eq('tenant_id', req.tenant_id);

      const revenueMap = {};
      sales?.forEach(sale => {
        const categoryId = sale.products?.category_id;
        if (categoryId) {
          if (!revenueMap[categoryId]) {
            revenueMap[categoryId] = {
              category_id: categoryId,
              total_sales: 0,
              total_quantity_sold: 0,
              total_revenue: 0
            };
          }
          revenueMap[categoryId].total_sales += 1;
          revenueMap[categoryId].total_quantity_sold += sale.quantity_sold;
          revenueMap[categoryId].total_revenue += sale.total_amount;
        }
      });

      return res.json(Object.values(revenueMap));
    }

    res.json(data || []);
  } catch (err) {
    next(err);
  }
};

// Get top-selling products
export const getTopSellingProducts = async (req, res, next) => {
  try {
    const db = req.db;
    const { limit = 10 } = req.query;
    const tenantId = req.tenant_id;

    // Get sales records
    const { data: sales, error: salesError } = await db
      .from('sales')
      .select('*, products(id, name, price, category_id)')
      .eq('tenant_id', tenantId);

    if (salesError) {
      const dbError = new Error(salesError.message || 'Failed to fetch sales');
      dbError.status = 500;
      throw dbError;
    }

    // Also get sell bill items for products that may not be in the sales table
    const { data: sellBills } = await db
      .from('bills')
      .select('bill_id')
      .eq('tenant_id', tenantId)
      .eq('bill_type', 'sell');

    let billItems = [];
    if (sellBills && sellBills.length > 0) {
      const billIds = sellBills.map(b => b.bill_id);
      const { data: items } = await db
        .from('bill_items')
        .select('product_name, quantity, unit_price, total_price')
        .in('bill_id', billIds);
      billItems = items || [];
    }

    // Aggregate sales by product
    const productMap = {};

    sales?.forEach(sale => {
      const productId = sale.product_id;
      if (!productMap[productId]) {
        productMap[productId] = {
          product_id: productId,
          product_name: sale.products?.name,
          price: sale.products?.price,
          category_id: sale.products?.category_id,
          total_sales_count: 0,
          total_quantity_sold: 0,
          total_revenue: 0
        };
      }
      productMap[productId].total_sales_count += 1;
      productMap[productId].total_quantity_sold += sale.quantity_sold;
      productMap[productId].total_revenue += sale.total_amount;
    });

    // Merge bill items (for products not already tracked via sales)
    billItems.forEach(item => {
      const key = `bill_${item.product_name}`;
      const existing = Object.values(productMap).find(
        p => p.product_name && p.product_name.toLowerCase() === item.product_name.toLowerCase()
      );
      if (existing) {
        // Already tracked via sales, skip to avoid double-counting
        return;
      }
      if (!productMap[key]) {
        productMap[key] = {
          product_id: key,
          product_name: item.product_name,
          price: item.unit_price,
          total_sales_count: 0,
          total_quantity_sold: 0,
          total_revenue: 0
        };
      }
      productMap[key].total_sales_count += 1;
      productMap[key].total_quantity_sold += item.quantity || 0;
      productMap[key].total_revenue += item.total_price || 0;
    });

    // Sort by revenue and limit
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, parseInt(limit));

    res.json(topProducts);
  } catch (err) {
    next(err);
  }
};

// Get current stock levels
export const getStockLevels = async (req, res, next) => {
  try {
    const db = req.db;

    const { data: products, error } = await db
      .from('products')
      .select('*, categories(name)')
      .eq('tenant_id', req.tenant_id)
      .order('stock_quantity', { ascending: true });

    if (error) {
      const dbError = new Error(error.message || 'Failed to fetch stock levels');
      dbError.status = 500;
      throw dbError;
    }

    // Add stock status
    const stockData = products?.map(product => ({
      ...product,
      stock_status: product.stock_quantity === 0 
        ? 'Out of Stock' 
        : product.stock_quantity <= 10 
          ? 'Low Stock' 
          : 'In Stock'
    })) || [];

    res.json(stockData);
  } catch (err) {
    next(err);
  }
};

// Get dashboard summary
export const getDashboardSummary = async (req, res, next) => {
  try {
    const db = req.db;
    const tenantId = req.tenant_id;

    // Get products (for stock info and stock value)
    const { data: products } = await db
      .from('products')
      .select('stock_quantity, price')
      .eq('tenant_id', tenantId);

    // Get all bills (buy and sell)
    const { data: bills } = await db
      .from('bills')
      .select('total_amount, bill_type, status')
      .eq('tenant_id', tenantId);

    // Get individual sales records
    const { data: sales } = await db
      .from('sales')
      .select('total_amount, quantity_sold')
      .eq('tenant_id', tenantId);

    // --- Products & Stock ---
    const totalProducts = products?.length || 0;
    const totalStock = products?.reduce((sum, p) => sum + (p.stock_quantity || 0), 0) || 0;
    const outOfStockCount = products?.filter(p => p.stock_quantity === 0).length || 0;
    const lowStockCount = products?.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 10).length || 0;
    const stockValue = products?.reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.price || 0)), 0) || 0;

    // --- Bills ---
    const sellBills = bills?.filter(b => b.bill_type === 'sell') || [];
    const buyBills = bills?.filter(b => b.bill_type === 'buy') || [];
    const totalSellRevenue = sellBills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const totalBuyExpense = buyBills.reduce((sum, b) => sum + (b.total_amount || 0), 0);

    // --- Individual Sales ---
    const totalSalesRevenue = sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
    const totalQuantitySold = sales?.reduce((sum, s) => sum + (s.quantity_sold || 0), 0) || 0;

    // --- Combined Revenue ---
    // Revenue = sell bill income + individual sales income
    // Use whichever is higher to avoid double-counting (sell bills create sale records)
    const totalRevenue = Math.max(totalSellRevenue, totalSalesRevenue);
    const totalSales = Math.max(sellBills.length, sales?.length || 0);
    const averageSale = totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : 0;

    // Net profit = sell revenue - buy expenses
    const netProfit = totalSellRevenue - totalBuyExpense;

    res.json({
      total_products: totalProducts,
      total_stock: totalStock,
      stock_value: stockValue,
      out_of_stock_count: outOfStockCount,
      low_stock_count: lowStockCount,
      total_sales: totalSales,
      total_revenue: totalRevenue,
      total_sell_revenue: totalSellRevenue,
      total_buy_expense: totalBuyExpense,
      net_profit: netProfit,
      total_quantity_sold: totalQuantitySold,
      average_sale: parseFloat(averageSale),
      total_bills: bills?.length || 0,
      sell_bills: sellBills.length,
      buy_bills: buyBills.length
    });
  } catch (err) {
    next(err);
  }
};

// Get sales statistics (Original)
export const getSalesStatistics = async (req, res, next) => {
  try {
    const db = req.db;
    const { start_date, end_date } = req.query;

    let query = db
      .from('sales')
      .select('*')
      .eq('tenant_id', req.tenant_id);

    if (start_date) {
      query = query.gte('sale_date', start_date);
    }

    if (end_date) {
      query = query.lte('sale_date', end_date);
    }

    const { data: sales, error } = await query;

    if (error) {
      const dbError = new Error(error.message || 'Failed to fetch sales');
      dbError.status = 500;
      throw dbError;
    }

    const stats = {
      total_sales: sales?.length || 0,
      total_revenue: sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0,
      total_quantity_sold: sales?.reduce((sum, s) => sum + (s.quantity_sold || 0), 0) || 0,
      average_sale_amount: sales?.length > 0 
        ? (sales.reduce((sum, s) => sum + (s.total_amount || 0), 0) / sales.length).toFixed(2)
        : 0,
      average_quantity_per_sale: sales?.length > 0
        ? (sales.reduce((sum, s) => sum + (s.quantity_sold || 0), 0) / sales.length).toFixed(2)
        : 0
    };

    res.json(stats);
  } catch (err) {
    next(err);
  }
};

// Get sales chart data (Last 7 days) - from bills + sales
export const getSalesChartData = async (req, res, next) => {
  try {
    const db = req.db;
    const tenantId = req.tenant_id;

    // Get dates for last 7 days
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    // Query sell bills for revenue chart
    const { data: sellBills } = await db
      .from('bills')
      .select('bill_date, total_amount')
      .eq('tenant_id', tenantId)
      .eq('bill_type', 'sell')
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);

    // Query buy bills for expense chart
    const { data: buyBills } = await db
      .from('bills')
      .select('bill_date, total_amount')
      .eq('tenant_id', tenantId)
      .eq('bill_type', 'buy')
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);

    // Query individual sales
    const { data: sales } = await db
      .from('sales')
      .select('sale_date, total_amount, quantity_sold')
      .eq('tenant_id', tenantId)
      .gte('sale_date', startDate + 'T00:00:00')
      .lte('sale_date', endDate + 'T23:59:59');

    // Aggregate data by date
    const dataByDate = {};
    dates.forEach(date => {
      dataByDate[date] = { revenue: 0, expense: 0, quantity: 0 };
    });

    // Add sell bill amounts as revenue
    sellBills?.forEach(bill => {
      const date = new Date(bill.bill_date).toISOString().split('T')[0];
      if (dataByDate[date]) {
        dataByDate[date].revenue += bill.total_amount || 0;
      }
    });

    // Add buy bill amounts as expense
    buyBills?.forEach(bill => {
      const date = new Date(bill.bill_date).toISOString().split('T')[0];
      if (dataByDate[date]) {
        dataByDate[date].expense += bill.total_amount || 0;
      }
    });

    // Add individual sales quantities (and revenue if no sell bills exist for that day)
    sales?.forEach(sale => {
      const date = new Date(sale.sale_date).toISOString().split('T')[0];
      if (dataByDate[date]) {
        dataByDate[date].quantity += sale.quantity_sold || 0;
        // If no sell bill revenue was recorded for this day, use sale amounts
        if (dataByDate[date].revenue === 0) {
          dataByDate[date].revenue += sale.total_amount || 0;
        }
      }
    });

    const labels = dates.map(date => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    });
    const revenueData = dates.map(date => dataByDate[date].revenue);
    const quantityData = dates.map(date => dataByDate[date].quantity);

    res.json({
      labels,
      revenue: revenueData,
      quantity: quantityData
    });

  } catch (err) {
    next(err);
  }
};
