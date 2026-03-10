// Workers Management JavaScript

let allWorkers = [];
let filteredWorkers = [];
let workerToDelete = null;
let editingWorkerId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    fetchWorkers();
    setDefaultDate();
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

// User info is now loaded centrally by sidebar.js loadHeaderUser()

// Set default date for join date
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('workerJoinDate').value = today;
    document.getElementById('payDate').value = today;
}

// Fetch workers from API
async function fetchWorkers() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            window.location.href = '/login';
            return;
        }

        const response = await fetch('/api/workers', {
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
            throw new Error('Failed to fetch workers');
        }

        const data = await response.json();
        allWorkers = data.workers || [];
        
        filterWorkers();
        updateStats();
        
    } catch (error) {
        console.error('Error fetching workers:', error);
        showEmptyState();
    }
}

// Filter and sort workers
function filterWorkers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sortBy = document.getElementById('sortBy').value;

    filteredWorkers = [...allWorkers];

    // Apply search filter
    if (searchTerm) {
        filteredWorkers = filteredWorkers.filter(worker => 
            worker.name.toLowerCase().includes(searchTerm) ||
            worker.phone?.toLowerCase().includes(searchTerm) ||
            worker.position?.toLowerCase().includes(searchTerm)
        );
    }

    // Apply sorting
    filteredWorkers.sort((a, b) => {
        switch (sortBy) {
            case 'newest':
                return new Date(b.created_at || b.join_date) - new Date(a.created_at || a.join_date);
            case 'oldest':
                return new Date(a.created_at || a.join_date) - new Date(b.created_at || b.join_date);
            case 'name':
                return a.name.localeCompare(b.name);
            case 'salary_high':
                return (b.salary + (b.allowance || 0)) - (a.salary + (a.allowance || 0));
            case 'salary_low':
                return (a.salary + (a.allowance || 0)) - (b.salary + (b.allowance || 0));
            default:
                return 0;
        }
    });

    renderWorkers();
}

