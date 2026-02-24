let allBills = [];
let filteredBills = [];
let currentModalBill = null;
let currentEditingBillIndex = -1;
let modalMode = 'view'; // 'view' or 'edit'
let currentBillType = 'sell'; // 'sell' or 'buy'

const BILL_API = '/api/bills';

// --- API helper ---
function getToken() {
    return localStorage.getItem('token');
}

async function billApiFetch(endpoint, options = {}) {
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
    const response = await fetch(`${BILL_API}${endpoint}`, config);
    if (!response.ok) {
        if (response.status === 401) {
            window.location.href = '/login';
            return null;
        }
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `API error: ${response.status}`);
    }
    return response.json();
}

// Load bills on page load
document.addEventListener('DOMContentLoaded', function() {
    if (!getToken()) {
        window.location.href = '/login';
        return;
    }
    loadBills();
});

// Switch bill type filter (Sell or Buy)
function switchBillType(type) {
    currentBillType = type;
    
    const sellBtn = document.getElementById('sellBillsBtn');
    const buyBtn = document.getElementById('buyBillsBtn');
    
    if (type === 'sell') {
        sellBtn.classList.add('active-bill-type');
        buyBtn.classList.remove('active-bill-type');
    } else {
        buyBtn.classList.add('active-bill-type');
        sellBtn.classList.remove('active-bill-type');
    }
    
    loadBills();
}

// Load bills from API
async function loadBills() {
    try {
        const data = await billApiFetch(`?bill_type=${currentBillType}`);
        if (!data) return;
        allBills = Array.isArray(data) ? data : (data.data || []);
        filteredBills = [...allBills];
        renderBills(filteredBills);
        updateStats(filteredBills);
    } catch (error) {
        console.error('Failed to load bills:', error);
        allBills = [];
        filteredBills = [];
        renderBills([]);
        updateStats([]);
    }
}

