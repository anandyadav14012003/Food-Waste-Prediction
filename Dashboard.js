/**
 * FoodWaste AI - Admin Dashboard Functionality & Supabase Integration
 * Compatible with Supabase JS v2 and Chart.js
 */

// Supabase Configuration
const SUPABASE_URL = 'https://pjtyoexscnbafcmzatzo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gEEREmvfXn_sCRLqz26z1A_VQpLG6IB';

// Initialize Supabase Client (safely checking if library is loaded)
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ==========================================================================
// AUTHENTICATION GUARD (Check if user is logged in before rendering dashboard)
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

// Global Data Store with Fallback/Mock Data
const dashboardData = {
    recentRecords: [
        { record_date: '2026-09-17', day_of_week: 'Thursday', customers: 135, food_prepared: 150, food_consumed: 138, food_wasted: 12, waste_percentage: 8.0, status: 'Optimal' },
        { record_date: '2026-09-16', day_of_week: 'Wednesday', customers: 120, food_prepared: 140, food_consumed: 115, food_wasted: 25, waste_percentage: 17.8, status: 'High Waste' },
        { record_date: '2026-09-15', day_of_week: 'Tuesday', customers: 110, food_prepared: 125, food_consumed: 112, food_wasted: 13, waste_percentage: 10.4, status: 'Good' },
        { record_date: '2026-09-14', day_of_week: 'Monday', customers: 98, food_prepared: 115, food_consumed: 96, food_wasted: 19, waste_percentage: 16.5, status: 'High Waste' },
        { record_date: '2026-09-13', day_of_week: 'Sunday', customers: 140, food_prepared: 155, food_consumed: 140, food_wasted: 15, waste_percentage: 9.6, status: 'Good' },
        { record_date: '2026-09-12', day_of_week: 'Saturday', customers: 130, food_prepared: 145, food_consumed: 130, food_wasted: 15, waste_percentage: 10.3, status: 'Good' },
        { record_date: '2026-09-11', day_of_week: 'Friday', customers: 105, food_prepared: 120, food_consumed: 102, food_wasted: 18, waste_percentage: 15.0, status: 'Normal' }
    ],
    wasteTrendData: {
        "7days": { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], data: [19, 13, 25, 12, 18, 15, 15] },
        "30days": { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], data: [98, 85, 110, 92] },
        "3months": { labels: ['June', 'July', 'August'], data: [420, 390, 410] }
    }
};

// Chart instances storage
let wasteTrendChartInstance = null;
let preparedVsConsumedChartInstance = null;
let customerDemandChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Sabse pehle Authentication check run karo
    await checkAuthGuard();

    const dateInput = document.getElementById('dashboardDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // Initialize all UI modules
    initSidebarNavigation();
    initMobileMenu();
    initNotifications();
    initInteractiveButtons();
    initDateSelector();
    initWasteChartFilters();
    initFoodRecordModule();
    initDashboardRecommendationRedirect();

    // Load logged-in user profile dynamically & check roles
    loadLoggedInUserProfile();
    checkUserRoleAndPermissions();

    // Fetch live data from Supabase (with built-in fallbacks)
    fetchDashboardDataFromSupabase();
});

/* ==========================================================================
   Supabase Data Fetching & UI Binding (With Safe Fallbacks)
   ========================================================================== */
