// Sidebar Navigation Component
// Include this file in all pages and call initSidebar() after DOM loads

// ---- Session Management (7-day persistent login) ----
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

async function checkAndRefreshSession() {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refresh_token');
    const loginTimestamp = parseInt(localStorage.getItem('loginTimestamp') || '0');

    // No session at all — redirect to login
    if (!token) {
        forceLogout();
        return false;
    }

    // Session older than 7 days — force re-login
    if (loginTimestamp && (Date.now() - loginTimestamp > SESSION_MAX_AGE)) {
        forceLogout();
        return false;
    }

    // Try to refresh the access token if we have a refresh token
    if (refreshToken) {
        try {
            const res = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('token', data.token);
                if (data.refresh_token) {
                    localStorage.setItem('refresh_token', data.refresh_token);
                }
                if (data.user) {
                    localStorage.setItem('user', JSON.stringify(data.user));
                }
                return true;
            } else {
                // Refresh failed — token may still be valid for a while, don't logout yet
                console.warn('Token refresh failed, using existing token');
                return true;
            }
        } catch (err) {
            // Network error — offline, keep existing token
            console.warn('Token refresh network error:', err.message);
            return true;
        }
    }

    return true;
}

function forceLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('loginTimestamp');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/signup')) {
        window.location.href = '/login';
    }
}

// ---- End Session Management ----

// Fetch tenant/business name from the database
async function loadTenantName() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch('/api/tenants/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            const businessName = data.tenant?.name || 'My Business';
            const initials = businessName.substring(0, 2).toUpperCase();

            const nameEl = document.getElementById('sidebarBusinessName');
            const initialsEl = document.getElementById('sidebarInitials');
            if (nameEl) nameEl.textContent = businessName;
            if (initialsEl) initialsEl.textContent = initials;
        }
    } catch (err) {
        console.warn('Failed to load tenant name:', err.message);
    }
}

function createSidebar(activePage = '') {
    const sidebarHTML = `
        <!-- Mobile Sidebar Overlay -->
        <div id="sidebarOverlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black bg-opacity-50 z-20 hidden lg:hidden"></div>

        <!-- SIDEBAR -->
        <aside id="sidebar" class="fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#0f172a] transform -translate-x-full lg:translate-x-0 transition-transform duration-300 flex flex-col h-full shadow-xl lg:shadow-none">
            
            <!-- Logo -->
            <div class="p-6 border-b border-white/10">
                <div class="flex items-center gap-3">
                    <div class="bg-gradient-to-br from-amber-400 to-amber-500 text-[#0f172a] h-10 w-10 flex items-center justify-center rounded-lg font-bold text-lg shadow-md" id="sidebarInitials">...</div>
                    <div>
                        <h1 class="text-lg font-bold text-white tracking-tight" id="sidebarBusinessName">Loading...</h1>
                        <p class="text-[10px] text-amber-400/70 font-medium uppercase tracking-wider">"साझा समाधान, सजिलो व्यापार"</p>
                    </div>
                </div>
            </div>

            <!-- Navigation -->
            <nav class="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                <p class="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Main Menu</p>
                
                <a href="/dashboard" class="sidebar-link ${activePage === 'dashboard' ? 'active' : ''} flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-400">
                    <i class="fa-solid fa-house w-5 text-center transition-colors"></i> Dashboard
                </a>
                <a href="/sale" class="sidebar-link ${activePage === 'sale' ? 'active' : ''} flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-400">
                    <i class="fa-solid fa-cart-shopping w-5 text-center transition-colors"></i> Sale
                </a>
                <a href="/stock" class="sidebar-link ${activePage === 'stock' || activePage === 'product' ? 'active' : ''} flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-400">
                    <i class="fa-solid fa-boxes-stacked w-5 text-center transition-colors"></i> Stocks
                </a>
                
                <p class="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Finance & People</p>
                
                <a href="/bill" class="sidebar-link ${activePage === 'bill' ? 'active' : ''} flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-400">
                    <i class="fa-solid fa-file-invoice w-5 text-center transition-colors"></i> Create Bill
                </a>
                <a href="/bills" class="sidebar-link ${activePage === 'bills' ? 'active' : ''} flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-400">
                    <i class="fa-solid fa-list w-5 text-center transition-colors"></i> Bills History
                </a>
                <a href="/workers" class="sidebar-link ${activePage === 'workers' ? 'active' : ''} flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-400">
                    <i class="fa-solid fa-user-group w-5 text-center transition-colors"></i> Workers
                </a>
            </nav>

            <!-- Bottom Actions -->
            <div class="p-4 border-t border-white/10">
                <a href="#" class="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-white/5 hover:text-slate-300 rounded-xl font-medium transition duration-200 opacity-50 cursor-not-allowed" title="Coming Soon">
                    <i class="fa-solid fa-gear w-5 text-center"></i> Settings
                </a>
                <a href="#" onclick="logout()" class="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl font-medium transition duration-200">
                    <i class="fa-solid fa-arrow-right-from-bracket w-5 text-center"></i> Log Out
                </a>
            </div>
        </aside>
    `;
    
    return sidebarHTML;
}

