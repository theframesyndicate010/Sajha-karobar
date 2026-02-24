import { ProductService } from '../services/product.service.js';
import { DashboardService } from '../services/dashboard.service.js';
import { supabase, supabaseAdmin } from '../config/Supabase.js';

// Add products
export const addProduct = async (req, res) => {
  try {
    const { name, categoryId, price, minSize, maxSize, numberOfSets, stockQuantity } = req.body;
    const tenantId = req.tenant_id;

    console.log('📝 Adding product:', { name, categoryId, price, minSize, maxSize, numberOfSets, stockQuantity, tenantId });

    // Fail fast: check tenant_id exists
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized: tenant_id missing from token' });
    }

    // Basic validation
    if (!name || !categoryId || !price || minSize === undefined || maxSize === undefined) {
      return res.status(400).json({ error: 'Required fields are missing.' });
    }

    if (minSize > maxSize) {
      return res.status(400).json({ error: 'minSize cannot be greater than maxSize.' });
    }

    // Fetch category ID from the category name
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', categoryId)
      .single();

    console.log('🏷️ Category lookup:', { category, categoryError });

    if (categoryError || !category) {
      console.error('Category lookup error:', categoryError);
      return res.status(400).json({ error: `Invalid category: '${categoryId}'.` });
    }

    const categoryDbId = category.id;

    // Check if a product with the same name AND same size range already exists
    const { data: existingProducts, error: lookupError } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('category_id', categoryDbId)
      .ilike('name', name);

    if (lookupError) {
      console.error('Lookup error:', lookupError);
      throw lookupError;
    }

    // Find exact match on size range
    const existingProduct = (existingProducts || []).find(
      p => p.min_size === parseInt(minSize) && p.max_size === parseInt(maxSize)
    );

    if (existingProduct) {
      // Product with same name exists — merge by adding stock quantity
      const updatedQuantity = (existingProduct.stock_quantity || 0) + (parseInt(stockQuantity) || 0);
      const updateData = {
        stock_quantity: updatedQuantity,
        price: parseFloat(price),
        min_size: parseInt(minSize),
        max_size: parseInt(maxSize),
      };

      console.log('🔄 Product already exists, updating stock:', { existingProduct, updateData });

      const { data: updatedProduct, error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', existingProduct.id)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      console.log('✅ Existing product stock updated:', updatedProduct);

      return res.status(200).json({
        message: `Product "${name}" already exists. Stock updated from ${existingProduct.stock_quantity} to ${updatedQuantity}.`,
        product: updatedProduct,
        merged: true,
      });
    }

    // No existing product found — insert new one
    const productData = {
      tenant_id: tenantId,
      category_id: categoryDbId,
      name,
      price: parseFloat(price),
      stock_quantity: parseInt(stockQuantity) || 0,
      min_size: parseInt(minSize),
      max_size: parseInt(maxSize),
      created_at: new Date().toISOString(),
    };

    console.log('💾 Inserting product:', productData);

    const { data: newProduct, error: insertError } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log('✅ Product added successfully:', newProduct);

    res.status(201).json({
      message: 'Product added successfully',
      product: newProduct,
    });
  } catch (err) {
    console.error('❌ Failed to add product:', err);
    res.status(500).json({ error: 'Failed to add product. ' + err.message });
  }
};


// Get all products
export const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { products, total } = await ProductService.getAllProducts(req.tenant_id, page, limit);

    res.json({
      message: 'Products retrieved successfully',
      products: products || [],
      total,
      page,
      limit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Search products
export const searchProducts = async (req, res) => {
  const { page = 1, limit = 10, name, category, inStock } = req.query;
  const filters = { name, category, inStock: inStock === 'true' };

  try {
    const { products, total } = await ProductService.searchProducts(req.tenant_id, filters, page, limit);
    res.json({
      message: 'Products retrieved successfully',
      products: products || [],
      total,
      page,
      limit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single product by ID
export const getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await ProductService.getProductById(req.tenant_id, id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      message: 'Product retrieved successfully',
      product: product
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a product
export const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, price, sizeMin, sizeMax, quantity } = req.body;

  try {
    const productData = {
      name,
      price: parseFloat(price),
      min_size: sizeMin !== undefined ? parseFloat(sizeMin) : undefined,
      max_size: sizeMax !== undefined ? parseFloat(sizeMax) : undefined,
      stock_quantity: quantity !== undefined ? parseInt(quantity) : undefined,
    };

    // Remove undefined values
    Object.keys(productData).forEach(key => productData[key] === undefined && delete productData[key]);

    const updatedProduct = await ProductService.updateProduct(req.tenant_id, id, productData);

    res.json({
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete a product
export const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    await ProductService.deleteProduct(req.tenant_id, id);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get top selling products
export const getTopProducts = async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    const limit = parseInt(req.query.limit) || 5;
    
    const topProducts = await DashboardService.getTopProducts(tenantId, limit);
    
    res.json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    console.error('Top products error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch top products' 
    });
  }
};