// Render bills in table
function renderBills(bills) {
    const tbody = document.getElementById('billsTableBody');
    
    if (bills.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-8 text-center text-gray-500">
                    No bills found. Start by creating a new bill.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = bills.map((bill, index) => `
        <tr class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 font-semibold text-gray-800">${bill.bill_title || 'N/A'}</td>
            <td class="px-6 py-4 text-gray-700">${bill.party_name || 'N/A'}</td>
            <td class="px-6 py-4 text-center text-gray-700">${bill.bill_date || 'N/A'}</td>
            <td class="px-6 py-4 text-right font-semibold text-gray-800">Rs ${(bill.total_amount || 0).toFixed(2)}</td>
            <td class="px-6 py-4 text-center">
                <span class="px-3 py-1 rounded-full text-sm font-semibold ${bill.payment_type === 'full' ? 'bg-green-100 text-green-800' : 'bg-green-50 text-green-700'}">
                    ${bill.payment_type === 'full' ? 'Full' : 'Partial'}
                </span>
            </td>
            <td class="px-6 py-4 text-right text-gray-700">Rs ${(bill.paid_amount || 0).toFixed(2)}</td>
            <td class="px-6 py-4 text-right font-semibold ${(bill.remaining_balance || 0) > 0 ? 'text-green-600' : 'text-green-700'}">
                Rs ${(bill.remaining_balance || 0).toFixed(2)}
            </td>
            <td class="px-6 py-4 text-center">
                <div class="grid grid-cols-2 gap-1 w-32 mx-auto">
                    <button onclick="viewBillDetails(${index})" class="bg-green-600 hover:bg-green-700 text-white font-semibold py-0.5 px-1 rounded text-[10px] transition">
                        👁️ View
                    </button>
                    <button onclick="editBillPayment(${index})" class="bg-green-600 hover:bg-green-700 text-white font-semibold py-0.5 px-1 rounded text-[10px] transition">
                        ✏️ Edit
                    </button>
                    <button onclick="printBill(${index})" class="bg-green-600 hover:bg-green-700 text-white font-semibold py-0.5 px-1 rounded text-[10px] transition">
                        🖨️ Print
                    </button>
                    <button onclick="deleteBill(${index})" class="bg-green-600 hover:bg-green-700 text-white font-semibold py-0.5 px-1 rounded text-[10px] transition">
                        🗑️ Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Filter bills
function filterBills() {
    const searchRetailer = document.getElementById('searchRetailer').value.toLowerCase();
    const filterDate = document.getElementById('filterDate').value;
    const filterPaymentType = document.getElementById('filterPaymentType').value;

    filteredBills = allBills.filter(bill => {
        const matchRetailer = (bill.party_name || '').toLowerCase().includes(searchRetailer);
        const matchDate = !filterDate || bill.bill_date === filterDate;
        const matchPaymentType = !filterPaymentType || bill.payment_type === filterPaymentType;

        return matchRetailer && matchDate && matchPaymentType;
    });

    renderBills(filteredBills);
    updateStats(filteredBills);
}

// Reset filters
function resetFilters() {
    document.getElementById('searchRetailer').value = '';
    document.getElementById('filterDate').value = '';
    document.getElementById('filterPaymentType').value = '';
    
    filteredBills = [...allBills];
    renderBills(filteredBills);
    updateStats(filteredBills);
}

// View bill details in modal (fetches items + payments from API)
async function viewBillDetails(index) {
    modalMode = 'view';
    currentModalBill = filteredBills[index];
    const bill = currentModalBill;

    if (!bill) {
        alert('Bill not found');
        return;
    }

    // Fetch full bill details with items and payments
    let items = [];
    let payments = [];
    try {
        const detail = await billApiFetch(`/${bill.bill_id}`);
        if (detail) {
            items = detail.items || [];
            payments = detail.payments || [];
        }
    } catch (e) {
        console.error('Failed to fetch bill details:', e);
    }

    const itemsHtml = items.map((item, i) => `
        <tr>
            <td class="px-4 py-2 border">${i + 1}</td>
            <td class="px-4 py-2 border">${item.product_name || 'N/A'}</td>
            <td class="px-4 py-2 border text-center">${item.quantity || 0}</td>
            <td class="px-4 py-2 border text-center">${item.min_size || 0} - ${item.max_size || 0}</td>
            <td class="px-4 py-2 border text-right">Rs ${(item.unit_price || 0).toFixed(2)}</td>
            <td class="px-4 py-2 border text-right">Rs ${(item.total_price || 0).toFixed(2)}</td>
        </tr>
    `).join('');

    const detailsHtml = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-gray-600 text-sm">Bill Title</p>
                    <p class="font-semibold text-gray-800">${bill.bill_title || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Date</p>
                    <p class="font-semibold text-gray-800">${bill.bill_date}</p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Retailer Name</p>
                    <p class="font-semibold text-gray-800">${bill.party_name}</p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Contact Number</p>
                    <p class="font-semibold text-gray-800">${bill.contact_number || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Email</p>
                    <p class="font-semibold text-gray-800">${bill.email || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Address</p>
                    <p class="font-semibold text-gray-800">${bill.address || 'N/A'}</p>
                </div>
            </div>

            <div class="border-t pt-4">
                <p class="font-semibold text-gray-800 mb-2">Items</p>
                <table class="w-full border-collapse border">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="px-4 py-2 border text-left">S.N.</th>
                            <th class="px-4 py-2 border text-left">Product</th>
                            <th class="px-4 py-2 border text-center">Qty</th>
                            <th class="px-4 py-2 border text-center">Size</th>
                            <th class="px-4 py-2 border text-right">Unit Price</th>
                            <th class="px-4 py-2 border text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml || '<tr><td colspan="6" class="text-center py-4 text-gray-400">No items</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div class="border-t pt-4 grid grid-cols-2 gap-4">
                <div>
                    <p class="text-gray-600 text-sm">Subtotal</p>
                    <p class="font-semibold text-gray-800">Rs ${(bill.subtotal || 0).toFixed(2)}</p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Discount (${bill.discount_percent || 0}%)</p>
                    <p class="font-semibold text-gray-800">Rs ${(bill.discount_amount || 0).toFixed(2)}</p>
                </div>
                <div class="border-t pt-2 col-span-2">
                    <p class="text-gray-600 text-sm">Total Amount</p>
                    <p class="font-bold text-lg text-green-600">Rs ${(bill.total_amount || 0).toFixed(2)}</p>
                </div>
            </div>

            <div class="border-t pt-4 grid grid-cols-2 gap-4">
                <div>
                    <p class="text-gray-600 text-sm">Payment Type</p>
                    <p class="font-semibold text-gray-800 px-3 py-1 bg-green-100 rounded w-fit">
                        ${bill.payment_type === 'full' ? 'Full Payment' : 'Partial Payment'}
                    </p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Payment Method</p>
                    <p class="font-semibold text-gray-800">${bill.payment_method || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Paid Amount</p>
                    <p class="font-semibold text-gray-800">Rs ${(bill.paid_amount || 0).toFixed(2)}</p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Remaining Balance</p>
                    <p class="font-semibold ${(bill.remaining_balance || 0) > 0 ? 'text-green-600' : 'text-green-700'}">
                        Rs ${(bill.remaining_balance || 0).toFixed(2)}
                    </p>
                </div>
            </div>

            ${payments.length > 0 ? `
            <div class="border-t pt-4">
                <p class="font-semibold text-gray-800 mb-3">Payment History</p>
                <div class="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    ${payments.map((payment, i) => `
                        <div class="flex justify-between items-center p-2 bg-white rounded border border-gray-100">
                            <div>
                                <p class="text-sm font-medium text-gray-700">Payment #${i + 1}</p>
                                <p class="text-xs text-gray-500">Date: ${payment.payment_date || 'N/A'}</p>
                            </div>
                            <p class="font-bold text-green-600">Rs ${(payment.payment_amount || 0).toFixed(2)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${bill.notes ? `
                <div class="border-t pt-4">
                    <p class="text-gray-600 text-sm">Notes</p>
                    <p class="font-semibold text-gray-800">${bill.notes}</p>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('billDetails').innerHTML = detailsHtml;
    
    const actionBtn = document.getElementById('modalActionBtn');
    actionBtn.textContent = '🖨️ Print';
    actionBtn.className = 'bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition';
    
    document.getElementById('billModal').classList.remove('hidden');
}

// Close modal
function closeBillModal() {
    document.getElementById('billModal').classList.add('hidden');
    currentModalBill = null;
}

// Print bill
async function printBill(index) {
    const bill = filteredBills[index];
    // Fetch items for print
    try {
        const detail = await billApiFetch(`/${bill.bill_id}`);
        if (detail) {
            bill._items = detail.items || [];
        }
    } catch (e) {
        console.error('Failed to fetch bill items for print:', e);
        bill._items = [];
    }
    printBillContent(bill);
}

// Print bill from modal
async function printBillFromModal() {
    if (currentModalBill) {
        // Fetch items if not already loaded
        if (!currentModalBill._items) {
            try {
                const detail = await billApiFetch(`/${currentModalBill.bill_id}`);
                if (detail) {
                    currentModalBill._items = detail.items || [];
                }
            } catch (e) {
                currentModalBill._items = [];
            }
        }
        printBillContent(currentModalBill);
    }
}

// Print bill content
async function printBillContent(bill) {
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

    const items = bill._items || [];
    const itemsHtml = items.map((item, i) => `
        <tr style="border: 1px solid #ddd;">
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${i + 1}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.product_name || 'N/A'}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity || 0}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.min_size || 0} - ${item.max_size || 0}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rs ${(item.unit_price || 0).toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rs ${(item.total_price || 0).toFixed(2)}</td>
        </tr>
    `).join('');

    const printWindow = window.open('', '', 'width=900,height=600');
    const paymentType = bill.payment_type;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bill - ${bill.bill_title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                .header h1 { margin: 0; font-size: 24px; }
                .header p { margin: 5px 0; font-size: 12px; }
                .bill-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
                .bill-info p { margin: 5px 0; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background-color: #f5f5f5; padding: 8px; border: 1px solid #ddd; text-align: left; }
                td { padding: 8px; }
                .totals { float: right; width: 40%; margin-bottom: 20px; }
                .totals p { margin: 5px 0; font-size: 14px; }
                .payment-badge { display: inline-block; padding: 5px 10px; background-color: ${paymentType === 'full' ? '#16a34a' : '#22c55e'}; color: white; border-radius: 3px; margin: 5px 0; }
                .footer { text-align: center; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${businessName}</h1>
                <p style="color: #666;">साझा समाधान, सजिलो व्यापार</p>
                <h2>${bill.bill_title || 'Bill'}</h2>
            </div>

            <div class="bill-info">
                <div>
                    <p><strong>Date:</strong> ${bill.bill_date}</p>
                    <p><strong>Retailer:</strong> ${bill.party_name}</p>
                    <p><strong>Contact:</strong> ${bill.contact_number || 'N/A'}</p>
                </div>
                <div>
                    <p><strong>Email:</strong> ${bill.email || 'N/A'}</p>
                    <p><strong>Address:</strong> ${bill.address || 'N/A'}</p>
                    <p><strong>Payment Type:</strong> <span class="payment-badge">${paymentType === 'full' ? 'Full Payment' : 'Partial Payment'}</span></p>
                </div>
            </div>

            <table>
                <thead>
                    <tr style="background-color: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px;">S.N.</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Product</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qty</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Size</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Unit Price</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="totals">
                <p><strong>Subtotal:</strong> Rs ${(bill.subtotal || 0).toFixed(2)}</p>
                <p><strong>Discount (${bill.discount_percent || 0}%):</strong> Rs ${(bill.discount_amount || 0).toFixed(2)}</p>
                <p style="border-top: 1px solid #ddd; padding-top: 5px;"><strong>Total:</strong> Rs ${(bill.total_amount || 0).toFixed(2)}</p>
                <p><strong>Paid:</strong> Rs ${(bill.paid_amount || 0).toFixed(2)}</p>
                ${(bill.remaining_balance || 0) > 0 ? `<p style="color: #16a34a;"><strong>Balance:</strong> Rs ${(bill.remaining_balance || 0).toFixed(2)}</p>` : `<p style="color: #16a34a;"><strong>Status:</strong> Fully Paid</p>`}
            </div>

            <div style="clear: both;"></div>

            <div class="footer">
                <p>Thank you for your business!</p>
                <p>Generated on: ${new Date().toLocaleString()}</p>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Delete bill via API
async function deleteBill(index) {
    if (!confirm('Are you sure you want to delete this bill? This action cannot be undone.')) return;
    const bill = filteredBills[index];
    try {
        await billApiFetch(`/${bill.bill_id}`, { method: 'DELETE' });
        alert('Bill deleted successfully!');
        loadBills();
    } catch (error) {
        console.error('Failed to delete bill:', error);
        alert('Failed to delete bill: ' + error.message);
    }
}

// Delete all bills (delete one by one via API)
async function deleteAllBills() {
    if (!confirm('Are you sure you want to delete ALL displayed bills? This action cannot be undone.')) return;
    let deleted = 0;
    for (const bill of filteredBills) {
        try {
            await billApiFetch(`/${bill.bill_id}`, { method: 'DELETE' });
            deleted++;
        } catch (e) {
            console.error(`Failed to delete bill ${bill.bill_id}:`, e);
        }
    }
    alert(`${deleted} bill(s) deleted successfully!`);
    loadBills();
}

// Export to CSV
function exportToCSV() {
    if (filteredBills.length === 0) {
        alert('No bills to export!');
        return;
    }

    let csv = 'Bill Title,Retailer,Date,Total Amount,Paid Amount,Remaining Balance,Payment Type,Payment Method,Notes\n';
    
    filteredBills.forEach(bill => {
        const notes = bill.notes ? bill.notes.replace(/,/g, ';') : '';
        csv += `"${bill.bill_title || ''}","${bill.party_name || ''}","${bill.bill_date || ''}","${(bill.total_amount || 0).toFixed(2)}","${(bill.paid_amount || 0).toFixed(2)}","${(bill.remaining_balance || 0).toFixed(2)}","${bill.payment_type || ''}","${bill.payment_method || ''}","${notes}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bills_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Update statistics
function updateStats(bills = allBills) {
    const totalBills = bills.length;
    const totalRevenue = bills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);
    const totalPaid = bills.reduce((sum, bill) => sum + (bill.paid_amount || 0), 0);
    const totalBalance = bills.reduce((sum, bill) => sum + (bill.remaining_balance || 0), 0);

    document.getElementById('totalBills').textContent = totalBills;
    document.getElementById('totalRevenue').textContent = `Rs ${totalRevenue.toFixed(2)}`;
    document.getElementById('totalPaid').textContent = `Rs ${totalPaid.toFixed(2)}`;
    document.getElementById('totalBalance').textContent = `Rs ${totalBalance.toFixed(2)}`;
}

// Edit Bill Payment - Update Remaining Balance
function editBillPayment(index) {
    modalMode = 'edit';
    currentModalBill = filteredBills[index];
    const bill = currentModalBill;
    
    if (!bill) {
        alert('Bill not found');
        return;
    }
    
    currentEditingBillIndex = index;

    const editHtml = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                    <p class="text-gray-600 text-sm">Bill Title</p>
                    <p class="font-semibold text-gray-800">${bill.bill_title || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Retailer</p>
                    <p class="font-semibold text-gray-800">${bill.party_name || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Date</p>
                    <p class="font-semibold text-gray-800">${bill.bill_date || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-gray-600 text-sm">Total Amount</p>
                    <p class="font-semibold text-gray-800">Rs ${(bill.total_amount || 0).toFixed(2)}</p>
                </div>
            </div>

            <div class="border-t pt-4">
                <p class="font-bold text-gray-800 mb-4">Reduce Pending Amount</p>
                <div class="grid grid-cols-2 gap-4 bg-green-50 p-4 rounded-lg mb-4 border border-green-200">
                    <div>
                        <p class="text-gray-600 text-sm">Current Pending Balance</p>
                        <p class="font-bold text-lg text-green-600">Rs ${(bill.remaining_balance || 0).toFixed(2)}</p>
                    </div>
                    <div>
                        <p class="text-gray-600 text-sm">Total Bill Amount</p>
                        <p class="font-bold text-lg text-gray-800">Rs ${(bill.total_amount || 0).toFixed(2)}</p>
                    </div>
                </div>

                <div class="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Amount Given by Retailer (Rs) <span class="text-green-600">*</span></label>
                    <input type="number" id="newPendingBalanceInput" min="0" step="0.01" placeholder="Enter payment received" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg" value="0.00">
                    <p class="text-xs text-gray-600 mt-2">Can set from 0 to Rs ${(bill.remaining_balance || 0).toFixed(2)}</p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                        <p class="text-sm font-semibold text-gray-700 mb-2">Amount to Reduce</p>
                        <p class="font-bold text-xl text-green-600" id="reductionAmountDisplay">Rs 0.00</p>
                    </div>
                    <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                        <p class="text-sm font-semibold text-gray-700 mb-2">New Paid Amount</p>
                        <p class="font-bold text-xl text-green-600" id="newPaidAmountDisplay">Rs ${(bill.paid_amount || 0).toFixed(2)}</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('billDetails').innerHTML = editHtml;
    
    const actionBtn = document.getElementById('modalActionBtn');
    actionBtn.textContent = '💾 Update Balance';
    actionBtn.className = 'bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition';
    
    setTimeout(() => {
        const newBalanceInput = document.getElementById('newPendingBalanceInput');
        if (newBalanceInput) {
            newBalanceInput.addEventListener('keyup', function() {
                const paymentReceived = parseFloat(this.value);
                
                if (isNaN(paymentReceived) || paymentReceived === 0) {
                    document.getElementById('reductionAmountDisplay').textContent = `Rs 0.00`;
                    document.getElementById('newPaidAmountDisplay').textContent = `Rs ${(bill.paid_amount || 0).toFixed(2)}`;
                    return;
                }

                const validPayment = Math.max(0, Math.min(paymentReceived, bill.remaining_balance || 0));
                const roundedPayment = Math.round(validPayment * 100) / 100;
                const newPaidAmount = Math.round(((bill.paid_amount || 0) + roundedPayment) * 100) / 100;
                
                document.getElementById('reductionAmountDisplay').textContent = `Rs ${roundedPayment.toFixed(2)}`;
                document.getElementById('newPaidAmountDisplay').textContent = `Rs ${newPaidAmount.toFixed(2)}`;
            });
            newBalanceInput.select();
        }
    }, 100);

    document.getElementById('billModal').classList.remove('hidden');
}

// Handle Modal Action Button
function handleModalAction() {
    if (modalMode === 'edit') {
        savePaymentUpdate();
    } else {
        printBillFromModal();
    }
}

// Save Payment via API
async function savePaymentUpdate() {
    if (currentEditingBillIndex === -1 || !currentModalBill) return;
    
    const paymentInput = document.getElementById('newPendingBalanceInput');
    if (!paymentInput) return;

    const paymentReceived = parseFloat(paymentInput.value);
    const bill = currentModalBill;

    if (isNaN(paymentReceived) || paymentReceived <= 0) {
        alert('Please enter a valid amount greater than 0');
        return;
    }

    if (paymentReceived > (bill.remaining_balance || 0)) {
        alert(`Payment cannot exceed pending balance: Rs ${(bill.remaining_balance || 0).toFixed(2)}`);
        return;
    }

    const roundedPayment = Math.round(paymentReceived * 100) / 100;

    try {
        const result = await billApiFetch(`/${bill.bill_id}/payments`, {
            method: 'POST',
            body: JSON.stringify({
                payment_amount: roundedPayment,
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: bill.payment_method || null,
                notes: `Additional payment of Rs ${roundedPayment.toFixed(2)}`
            })
        });

        if (result) {
            const newPaid = result.bill?.paid_amount || (bill.paid_amount + roundedPayment);
            const newBalance = result.bill?.remaining_balance || (bill.total_amount - newPaid);
            
            alert(`✓ Payment of Rs ${roundedPayment.toFixed(2)} recorded successfully!\n\nPreviously Paid: Rs ${(bill.paid_amount || 0).toFixed(2)}\nNow Paid: Rs ${newPaid.toFixed(2)}\nRemaining Balance: Rs ${newBalance.toFixed(2)}`);
        }
    } catch (error) {
        console.error('Failed to record payment:', error);
        alert('Failed to record payment: ' + error.message);
        return;
    }

    modalMode = 'view';
    currentEditingBillIndex = -1;
    
    loadBills();
    closeBillModal();
}

// Close modal on outside click
document.addEventListener('click', function(event) {
    const modal = document.getElementById('billModal');
    if (event.target === modal) {
        closeBillModal();
    }
});