// Toggle Sidebar for mobile
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const bottomNav = document.getElementById('bottomNav');
    if (!sidebar || !overlay) return;
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');

    // Hide bottom nav when sidebar is open, show when closed
    if (bottomNav) {
        const sidebarOpen = !sidebar.classList.contains('-translate-x-full');
        bottomNav.style.display = sidebarOpen ? 'none' : 'flex';
    }
}

// Logout function
function logout() {
    forceLogout();
}

// Load header user info from localStorage (runs on every page)
function loadHeaderUser() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;

    const name = (user.user_metadata && user.user_metadata.name) || user.name || user.email || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

    const nameEl = document.getElementById('headerUserName');
    const initialEl = document.getElementById('headerUserInitial');

    if (nameEl) nameEl.textContent = name;
    if (initialEl) initialEl.textContent = initials;

    // Setup profile dropdown
    setupProfileDropdown(name, user.email || '');
}

// Create and attach profile dropdown to the header profile section
function setupProfileDropdown(userName, userEmail) {
    const nameEl = document.getElementById('headerUserName');
    if (!nameEl) return;

    // Find the profile container (the clickable div wrapping name + avatar)
    const profileContainer = nameEl.closest('.flex.items-center.gap-3') || nameEl.parentElement.parentElement;
    if (!profileContainer || profileContainer.dataset.dropdownReady) return;
    profileContainer.dataset.dropdownReady = 'true';

    // Make profile container a positioning context
    profileContainer.style.position = 'relative';

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.id = 'profileDropdown';
    dropdown.className = 'absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 opacity-0 invisible transform scale-95 transition-all duration-150';
    dropdown.innerHTML = `
        <div class="px-4 py-3 border-b border-gray-100">
            <p class="text-sm font-semibold text-gray-800 truncate">${userName}</p>
            <p class="text-xs text-gray-400 truncate">${userEmail}</p>
        </div>
        <a href="#" onclick="logout(); return false;" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors">
            <i class="fa-solid fa-arrow-right-from-bracket w-4 text-center"></i>
            Log Out
        </a>
    `;
    profileContainer.appendChild(dropdown);

    // Toggle dropdown on click
    profileContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = !dropdown.classList.contains('invisible');
        if (isVisible) {
            closeProfileDropdown();
        } else {
            dropdown.classList.remove('invisible', 'opacity-0', 'scale-95');
            dropdown.classList.add('opacity-100', 'scale-100');
        }
    });

    // Close on outside click
    document.addEventListener('click', () => closeProfileDropdown());

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeProfileDropdown();
    });
}

// Close the profile dropdown
function closeProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.add('invisible', 'opacity-0', 'scale-95');
        dropdown.classList.remove('opacity-100', 'scale-100');
    }
}

