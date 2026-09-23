/**
 * Food Records Display Module - FoodWaste AI Project
 * Fetches and renders all data from Supabase table 'food_records', handles authentication session, and sidebar interactions.
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
            window.location.href = "index.html";
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Sabse pehle Authentication check run karo
    await checkAuthGuard();

    // 1. Fetch logged-in user details dynamically from Supabase Auth
    loadLoggedInUser();

    // 2. Fetch food records from database
    fetchAllRecords();

    // 3. Initialize mobile menu and logout handlers
    initMobileMenuHandlers();
    initLogoutHandler();
});

/**
 * Fetches the currently authenticated user from Supabase and updates the sidebar name element.
 */
async function loadLoggedInUser() {
    if (!supabaseClient) {
        console.warn('Supabase client not initialized for auth.');
        return;
    }

    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error) {
            console.warn('Auth session error or not logged in:', error.message);
            return;
        }

        if (user) {
            // Extract username from user metadata or email prefix
            const userName = user.user_metadata?.full_name || user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Anand Yadav');
            
            // Update sidebar element
            const nameElem = document.getElementById('sidebarAdminName');
            if (nameElem && userName) {
                nameElem.textContent = userName;
            }
        }
    } catch (err) {
        console.error('Failed to fetch user session:', err.message);
    }
}

async function fetchAllRecords() {
    const tbody = document.getElementById('allFoodRecordsBody');
    const countEl = document.getElementById('recordCount');

    if (!tbody || !countEl) return;

    if (!supabaseClient) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red; padding: 20px;">Supabase client failed to initialize.</td></tr>`;
        return;
    }

    try {
        // Fetch all rows from food_records ordered by newest date first
        const { data: records, error } = await supabaseClient
            .from('food_records')
            .select('*')
            .order('record_date', { ascending: false });

        if (error) throw error;

        if (!records || records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #64748b;">No food records found in the database.</td></tr>`;
            countEl.innerText = `Total: 0 records`;
            return;
        }

        countEl.innerText = `Total: ${records.length} records`;
        tbody.innerHTML = '';

        records.forEach(rec => {
            const prepared = parseFloat(rec.food_prepared) || 0;
            const consumed = parseFloat(rec.food_consumed) || 0;
            const wasted = parseFloat(rec.food_wasted) || (prepared - consumed);
            const wastePercent = prepared > 0 ? ((wasted / prepared) * 100).toFixed(1) : (rec.waste_percentage || '0.0');

            let badgeStyle = 'background: #e2e8f0; color: #475569; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;';
            let statusText = rec.status || 'Normal';

            if (parseFloat(wastePercent) > 15 || rec.status === 'High Waste') {
                badgeStyle = 'background: #fee2e2; color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;';
                statusText = 'High Waste';
            } else if (parseFloat(wastePercent) < 8 || rec.status === 'Good' || rec.status === 'Optimal') {
                badgeStyle = 'background: #d1fae5; color: #059669; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;';
                statusText = 'Good';
            }

            const formattedDate = rec.record_date ? new Date(rec.record_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
            const dayName = rec.day_of_week || (rec.record_date ? new Date(rec.record_date).toLocaleDateString('en-US', { weekday: 'long' }) : 'N/A');

            const row = `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px; font-weight: 500; color: #1e293b;">${formattedDate}</td>
                    <td style="padding: 12px; color: #64748b;">${dayName}</td>
                    <td style="padding: 12px; color: #1e293b;">${rec.customers || 0}</td>
                    <td style="padding: 12px; color: #1e293b;">${prepared} Containers</td>
                    <td style="padding: 12px; color: #1e293b;">${consumed} Containers</td>
                    <td style="padding: 12px; color: #1e293b;">${wasted} Containers</td>
                    <td style="padding: 12px; font-weight: 600; color: #1e293b;">${wastePercent}%</td>
                    <td style="padding: 12px;"><span style="${badgeStyle}">${statusText}</span></td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });

    } catch (err) {
        console.error('Error fetching food records:', err.message);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red; padding: 20px;">Error loading data: ${err.message}</td></tr>`;
    }
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