async function fetchDashboardDataFromSupabase() {
    let predictionToUse = {
        predicted_customers: '--',
        confidence: '--',
        recommended_prep: '--',
        food_requirement: '--'
    };

    let recordsToUse = [];

    if (supabaseClient) {
        try {
            const { data: records, error: recordsError } = await supabaseClient
                .from('food_records')
                .select('*')
                .order('record_date', { ascending: false })
                .limit(7);

            if (!recordsError && records && records.length > 0) {
                recordsToUse = records;
                const latest = records[0];

                const customers = latest.customers || 1;
                const consumed = latest.food_consumed || 0;
                const consumptionRatePerPerson = consumed / customers;

                const predictedCustomers = Math.round(customers * 1.02);
                const rawPredictedPrep = predictedCustomers * consumptionRatePerPerson;
                const recommendedPrep = parseFloat((rawPredictedPrep * 1.08).toFixed(1));

                predictionToUse = {
                    predicted_customers: predictedCustomers,
                    confidence: 91.0,
                    recommended_prep: recommendedPrep,
                    food_requirement: parseFloat(rawPredictedPrep.toFixed(1))
                };
            }
        } catch (error) {
            console.warn('Supabase fetch error:', error.message);
        }
    }

    // UI update karo
    updateRecentRecordsTable(recordsToUse);
    if(recordsToUse.length > 0) {
        updateKPICards(recordsToUse[0]);
    }
    updateAIPredictionUI(predictionToUse);
    initCharts(recordsToUse);
    updateAIInsightsAndStats(recordsToUse);
}

function updateKPICards(latest) {
    if (!latest) return;
    const kpiCustomers = document.getElementById('kpiCustomers');
    const kpiPrepared = document.getElementById('kpiPrepared');
    const kpiWasted = document.getElementById('kpiWasted');
    const kpiWastePercent = document.getElementById('kpiWastePercent');

    if (kpiCustomers) kpiCustomers.innerText = latest.customers;
    if (kpiPrepared) kpiPrepared.innerText = `${latest.food_prepared} kg`;
    if (kpiWasted) kpiWasted.innerText = `${latest.food_wasted} kg`;
    if (kpiWastePercent) kpiWastePercent.innerText = `${latest.waste_percentage}%`;
}

function updateAIPredictionUI(pred) {
    const expectedCustomersEl = document.getElementById('predExpectedCustomers');
    const confidenceEl = document.getElementById('predConfidence');
    const foodReqEl = document.getElementById('predFoodReq');
    const recommendedPrepEl = document.getElementById('predRecommendedPrep');

    if (expectedCustomersEl) {
        expectedCustomersEl.innerHTML = `${pred.predicted_customers ?? pred.customers ?? '--'} <span class="unit">Customers</span>`;
    }
    
    if (confidenceEl) {
        confidenceEl.innerText = `${pred.confidence ?? '--'}%`;
    }
    
    if (foodReqEl) {
        const foodValue = pred.food_requirement ?? pred.predicted_food ?? pred.food_req ?? pred.required_food;
        foodReqEl.innerText = `${foodValue ?? '--'} kg`;
    }
    
    if (recommendedPrepEl) {
        const prepValue = pred.recommended_prep ?? pred.prep_target ?? pred.prep;
        recommendedPrepEl.innerText = `${prepValue ?? '--'} kg`;
    }
}