// Create mobile bottom navigation bar
function createBottomNav(activePage = '') {
    const navItems = [
        { href: '/dashboard', icon: 'fa-house', label: 'Home', page: 'dashboard' },
        { href: '/sale', icon: 'fa-cart-shopping', label: 'Sales', page: 'sale' },
        { href: '/stock', icon: 'fa-boxes-stacked', label: 'Stock', page: 'stock' },
        { href: '/bills', icon: 'fa-file-invoice', label: 'Bills', page: 'bills' }
    ];

    const items = navItems.map(item => {
        const isActive = activePage === item.page || 
            (item.page === 'stock' && activePage === 'product') ||
            (item.page === 'bills' && activePage === 'bill');
        return `
            <a href="${item.href}" class="bottom-nav-item ${isActive ? 'active' : ''} flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors">
                <i class="fa-solid ${item.icon} text-lg"></i>
                <span class="text-[10px] font-medium">${item.label}</span>
            </a>
        `;
    }).join('');

    return `
        <nav id="bottomNav" class="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-center lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
            ${items}
        </nav>
    `;
}

// Initialize sidebar - call this in each page
function initSidebar(activePage) {
    // Check session validity and refresh token (7-day limit)
    checkAndRefreshSession();

    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = createSidebar(activePage);

        // Inject sidebar styles once
        if (!document.getElementById('sidebar-styles')) {
            const style = document.createElement('style');
            style.id = 'sidebar-styles';
            style.textContent = getSidebarStyles();
            document.head.appendChild(style);
        }

        // Fetch tenant name from database
        loadTenantName();

        // Close sidebar when clicking a nav link on mobile
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 1024) {
                    toggleSidebar();
                }
            });
        });
    }

    // Add mobile bottom navigation
    if (!document.getElementById('bottomNav')) {
        document.body.insertAdjacentHTML('beforeend', createBottomNav(activePage));
    }

    // Add bottom padding to scrollable content on mobile so it's not hidden behind bottom nav
    const scrollableContent = document.querySelector('main .flex-1.overflow-y-auto');
    if (scrollableContent) {
        scrollableContent.classList.add('pb-32', 'lg:pb-8');
    }

    // Load header user info on every page
    loadHeaderUser();

    // Register service worker for PWA
    registerServiceWorker();
}

// Register service worker (safe to call multiple times)
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.error('SW registration failed:', err));
    }
}

// Get common styles for sidebar
function getSidebarStyles() {
    return `
        .sidebar-link {
            transition: all 0.2s;
            display: flex;
            align-items: center;
        }
        .sidebar-link:hover {
            background: linear-gradient(90deg, #1e3a5f 0%, #2563eb 100%);
            color: #fff !important;
            box-shadow: 0 4px 6px -1px rgba(30, 58, 95, 0.4);
            transform: translateX(4px);
        }
        .sidebar-link.active {
            background: linear-gradient(90deg, #1e3a5f 0%, #2563eb 100%);
            color: #fff !important;
            box-shadow: 0 4px 6px -1px rgba(30, 58, 95, 0.4);
        }
        .sidebar-link:hover i,
        .sidebar-link.active i {
            color: #fff !important;
        }
        /* Mobile sidebar sizing */
        @media (max-width: 1023px) {
            #sidebar {
                width: 280px;
                max-width: 85vw;
            }
            #sidebar.open {
                transform: translateX(0) !important;
            }
        }

        /* Bottom navigation bar (mobile only) */
        .bottom-nav-item {
            color: #9ca3af;
            text-decoration: none;
            -webkit-tap-highlight-color: transparent;
        }
        .bottom-nav-item.active {
            color: #1e3a5f;
        }
        .bottom-nav-item.active i {
            transform: scale(1.1);
        }
        .bottom-nav-item:not(.active):hover {
            color: #4b5563;
        }
        #bottomNav {
            padding-bottom: env(safe-area-inset-bottom, 0px);
        }
    `;
}