// Toggle Sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

// Set Active Menu Item
function setActive(element) {
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
    });
    element.classList.add('active');
}
// ========== MULTIPLE PRODUCT FORMS ==========
let currentProductCount = 1;

// Set product count from buttons
function setProductCount(count) {
    currentProductCount = count;
    generateProductForms(count);
    updateProductCountButtons(count);
}

// Set custom product count
function setCustomProductCount() {
    const customCount = parseInt(document.getElementById('customProductCount').value);
    if (customCount >= 1 && customCount <= 20) {
        setProductCount(customCount);
    } else {
        alert('Please enter a number between 1 and 20');
    }
}

// Update product count button styles
function updateProductCountButtons(activeCount) {
    document.querySelectorAll('.productCountBtn').forEach(btn => {
        const count = parseInt(btn.getAttribute('data-count'));
        if (count === activeCount) {
            btn.classList.add('active');
            btn.classList.remove('bg-gray-200', 'text-gray-700');
            btn.classList.add('bg-green-600', 'text-white');
        } else {
            btn.classList.remove('active');
            btn.classList.add('bg-gray-200', 'text-gray-700');
            btn.classList.remove('bg-green-600', 'text-white');
        }
    });
    document.getElementById('customProductCount').value = activeCount;
}

// Generate product forms
function generateProductForms(count) {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    for (let i = 1; i <= count; i++) {
        const formHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-2xl">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-lg font-bold text-gray-900">Product #${i}</h3>
                    <span class="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">Form ${i}/${count}</span>
                </div>
                <form class="addProductForm space-y-6">
                    
                    <!-- Product Name -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Product Name <span class="text-green-600">*</span>
                        </label>
                        <input 
                            type="text" 
                            class="productName w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                            name="productName" 
                            placeholder="Enter product name"
                            required
                        >
                    </div>

                    <!-- Product Category -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Category Type <span class="text-green-600">*</span>
                        </label>
                        <select 
                            class="productCategory w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition bg-white"
                            name="productCategory" 
                            required
                        >
                            <option value="">Loading categories...</option>
                        </select>
                    </div>

                    <!-- Product Price -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Product Price (Rs) <span class="text-green-600">*</span>
                        </label>
                        <input 
                            type="number" 
                            class="productPrice w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                            name="productPrice" 
                            placeholder="Enter price"
                            step="0.01"
                            min="0"
                            required
                        >
                    </div>

                    <!-- Size Range -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                Minimum Size <span class="text-green-600">*</span>
                            </label>
                            <input 
                                type="number" 
                                class="sizeMin w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                name="sizeMin" 
                                placeholder="Min size"
                                step="0.1"
                                min="0"
                                required
                            >
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                Maximum Size <span class="text-green-600">*</span>
                            </label>
                            <input 
                                type="number" 
                                class="sizeMax w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                                name="sizeMax" 
                                placeholder="Max size"
                                step="0.1"
                                min="0"
                                required
                            >
                        </div>
                    </div>

                    <!-- Set of Products -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Set of Products <span class="text-green-600">*</span>
                        </label>
                        <input 
                            type="number" 
                            class="productQuantity w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                            name="productQuantity" 
                            placeholder="Enter set of products"
                            min="1"
                            step="1"
                            required
                        >
                    </div>

                    <!-- Form Actions -->
                    <div class="flex gap-4 pt-4">
                        <button 
                            type="submit" 
                            class="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2.5 rounded-lg transition duration-200 shadow-md hover:shadow-lg"
                        >
                            <i class="fa-solid fa-check mr-2"></i> Add Product
                        </button>
                        <button 
                            type="reset" 
                            class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-lg transition duration-200"
                        >
                            <i class="fa-solid fa-redo mr-2"></i> Clear
                        </button>
                    </div>

                    <!-- Success/Error Messages -->
                    <div class="successMessage hidden bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                        <i class="fa-solid fa-check-circle mr-2"></i> Product added successfully!
                    </div>
                    <div class="errorMessage hidden bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm"></div>

                </form>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', formHTML);
    }

    // Fetch categories and attach form handlers
    fetchCategoriesForAllForms();
    attachFormHandlers();
}
// Fetch categories
async function fetchCategories() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('❌ No token found in localStorage');
            return [];
        }
        
        console.log('📡 Fetching categories with token...');
        
        const response = await fetch('/api/categories', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`📊 Response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Failed to fetch categories:', response.status, errorText);
            return [];
        }

        const result = await response.json();
        console.log('✅ Categories response:', result);
        
        const categories = Array.isArray(result) ? result : (result.data || []);
        
        if (!Array.isArray(categories)) {
            console.error('❌ Categories is not an array:', categories);
            return [];
        }

        if (categories.length === 0) {
            console.warn('⚠️ No categories found for this tenant');
            return [];
        }

        console.log(`✅ Loaded ${categories.length} categories:`, categories);
        return categories;
        
    } catch (error) {
        console.error('🔴 Error fetching categories:', error);
        return [];
    }
}

// Update all category dropdowns
async function fetchCategoriesForAllForms() {
    const categories = await fetchCategories();
    
    document.querySelectorAll('.productCategory').forEach(select => {
        updateCategoryDropdown(select, categories);
    });
}

// Helper function to update dropdown
function updateCategoryDropdown(select, categories) {
    select.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Category';
    select.appendChild(defaultOption);
    
    categories.forEach(category => {
        const option = document.createElement('option');
        // Handle both string and object formats
        const categoryName = typeof category === 'string' ? category : (category.name || String(category));
        option.value = categoryName;
        option.textContent = categoryName;
        select.appendChild(option);
    });
}
// Attach form handlers to all forms
function attachFormHandlers() {
    document.querySelectorAll('.addProductForm').forEach((form, index) => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const successMessage = form.querySelector('.successMessage');
            const errorMessage = form.querySelector('.errorMessage');
            const submitBtn = form.querySelector('button[type="submit"]');
            
            const formData = {
                name: form.querySelector('.productName').value.trim(),
                categoryId: form.querySelector('.productCategory').value.trim(),
                price: parseFloat(form.querySelector('.productPrice').value),
                minSize: parseFloat(form.querySelector('.sizeMin').value),
                maxSize: parseFloat(form.querySelector('.sizeMax').value),
                numberOfSets: parseInt(form.querySelector('.productQuantity').value, 10)
            };

            // Calculate actual stock quantity: sets × (maxSize - minSize)
            const sizeCount = Math.floor(formData.maxSize - formData.minSize);
            formData.stockQuantity = formData.numberOfSets * sizeCount;

            // Validation
            if (!formData.name) {
                showError(errorMessage, successMessage, 'Product name is required');
                return;
            }

            if (!formData.categoryId) {
                showError(errorMessage, successMessage, 'Category is required');
                return;
            }

            if (formData.price <= 0) {
                showError(errorMessage, successMessage, 'Price must be greater than 0');
                return;
            }

            if (formData.minSize < 0 || formData.maxSize < 0) {
                showError(errorMessage, successMessage, 'Size cannot be negative');
                return;
            }

            if (formData.minSize > formData.maxSize) {
                showError(errorMessage, successMessage, 'Minimum size cannot be greater than maximum size');
                return;
            }

            if (!formData.numberOfSets || formData.numberOfSets <= 0) {
                showError(errorMessage, successMessage, 'Set of products must be at least 1');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Adding...';

            try {
                const token = localStorage.getItem('token');
                console.log('📤 Submitting product:', formData);
                
                const response = await fetch('/api/products/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();
                console.log('📥 Response:', data);
                
                if (response.ok) {
                    showSuccess(errorMessage, successMessage);
                    form.reset();
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Add Product';

                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 1500);
                } else {
                    showError(errorMessage, successMessage, data.error || 'Failed to add product');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Add Product';
                }
            } catch (error) {
                console.error('🔴 Error:', error);
                showError(errorMessage, successMessage, 'Error: ' + error.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Add Product';
            }
        });
    });
}

function showSuccess(errorMsg, successMsg) {
    successMsg.classList.remove('hidden');
    errorMsg.classList.add('hidden');
}

function showError(errorMsg, successMsg, message) {
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
    successMsg.classList.add('hidden');
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    generateProductForms(1);
});
