// Bill Management JavaScript
// NOTE: toggleSidebar() is defined in sidebar.js, do NOT redefine it here

// ==================== BILL MANAGEMENT ====================

// Initialize
let billItems = [];
let billMode = 'sell'; // 'sell' or 'buy'
let availableProducts = []; // Store available products for autocomplete
let availableCategories = []; // Store available categories

document.addEventListener('DOMContentLoaded', function() {
    // Set current date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('billDate').value = today;

    // Fetch available products and categories
    fetchAvailableProducts();
    fetchAvailableCategories();

    // Add event listeners
    setupEventListeners();
});

// Fetch available products from database
async function fetchAvailableProducts() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('/api/products?limit=10000', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            availableProducts = data.products || [];
            setupProductAutocomplete();
        }
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

// Fetch available categories from database
async function fetchAvailableCategories() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('/api/categories', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            availableCategories = Array.isArray(data) ? data : [];
            console.log('✅ Categories fetched:', availableCategories);
            populateCategoryDropdown();
        } else {
            console.error('❌ Failed to fetch categories:', response.status);
        }
    } catch (error) {
        console.error('Error fetching categories:', error);
    }
}

// Populate category dropdown
function populateCategoryDropdown() {
    const categorySelect = document.getElementById('categories');
    if (!categorySelect) return;

    categorySelect.innerHTML = '<option value="">Select Category</option>';
    
    if (!availableCategories || availableCategories.length === 0) {
        console.warn('⚠️ No categories available');
        categorySelect.innerHTML += '<option disabled>No categories available</option>';
        return;
    }

    availableCategories.forEach(category => {
        const option = document.createElement('option');
        // Handle both string and object formats
        const categoryName = typeof category === 'string' ? category : (category.name || String(category));
        option.value = categoryName;
        option.textContent = categoryName;
        categorySelect.appendChild(option);
    });
    
    console.log('✅ Category dropdown populated with', availableCategories.length, 'categories');
}

// Setup product name autocomplete
function setupProductAutocomplete() {
    const productInput = document.getElementById('productName');
    if (!productInput) return;

    productInput.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        if (value.length === 0) {
            removeAutocompleteList();
            return;
        }

        const matches = availableProducts.filter(p => 
            p.name.toLowerCase().includes(value)
        );

        showAutocompleteList(matches, this);
    });

    productInput.addEventListener('blur', function() {
        setTimeout(() => removeAutocompleteList(), 200);
    });
}

// Show autocomplete suggestions
function showAutocompleteList(products, inputElement) {
    removeAutocompleteList();

    if (products.length === 0) return;

    const list = document.createElement('div');
    list.id = 'autocompleteList';
    list.className = 'absolute bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-full max-h-48 overflow-y-auto';
    list.style.top = (inputElement.offsetTop + inputElement.offsetHeight) + 'px';
    list.style.left = inputElement.offsetLeft + 'px';

    products.slice(0, 10).forEach(product => {
        const item = document.createElement('div');
        item.className = 'px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-gray-100 text-sm';
        item.innerHTML = `<strong>${product.name}</strong> <span class="text-gray-500">(Stock: ${product.stock_quantity})</span>`;
        
        item.addEventListener('click', function() {
            document.getElementById('productName').value = product.name;
            removeAutocompleteList();
        });

        list.appendChild(item);
    });

    inputElement.parentElement.style.position = 'relative';
    inputElement.parentElement.appendChild(list);
}

// Remove autocomplete list
function removeAutocompleteList() {
    const list = document.getElementById('autocompleteList');
    if (list) list.remove();
}