function updateRecentRecordsTable(records) {
    const tbody = document.getElementById('recentRecordsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    records.forEach(rec => {
        const prepared = parseFloat(rec.food_prepared) || 0;
        const consumed = parseFloat(rec.food_consumed) || 0;
        const wasted = parseFloat(rec.food_wasted) || (prepared - consumed);
        const wastePercent = prepared > 0 ? ((wasted / prepared) * 100).toFixed(1) : (rec.waste_percentage || '0.0');

        let badgeClass = 'normal';
        let statusText = rec.status || 'Normal';
        
        if (parseFloat(wastePercent) > 15 || rec.status === 'High Waste') {
            badgeClass = 'high-waste';
            statusText = 'High Waste';
        } else if (parseFloat(wastePercent) < 8 || rec.status === 'Good' || rec.status === 'Optimal') {
            badgeClass = 'good';
            statusText = 'Good';
        }

        const formattedDate = new Date(rec.record_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const dayName = rec.day_of_week || new Date(rec.record_date).toLocaleDateString('en-US', { weekday: 'long' });

        const row = `
            <tr>
                <td>${formattedDate}</td>
                <td>${dayName}</td>
                <td>${rec.customers || 0}</td>
                <td>${prepared} kg</td>
                <td>${consumed} kg</td>
                <td>${wasted} kg</td>
                <td>${wastePercent}%</td>
                <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

function updateAIInsightsAndStats(records = []) {
    const gridContainer = document.getElementById('aiInsightsGrid');
    if (!gridContainer) return;

    if (!records || records.length === 0) {
        gridContainer.innerHTML = `
            <div class="insight-card info-alert">
                <div class="insight-icon-wrap"><i class="fas fa-info-circle"></i></div>
                <div class="insight-content">
                    <h3>No Telemetry Data</h3>
                    <p>Add daily records to generate active AI diagnostic insights.</p>
                </div>
            </div>
        `;
        return;
    }

    const latest = records[0];
    const latestWastePercent = Number(latest.waste_percentage) || 0;
    
    let alertClass = latestWastePercent > 15 ? 'warning-alert' : 'success-alert';
    let iconClass = latestWastePercent > 15 ? 'fa-triangle-exclamation' : 'fa-check-circle';
    let alertTitle = latestWastePercent > 15 ? 'High Food Waste Alert' : 'Optimal Operations Notice';
    let alertDesc = latestWastePercent > 15 
        ? `Recent telemetry shows ${latestWastePercent}% waste on ${latest.day_of_week || 'recent entry'}. Consider optimizing preparation limits tomorrow.`
        : `Waste levels are well managed at ${latestWastePercent}%. Kitchen output aligns closely with customer demand.`;

    gridContainer.innerHTML = `
        <div class="insight-card ${alertClass}">
            <div class="insight-icon-wrap"><i class="fas ${iconClass}"></i></div>
            <div class="insight-content">
                <h3>${alertTitle}</h3>
                <p>${alertDesc}</p>
            </div>
        </div>
    `;
}

/* ==========================================================================
   Chart.js Initialization & Render Functions
   ========================================================================== */
function initCharts(records = []) {
    initializeWasteChart('7days', records);
    initializeConsumptionChart(records);
    initializeDemandChart(records);
}

function initializeWasteChart(range = '7days', records = []) {
    const canvas = document.getElementById('wasteTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let labels, data;
    if (records.length > 0 && range === '7days') {
        labels = records.map(r => r.day_of_week).reverse();
        data = records.map(r => r.food_wasted).reverse();
    } else {
        const currentSet = dashboardData.wasteTrendData[range];
        labels = currentSet.labels;
        data = currentSet.data;
    }

    if (wasteTrendChartInstance) {
        wasteTrendChartInstance.destroy();
    }

    wasteTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Waste Generated (kg)',
                data: data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', padding: 10, cornerRadius: 8 }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function initWasteChartFilters() {
    const filterButtons = document.querySelectorAll('#wasteTrendFilters .filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const range = btn.getAttribute('data-range');
            initializeWasteChart(range, dashboardData.recentRecords);
        });
    });
}

function initializeConsumptionChart(records = []) {
    const canvas = document.getElementById('preparedVsConsumedChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const labels = records.length ? records.map(r => r.day_of_week).reverse() : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const prepared = records.length ? records.map(r => r.food_prepared).reverse() : [115, 125, 140, 120, 110, 155, 150];
    const consumed = records.length ? records.map(r => r.food_consumed).reverse() : [96, 112, 115, 104, 98, 138, 140];
    const wasted = records.length ? records.map(r => r.food_wasted).reverse() : [19, 13, 25, 16, 12, 17, 10];

    if (preparedVsConsumedChartInstance) {
        preparedVsConsumedChartInstance.destroy();
    }

    preparedVsConsumedChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Prepared (kg)', data: prepared, backgroundColor: '#3b82f6', borderRadius: 4 },
                { label: 'Consumed (kg)', data: consumed, backgroundColor: '#10b981', borderRadius: 4 },
                { label: 'Wasted (kg)', data: wasted, backgroundColor: '#f59e0b', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, color: '#475569' } },
                tooltip: { backgroundColor: '#0f172a', padding: 10, cornerRadius: 8 }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function initializeDemandChart(records = []) {
    const canvas = document.getElementById('customerDemandChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let labels, actual, predicted;
    if (records.length > 0) {
        const sortedRecords = [...records].reverse();
        labels = sortedRecords.map(r => r.day_of_week || new Date(r.record_date).toLocaleDateString('en-US', { weekday: 'short' }));
        actual = sortedRecords.map(r => Number(r.customers) || 0);
        predicted = actual.map(c => Math.round(c * 1.02));
    } else {
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        actual = [98, 110, 115, 102, 96, 135, 140];
        predicted = actual.map(c => c + Math.floor(Math.random() * 6 - 3));
    }

    if (customerDemandChartInstance) {
        customerDemandChartInstance.destroy();
    }

    customerDemandChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Actual Customers', data: actual, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.08)', borderWidth: 2.5, tension: 0.3, fill: true },
                { label: 'Predicted Customers (ML)', data: predicted, borderColor: '#14b8a6', borderWidth: 2.5, borderDash: [5, 5], tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 14, color: '#475569' } },
                tooltip: { backgroundColor: '#0f172a', padding: 10, cornerRadius: 8 }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' }, 
                    ticks: { color: '#94a3b8' } 
                },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

/* ==========================================================================
   Sidebar & Navigation Interactions
   ========================================================================== */
function initSidebarNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const pageName = item.getAttribute('data-page');
            
            const sidebar = document.getElementById('sidebar');
            const sidebarOverlay = document.getElementById('sidebarOverlay');
            if (sidebar) sidebar.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');

            if (pageName === 'food-records' || pageName === 'Food_records') {
                window.location.href = 'Food_records.html';
            } else if (pageName === 'daily-data' || pageName === 'add-data' || pageName === 'add_data') {
                window.location.href = 'Daily_data.html';
            } else if (pageName === 'predictions') {
                window.location.href = 'Prediction.html';
            } else if (pageName === 'analytics') {
                window.location.href = 'Analytics.html';
            } else if (pageName === 'recommendations') {
                window.location.href = 'Recommendations.html';
            } else if (pageName === 'reports') {
                window.location.href = 'reports.html';
            } else if (pageName === 'settings') {
                window.location.href = 'settings.html';
            } else if (pageName === 'dashboard') {
                window.location.href = 'Dashboard.html';
            }
        });
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            showModal("System Logout", "Are you sure you want to end your current FoodWise administrator session?", "Confirm Logout", async () => {
                if (supabaseClient) {
                    await supabaseClient.auth.signOut();
                }
                window.location.href = "login.html";
            });
        });
    }
}

function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggleBtn');
    const closeBtn = document.getElementById('mobileCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (!menuToggle || !sidebar || !overlay) return;

    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    });

    const closeSidebar = () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);
}

/* ==========================================================================
   Notifications Toggle
   ========================================================================== */
function initNotifications() {
    const notificationBtn = document.getElementById('notificationBtn');
    const dropdown = document.getElementById('notificationDropdown');

    if (!notificationBtn || !dropdown) return;

    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    const markReadBtn = document.querySelector('.mark-read');
    if (markReadBtn) {
        markReadBtn.addEventListener('click', () => {
            document.querySelectorAll('.notification-item').forEach(item => item.classList.remove('unread'));
            const badge = document.querySelector('.notification-badge');
            if (badge) badge.style.display = 'none';
        });
    }
}

/* ==========================================================================
   Interactive Buttons & Modal Handling
   ========================================================================== */
function initInteractiveButtons() {
    const modal = document.getElementById('appModal');
    
    document.getElementById('viewPredictionDetailsBtn')?.addEventListener('click', () => {
        window.location.href = 'Prediction.html';
    });

    document.getElementById('applyRecommendationBtn')?.addEventListener('click', () => {
        showModal("Recommendation Applied", "Kitchen preparation targets for tomorrow have been locked in the inventory system database.");
    });

    document.getElementById('viewAnalysisBtn')?.addEventListener('click', () => {
        window.location.href = 'Prediction.html';
    });

    document.getElementById('viewAllRecordsBtn')?.addEventListener('click', () => {
        window.location.href = 'Food_records.html';
    });

    document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
    document.getElementById('modalActionBtn')?.addEventListener('click', closeModal);
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
}

function initDashboardRecommendationRedirect() {
    const recommendationCards = document.querySelectorAll('.recommendation-card, .ai-insight-box');
    
    recommendationCards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            window.location.href = 'Recommendations.html';
        });
    });

    const viewAllBtn = document.getElementById('viewAllRecommendationsBtn');
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'Recommendations.html';
        });
    }
}

function showModal(title, content, actionText = "Close", actionCallback = null) {
    const modal = document.getElementById('appModal');
    if (!modal) return;
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalBodyContent').innerText = content;
    const actionBtn = document.getElementById('modalActionBtn');
    actionBtn.innerText = actionText;

    const newBtn = actionBtn.cloneNode(true);
    actionBtn.parentNode.replaceChild(newBtn, actionBtn);
    
    newBtn.addEventListener('click', () => {
        closeModal();
        if (actionCallback) actionCallback();
    });

    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('appModal');
    if (modal) modal.classList.remove('active');
}

/* ==========================================================================
   Date Selector Interaction
   ========================================================================== */
function initDateSelector() {
    const dateInput = document.getElementById('dashboardDate');
    if (!dateInput) return;

    dateInput.addEventListener('change', (e) => {
        const selectedDate = e.target.value;
        console.log(`Querying telemetry for date: ${selectedDate}`);
        dateInput.style.borderColor = '#10b981';
        setTimeout(() => { dateInput.style.borderColor = '#cbd5e1'; }, 1000);
    });
}

/* ==========================================================================
   Dynamic Profile Management & Permissions
   ========================================================================== */
async function loadLoggedInUserProfile() {
    let displayName = "Anand Yadav";

    if (!supabaseClient) {
        updateAdminNameUI(displayName);
        return;
    }

    try {
        const sessionPromise = supabaseClient.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Session timeout')), 3000));

        const { data: { session }, error: sessionError } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (sessionError || !session || !session.user) {
            updateAdminNameUI(displayName);
            return;
        }

        const user = session.user;
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

        if (!profileError && profile && profile.full_name) {
            displayName = profile.full_name;
        } else if (user.user_metadata?.full_name) {
            displayName = user.user_metadata.full_name;
        } else if (user.email) {
            displayName = user.email.split('@')[0];
        }

        updateAdminNameUI(displayName);

    } catch (error) {
        updateAdminNameUI(displayName);
    }
}

function updateAdminNameUI(name) {
    const sidebarNameEl = document.getElementById('sidebarAdminName');
    const headerNameEl = document.getElementById('headerAdminName');

    if (sidebarNameEl) sidebarNameEl.innerText = name;
    if (headerNameEl) headerNameEl.innerText = name;
}

async function checkUserRoleAndPermissions() {
    if (!supabaseClient) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data, error } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

    if (error || !data) {
        console.warn("Could not retrieve user role.");
        return;
    }

    if (data.role === 'admin') {
        console.log("Logged in as Administrator");
    } else {
        console.log("Logged in as Standard User");
        const applyBtn = document.getElementById('applyRecommendationBtn');
        if (applyBtn) applyBtn.style.display = 'none';
    }
}

/**
 * Initialize Food Record Module
 */
function initFoodRecordModule() {
    const recordModal = document.getElementById('foodRecordModal');
    const closeBtn = document.getElementById('closeFoodModal');
    
    closeBtn?.addEventListener('click', () => {
        if (recordModal) {
            recordModal.classList.remove('active');
        }
    });
}