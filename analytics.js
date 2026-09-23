/**
 * FoodWaste AI - Analytics Dashboard Functionality & Supabase Integration
 * Compatible with Supabase JS v2 and Chart.js
 */

// Supabase Configuration
const SUPABASE_URL = 'https://pjtyoexscnbafcmzatzo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gEEREmvfXn_sCRLqz26z1A_VQpLG6IB';

// Initialize Supabase Client
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ==========================================================================
// AUTHENTICATION GUARD (Check if user is logged in before rendering page)
// ==========================================================================
async function checkAuthGuard() {
    if (!supabaseClient) {
        console.warn("Supabase client not initialized. Skipping guard.");
        return;
    }

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        // Agar session na mile ya error aaye, toh login page par bhej do
        if (error || !session) {
            console.warn("Unauthorized access detected. Redirecting to login...");
            window.location.href = "login.html";
        } else {
            console.log("User authenticated:", session.user.email);
        }
    } catch (err) {
        console.error("Auth check failed:", err);
        window.location.href = "login.html";
    }
}

// Listen for auth state changes (e.g., session expiration or logout from another tab)
if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            window.location.href = "login.html";
        }
    });
}

// Chart instances storage
let analyticsTrendChartInstance = null;
let analyticsComparisonChartInstance = null;
let analyticsDistributionChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Sabse pehle Authentication check run karo
    await checkAuthGuard();

    // Initialize Navigation & Common UI
    initSidebarNavigation();
    initMobileMenu();
    initNotifications();
    loadLoggedInUserProfile();

    // Fetch live analytics data from Supabase with fallbacks
    fetchAnalyticsDataFromSupabase();
});

/* ==========================================================================
   Supabase Data Fetching for Analytics
   ========================================================================== */
async function fetchAnalyticsDataFromSupabase() {
    let recordsToUse = [];

    if (supabaseClient) {
        try {
            const { data: records, error } = await supabaseClient
                .from('food_records')
                .select('*')
                .order('record_date', { ascending: false })
                .limit(30); // Last 30 records for deep analytics

            if (!error && records && records.length > 0) {
                recordsToUse = records;
            }
        } catch (err) {
            console.warn('Supabase analytics fetch error:', err.message);
        }
    }

    // Update Metric Cards & Render Charts with Live/Fallback Data
    updateAnalyticsMetrics(recordsToUse);
    initAnalyticsCharts(recordsToUse);
}

/* ==========================================================================
   Advanced Metric Cards Update (Units updated to Containers)
   ========================================================================== */
function updateAnalyticsMetrics(records) {
    if (!records || records.length === 0) return;

    let totalWaste = 0;
    let totalPrepared = 0;
    let totalCustomers = 0;

    records.forEach(r => {
        // Supporting both column name conventions (food_wasted or wasted, food_prepared or prepared)
        totalWaste += parseFloat(r.food_wasted || r.wasted || (r.food_prepared ? r.food_prepared * 0.15 : 0)) || 0;
        totalPrepared += parseFloat(r.food_prepared || r.prepared || 0);
        totalCustomers += parseInt(r.customers || 0);
    });

    const avgWastePercentage = totalPrepared > 0 ? ((totalWaste / totalPrepared) * 100).toFixed(1) : '0.0';
    const avgCustomers = Math.round(totalCustomers / records.length);

    // DOM Elements update
    const elTotalWaste = document.getElementById('analyticsTotalWaste');
    const elAvgWastePercent = document.getElementById('analyticsAvgWastePercent');
    const elTotalPrepared = document.getElementById('analyticsTotalPrepared');
    const elAvgCustomers = document.getElementById('analyticsAvgCustomers');

    if (elTotalWaste) elTotalWaste.innerText = `${totalWaste.toFixed(1)} Containers`;
    if (elAvgWastePercent) elAvgWastePercent.innerText = `${avgWastePercentage}%`;
    if (elTotalPrepared) elTotalPrepared.innerText = `${totalPrepared.toFixed(1)} Containers`;
    if (elAvgCustomers) elAvgCustomers.innerText = avgCustomers;
}

/* ==========================================================================
   Chart.js Advanced Analytics Render Functions (Units updated to Containers)
   ========================================================================== */
