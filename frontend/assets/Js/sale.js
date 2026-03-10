// Sale Management JavaScript
const API_BASE = '/api';
let saleItems = [];
let products = [];

// Get auth token
function getToken() {
    return localStorage.getItem('token');
}

// --- API helper for sale page ---
async function saleApiFetch(endpoint, options = {}) {
    const token = getToken();
    if (!token) {
        window.location.href = '/login';
        return null;
    }
    const defaults = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
    const config = { ...defaults, ...options, headers: { ...defaults.headers, ...(options.headers || {}) } };
    const response = await fetch(`${API_BASE}/${endpoint}`, config);
    if (!response.ok) {
        if (response.status === 401) {
            window.location.href = '/login';
            return null;
        }
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}

// --- Load Sale Stats ---
async function loadSaleStats() {
    try {
        const data = await saleApiFetch('dashboard/sales-stats');
        if (!data) return;

        const el = (id) => document.getElementById(id);

        // Total Sales
        if (el('sale-total-revenue')) el('sale-total-revenue').innerHTML = `<span class="text-base text-gray-400 font-normal">Rs</span> ${(data.total_revenue || 0).toLocaleString()}`;
        if (el('sale-total-count')) el('sale-total-count').textContent = `${(data.total_sales || 0)} transactions`;

        // Avg Sale Value
        if (el('sale-avg-value')) el('sale-avg-value').innerHTML = `<span class="text-base text-gray-400 font-normal">Rs</span> ${parseFloat(data.average_sale_amount || 0).toLocaleString()}`;
        if (el('sale-avg-label')) el('sale-avg-label').textContent = `Avg qty: ${parseFloat(data.average_quantity_per_sale || 0).toFixed(1)} per sale`;
    } catch (error) {
        console.error('Failed to load sale stats:', error);
    }
}

// --- Load Today's Sales ---
async function loadTodaySales() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const data = await saleApiFetch(`sales/date-range?start_date=${today}&end_date=${today}`);
        if (!data) return;

        const sales = Array.isArray(data) ? data : (data.data || []);
        const totalToday = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

        const el = (id) => document.getElementById(id);
        if (el('sale-today-revenue')) el('sale-today-revenue').innerHTML = `<span class="text-base text-gray-400 font-normal">Rs</span> ${totalToday.toLocaleString()}`;
        if (el('sale-today-count')) el('sale-today-count').textContent = `${sales.length} transactions today`;
    } catch (error) {
        console.error('Failed to load today sales:', error);
    }
}

