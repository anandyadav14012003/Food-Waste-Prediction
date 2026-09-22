/**
 * Daily Data Entry Module - FoodWaste AI Project
 * Handles form submission, sidebar interactivity, dynamic user loading, and saving records to Supabase table 'food_records'
 */

// Supabase Configuration
const SUPABASE_URL = 'https://pjtyoexscnbafcmzatzo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gEEREmvfXn_sCRLqz26z1A_VQpLG6IB';

// Initialize Supabase Client safely
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

    // 1. Fetch and display logged-in user dynamically from Supabase Auth
    loadLoggedInUser();

    // 2. Set default date input to today's date & update Header Date Display
    const dateInput = document.getElementById('recDate');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Header Date Display update (Fixes "Loading Date..." issue)
    const dateDisplay = document.getElementById('currentDateDisplay');
    if (dateDisplay) {
        const today = new Date();
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        const formattedDate = today.toLocaleDateString('en-US', options);
        dateDisplay.innerHTML = `<i class="fa-regular fa-calendar" style="margin-right: 6px; color: #10b981;"></i>${formattedDate}`;
    }

    // 3. Load dishes into the dropdown from Supabase table 'dishes'
    loadDishesDropdown();

    // 4. Bind form submission listener
    const form = document.getElementById('foodRecordForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // 5. Sidebar Mobile Toggle & Close Controls
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (sidebarToggle && sidebar && sidebarOverlay) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.add('show');
            sidebarOverlay.classList.add('show');
        });
    }

    const closeSidebarMenu = () => {
        if (sidebar) sidebar.classList.remove('show');
        if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    };

    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebarMenu);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebarMenu);

    // 6. Logout button functionality handler
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
});

// Function to fetch and display the logged-in user's details from Supabase Auth
async function loadLoggedInUser() {
    if (!supabaseClient) return;

    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error) {
            console.warn('Auth session error or not logged in:', error.message);
            return;
        }

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

// Function to fetch dishes from Supabase and populate the dropdown
async function loadDishesDropdown() {
    const select = document.getElementById('dishSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Loading dishes...</option>';

    if (!supabaseClient) {
        select.innerHTML = '<option value="">Supabase not connected</option>';
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('dishes')
            .select('id, dish_name, category')
            .order('dish_name', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            select.innerHTML = '<option value="">No dishes found. Add dishes in Settings first!</option>';
            return;
        }

        select.innerHTML = '<option value="">-- Select a Dish --</option>';
        data.forEach(dish => {
            const opt = document.createElement('option');
            opt.value = dish.id;
            opt.textContent = `${dish.dish_name} (${dish.category || 'General'})`;
            select.appendChild(opt);
        });

    } catch (err) {
        console.error('Error loading dishes for dropdown:', err);
        select.innerHTML = '<option value="">Error loading dishes</option>';
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!supabaseClient) {
        alert('Supabase client is not initialized. Please check your CDN script.');
        return;
    }

    // 1. Gather form inputs
    const dishId = document.getElementById('dishSelect').value;
    const recordDate = document.getElementById('recDate').value;
    const customers = parseInt(document.getElementById('recCustomers').value, 10);
    const foodPrepared = parseFloat(document.getElementById('recPrepared').value);
    const foodConsumed = parseFloat(document.getElementById('recConsumed').value);

    // Validation checks
    if (!dishId) {
        alert('Please select a dish from the dropdown.');
        return;
    }

    if (foodConsumed > foodPrepared) {
        alert('Warning: Food consumed cannot be greater than food prepared!');
        return;
    }

    // 2. Automatically compute derived fields based on schema columns
    const foodWasted = parseFloat((foodPrepared - foodConsumed).toFixed(2));
    const wastePercentage = parseFloat(((foodWasted / foodPrepared) * 100).toFixed(1));
    
    // Determine Day of Week (e.g., "Tuesday")
    const dateObj = new Date(recordDate);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    // Determine status badge category
    let status = 'Normal';
    if (wastePercentage > 15) {
        status = 'High Waste';
    } else if (wastePercentage < 8) {
        status = 'Good';
    }

    // 3. Prepare payload matching exact Supabase column names (including dish_id)
    const payload = {
        dish_id: dishId,
        record_date: recordDate,
        day_of_week: dayOfWeek,
        customers: customers,
        food_prepared: foodPrepared,
        food_consumed: foodConsumed,
        food_wasted: foodWasted,
        waste_percentage: wastePercentage,
        status: status
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerText : 'Save Record';

    try {
        // Show loading state
        if (submitBtn) {
            submitBtn.innerText = 'Saving to Supabase...';
            submitBtn.disabled = true;
        }

        // Insert into Supabase table 'food_records'
        const { data, error } = await supabaseClient
            .from('food_records')
            .insert([payload]);

        if (error) {
            throw error;
        }

        alert('Success! Daily record has been added to Supabase.');
        e.target.reset();
        
        // Reset date back to today after clearing & reload dishes
        document.getElementById('recDate').value = new Date().toISOString().split('T')[0];
        loadDishesDropdown();

    } catch (err) {
        console.error('Supabase Insert Error:', err.message);
        alert('Failed to save record: ' + err.message);
    } finally {
        // Restore button state properly
        if (submitBtn) {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    }
}