function initAnalyticsCharts(records = []) {
    // Fallback data agar records kam ho ya na ho
    const fallbackLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const fallbackWaste = [19, 13, 25, 12, 18, 15, 15];
    const fallbackPrepared = [115, 125, 140, 120, 110, 155, 150];
    const fallbackConsumed = [96, 112, 115, 104, 98, 138, 140];

    const labels = records.length ? records.map(r => r.day_of_week || r.record_date).reverse() : fallbackLabels;
    const wasteData = records.length ? records.map(r => parseFloat(r.food_wasted || r.wasted || (r.food_prepared ? r.food_prepared * 0.15 : 0))).reverse() : fallbackWaste;
    const preparedData = records.length ? records.map(r => parseFloat(r.food_prepared || r.prepared || 0)).reverse() : fallbackPrepared;
    const consumedData = records.length ? records.map(r => parseFloat(r.food_consumed || (r.customers ? r.customers * 1.2 : 0))).reverse() : fallbackConsumed;

    // 1. Waste Trend Line Chart
    const trendCanvas = document.getElementById('analyticsTrendChart');
    if (trendCanvas) {
        if (analyticsTrendChartInstance) analyticsTrendChartInstance.destroy();
        analyticsTrendChartInstance = new Chart(trendCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Waste Volume (Containers)',
                    data: wasteData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#f1f5f9' },
                        title: { display: true, text: 'Containers' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 2. Prepared vs Consumed Bar Chart
    const compCanvas = document.getElementById('analyticsComparisonChart');
    if (compCanvas) {
        if (analyticsComparisonChartInstance) analyticsComparisonChartInstance.destroy();
        analyticsComparisonChartInstance = new Chart(compCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Prepared (Containers)', data: preparedData, backgroundColor: '#3b82f6', borderRadius: 4 },
                    { label: 'Consumed (Containers)', data: consumedData, backgroundColor: '#10b981', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#f1f5f9' },
                        title: { display: true, text: 'Containers' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 3. Waste Distribution / Category Breakdown Chart (Doughnut)
    const distCanvas = document.getElementById('analyticsDistributionChart');
    if (distCanvas) {
        if (analyticsDistributionChartInstance) analyticsDistributionChartInstance.destroy();
        analyticsDistributionChartInstance = new Chart(distCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Grains & Rice', 'Vegetables', 'Dairy', 'Prepared Dishes'],
                datasets: [{
                    data: [40, 25, 20, 15],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

/* ==========================================================================
   Sidebar & Navigation Interactions
   ========================================================================== */
function initSidebarNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const pageName = item.getAttribute('data-page');
            
            const href = item.getAttribute('href');
            if (href && href !== '#') {
                return;
            }

            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const sidebar = document.getElementById('sidebar');
            const sidebarOverlay = document.getElementById('sidebarOverlay');
            if (sidebar) sidebar.classList.remove('active', 'show');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active', 'show');

            if (pageName === 'dashboard') {
                window.location.href = 'Dashboard.html';
            } else if (pageName === 'food-records') {
                window.location.href = 'Food_records.html';
            } else if (pageName === 'add-daily-data') {
                window.location.href = 'Daily_data.html';
            } else if (pageName === 'predictions') {
                window.location.href = 'Prediction.html';
            } else if (pageName === 'recommendations') {
                window.location.href = 'Recommendations.html';
            } else if (pageName === 'analytics') {
                window.location.href = 'Analytics.html';
            }
        });
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to log out?")) {
                if (supabaseClient) {
                    await supabaseClient.auth.signOut();
                }
                window.location.href = 'index.html';
            }
        });
    }
}

function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggleBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebarClose = document.getElementById('sidebarClose');

    if (!sidebar || !overlay) return;

    menuToggle?.addEventListener('click', () => {
        sidebar.classList.add('active', 'show');
        overlay.classList.add('active', 'show');
    });

    const closeSidebar = () => {
        sidebar.classList.remove('active', 'show');
        overlay.classList.remove('active', 'show');
    };

    overlay.addEventListener('click', closeSidebar);
    sidebarClose?.addEventListener('click5', closeSidebar); // safe optional chaining fallback
}

function initNotifications() {
    const notificationBtn = document.getElementById('notificationBtn');
    const dropdown = document.getElementById('notificationDropdown');
    if (!notificationBtn || !dropdown) return;

    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        dropdown.classList.remove('active');
    });
}

async function loadLoggedInUserProfile() {
    const sidebarNameEl = document.getElementById('sidebarAdminName');
    let displayName = "Anand Yadav";

    if (supabaseClient) {
        try {
            const { data: { user }, error } = await supabaseClient.auth.getUser();
            if (!error && user) {
                displayName = user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Anand Yadav');
            }
        } catch (e) {
            console.warn('Could not load user profile session:', e.message);
        }
    }
    if (sidebarNameEl) sidebarNameEl.innerText = displayName;
}