// --- Load Sales Table from API ---
async function loadSalesTable() {
    try {
        const data = await saleApiFetch('sales');
        if (!data) return;

        const sales = Array.isArray(data) ? data : (data.data || []);
        cachedSales = sales; // Cache for print
        const tbody = document.querySelector('#sale-table tbody');
        if (!tbody) return;

        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-400">No sales found</td></tr>';
            return;
        }

        const colors = ['purple', 'blue', 'orange', 'green', 'pink', 'indigo', 'gray'];

        tbody.innerHTML = sales.map((sale, idx) => {
            const productName = sale.products?.name || 'Product';
            const initials = productName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const color = colors[idx % colors.length];
            const date = sale.sale_date
                ? new Date(sale.sale_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
                  new Date(sale.created_at || sale.sale_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                : '';
            const amount = (sale.total_amount || 0).toLocaleString();

            return `
                <tr class="hover:bg-gray-50 transition group" data-sale-id="${sale.id}">
                    <td class="py-4 px-6 font-medium text-[#0F766E]">#SALE-${String(sale.id).slice(-4).padStart(4, '0')}</td>
                    <td class="py-4 px-6">
                        <div class="flex items-center gap-3">
                            <div class="h-8 w-8 rounded-full bg-${color}-100 text-${color}-600 flex items-center justify-center text-xs font-bold">${initials}</div>
                            <span class="font-medium text-gray-800">${productName}</span>
                        </div>
                    </td>
                    <td class="py-4 px-6 text-gray-500">${sale.quantity_sold || 0} items</td>
                    <td class="py-4 px-6 font-bold text-gray-800">Rs ${amount}</td>
                    <td class="py-4 px-6">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-[#134E4A] border border-slate-200">
                            Sale
                        </span>
                    </td>
                    <td class="py-4 px-6 text-gray-500">${date}</td>
                    <td class="py-4 px-6 text-right">
                        <div class="flex justify-end gap-2">
                            <button class="text-gray-400 hover:text-[#0F766E] p-1 transition" title="Print" onclick="printSaleReceipt(${idx})">
                                <i class="fa-solid fa-print text-xs"></i>
                            </button>
                            <button class="text-gray-400 hover:text-[#0F766E] p-1 transition" title="View Details">
                                <i class="fa-solid fa-eye text-xs"></i>
                            </button>
                            <button class="text-gray-400 hover:text-[#0F766E] p-1 transition" title="Delete" onclick="deleteSaleRecord('${sale.id}')">
                                <i class="fa-solid fa-trash text-xs"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load sales table:', error);
    }
}

// --- Delete Sale ---
async function deleteSaleRecord(saleId) {
    if (!confirm('Are you sure you want to delete this sale?')) return;
    try {
        await saleApiFetch(`sales/${saleId}`, { method: 'DELETE' });
        alert('Sale deleted successfully');
        loadSalesTable();
        loadSaleStats();
        loadTodaySales();
    } catch (error) {
        console.error('Failed to delete sale:', error);
        alert('Failed to delete sale');
    }
}

// --- Print Sale Receipt ---
let cachedSales = [];

async function printSaleReceipt(index) {
    const sale = cachedSales[index];
    if (!sale) {
        alert('Sale data not found');
        return;
    }

    // Fetch tenant name from database
    let businessName = 'My Business';
    try {
        const token = localStorage.getItem('token');
        const tenantRes = await fetch('/api/tenants/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (tenantRes.ok) {
            const tenantData = await tenantRes.json();
            businessName = tenantData.tenant?.name || businessName;
        }
    } catch (e) { console.warn('Could not fetch tenant name'); }

    const productName = sale.products?.name || 'Product';
    const date = sale.sale_date
        ? new Date(sale.sale_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString();
    const time = sale.created_at
        ? new Date(sale.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : '';

    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sale Receipt</title>
            <style>
                body { font-family: 'Courier New', monospace; margin: 0; padding: 20px; width: 350px; }
                .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 10px; margin-bottom: 15px; }
                .header h1 { margin: 0; font-size: 20px; }
                .header p { margin: 3px 0; font-size: 11px; color: #666; }
                .info { margin-bottom: 15px; font-size: 12px; }
                .info p { margin: 4px 0; }
                .divider { border-top: 1px dashed #999; margin: 10px 0; }
                table { width: 100%; font-size: 12px; border-collapse: collapse; }
                th, td { padding: 5px 2px; text-align: left; }
                th { border-bottom: 1px solid #333; }
                .totals { margin-top: 10px; font-size: 13px; }
                .totals p { margin: 4px 0; display: flex; justify-content: space-between; }
                .grand-total { font-size: 16px; font-weight: bold; border-top: 2px solid #333; padding-top: 8px; margin-top: 8px; }
                .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #666; border-top: 2px dashed #333; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${businessName}</h1>
                <p>साझा समाधान, सजिलो व्यापार</p>
                <p style="font-size: 14px; font-weight: bold; margin-top: 8px;">SALE RECEIPT</p>
            </div>

            <div class="info">
                <p><strong>Receipt:</strong> #SALE-${String(sale.id).slice(-4).padStart(4, '0')}</p>
                <p><strong>Date:</strong> ${date} ${time}</p>
                ${sale.party_name ? `<p><strong>Customer:</strong> ${sale.party_name}</p>` : ''}
            </div>

            <div class="divider"></div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th style="text-align: center;">Qty</th>
                        <th style="text-align: right;">Price</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${productName}</td>
                        <td style="text-align: center;">${sale.quantity_sold || 0}</td>
                        <td style="text-align: right;">Rs ${(sale.unit_price || 0).toLocaleString()}</td>
                        <td style="text-align: right;">Rs ${(sale.total_amount || 0).toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>

            <div class="totals">
                <div class="divider"></div>
                <p class="grand-total"><span>Total:</span> <span>Rs ${(sale.total_amount || 0).toLocaleString()}</span></p>
            </div>

            ${sale.notes ? `<div class="info" style="margin-top: 10px;"><p><strong>Notes:</strong> ${sale.notes}</p></div>` : ''}

            <div class="footer">
                <p>Thank you for your purchase!</p>
                <p>Generated on: ${new Date().toLocaleString()}</p>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Fetch products for dropdown
async function fetchProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to fetch products');
        }
        
        const data = await response.json();
        products = data.products || data || [];
        populateProductDropdown();
    } catch (error) {
        console.error('Error fetching products:', error);
        // Use sample data for demo if API fails
        products = [
            { id: 1, name: 'Rice (25kg)', price: 1200, stock: 50 },
            { id: 2, name: 'Sugar (1kg)', price: 85, stock: 100 },
            { id: 3, name: 'Oil (1L)', price: 180, stock: 75 },
            { id: 4, name: 'Dal (1kg)', price: 150, stock: 60 },
            { id: 5, name: 'Salt (1kg)', price: 25, stock: 200 },
            { id: 6, name: 'Flour (5kg)', price: 280, stock: 40 }
        ];
        populateProductDropdown();
    }
}

// Populate product dropdown
function populateProductDropdown() {
    const select = document.getElementById('productSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Select a product --</option>';
    
    products.forEach(product => {
        const stock = product.stock_quantity || product.stock || product.quantity || 0;
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = `${product.name} (Stock: ${stock})`;
        option.dataset.price = product.selling_price || product.price || 0;
        option.dataset.stock = stock;
        select.appendChild(option);
    });
}

// Handle product selection
document.addEventListener('change', function(e) {
    if (e.target.id === 'productSelect') {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const priceInput = document.getElementById('productPrice');
        
        if (selectedOption.value) {
            priceInput.value = selectedOption.dataset.price;
        } else {
            priceInput.value = '';
        }
    }
});

// Open sale modal
function openSaleModal() {
    const modal = document.getElementById('saleModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    resetSaleForm();
    fetchProducts();
}

// Close sale modal
function closeSaleModal() {
    const modal = document.getElementById('saleModal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// Reset sale form
function resetSaleForm() {
    saleItems = [];
    document.getElementById('saleForm').reset();
    document.getElementById('saleItemsBody').innerHTML = `
        <tr id="noItemsRow">
            <td colspan="5" class="py-8 text-center text-gray-400">
                <i class="fa-solid fa-cart-shopping text-3xl mb-2"></i>
                <p>No items added yet</p>
            </td>
        </tr>
    `;
    updateSummary();
}

// Add product to sale
function addProductToSale() {
    const select = document.getElementById('productSelect');
    const qtyInput = document.getElementById('productQty');
    
    const productId = select.value;
    const selectedOption = select.options[select.selectedIndex];
    
    if (!productId) {
        alert('Please select a product');
        return;
    }
    
    const quantity = parseInt(qtyInput.value) || 1;
    const stock = parseInt(selectedOption.dataset.stock) || 0;
    
    if (quantity > stock) {
        alert(`Only ${stock} items available in stock`);
        return;
    }
    
    const productName = selectedOption.textContent.split(' (Stock:')[0];
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    
    if (price <= 0) {
        alert('Please enter a valid price');
        return;
    }
    
    // Check if product already in list
    const existingIndex = saleItems.findIndex(item => item.id === productId);
    
    if (existingIndex >= 0) {
        const newQty = saleItems[existingIndex].quantity + quantity;
        if (newQty > stock) {
            alert(`Cannot add more. Only ${stock} items available in stock`);
            return;
        }
        saleItems[existingIndex].quantity = newQty;
        saleItems[existingIndex].total = newQty * price;
    } else {
        saleItems.push({
            id: productId,
            name: productName,
            price: price,
            quantity: quantity,
            total: price * quantity
        });
    }
    
    renderSaleItems();
    updateSummary();
    
    // Reset inputs
    select.value = '';
    qtyInput.value = 1;
    document.getElementById('productPrice').value = '';
}

// Render sale items table
function renderSaleItems() {
    const tbody = document.getElementById('saleItemsBody');
    
    if (saleItems.length === 0) {
        tbody.innerHTML = `
            <tr id="noItemsRow">
                <td colspan="5" class="py-8 text-center text-gray-400">
                    <i class="fa-solid fa-cart-shopping text-3xl mb-2"></i>
                    <p>No items added yet</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = saleItems.map((item, index) => `
        <tr class="hover:bg-gray-50">
            <td class="py-3 px-4">
                <span class="font-medium text-gray-800">${item.name}</span>
            </td>
            <td class="py-3 px-4 text-center text-gray-600">Rs ${item.price.toLocaleString()}</td>
            <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="updateItemQty(${index}, -1)" class="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 transition">
                        <i class="fa-solid fa-minus text-xs"></i>
                    </button>
                    <span class="w-8 text-center font-medium">${item.quantity}</span>
                    <button onclick="updateItemQty(${index}, 1)" class="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 transition">
                        <i class="fa-solid fa-plus text-xs"></i>
                    </button>
                </div>
            </td>
            <td class="py-3 px-4 text-center font-bold text-gray-800">Rs ${item.total.toLocaleString()}</td>
            <td class="py-3 px-4 text-center">
                <button onclick="removeItem(${index})" class="text-[#0F766E] hover:text-[#134E4A] hover:bg-slate-50 p-2 rounded-lg transition">
                    <i class="fa-solid fa-trash text-sm"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Update item quantity
function updateItemQty(index, change) {
    const item = saleItems[index];
    const newQty = item.quantity + change;
    
    if (newQty < 1) {
        removeItem(index);
        return;
    }
    
    // Check stock limit
    const product = products.find(p => p.id == item.id);
    const stock = product ? (product.stock_quantity || product.stock || product.quantity || 999) : 999;
    
    if (newQty > stock) {
        alert(`Only ${stock} items available in stock`);
        return;
    }
    
    saleItems[index].quantity = newQty;
    saleItems[index].total = item.price * newQty;
    
    renderSaleItems();
    updateSummary();
}

// Remove item from sale
function removeItem(index) {
    saleItems.splice(index, 1);
    renderSaleItems();
    updateSummary();
}

// Calculate and update summary
function calculateTotal() {
    updateSummary();
}

function updateSummary() {
    const subtotal = saleItems.reduce((sum, item) => sum + item.total, 0);
    const discount = parseFloat(document.getElementById('discountInput')?.value) || 0;
    const grandTotal = Math.max(0, subtotal - discount);
    
    document.getElementById('subtotal').textContent = `Rs ${subtotal.toLocaleString()}`;
    document.getElementById('grandTotal').textContent = `Rs ${grandTotal.toLocaleString()}`;
}

// Save sale - create one sale record per item (backend expects individual product sales)
async function saveSale() {
    if (saleItems.length === 0) {
        alert('Please add at least one item to the sale');
        return;
    }
    
    const notes = document.getElementById('saleNotes').value.trim();
    const discount = parseFloat(document.getElementById('discountInput').value) || 0;
    
    let successCount = 0;
    let errors = [];
    
    for (const item of saleItems) {
        const saleData = {
            product_id: item.id,
            quantity_sold: item.quantity,
            unit_price: item.price,
            total_amount: item.total,
            sale_date: new Date().toISOString().split('T')[0],
            notes: notes || null
        };
        
        try {
            const response = await fetch(`${API_BASE}/sales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(saleData)
            });
            
            if (response.ok) {
                successCount++;
            } else {
                const err = await response.json().catch(() => ({}));
                errors.push(`${item.name}: ${err.error || err.message || 'Failed'}`);
            }
        } catch (error) {
            errors.push(`${item.name}: ${error.message}`);
        }
    }
    
    if (successCount > 0) {
        alert(`${successCount} sale(s) completed successfully!${errors.length > 0 ? '\nErrors: ' + errors.join(', ') : ''}`);
        closeSaleModal();
        // Reload dynamic data
        loadSalesTable();
        loadSaleStats();
        loadTodaySales();
    } else {
        alert('Failed to complete sale: ' + errors.join(', '));
    }
}

// View sale modal
function openViewModal(saleId) {
    const modal = document.getElementById('viewSaleModal');
    const content = document.getElementById('viewSaleContent');
    
    // Find the row data
    const rows = document.querySelectorAll('#sale-table tbody tr');
    let saleData = null;
    
    rows.forEach(row => {
        if (row.cells[0]?.textContent.trim() === saleId) {
            saleData = {
                id: row.cells[0].textContent.trim(),
                customer: row.cells[1].textContent.trim(),
                items: row.cells[2].textContent.trim(),
                total: row.cells[3].textContent.trim(),
                payment: row.cells[4].textContent.trim(),
                date: row.cells[5].textContent.trim()
            };
        }
    });
    
    if (saleData) {
        content.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-center pb-4 border-b">
                    <span class="text-2xl font-bold text-[#0F766E]">${saleData.id}</span>
                    <span class="text-sm text-gray-500">${saleData.date}</span>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-xs text-gray-500 uppercase">Customer</p>
                        <p class="font-medium">${saleData.customer}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500 uppercase">Items</p>
                        <p class="font-medium">${saleData.items}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500 uppercase">Payment Method</p>
                        <p class="font-medium">${saleData.payment}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500 uppercase">Total Amount</p>
                        <p class="font-bold text-lg text-[#0F766E]">${saleData.total}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeViewModal() {
    document.getElementById('viewSaleModal').classList.add('hidden');
    document.body.style.overflow = '';
}

// New Sale Button Handler
const newSaleBtn = document.getElementById('newSaleBtn');
if (newSaleBtn) {
    newSaleBtn.addEventListener('click', openSaleModal);
}

// Search functionality for sales
const saleSearchInput = document.getElementById('sale-search');
if (saleSearchInput) {
    saleSearchInput.addEventListener('keyup', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const tableRows = document.querySelectorAll('#sale-table tbody tr');
        
        tableRows.forEach(row => {
            const saleId = row.cells[0]?.textContent.toLowerCase() || '';
            const customer = row.cells[1]?.textContent.toLowerCase() || '';
            
            if (saleId.includes(searchTerm) || customer.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

// Date filter functionality
const dateFilter = document.getElementById('date-filter');
if (dateFilter) {
    dateFilter.addEventListener('change', function(e) {
        const filterValue = e.target.value;
        const tableRows = document.querySelectorAll('#sale-table tbody tr');
        
        tableRows.forEach(row => {
            // For demo purposes, showing all rows
            // In a real application, you would filter based on actual dates
            row.style.display = '';
        });
    });
}

// Export functionality
const exportBtn = document.querySelector('button:has(i.fa-download)');
if (exportBtn) {
    exportBtn.addEventListener('click', function() {
        // Export to CSV functionality
        const table = document.getElementById('sale-table');
        let csv = [];
        const rows = table.querySelectorAll('tr');
        
        rows.forEach(row => {
            let rowData = [];
            const cells = row.querySelectorAll('td, th');
            cells.forEach((cell, index) => {
                // Skip action column
                if (index < cells.length - 1) {
                    rowData.push('"' + cell.textContent.trim().replace(/"/g, '""') + '"');
                }
            });
            csv.push(rowData.join(','));
        });
        
        // Create download link
        const csvContent = csv.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    });
}

// View, Edit, Delete button handlers
document.addEventListener('click', function(e) {
    // View Details
    if (e.target.closest('button[title="View Details"]')) {
        const row = e.target.closest('tr');
        const saleId = row.cells[0].textContent.trim();
        openViewModal(saleId);
    }
    
    // Edit
    if (e.target.closest('button[title="Edit"]')) {
        const row = e.target.closest('tr');
        const saleId = row.cells[0].textContent.trim();
        alert(`Edit functionality for ${saleId} - Coming soon!`);
    }
    
    // Delete
    if (e.target.closest('button[title="Delete"]')) {
        const row = e.target.closest('tr');
        const saleId = row.cells[0].textContent.trim();
        if (confirm(`Are you sure you want to delete ${saleId}?`)) {
            row.remove();
            alert(`${saleId} deleted successfully`);
        }
    }
});
// Close modal on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeSaleModal();
        closeViewModal();
    }
});

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Check auth
    if (!getToken()) {
        window.location.href = '/login';
        return;
    }

    // Load products for the sale modal
    fetchProducts();

    // Load dynamic stats and sales table
    loadSaleStats();
    loadTodaySales();
    loadSalesTable();
});
