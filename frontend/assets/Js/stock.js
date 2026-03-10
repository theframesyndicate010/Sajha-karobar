// Stock Management JavaScript

let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
let limit = 10;
let totalProducts = 0;
let categories = [];
let productToDelete = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    fetchAllStock();
    fetchCategories();
});

// Fetch ALL stock without pagination
async function fetchAllStock() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('No token found');
            window.location.href = '/login';
            return;
        }

        // Fetch all products without limit
        const response = await fetch('/api/products?limit=10000', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to fetch products');
        }

        const data = await response.json();
        allProducts = data.products || [];
        totalProducts = data.total || 0;
        currentPage = 1;

        filterProducts();
        updateStats();
        
    } catch (error) {
        console.error('Error fetching all stock:', error);
        showError('Failed to load stock. Please try again.');
    }
}

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

// User info is now loaded centrally by sidebar.js loadHeaderUser()

// Fetch categories for filter dropdown
async function fetchCategories() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/categories', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            categories = await response.json();
            populateCategoryFilter(categories);
        }
    } catch (error) {
        console.error('Error fetching categories:', error);
    }
}

// Populate category filter dropdown
function populateCategoryFilter(categories) {
    const select = document.getElementById('categoryFilter');
    select.innerHTML = '<option value="">All Categories</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        const categoryName = typeof category === 'string' ? category : (category.name || String(category));
        option.value = categoryName;
        option.textContent = categoryName;
        select.appendChild(option);
    });
}

// Fetch products from API
async function fetchProducts(page = 1) {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('No token found');
            window.location.href = '/login';
            return;
        }

        const response = await fetch(`/api/products?page=${page}&limit=${limit}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to fetch products');
        }

        const data = await response.json();
        allProducts = data.products || [];
        totalProducts = data.total || 0;
        currentPage = parseInt(data.page) || 1;

        filterProducts();
        updateStats();
        
    } catch (error) {
        console.error('Error fetching products:', error);
        showError('Failed to load products. Please try again.');
    }
}

// Filter and sort products
function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const stockFilter = document.getElementById('stockFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    // Start with all products
    filteredProducts = [...allProducts];

    // Apply search filter
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(product => 
            product.name.toLowerCase().includes(searchTerm)
        );
    }

    // Apply category filter
    if (categoryFilter) {
        filteredProducts = filteredProducts.filter(product => {
            // Handle both category_id and category name matching
            return product.category_name === categoryFilter || 
                   product.category === categoryFilter;
        });
    }

    // Apply stock filter
    if (stockFilter) {
        filteredProducts = filteredProducts.filter(product => {
            const qty = product.stock_quantity || 0;
            switch (stockFilter) {
                case 'inStock':
                    return qty > 10;
                case 'lowStock':
                    return qty > 0 && qty <= 10;
                case 'outOfStock':
                    return qty === 0;
                default:
                    return true;
            }
        });
    }

    // Apply sorting
    filteredProducts.sort((a, b) => {
        switch (sortBy) {
            case 'newest':
                return new Date(b.created_at) - new Date(a.created_at);
            case 'oldest':
                return new Date(a.created_at) - new Date(b.created_at);
            case 'name':
                return a.name.localeCompare(b.name);
            case 'price_high':
                return b.price - a.price;
            case 'price_low':
                return a.price - b.price;
            case 'stock_high':
                return (b.stock_quantity || 0) - (a.stock_quantity || 0);
            case 'stock_low':
                return (a.stock_quantity || 0) - (b.stock_quantity || 0);
            default:
                return 0;
        }
    });

    renderProducts();
    updatePagination();
}

// Render products table
function renderProducts() {
    const tbody = document.getElementById('productsTableBody');
    
    if (filteredProducts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center">
                        <i class="fa-solid fa-box-open text-gray-300 text-5xl mb-4"></i>
                        <p class="text-gray-500 font-medium">No products found</p>
                        <p class="text-gray-400 text-sm mt-1">Try adjusting your filters or add new products</p>
                        <button onclick="openAddModal()" class="mt-4 inline-flex items-center gap-2 bg-[#2563eb] hover:bg-[#1e40af] text-white font-semibold py-2 px-4 rounded-lg transition">
                            <i class="fa-solid fa-plus"></i> Add Product
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredProducts.map(product => {
        const qty = product.stock_quantity || 0;
        const isLowStock = qty > 0 && qty <= 10;
        const isOutOfStock = qty === 0;
        
        let statusBadge = '';
        let rowClass = '';
        
        if (isOutOfStock) {
            statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-[#1e40af]">Out of Stock</span>`;
            rowClass = 'bg-slate-50';
        } else if (isLowStock) {
            statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-[#1e40af]">Low Stock</span>`;
            rowClass = 'bg-slate-50';
        } else {
            statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-[#1e40af]">In Stock</span>`;
        }

        const sizeRange = product.min_size && product.max_size 
            ? `${product.min_size} - ${product.max_size}`
            : 'N/A';

        const categoryName = product.category_name || product.category || 'Uncategorized';

        return `
            <tr class="hover:bg-gray-50 transition ${rowClass}">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <i class="fa-solid fa-box text-gray-400"></i>
                        </div>
                        <div>
                            <p class="font-semibold text-gray-800">${escapeHtml(product.name)}</p>
                            <p class="text-xs text-gray-400">ID: ${product.id}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">${escapeHtml(categoryName)}</span>
                </td>
                <td class="px-6 py-4 text-center text-gray-700">${sizeRange}</td>
                <td class="px-6 py-4 text-right font-semibold text-gray-800">₹${Number(product.price).toFixed(2)}</td>
                <td class="px-6 py-4 text-center">
                    <span class="font-semibold ${isOutOfStock ? 'text-[#2563eb]' : isLowStock ? 'text-[#2563eb]' : 'text-gray-800'}">${qty}</span>
                </td>
                <td class="px-6 py-4 text-center">${statusBadge}</td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="editProduct('${product.id}')" class="p-2 text-[#2563eb] hover:bg-slate-50 rounded-lg transition" title="Edit">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="deleteProduct('${product.id}', '${escapeHtml(product.name)}')" class="p-2 text-[#2563eb] hover:bg-slate-50 rounded-lg transition" title="Delete">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Update statistics
function updateStats() {
    const totalProductsCount = allProducts.length;
    const totalStockQty = allProducts.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);
    const lowStockCount = allProducts.filter(p => (p.stock_quantity || 0) <= 10 && (p.stock_quantity || 0) > 0).length;
    const outOfStockCount = allProducts.filter(p => (p.stock_quantity || 0) === 0).length;
    const totalValue = allProducts.reduce((sum, p) => sum + (p.price * (p.stock_quantity || 0)), 0);

    document.getElementById('totalProducts').textContent = totalProductsCount;
    document.getElementById('totalStock').textContent = totalStockQty;
    document.getElementById('lowStockCount').textContent = lowStockCount + outOfStockCount;
    document.getElementById('totalValue').textContent = `Rs ${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Update pagination
function updatePagination() {
    const paginationContainer = document.getElementById('paginationContainer');
    const totalPages = Math.ceil(totalProducts / limit);
    
    if (totalProducts > limit) {
        paginationContainer.classList.remove('hidden');
        
        const from = (currentPage - 1) * limit + 1;
        const to = Math.min(currentPage * limit, totalProducts);
        
        document.getElementById('showingFrom').textContent = from;
        document.getElementById('showingTo').textContent = to;
        document.getElementById('totalCount').textContent = totalProducts;
        document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
        
        document.getElementById('prevBtn').disabled = currentPage <= 1;
        document.getElementById('nextBtn').disabled = currentPage >= totalPages;
    } else {
        paginationContainer.classList.add('hidden');
    }
}

// Pagination functions
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        fetchProducts(currentPage);
    }
}

function nextPage() {
    const totalPages = Math.ceil(totalProducts / limit);
    if (currentPage < totalPages) {
        currentPage++;
        fetchProducts(currentPage);
    }
}

// Search handler with debounce
let searchTimeout;
function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        filterProducts();
    }, 300);
}

