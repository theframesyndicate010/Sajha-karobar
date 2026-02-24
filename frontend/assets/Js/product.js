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

// Get product ID from URL parameters
function getProductId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

 // Load product details
async function loadProductDetails() {
    const productId = getProductId();
    
    if (!productId) {
        showError('No product ID provided');
        return;
    }
    try {
        const response = await fetch(`/api/products/${productId}`);
        
        if (!response.ok) {
            throw new Error('Product not found');
        }

            const data = await response.json();
            const product = data.product || data;
            
            // Display product details
            displayProductDetails(product);
            
    } catch (error) {
        showError('Error loading product: ' + error.message);
    }
}

    // Display product details
    function displayProductDetails(product) {
        document.getElementById('detailName').textContent = product.name || '-';
        document.getElementById('detailCategory').textContent = product.category || '-';
        document.getElementById('detailPrice').textContent = 'Rs ' + (product.price || '0').toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        // Handle both camelCase and snake_case field names
        document.getElementById('detailSizeMin').textContent = (product.sizeMin || product.size_min) || '-';
        document.getElementById('detailSizeMax').textContent = (product.sizeMax || product.size_max) || '-';
        document.getElementById('detailQuantity').textContent = product.quantity || '-';
        document.getElementById('productSubtitle').textContent = product.name || 'Product Details';
        
        // Format date
        const dateField = product.createdAt || product.created_at;
        if (dateField) {
            const date = new Date(dateField);
            document.getElementById('detailCreatedDate').textContent = date.toLocaleDateString('en-IN');
        }

        // Hide loading and show details
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('productDetailsContainer').classList.remove('hidden');
        document.getElementById('actionButtons').style.display = 'flex';
    }

    // Show error message
    function showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        document.getElementById('loadingMessage').style.display = 'none';
    }

    // Edit product
    function editProduct() {
        const productId = getProductId();
        if (productId) {
            window.location.href = `/edit?id=${productId}`;
        }
    }

    // Delete product
    function deleteProduct() {
        if (confirm('Are you sure you want to delete this product?')) {
            const productId = getProductId();
            fetch(`/api/products/${productId}`, {
                method: 'DELETE'
            }).then(response => {
                if (response.ok) {
                    alert('Product deleted successfully');
                    window.location.href = '/dashboard';
                } else {
                    alert('Error deleting product');
                }
            }).catch(error => {
                alert('Error: ' + error.message);
            });
        }
    }

    // Navigate to dashboard
    function goToDashboard() {
        window.location.href = '/dashboard';
    }

    // Load product details on page load
    document.addEventListener('DOMContentLoaded', loadProductDetails);
