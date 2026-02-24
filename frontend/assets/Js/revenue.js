// Revenue Management JavaScript

let allProducts = [];
let allBills = [];
let salesChart = null;
let categoryChart = null;
let currentView = 'sales'; // 'sales' or 'stock'

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadAllData();
});

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

// Load all data
async function loadAllData() {
    loadBillsFromStorage();
    await fetchProducts();
    calculateAndDisplayStats();
    renderSalesTable();
    renderStockTable();
    renderCharts();
}

// Load bills from localStorage
function loadBillsFromStorage() {
    const bills = localStorage.getItem('bills');
    allBills = bills ? JSON.parse(bills) : [];
}

// Fetch products from API
async function fetchProducts() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('No token found');
            return;
        }

        const response = await fetch('/api/products?page=1&limit=1000', {
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
        
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

// Switch between Sales and Stock views
function switchView(view) {
    currentView = view;
    
    const salesBtn = document.getElementById('salesViewBtn');
    const stockBtn = document.getElementById('stockViewBtn');
    const salesSection = document.getElementById('salesSection');
    const stockSection = document.getElementById('stockSection');
    const chartTitle = document.getElementById('chartTitle');
    
    if (view === 'sales') {
        salesBtn.classList.add('active-view');
        salesBtn.classList.remove('bg-transparent', 'text-gray-600');
        stockBtn.classList.remove('active-view');
        stockBtn.classList.add('bg-transparent', 'text-gray-600');
        salesSection.classList.remove('hidden');
        stockSection.classList.add('hidden');
        chartTitle.textContent = 'Sales by Retailer';
        renderSalesChart();
    } else {
        stockBtn.classList.add('active-view');
        stockBtn.classList.remove('bg-transparent', 'text-gray-600');
        salesBtn.classList.remove('active-view');
        salesBtn.classList.add('bg-transparent', 'text-gray-600');
        stockSection.classList.remove('hidden');
        salesSection.classList.add('hidden');
        chartTitle.textContent = 'Stock by Category';
        renderCategoryChart();
    }
}

// Calculate and display all statistics
function calculateAndDisplayStats() {
    // Filter only sell bills
    const sellBills = allBills.filter(bill => (bill.billMode || 'sell') === 'sell');
    
    // Sales stats
    const totalSalesRevenue = sellBills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
    const totalPaid = sellBills.reduce((sum, bill) => sum + (bill.paidAmount || 0), 0);
    const totalOutstanding = sellBills.reduce((sum, bill) => sum + (bill.remainingBalance || 0), 0);
    const partialBills = sellBills.filter(bill => bill.paymentType === 'partial').length;
    const collectionRate = totalSalesRevenue > 0 ? (totalPaid / totalSalesRevenue * 100).toFixed(1) : 0;
    
    // Stock stats
    const totalStockValue = allProducts.reduce((sum, p) => sum + (p.price * (p.stock_quantity || 0)), 0);
    const totalProducts = allProducts.length;
    
    // Update UI
    document.getElementById('totalSalesRevenue').textContent = formatCurrency(totalSalesRevenue);
    document.getElementById('totalSalesCount').textContent = `${sellBills.length} bills`;
    
    document.getElementById('outstandingBalance').textContent = formatCurrency(totalOutstanding);
    document.getElementById('partialBillsCount').textContent = `${partialBills} partial bills`;
    
    document.getElementById('totalStockValue').textContent = formatCurrency(totalStockValue);
    document.getElementById('totalProductsCount').textContent = `${totalProducts} products`;
    
    document.getElementById('collectedAmount').textContent = formatCurrency(totalPaid);
    document.getElementById('collectionRate').textContent = `${collectionRate}% collected`;
}

// Render sales table
function renderSalesTable() {
    const tbody = document.getElementById('salesTableBody');
    const sellBills = allBills.filter(bill => (bill.billMode || 'sell') === 'sell');
    
    if (sellBills.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                    No sales bills found. Create bills from the Bill page.
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort by date (newest first)
    const sortedBills = [...sellBills].sort((a, b) => new Date(b.billDate) - new Date(a.billDate));
    
    tbody.innerHTML = sortedBills.slice(0, 20).map(bill => `
        <tr class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 font-semibold text-gray-800">${escapeHtml(bill.billTitle || 'N/A')}</td>
            <td class="px-6 py-4 text-gray-700">${escapeHtml(bill.retailerName)}</td>
            <td class="px-6 py-4 text-center text-gray-700">${bill.billDate}</td>
            <td class="px-6 py-4 text-right font-semibold text-gray-800">${formatCurrency(bill.totalAmount)}</td>
            <td class="px-6 py-4 text-right text-green-600">${formatCurrency(bill.paidAmount)}</td>
            <td class="px-6 py-4 text-right font-semibold ${bill.remainingBalance > 0 ? 'text-green-600' : 'text-green-700'}">
                ${formatCurrency(bill.remainingBalance)}
            </td>
        </tr>
    `).join('');
}

// Render stock table
function renderStockTable() {
    const tbody = document.getElementById('stockTableBody');
    
    if (allProducts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                    No products found. Add products from the Stock page.
                </td>
            </tr>
        `;
        return;
    }
    
    // Group by category
    const categoryData = {};
    allProducts.forEach(product => {
        const category = product.category_name || product.category || 'Uncategorized';
        if (!categoryData[category]) {
            categoryData[category] = { products: 0, units: 0, value: 0 };
        }
        categoryData[category].products++;
        categoryData[category].units += (product.stock_quantity || 0);
        categoryData[category].value += (product.price * (product.stock_quantity || 0));
    });
    
    const totalValue = Object.values(categoryData).reduce((sum, c) => sum + c.value, 0);
    const sortedCategories = Object.entries(categoryData).sort((a, b) => b[1].value - a[1].value);
    
    const colors = [
        'bg-green-50 text-green-700',
        'bg-green-100 text-green-800',
        'bg-green-200 text-green-800',
        'bg-green-50 text-green-600',
        'bg-green-100 text-green-700',
        'bg-green-200 text-green-700'
    ];
    
    tbody.innerHTML = sortedCategories.map(([name, data], index) => {
        const percentage = totalValue > 0 ? ((data.value / totalValue) * 100).toFixed(1) : 0;
        const colorClass = colors[index % colors.length];
        
        return `
            <tr class="hover:bg-gray-50 transition">
                <td class="px-6 py-4">
                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${colorClass}">${escapeHtml(name)}</span>
                </td>
                <td class="px-6 py-4 text-center font-medium text-gray-700">${data.products}</td>
                <td class="px-6 py-4 text-center font-medium text-gray-700">${data.units.toLocaleString()}</td>
                <td class="px-6 py-4 text-right font-bold text-gray-800">${formatCurrency(data.value)}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center justify-center gap-2">
                        <div class="w-24 bg-gray-200 rounded-full h-2">
                            <div class="bg-green-500 h-2 rounded-full" style="width: ${percentage}%"></div>
                        </div>
                        <span class="text-sm font-medium text-gray-600 w-12">${percentage}%</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Render all charts
function renderCharts() {
    renderSalesDateChart();
    if (currentView === 'sales') {
        renderSalesChart();
    } else {
        renderCategoryChart();
    }
}

// Render sales by date chart
function renderSalesDateChart() {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    if (salesChart) {
        salesChart.destroy();
    }
    
    const sellBills = allBills.filter(bill => (bill.billMode || 'sell') === 'sell');
    
    // Group by date
    const dateData = {};
    sellBills.forEach(bill => {
        const date = bill.billDate;
        if (!dateData[date]) {
            dateData[date] = { sales: 0, collected: 0 };
        }
        dateData[date].sales += (bill.totalAmount || 0);
        dateData[date].collected += (bill.paidAmount || 0);
    });
    
    // Sort by date and get last 7 days
    const sortedDates = Object.keys(dateData).sort().slice(-7);
    
    // Create gradient
    let gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(22, 163, 74, 0.3)');
    gradient.addColorStop(1, 'rgba(22, 163, 74, 0.0)');
    
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates.map(d => formatDate(d)),
            datasets: [
                {
                    label: 'Sales',
                    data: sortedDates.map(d => dateData[d].sales),
                    borderColor: '#16a34a',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Collected',
                    data: sortedDates.map(d => dateData[d].collected),
                    borderColor: '#10B981',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'Rs ' + (value / 1000).toFixed(0) + 'k';
                        }
                    }
                }
            }
        }
    });
}