// Reset filters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('stockFilter').value = '';
    document.getElementById('sortBy').value = 'newest';
    filterProducts();
}

// Edit product
function editProduct(productId) {
    const product = allProducts.find(p => p.id === productId || p.id === parseInt(productId));
    
    if (!product) {
        showError('Product not found');
        return;
    }

    document.getElementById('editProductId').value = product.id;
    document.getElementById('editName').value = product.name;
    document.getElementById('editPrice').value = product.price;
    document.getElementById('editMinSize').value = product.min_size || '';
    document.getElementById('editMaxSize').value = product.max_size || '';
    document.getElementById('editQuantity').value = product.stock_quantity || 0;

    document.getElementById('editModal').classList.remove('hidden');
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}

// Save product changes
async function saveProduct() {
    const productId = document.getElementById('editProductId').value;
    const name = document.getElementById('editName').value;
    const price = parseFloat(document.getElementById('editPrice').value);
    const minSize = parseFloat(document.getElementById('editMinSize').value);
    const maxSize = parseFloat(document.getElementById('editMaxSize').value);
    const quantity = parseInt(document.getElementById('editQuantity').value);

    if (!name || isNaN(price)) {
        showError('Please fill in all required fields');
        return;
    }

    if (minSize > maxSize) {
        showError('Minimum size cannot be greater than maximum size');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                price,
                sizeMin: minSize,
                sizeMax: maxSize,
                quantity
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update product');
        }

        closeEditModal();
        showSuccess('Product updated successfully');
        fetchProducts(currentPage);

    } catch (error) {
        console.error('Error updating product:', error);
        showError('Failed to update product. Please try again.');
    }
}

