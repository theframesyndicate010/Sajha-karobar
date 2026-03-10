// Dashboard JavaScript - Dynamic data loading
// NOTE: toggleSidebar() is defined in sidebar.js, do NOT redefine it here

const API_URL = '/api';
const token = localStorage.getItem('token');

// --- API helper ---
const api = {
    get: async (endpoint) => {
        const url = `${API_URL}/${endpoint}`;
        console.log(`📡 Fetching: ${url}`);
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            console.error(`❌ API error: ${response.status} ${response.statusText}`);
            throw new Error(`API error: ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`✅ Response:`, data);
        return data;
    },
};

// --- Logout ---
async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    } catch (error) {
        console.error(error);
    } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
}

// --- Chart (initialized lazily after DOM ready) ---
let salesChart = null;

function initChart() {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
gradient.addColorStop(0, 'rgba(124, 58, 237, 0.15)');
            gradient.addColorStop(1, 'rgba(124, 58, 237, 0.0)');

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Revenue (Rs)',
                data: [0, 0, 0, 0, 0, 0, 0],
                borderColor: '#7C3AED',
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#7C3AED',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            },
            {
                label: 'Qty Sold',
                data: [0, 0, 0, 0, 0, 0, 0],
                borderColor: '#7C3AED',
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#7C3AED',
                pointRadius: 0,
                pointHoverRadius: 4,
                borderDash: [5, 5],
                fill: false,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        font: { size: 10, family: "'Inter', sans-serif" }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1f2937',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 4
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f3f4f6', drawBorder: false },
                    ticks: {
                        font: { size: 10 },
                        callback: (value) => 'Rs ' + (value >= 1000 ? (value / 1000) + 'k' : value)
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
}

// --- Fetch Dashboard Summary (matches /api/dashboard/summary) ---
async function fetchSummary() {
    try {
        const data = await api.get('dashboard/summary');
        if (!data) return;

        const el = (id) => document.getElementById(id);

        // Card 1: Total Products
        if (el('total-products')) el('total-products').textContent = (data.total_products || 0).toLocaleString();
        if (el('total-stock-label')) {
            el('total-stock-label').innerHTML = `<i class="fa-solid fa-cubes mr-1"></i> ${(data.total_stock || 0).toLocaleString()} total units`;
        }

        // Card 2: Revenue (from sell bills + individual sales)
        if (el('total-revenue')) el('total-revenue').innerHTML = `<span class="text-base text-gray-400 font-normal mr-1">Rs</span>${(data.total_revenue || 0).toLocaleString()}`;
        if (el('avg-sale-label')) {
            const parts = [];
            if (data.total_buy_expense > 0) parts.push(`Expense: Rs ${(data.total_buy_expense || 0).toLocaleString()}`);
            if (data.net_profit !== undefined) parts.push(`Profit: Rs ${(data.net_profit || 0).toLocaleString()}`);
            if (parts.length === 0) parts.push(`Avg sale: Rs ${(data.average_sale || 0).toLocaleString()}`);
            el('avg-sale-label').innerHTML = parts.join(' · ');
        }

        // Card 3: Total Sales
        if (el('total-sales')) el('total-sales').textContent = (data.total_sales || 0).toLocaleString();
        if (el('avg-qty-label')) {
            el('avg-qty-label').innerHTML = `<i class="fa-solid fa-chart-line mr-1"></i> Transactions`;
        }

        // Card 4: Stock Status
        if (el('total-stock')) el('total-stock').textContent = (data.total_stock || 0).toLocaleString() + ' units';
        if (el('stock-alerts')) {
            const alerts = [];
            if (data.stock_value > 0) alerts.push(`<span class="text-[#581C87]"><i class="fa-solid fa-coins"></i> Rs ${(data.stock_value || 0).toLocaleString()} value</span>`);
            if (data.out_of_stock_count > 0) alerts.push(`<span class="text-[#7C3AED]"><i class="fa-solid fa-circle-exclamation"></i> ${data.out_of_stock_count} out of stock</span>`);
            if (data.low_stock_count > 0) alerts.push(`<span class="text-[#7C3AED]"><i class="fa-solid fa-triangle-exclamation"></i> ${data.low_stock_count} low stock</span>`);
            if (alerts.length === 0) alerts.push('<span class="text-[#7C3AED]"><i class="fa-solid fa-check-circle"></i> All stocked</span>');
            el('stock-alerts').innerHTML = alerts.join(' · ');
        }
    } catch (error) {
        console.error('Failed to fetch summary:', error);
    }
}

// --- Fetch Sales Chart Data (matches /api/dashboard/sales-chart) ---
async function fetchSalesStats() {
    try {
        const data = await api.get('dashboard/sales-chart');
        if (!data || !salesChart) return;
        
        // Update Chart
        salesChart.data.labels = data.labels;
        salesChart.data.datasets[0].data = data.revenue;
        salesChart.data.datasets[1].data = data.quantity;
        salesChart.update();
        
    } catch (error) {
        console.error('Failed to fetch sales chart data:', error);
    }
}

// --- Fetch Top Products (matches /api/dashboard/top-products) ---
async function fetchTopProducts() {
    try {
        const data = await api.get('dashboard/top-products');
        if (!data) return;

        const topProductsList = document.getElementById('top-products-list');
        if (!topProductsList) return;

        const products = Array.isArray(data) ? data : (data.data || []);

        if (products.length === 0) {
            topProductsList.innerHTML = '<p class="text-center text-gray-400 py-8">No sales data yet</p>';
            return;
        }

        topProductsList.innerHTML = products.map((product, idx) => `
            <div class="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 transition group">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-slate-500 text-xs font-bold group-hover:from-[#581C87] group-hover:to-[#7C3AED] group-hover:text-white transition">
                        ${idx + 1}
                    </div>
                    <div>
                        <p class="font-semibold text-sm text-slate-800">${product.product_name || product.name || 'Unknown'}</p>
                        <p class="text-[11px] text-slate-400">${(product.total_quantity_sold || product.total_units_sold || 0).toLocaleString()} units sold</p>
                    </div>
                </div>
                <p class="font-bold text-sm text-[#581C87]">Rs ${(product.total_revenue || 0).toLocaleString()}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to fetch top products:', error);
    }
}

// --- Fetch Products for table (matches /api/products/search) ---
async function fetchProducts() {
    const searchInput = document.getElementById('product-search');
    const categorySelect = document.getElementById('category-filter');
    const inStockCheckbox = document.getElementById('in-stock-filter');

    const search = searchInput ? searchInput.value : '';
    const category = categorySelect ? categorySelect.value : '';
    const inStock = inStockCheckbox ? inStockCheckbox.checked : false;

    try {
        const response = await api.get(`products/search?name=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&inStock=${inStock}`);
        const products = response?.products || response?.data || (Array.isArray(response) ? response : []);
        renderProducts(products);
    } catch (error) {
        console.error('Failed to fetch products:', error);
        renderProducts([]);
    }
}

function renderProducts(products) {
    const productTableBody = document.querySelector('#product-table tbody');
    if (!productTableBody) return;

    if (!products || products.length === 0) {
        productTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-400">No products found</td></tr>';
        return;
    }

    productTableBody.innerHTML = products.map(product => `
        <tr class="hover:bg-gray-50 transition">
            <td class="py-4 px-6 font-medium text-gray-800">${product.name || ''}</td>
            <td class="py-4 px-6 text-gray-500">${product.category || product.category_name || ''}</td>
            <td class="py-4 px-6 text-gray-800">Rs ${(product.selling_price || product.price || 0).toLocaleString()}</td>
            <td class="py-4 px-6">
                <span class="${(product.stock_quantity || product.quantity || 0) === 0 ? 'text-[#7C3AED]' : (product.stock_quantity || product.quantity || 0) <= 10 ? 'text-[#7C3AED]' : 'text-[#581C87]'} font-medium">
                    ${(product.stock_quantity || product.quantity || 0).toLocaleString()}
                </span>
            </td>
        </tr>
    `).join('');
}

// --- Fetch Categories (matches /api/categories/) ---
async function fetchCategories() {
    try {
        const response = await api.get('categories');
        const categories = response?.data || (Array.isArray(response) ? response : []);
        const categoryFilter = document.getElementById('category-filter');
        if (!categoryFilter) return;

        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = typeof cat === 'string' ? cat : (cat.name || cat.id);
            option.textContent = typeof cat === 'string' ? cat : (cat.name || cat.id);
            categoryFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to fetch categories:', error);
    }
}

// --- Fetch Recent Sales for table (matches /api/sales/) ---
async function fetchRecentSales() {
    try {
        const data = await api.get('sales');
        const sales = Array.isArray(data) ? data : (data?.data || []);
        const tbody = document.getElementById('recent-sales-body');
        if (!tbody) return;

        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-400">No recent transactions</td></tr>';
            return;
        }

        const colors = ['purple', 'blue', 'orange', 'green', 'pink', 'indigo', 'gray'];

        tbody.innerHTML = sales.slice(0, 10).map((sale, idx) => {
            const productName = sale.products?.name || 'Product';
            const initials = productName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const color = colors[idx % colors.length];
            const date = sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            const amount = (sale.total_amount || 0).toLocaleString();

            return `
                <tr class="hover:bg-slate-50 transition group">
                    <td class="py-4 px-6 font-semibold text-[#7C3AED]">#SALE-${String(sale.id).slice(-4).padStart(4, '0')}</td>
                    <td class="py-4 px-6">
                        <div class="flex items-center gap-3">
                            <div class="h-8 w-8 rounded-full bg-[#7C3AED] text-pink-400 flex items-center justify-center text-xs font-bold">${initials}</div>
                            <span class="font-medium text-slate-800">${productName}</span>
                        </div>
                    </td>
                    <td class="py-4 px-6 text-slate-500">${date}</td>
                    <td class="py-4 px-6 font-bold text-slate-800">Rs ${amount}</td>
                    <td class="py-4 px-6 text-slate-500">${sale.quantity_sold || 0} units</td>
                    <td class="py-4 px-6">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Completed
                        </span>
                    </td>
                    <td class="py-4 px-6 text-right">
                        <button class="text-slate-400 hover:text-[#581C87] p-1 rounded-lg hover:bg-slate-100 transition"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to fetch recent sales:', error);
    }
}

// --- Initialize Dashboard ---
function initializeDashboard() {
    if (!token) {
        window.location.href = '/login';
        return;
    }

    // Init chart
    initChart();

    // Fetch all data
    fetchSummary();
    fetchSalesStats();
    fetchTopProducts();
    fetchProducts();
    fetchCategories();
    fetchRecentSales();

    // Attach event listeners for product search/filter
    const searchInput = document.getElementById('product-search');
    const categoryFilter = document.getElementById('category-filter');
    const inStockFilter = document.getElementById('in-stock-filter');

    if (searchInput) searchInput.addEventListener('input', fetchProducts);
    if (categoryFilter) categoryFilter.addEventListener('change', fetchProducts);
    if (inStockFilter) inStockFilter.addEventListener('change', fetchProducts);
}

document.addEventListener('DOMContentLoaded', initializeDashboard);
