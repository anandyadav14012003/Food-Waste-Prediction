/**
 * AI Recommendations Module - FoodWise AI
 * Handles Supabase authentication, fetching live food records to generate dynamic recommendations, and sidebar interactions.
 */

const SUPABASE_URL = 'https://pjtyoexscnbafcmzatzo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gEEREmvfXn_sCRLqz26z1A_VQpLG6IB';

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

document.addEventListener('DOMContentLoaded', async () => {
    // Sabse pehle Authentication check run karo
    await checkAuthGuard();

    // 1. Load logged-in user name in sidebar
    loadLoggedInUser();

    // 2. Load recommendations from Supabase records
    loadRecommendations();

    // 3. Initialize mobile menu and logout handlers
    initMobileMenuHandlers();
    initLogoutHandler();
});

/**
 * Fetches the currently authenticated user from Supabase and updates the sidebar name element.
 */
async function loadLoggedInUser() {
    if (!supabaseClient) return;

    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) return;

        if (user) {
            const userName = user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Anand Yadav');
            const nameElem = document.getElementById('sidebarAdminName');
            if (nameElem && userName) {
                nameElem.textContent = userName;
            }
        }
    } catch (err) {
        console.error('Failed to fetch user session:', err.message);
    }
}

async function loadRecommendations() {
    const container = document.getElementById('recommendationsContainer');
    if (!container) return;

    let dynamicRecommendations = [];

    if (supabaseClient) {
        try {
            const { data: records, error } = await supabaseClient
                .from('food_records')
                .select('*')
                .order('record_date', { ascending: false })
                .limit(5);

            if (!error && records && records.length > 0) {
                const latest = records[0];
                const wasted = parseFloat(latest.food_wasted) || 0;
                const prepared = parseFloat(latest.food_prepared) || 1;
                const wastePercent = (wasted / prepared) * 100;

                // 1. Waste Percentage Based Recommendation
                if (wastePercent > 15) {
                    dynamicRecommendations.push({
                        title: "High Food Waste Alert",
                        category: "Critical Action",
                        type: "danger",
                        icon: "fa-triangle-exclamation",
                        desc: `Recent wastage is at ${wastePercent.toFixed(1)}%, which exceeds the optimal 10% threshold. Consider reducing batch preparation quantities for tomorrow.`
                    });
                } else {
                    dynamicRecommendations.push({
                        title: "Optimal Preparation Balance",
                        category: "Efficiency",
                        type: "success",
                        icon: "fa-circle-check",
                        desc: `Your recent food wastage is well controlled at ${wastePercent.toFixed(1)}%. Maintain the current demand forecasting ratio.`
                    });
                }

                // 2. Customer Demand Trend Recommendation
                dynamicRecommendations.push({
                    title: "Demand Surge Preparation",
                    category: "Forecasting",
                    type: "warning",
                    icon: "fa-chart-line",
                    desc: `Based on the latest count of ${latest.customers || 0} customers, expect a minor 2% upward trend for tomorrow. Prep accordingly with a 5-8% safety margin.`
                });

                // 3. Leftover Utilization
                dynamicRecommendations.push({
                    title: "Smart Inventory Utilization",
                    category: "Sustainability",
                    type: "success",
                    icon: "fa-seedling",
                    desc: `Ensure raw ingredients remaining from previous shifts are integrated into early morning prep sessions to lower raw procurement costs.`
                });
            }
        } catch (err) {
            console.error('Error fetching data for recommendations:', err);
        }
    }

    // Fallback static recommendations agar data na ho
    if (dynamicRecommendations.length === 0) {
        dynamicRecommendations = [
            {
                title: "Portion Control Strategy",
                category: "General Tip",
                type: "success",
                icon: "fa-utensils",
                desc: "Standardize serving portions across shifts to keep food surplus predictable and easy to manage."
            },
            {
                title: "Peak Hour Analysis",
                category: "Operations",
                type: "warning",
                icon: "fa-clock",
                desc: "Monitor peak dining intervals closely to adjust live cooking batches and avoid excess final-hour waste."
            }
        ];
    }

    // Render cards into container
    container.innerHTML = '';
    dynamicRecommendations.forEach(rec => {
        const cardHTML = `
            <div class="rec-card ${rec.type}">
                <div>
                    <div class="rec-header">
                        <div class="rec-icon"><i class="fa-solid ${rec.icon}"></i></div>
                        <div class="rec-title">
                            <h3>${rec.title}</h3>
                            <span>${rec.category}</span>
                        </div>
                    </div>
                    <div class="rec-body">
                        <p>${rec.desc}</p>
                    </div>
                </div>
                <div class="rec-footer">
                    <button class="btn-action" onclick="alert('Recommendation marked as reviewed!')">Acknowledge</button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}

function initMobileMenuHandlers() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');

    if (!sidebar || !overlay) return;

    toggleBtn?.addEventListener('click', () => {
        sidebar.classList.add('show', 'active');
        overlay.classList.add('show', 'active');
    });

    const closeMenu = () => {
        sidebar.classList.remove('show', 'active');
        overlay.classList.remove('show', 'active');
    };

    closeBtn?.addEventListener('click', closeMenu);
    overlay?.addEventListener('click', closeMenu);
}

function initLogoutHandler() {
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to log out?')) {
                if (supabaseClient) {
                    await supabaseClient.auth.signOut();
                }
                window.location.href = 'login.html';
            }
        });
    }
}