// Render workers table
function renderWorkers() {
    const tbody = document.getElementById('workersTableBody');
    
    if (filteredWorkers.length === 0) {
        showEmptyState();
        return;
    }

    tbody.innerHTML = filteredWorkers.map(worker => {
        const totalSalary = (worker.salary || 0) + (worker.allowance || 0);

        const initials = worker.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

        return `
            <tr class="hover:bg-gray-50 transition">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="h-10 w-10 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#1e3a5f] flex items-center justify-center text-white font-bold text-sm">
                            ${initials}
                        </div>
                        <div>
                            <p class="font-semibold text-gray-800">${escapeHtml(worker.name)}</p>
                            <p class="text-xs text-gray-400">Joined: ${formatDate(worker.join_date)}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <p class="text-gray-800">${escapeHtml(worker.phone || 'N/A')}</p>
                    <p class="text-xs text-gray-400">${escapeHtml(worker.email || 'No email')}</p>
                </td>
                <td class="px-6 py-4 text-gray-700">${escapeHtml(worker.position || 'N/A')}</td>
                <td class="px-6 py-4 text-right">
                    <p class="font-bold text-gray-800">₹${totalSalary.toLocaleString('en-IN')}</p>
                    <p class="text-xs text-gray-400">${worker.payment_cycle || 'monthly'}</p>
                </td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="viewWorker('${worker.id}')" class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="View Details">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button onclick="editWorker('${worker.id}')" class="p-2 text-[#1e3a5f] hover:bg-slate-50 rounded-lg transition" title="Edit">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="openPayModal('${worker.id}')" class="p-2 text-[#1e3a5f] hover:bg-slate-50 rounded-lg transition" title="Pay Salary">
                            <i class="fa-solid fa-indian-rupee-sign"></i>
                        </button>
                        <button onclick="deleteWorker('${worker.id}', '${escapeHtml(worker.name)}')" class="p-2 text-[#1e3a5f] hover:bg-slate-50 rounded-lg transition" title="Remove">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Show empty state
function showEmptyState() {
    const tbody = document.getElementById('workersTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center justify-center">
                    <i class="fa-solid fa-users-slash text-gray-300 text-5xl mb-4"></i>
                    <p class="text-gray-500 font-medium">No workers found</p>
                    <p class="text-gray-400 text-sm mt-1">Add your first worker to get started</p>
                    <button onclick="openAddWorkerModal()" class="mt-4 inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#0f172a] text-white font-semibold py-2 px-4 rounded-lg transition">
                        <i class="fa-solid fa-user-plus"></i> Add Worker
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Update statistics
function updateStats() {
    const totalWorkersCount = allWorkers.length;
    const totalMonthlySalary = allWorkers
        .reduce((sum, w) => sum + (w.salary || 0) + (w.allowance || 0), 0);

    document.getElementById('totalWorkers').textContent = totalWorkersCount;
    document.getElementById('totalSalary').textContent = `Rs ${totalMonthlySalary.toLocaleString('en-IN')}`;
    document.getElementById('pendingPayments').textContent = `Rs 0`; // Can be calculated from payment history
}

// Search handler with debounce
let searchTimeout;
function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        filterWorkers();
    }, 300);
}

// Reset filters
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('sortBy').value = 'newest';
    filterWorkers();
}

// Open Add Worker Modal
function openAddWorkerModal() {
    editingWorkerId = null;
    document.getElementById('modalTitle').textContent = 'Add New Worker';
    document.getElementById('saveButtonText').textContent = 'Add Worker';
    document.getElementById('workerForm').reset();
    setDefaultDate();
    document.getElementById('workerModal').classList.remove('hidden');
}

// Close Worker Modal
function closeWorkerModal() {
    document.getElementById('workerModal').classList.add('hidden');
    editingWorkerId = null;
}

// Edit Worker
function editWorker(workerId) {
    const worker = allWorkers.find(w => w.id === workerId || w.id === parseInt(workerId));
    
    if (!worker) {
        showError('Worker not found');
        return;
    }

    editingWorkerId = worker.id;
    document.getElementById('modalTitle').textContent = 'Edit Worker';
    document.getElementById('saveButtonText').textContent = 'Save Changes';
    
    document.getElementById('workerId').value = worker.id;
    document.getElementById('workerName').value = worker.name || '';
    document.getElementById('workerPhone').value = worker.phone || '';
    document.getElementById('workerEmail').value = worker.email || '';
    document.getElementById('workerJoinDate').value = worker.join_date || '';
    document.getElementById('workerAddress').value = worker.address || '';
    const positionField = document.getElementById('workerPosition');
    if (positionField) positionField.value = worker.position || '';
    document.getElementById('workerSalary').value = worker.salary || '';
    document.getElementById('workerAllowance').value = worker.allowance || 0;
    document.getElementById('workerPaymentCycle').value = worker.payment_cycle || 'monthly';

    document.getElementById('workerModal').classList.remove('hidden');
}

// Save Worker
async function saveWorker() {
    const name = document.getElementById('workerName').value.trim();
    const phone = document.getElementById('workerPhone').value.trim();
    const email = document.getElementById('workerEmail').value.trim();
    const joinDate = document.getElementById('workerJoinDate').value;
    const address = document.getElementById('workerAddress').value.trim();
    const positionField = document.getElementById('workerPosition');
    const position = positionField ? positionField.value.trim() : '';
    const salary = parseFloat(document.getElementById('workerSalary').value) || 0;
    const allowance = parseFloat(document.getElementById('workerAllowance').value) || 0;
    const paymentCycle = document.getElementById('workerPaymentCycle').value;

    if (!name || !phone || !joinDate || salary <= 0) {
        showError('Please fill in all required fields');
        return;
    }

    const workerData = {
        name,
        phone,
        email,
        join_date: joinDate,
        address,
        salary,
        allowance,
        payment_cycle: paymentCycle
    };
    
    if (position) {
        workerData.position = position;
    }

    try {
        const token = localStorage.getItem('token');
        const url = editingWorkerId ? `/api/workers/${editingWorkerId}` : '/api/workers';
        const method = editingWorkerId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(workerData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save worker');
        }

        closeWorkerModal();
        showSuccess(editingWorkerId ? 'Worker updated successfully' : 'Worker added successfully');
        fetchWorkers();

    } catch (error) {
        console.error('Error saving worker:', error);
        showError(error.message || 'Failed to save worker. Please try again.');
    }
}

// View Worker Details
function viewWorker(workerId) {
    const worker = allWorkers.find(w => w.id === workerId || w.id === parseInt(workerId));
    
    if (!worker) {
        showError('Worker not found');
        return;
    }

    const totalSalary = (worker.salary || 0) + (worker.allowance || 0);

    const initials = worker.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

    document.getElementById('viewWorkerContent').innerHTML = `
        <div class="flex items-center gap-4 mb-6">
            <div class="h-20 w-20 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#1e3a5f] flex items-center justify-center text-white font-bold text-2xl">
                ${initials}
            </div>
            <div>
                <h4 class="text-2xl font-bold text-gray-800">${escapeHtml(worker.name)}</h4>
                <p class="text-gray-500">${escapeHtml(worker.position || 'N/A')}</p>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
                <h5 class="font-semibold text-gray-700 border-b pb-2">Contact Information</h5>
                <div class="space-y-3">
                    <div class="flex items-center gap-3">
                        <i class="fa-solid fa-phone text-gray-400 w-5"></i>
                        <span class="text-gray-800">${escapeHtml(worker.phone || 'N/A')}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <i class="fa-solid fa-envelope text-gray-400 w-5"></i>
                        <span class="text-gray-800">${escapeHtml(worker.email || 'N/A')}</span>
                    </div>
                    <div class="flex items-start gap-3">
                        <i class="fa-solid fa-location-dot text-gray-400 w-5 mt-1"></i>
                        <span class="text-gray-800">${escapeHtml(worker.address || 'N/A')}</span>
                    </div>
                </div>
            </div>

            <div class="space-y-4">
                <h5 class="font-semibold text-gray-700 border-b pb-2">Employment Details</h5>
                <div class="space-y-3">
                    <div class="flex items-center gap-3">
                        <i class="fa-solid fa-calendar text-gray-400 w-5"></i>
                        <span class="text-gray-800">Joined: ${formatDate(worker.join_date)}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <i class="fa-solid fa-briefcase text-gray-400 w-5"></i>
                        <span class="text-gray-800">${escapeHtml(worker.position || 'N/A')}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-6 bg-gray-50 rounded-xl p-5">
            <h5 class="font-semibold text-gray-700 mb-4">Salary Information</h5>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-white rounded-lg p-4 text-center">
                    <p class="text-sm text-gray-500">Basic Salary</p>
                    <p class="text-xl font-bold text-gray-800">₹${(worker.salary || 0).toLocaleString('en-IN')}</p>
                </div>
                <div class="bg-white rounded-lg p-4 text-center">
                    <p class="text-sm text-gray-500">Allowances</p>
                    <p class="text-xl font-bold text-gray-800">₹${(worker.allowance || 0).toLocaleString('en-IN')}</p>
                </div>
                <div class="bg-white rounded-lg p-4 text-center">
                    <p class="text-sm text-gray-500">Total Salary</p>
                    <p class="text-xl font-bold text-[#1e3a5f]">₹${totalSalary.toLocaleString('en-IN')}</p>
                </div>
                <div class="bg-white rounded-lg p-4 text-center">
                    <p class="text-sm text-gray-500">Payment Cycle</p>
                    <p class="text-xl font-bold text-gray-800 capitalize">${worker.payment_cycle || 'Monthly'}</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('viewModal').classList.remove('hidden');
}

// Close View Modal
function closeViewModal() {
    document.getElementById('viewModal').classList.add('hidden');
}

// Delete Worker
function deleteWorker(workerId, workerName) {
    workerToDelete = workerId;
    document.getElementById('deleteWorkerName').textContent = workerName;
    document.getElementById('deleteModal').classList.remove('hidden');
}

// Close Delete Modal
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    workerToDelete = null;
}

// Confirm Delete
async function confirmDelete() {
    if (!workerToDelete) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/workers/${workerToDelete}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete worker');
        }

        closeDeleteModal();
        showSuccess('Worker removed successfully');
        fetchWorkers();

    } catch (error) {
        console.error('Error deleting worker:', error);
        showError('Failed to remove worker. Please try again.');
    }
}