// Render sales by retailer chart (pie)
function renderSalesChart() {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    const sellBills = allBills.filter(bill => (bill.billMode || 'sell') === 'sell');
    
    // Group by retailer
    const retailerData = {};
    sellBills.forEach(bill => {
        const retailer = bill.retailerName || 'Unknown';
        if (!retailerData[retailer]) {
            retailerData[retailer] = 0;
        }
        retailerData[retailer] += (bill.totalAmount || 0);
    });
    
    const sortedRetailers = Object.entries(retailerData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    
    const colors = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#15803d', '#166534'];
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedRetailers.map(([name]) => name),
            datasets: [{
                data: sortedRetailers.map(([, value]) => value),
                backgroundColor: colors.slice(0, sortedRetailers.length),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 10,
                        usePointStyle: true,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(context.raw)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Render stock by category chart
function renderCategoryChart() {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    // Group by category
    const categoryData = {};
    allProducts.forEach(product => {
        const category = product.category_name || product.category || 'Uncategorized';
        if (!categoryData[category]) {
            categoryData[category] = 0;
        }
        categoryData[category] += (product.price * (product.stock_quantity || 0));
    });
    
    const sortedCategories = Object.entries(categoryData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    
    const colors = ['#16A34A', '#22C55E', '#4ADE80', '#15803D', '#86EFAC', '#14532D'];
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedCategories.map(([name]) => name),
            datasets: [{
                data: sortedCategories.map(([, value]) => value),
                backgroundColor: colors.slice(0, sortedCategories.length),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 10,
                        usePointStyle: true,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(context.raw)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Export sales to CSV
function exportSalesCSV() {
    const sellBills = allBills.filter(bill => (bill.billMode || 'sell') === 'sell');
    
    if (sellBills.length === 0) {
        alert('No sales data to export');
        return;
    }
    
    const headers = ['Bill Title', 'Retailer', 'Date', 'Total Amount', 'Paid Amount', 'Balance', 'Payment Type'];
    const rows = sellBills.map(bill => [
        bill.billTitle || '',
        bill.retailerName || '',
        bill.billDate || '',
        bill.totalAmount || 0,
        bill.paidAmount || 0,
        bill.remainingBalance || 0,
        bill.paymentType || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Utility Functions
function formatCurrency(amount) {
    return 'Rs ' + Number(amount || 0).toLocaleString('en-IN', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