// Delete product
function deleteProduct(productId, productName) {
    productToDelete = productId;
    document.getElementById('deleteProductName').textContent = productName;
    document.getElementById('deleteModal').classList.remove('hidden');
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    productToDelete = null;
}

// Confirm delete
async function confirmDelete() {
    if (!productToDelete) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/products/${productToDelete}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete product');
        }

        closeDeleteModal();
        showSuccess('Product deleted successfully');
        fetchProducts(currentPage);

    } catch (error) {
        console.error('Error deleting product:', error);
        showError('Failed to delete product. Please try again.');
    }
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    // Simple alert for now - can be replaced with toast notification
    alert('Error: ' + message);
}

function showSuccess(message) {
    // Simple alert for now - can be replaced with toast notification
    alert(message);
}

// ========== ADD PRODUCT FUNCTIONS ==========

// Open add product modal
function openAddModal() {
    document.getElementById('addForm').reset();
    document.getElementById('addFormMessage').classList.add('hidden');
    populateAddCategoryDropdown();
    document.getElementById('addModal').classList.remove('hidden');
}

// Close add product modal
function closeAddModal() {
    document.getElementById('addModal').classList.add('hidden');
}

// Populate category dropdown in add modal
function populateAddCategoryDropdown() {
    const select = document.getElementById('addCategory');
    select.innerHTML = '<option value="">Select Category</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        const categoryName = typeof category === 'string' ? category : (category.name || String(category));
        option.value = categoryName;
        option.textContent = categoryName;
        select.appendChild(option);
    });
}

// Add new product
async function addProduct() {
    const name = document.getElementById('addName').value.trim();
    const categoryId = document.getElementById('addCategory').value.trim();
    const price = parseFloat(document.getElementById('addPrice').value);
    const minSize = parseFloat(document.getElementById('addMinSize').value);
    const maxSize = parseFloat(document.getElementById('addMaxSize').value);
    const numberOfSets = parseInt(document.getElementById('addQuantity').value);
    const sizeCount = Math.floor(maxSize - minSize);
    const stockQuantity = numberOfSets * sizeCount;
    
    const messageDiv = document.getElementById('addFormMessage');
    const addBtn = document.getElementById('addProductBtn');

    // Validation
    if (!name) {
        showAddMessage(messageDiv, 'Product name is required', 'error');
        return;
    }
    if (!categoryId) {
        showAddMessage(messageDiv, 'Category is required', 'error');
        return;
    }
    if (isNaN(price) || price <= 0) {
        showAddMessage(messageDiv, 'Price must be greater than 0', 'error');
        return;
    }
    if (minSize < 0 || maxSize < 0) {
        showAddMessage(messageDiv, 'Size cannot be negative', 'error');
        return;
    }
    if (minSize > maxSize) {
        showAddMessage(messageDiv, 'Minimum size cannot be greater than maximum size', 'error');
        return;
    }
    if (isNaN(numberOfSets) || numberOfSets < 1) {
        showAddMessage(messageDiv, 'Set of products must be at least 1', 'error');
        return;
    }

    addBtn.disabled = true;
    addBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Adding...';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/products/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                categoryId,
                price,
                minSize,
                maxSize,
                stockQuantity
            })
        });

        const data = await response.json();

        if (response.ok) {
            showAddMessage(messageDiv, 'Product added successfully!', 'success');
            addBtn.disabled = false;
            addBtn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Add Product';
            
            setTimeout(() => {
                closeAddModal();
                fetchProducts(1); // Refresh products list
            }, 1000);
        } else {
            showAddMessage(messageDiv, data.error || 'Failed to add product', 'error');
            addBtn.disabled = false;
            addBtn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Add Product';
        }
    } catch (error) {
        console.error('Error adding product:', error);
        showAddMessage(messageDiv, 'Error: ' + error.message, 'error');
        addBtn.disabled = false;
        addBtn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Add Product';
    }
}

// Show message in add form
function showAddMessage(messageDiv, message, type) {
    messageDiv.classList.remove('hidden', 'bg-slate-50', 'border-slate-300', 'text-[#1e40af]');
    
    if (type === 'success') {
        messageDiv.className = 'bg-slate-50 border border-slate-300 text-[#1e40af] px-4 py-3 rounded-lg text-sm';
        messageDiv.innerHTML = '<i class="fa-solid fa-check-circle mr-2"></i>' + message;
    } else {
        messageDiv.className = 'bg-slate-50 border border-slate-300 text-[#1e40af] px-4 py-3 rounded-lg text-sm';
        messageDiv.innerHTML = '<i class="fa-solid fa-exclamation-circle mr-2"></i>' + message;
    }
}