// Open Pay Modal
function openPayModal(workerId) {
    const worker = allWorkers.find(w => w.id === workerId || w.id === parseInt(workerId));
    
    if (!worker) {
        showError('Worker not found');
        return;
    }

    const totalSalary = (worker.salary || 0) + (worker.allowance || 0);

    document.getElementById('payWorkerId').value = worker.id;
    document.getElementById('payWorkerName').textContent = worker.name;
    document.getElementById('payTotalSalary').textContent = `Rs ${totalSalary.toLocaleString('en-IN')}`;
    document.getElementById('payPaymentCycle').textContent = (worker.payment_cycle || 'monthly').charAt(0).toUpperCase() + (worker.payment_cycle || 'monthly').slice(1);
    document.getElementById('payAmount').value = totalSalary;
    document.getElementById('payDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('payNotes').value = '';

    document.getElementById('payModal').classList.remove('hidden');
}

// Close Pay Modal
function closePayModal() {
    document.getElementById('payModal').classList.add('hidden');
}

// Record Payment
async function recordPayment() {
    const workerId = document.getElementById('payWorkerId').value;
    const amount = parseFloat(document.getElementById('payAmount').value) || 0;
    const payDate = document.getElementById('payDate').value;
    const payMethod = document.getElementById('payMethod').value;
    const notes = document.getElementById('payNotes').value.trim();

    if (amount <= 0) {
        showError('Please enter a valid payment amount');
        return;
    }

    const paymentData = {
        worker_id: workerId,
        amount,
        payment_date: payDate,
        payment_method: payMethod,
        notes
    };

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/workers/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to record payment');
        }

        closePayModal();
        showSuccess('Payment recorded successfully');

    } catch (error) {
        console.error('Error recording payment:', error);
        showError(error.message || 'Failed to record payment. Please try again.');
    }
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function showError(message) {
    alert('Error: ' + message);
}

function showSuccess(message) {
    alert(message);
}