// Switch Bill Mode (Sell or Buy)
function switchBillMode(mode) {
    try {
        billMode = mode;
        
        // Update button styles
        const sellBtn = document.getElementById('sellModeBtn');
        const buyBtn = document.getElementById('buyModeBtn');
        
        if (mode === 'sell') {
            sellBtn.classList.add('active-bank-mode');
            buyBtn.classList.remove('active-bank-mode');
            const icon = document.querySelector('#retailerSection h3 i');
            if (icon) {
                icon.className = 'fa-solid fa-user-tie text-[#0F766E]';
            }
            document.getElementById('partyLabel').textContent = 'Retailer';
            document.getElementById('partyNameLabel').textContent = 'Retailer';
            document.getElementById('retailerName').placeholder = 'e.g., Sita Retailers, Gopal Kirana';
        } else {
            buyBtn.classList.add('active-bank-mode');
            sellBtn.classList.remove('active-bank-mode');
            const icon = document.querySelector('#retailerSection h3 i');
            if (icon) {
                icon.className = 'fa-solid fa-user-tie text-[#0F766E]';
            }
            document.getElementById('partyLabel').textContent = 'Supplier/Vendor';
            document.getElementById('partyNameLabel').textContent = 'Supplier/Vendor';
            document.getElementById('retailerName').placeholder = 'e.g., Wholesale Supplier, Factory Name';
        }
        
        // Clear form
        clearBillForm();
    } catch (error) {
        console.error('Error in switchBillMode:', error);
        alert('Error switching bill mode. Please refresh the page.');
    }
}
// Setup Event Listeners
function setupEventListeners() {
    // Add Item Button
    document.getElementById('addItemBtn').addEventListener('click', addItem);

    // Discount calculation
    document.getElementById('discountPercent').addEventListener('change', updateCalculations);

    // Payment Type Change
    document.querySelectorAll('input[name="paymentType"]').forEach(radio => {
        radio.addEventListener('change', handlePaymentTypeChange);
    });

    // Paid Amount for Partial
    document.getElementById('paidAmount').addEventListener('keyup', updateRemainingBalance);

    // Save Button
    document.getElementById('saveBillBtn').addEventListener('click', saveBill);

    // Print Button
    document.getElementById('printBillBtn').addEventListener('click', printBill);

    // Reset Button
    document.getElementById('resetBtn').addEventListener('click', resetForm);
}

// Add Item to Bill
function addItem() {
    const productName = document.getElementById('productName').value.trim();
    const numOfSets = parseFloat(document.getElementById('numOfSets').value);
    const minSize = parseFloat(document.getElementById('minSize').value);
    const maxSize = parseFloat(document.getElementById('maxSize').value);
    const unitPrice = parseFloat(document.getElementById('unitPrice').value);
    const category = document.getElementById('categories').value;

    // Validation
    if (!productName || isNaN(unitPrice) || unitPrice < 0) {
        alert('Please fill all required item fields (Product Name, Number of Sets, Min Size, Max Size, Unit Price) with valid values');
        return;
    }

    // Calculate quantity: Number of Sets × (Max Size - Min Size + 1) [inclusive range]
    let quantity = 1; // Default
    const minSizeVal = isNaN(minSize) ? null : minSize;
    const maxSizeVal = isNaN(maxSize) ? null : maxSize;
    const numOfSetsVal = isNaN(numOfSets) ? 1 : numOfSets;

    if (minSizeVal !== null && maxSizeVal !== null && numOfSetsVal > 0) {
        quantity = numOfSetsVal * (maxSizeVal - minSizeVal);
    } else if (numOfSetsVal > 0) {
        quantity = numOfSetsVal;
    }

    // Create Item Object
    const item = {
        id: Date.now(),
        productName,
        quantity,
        minSize: minSizeVal,
        maxSize: maxSizeVal,
        numOfSets: numOfSetsVal,
        unit: 'pcs',
        unitPrice,
        category: category || null,
        total: quantity * unitPrice
    };

    // Add to array
    billItems.push(item);

    // Add to UI
    renderItems();

    // Clear form
    document.getElementById('productName').value = '';
    document.getElementById('numOfSets').value = '';
    document.getElementById('minSize').value = '';
    document.getElementById('maxSize').value = '';
    document.getElementById('unitPrice').value = '';
    document.getElementById('categories').value = '';
    document.getElementById('productName').focus();

    // Update calculations
    updateCalculations();
}

