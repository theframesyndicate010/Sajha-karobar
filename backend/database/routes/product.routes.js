import express from "express";
import {
  addProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getTopProducts,
  searchProducts
} from "../controllers/product.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { tenantMiddleware } from "../middleware/tenant.middleware.js";
import { supabase } from "../config/Supabase.js";

const router = express.Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware, tenantMiddleware);

// Debug endpoint to check categories
router.get("/debug/categories", async (req, res) => {
  try {
    const tenantId = req.tenant_id;
    console.log(`🔍 Debug: Checking categories for tenant: ${tenantId}`);
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId);
    
    if (error) {
      return res.json({ error: error.message, data: null });
    }
    
    res.json({ 
      success: true,
      tenantId,
      count: data.length,
      data 
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// Add a new product
router.post("/add", addProduct);

router.get("/search", searchProducts);

// Get all products
router.get("/", getAllProducts);

// Get a single product by ID
router.get("/:id", getProductById);

// Update a product
router.put("/:id", updateProduct);

// Delete a product
router.delete("/:id", deleteProduct);

// Top selling products
router.get('/top-products', getTopProducts);

export default router;