// Render Items
function renderItems() {
    const itemsList = document.getElementById('itemsList');
    
    if (billItems.length === 0) {
        itemsList.innerHTML = '<p class="text-center text-gray-400 text-sm py-6">Items will appear here after adding them</p>';
        return;
    }
    
    itemsList.innerHTML = '';

    billItems.forEach((item) => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card bg-white p-3 rounded-lg border border-gray-200 fade-in shadow-sm hover:shadow-md transition';
        
        // Build size info if available
        let sizeInfo = '';
        if (item.minSize !== null && item.maxSize !== null) {
            sizeInfo = ` (${item.minSize} - ${item.maxSize})`;
        }
        
        itemCard.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1">
                    <p class="font-semibold text-gray-800 text-sm">${item.productName}</p>
                    <p class="text-xs text-gray-500">
                        ${item.numOfSets ? item.numOfSets + ' sets' : ''} ${sizeInfo} = ${item.quantity} qty × Rs ${item.unitPrice.toFixed(2)} = <span class="font-bold text-gray-800">Rs ${item.total.toFixed(2)}</span>
                    </p>
                </div>
                <button onclick="removeItem(${item.id})" class="text-[#0F766E] hover:text-[#134E4A] hover:bg-slate-50 p-1 rounded transition flex-shrink-0">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        `;
        itemsList.appendChild(itemCard);
    });

    // Update item count
    document.getElementById('itemCount').textContent = billItems.length;
}

// Remove Item
function removeItem(itemId) {
    billItems = billItems.filter(item => item.id !== itemId);
    renderItems();
    updateCalculations();
}

// Update Calculations
function updateCalculations() {
    // Calculate subtotal
    const subtotal = billItems.reduce((sum, item) => sum + item.total, 0);

    // Get discount
    const discountPercent = parseFloat(document.getElementById('discountPercent').value) || 0;
    const discountAmount = (subtotal * discountPercent) / 100;

    // Calculate total (without tax)
    const totalAmount = subtotal - discountAmount;

    // Update UI
    document.getElementById('subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('discountAmount').value = `Rs ${discountAmount.toFixed(2)}`;
    document.getElementById('totalAmount').textContent = totalAmount.toFixed(2);

    // Update remaining balance if partial payment
    updateRemainingBalance();
}

// Handle Payment Type Change
function handlePaymentTypeChange() {
    const paymentType = document.querySelector('input[name="paymentType"]:checked').value;
    const paidAmountDiv = document.getElementById('paidAmountDiv');

    if (paymentType === 'partial') {
        paidAmountDiv.classList.remove('hidden');
    } else {
        paidAmountDiv.classList.add('hidden');
        document.getElementById('paidAmount').value = '';
    }
}

// Update Remaining Balance
function updateRemainingBalance() {
    const paymentType = document.querySelector('input[name="paymentType"]:checked').value;
    
    if (paymentType === 'partial') {
        const totalAmount = parseFloat(document.getElementById('totalAmount').textContent);
        const paidAmount = parseFloat(document.getElementById('paidAmount').value) || 0;
        const remaining = totalAmount - paidAmount;
        document.getElementById('remainingBalance').textContent = remaining.toFixed(2);
    }
}

// Save Bill
function saveBill() {
    // Validation
    if (billItems.length === 0) {
        alert('Please add at least one item to the bill');
        return;
    }

    const retailerName = document.getElementById('retailerName').value.trim();
    const billTitle = document.getElementById('billTitle').value.trim();
    const billDate = document.getElementById('billDate').value;
    const paymentMethod = document.getElementById('paymentMethod').value;

    if (!retailerName || !billTitle || !billDate || !paymentMethod) {
        alert('Please fill all required fields');
        return;
    }

    const paymentType = document.querySelector('input[name="paymentType"]:checked').value;
    if (paymentType === 'partial') {
        const paidAmount = parseFloat(document.getElementById('paidAmount').value);
        if (!paidAmount || paidAmount <= 0) {
            alert('Please enter a valid paid amount for partial payment');
            return;
        }
    }

    // Prepare bill data for API
    const subtotal = parseFloat(document.getElementById('subtotal').textContent);
    const discountPercent = parseFloat(document.getElementById('discountPercent').value) || 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const totalAmount = subtotal - discountAmount;
    const paidAmount = paymentType === 'partial' ? parseFloat(document.getElementById('paidAmount').value) : totalAmount;
    const remainingBalance = paymentType === 'partial' ? (totalAmount - paidAmount) : 0;

    const billData = {
        bill_number: `BILL-${Date.now()}`,
        bill_title: billTitle,
        bill_date: billDate,
        bill_type: billMode, // 'sell' or 'buy'
        party_name: retailerName,
        contact_number: document.getElementById('contactNumber').value || null,
        email: document.getElementById('email').value || null,
        address: document.getElementById('address').value || null,
        subtotal: subtotal,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_type: paymentType,
        paid_amount: paidAmount,
        remaining_balance: remainingBalance,
        notes: document.getElementById('notes').value || null,
        items: billItems.map(item => ({
            product_name: item.productName,
            quantity: item.quantity,
            min_size: item.minSize,
            max_size: item.maxSize,
            unit: item.unit,
            unit_price: item.unitPrice,
            category: item.category
        }))
    };

    console.log('📝 Saving bill:', billData);

    // Send to API
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Error: Authentication token not found. Please login again.');
        return;
    }

    const apiUrl = '/api/bills';
    console.log('🌐 Calling API:', apiUrl);

    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(billData)
    })
    .then(async response => {
        console.log('📊 Response status:', response.status);
        if (!response.ok) {
            let errMessage = `Server error: ${response.status} ${response.statusText}`;
            try {
                const err = await response.json();
                console.error('❌ Server error:', err);
                errMessage = err.error || err.message || errMessage;
            } catch (parseErr) {
                console.error('❌ Failed to parse error response:', parseErr);
            }
            throw new Error(errMessage);
        }
        return response.json();
    })
    .then(data => {
        console.log('✅ Bill saved successfully:', data);
        const partyType = billMode === 'sell' ? 'Retailer' : 'Supplier/Vendor';
        alert(`✓ Bill saved successfully!\n\nBill ID: ${data.bill_id}\n${partyType}: ${retailerName}\nTotal: Rs ${totalAmount.toFixed(2)}\nPayment Type: ${paymentType === 'full' ? 'Full Payment' : 'Partial Payment'}`);
        resetForm();
    })
    .catch(error => {
        console.error('❌ Error saving bill:', error);
        alert(`Error saving bill: ${error.message}`);
    });
}

// Print Bill
async function printBill() {
    if (billItems.length === 0) {
        alert('Please add items to the bill before printing');
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

    const billTitle = document.getElementById('billTitle').value || 'Bill';
    const retailerName = document.getElementById('retailerName').value || 'Retailer';
    const billDate = document.getElementById('billDate').value;
    const subtotal = document.getElementById('subtotal').textContent;
    const discountAmount = document.getElementById('discountAmount').value;
    const totalAmount = document.getElementById('totalAmount').textContent;
    const paymentType = document.querySelector('input[name="paymentType"]:checked').value;
    const paymentMethod = document.getElementById('paymentMethod').value;

    let itemsHtml = billItems.map((item, index) => {
        let sizeInfo = '';
        if (item.minSize !== null && item.maxSize !== null) {
            sizeInfo = ` (${item.minSize} - ${item.maxSize})`;
        }
        return `
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${index + 1}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${item.productName}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity} ${item.unit || 'pcs'}${sizeInfo}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rs ${item.unitPrice.toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rs ${item.total.toFixed(2)}</td>
        </tr>
    `;
    }).join('');

    let paidInfo = '';
    if (paymentType === 'partial') {
        const paidAmount = document.getElementById('paidAmount').value;
        const remaining = document.getElementById('remainingBalance').textContent;
        paidInfo = `
            <tr>
                <td colspan="4" style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">Paid Amount:</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rs ${paidAmount}</td>
            </tr>
            <tr>
                <td colspan="4" style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">Remaining Balance:</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right; color: red; font-weight: bold;">Rs ${remaining}</td>
            </tr>
        `;
    }

    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Bill - ${billTitle}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 20px; }
                h1 { margin: 0; color: #0F766E; }
                .bill-info { margin-bottom: 20px; }
                .bill-info p { margin: 5px 0; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                .summary { float: right; width: 300px; margin-top: 20px; }
                .summary p { display: flex; justify-content: space-between; margin: 8px 0; }
                .total { font-weight: bold; font-size: 18px; color: #0F766E; border-top: 2px solid #0F766E; padding-top: 10px; }
                .payment-badge { 
                    display: inline-block; 
                    padding: 5px 10px; 
                    background-color: ${paymentType === 'full' ? '#0F766E' : '#0F766E'}; 
                    color: white; 
                    border-radius: 3px; 
                    margin: 5px 0;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${businessName}</h1>
                <p style="color: #666; font-size: 12px;">"साझा समाधान, सजिलो व्यापार"</p>
                <h2>${billTitle}</h2>
            </div>

            <div class="bill-info">
                <p><strong>Date:</strong> ${billDate}</p>
                <p><strong>Retailer:</strong> ${retailerName}</p>
                <p><strong>Payment Type:</strong> <span class="payment-badge">${paymentType === 'full' ? 'Full Payment' : 'Partial Payment'}</span></p>
            </div>

            <table>
                <thead>
                    <tr style="background-color: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px;">S.N.</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Product</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantity</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Unit Price</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="summary">
                <p><span>Subtotal:</span> <span>Rs ${subtotal}</span></p>
                <p><span>Discount:</span> <span>${discountAmount}</span></p>
                <p class="total"><span>Total:</span> <span>Rs ${totalAmount}</span></p>
                ${paidInfo}
            </div>

            <div style="clear: both; margin-top: 40px; text-align: center; color: #999; font-size: 12px;">
                <p>Thank you for your business!</p>
                <p>Payment Method: ${paymentMethod}</p>
            </div>

            <script>
                window.print();
                window.close();
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Reset Form
function resetForm() {
    // Clear items
    billItems = [];
    document.getElementById('itemsList').innerHTML = '';
    document.getElementById('itemCount').textContent = '0';

    // Reset form fields
    document.getElementById('retailerName').value = '';
    document.getElementById('contactNumber').value = '';
    document.getElementById('email').value = '';
    document.getElementById('address').value = '';
    document.getElementById('billTitle').value = '';
    document.getElementById('notes').value = '';

    // Reset numbers
    document.getElementById('discountPercent').value = '';
    document.getElementById('paidAmount').value = '';
    document.querySelector('input[name="paymentType"][value="full"]').checked = true;
    document.getElementById('paymentMethod').value = '';

    // Reset calculations
    document.getElementById('subtotal').textContent = '0.00';
    document.getElementById('discountAmount').value = 'Rs 0.00';
    document.getElementById('totalAmount').textContent = '0.00';
    document.getElementById('remainingBalance').textContent = '0.00';

    // Reset date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('billDate').value = today;

    // Hide paid amount div
    document.getElementById('paidAmountDiv').classList.add('hidden');

    // Focus on retailer name
    document.getElementById('retailerName').focus();
}
// Clear form for mode switching
function clearBillForm() {
    try {
        // Clear items
        billItems = [];
        const itemsList = document.getElementById('itemsList');
        const itemCount = document.getElementById('itemCount');
        if (itemsList) itemsList.innerHTML = '';
        if (itemCount) itemCount.textContent = '0';

        // Reset form fields
        const fields = ['retailerName', 'contactNumber', 'email', 'address', 'billTitle', 'notes'];
        fields.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) elem.value = '';
        });

        // Reset numbers
        const numberFields = ['discountPercent', 'paidAmount'];
        numberFields.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) elem.value = '';
        });

        const paymentTypeRadio = document.querySelector('input[name="paymentType"][value="full"]');
        if (paymentTypeRadio) paymentTypeRadio.checked = true;

        const paymentMethod = document.getElementById('paymentMethod');
        if (paymentMethod) paymentMethod.value = '';

        // Reset calculations
        const textFields = {
            'subtotal': '0.00',
            'totalAmount': '0.00',
            'remainingBalance': '0.00'
        };
        Object.entries(textFields).forEach(([id, value]) => {
            const elem = document.getElementById(id);
            if (elem) elem.textContent = value;
        });

        const valueFields = {
            'discountAmount': 'Rs 0.00'
        };
        Object.entries(valueFields).forEach(([id, value]) => {
            const elem = document.getElementById(id);
            if (elem) elem.value = value;
        });

        // Reset date to today
        const billDate = document.getElementById('billDate');
        if (billDate) {
            const today = new Date().toISOString().split('T')[0];
            billDate.value = today;
        }

        // Hide paid amount div
        const paidAmountDiv = document.getElementById('paidAmountDiv');
        if (paidAmountDiv) paidAmountDiv.classList.add('hidden');

        // Focus on retailer name
        const retailerName = document.getElementById('retailerName');
        if (retailerName) retailerName.focus();
    } catch (error) {
        console.error('Error in clearBillForm:', error);
    }
}


async function fetchCategories() {

    const categories = document.querySelector(".categories");
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('❌ No token found in localStorage');
            return ['No categories available'];
        }
        
        console.log('📡 Fetching categories with token...');
        
        const response = await fetch('/api/products/category', {
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
            return ['Error loading categories'];
        }

        const result = await response.json();
        console.log('✅ Categories response:', result);
        
        const categories = result.data || result;
        
        if (!Array.isArray(categories)) {
            console.error('❌ Categories is not an array:', categories);
            return ['Invalid response format'];
        }

        if (categories.length === 0) {
            console.warn('⚠️ No categories found for this tenant');
            return ['No categories available'];
        }

        console.log(`✅ Loaded ${categories.length} categories:`, categories);
        return categories;
        
    } catch (error) {
        console.error('🔴 Error fetching categories:', error);
        return ['Error: ' + error.message];
    }
}
