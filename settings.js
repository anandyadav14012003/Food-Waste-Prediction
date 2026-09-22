/* ==========================================================================
   FoodWaste AI - Settings Page JavaScript (Single User & Kitchen Config)
   ========================================================================== */

// Supabase Credentials
const SUPABASE_URL = 'https://pjtyoexscnbafcmzatzo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gEEREmvfXn_sCRLqz26z1A_VQpLG6IB';

// Safe initialization
let supabaseClient = null;
try {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (err) {
    console.error("Supabase init error:", err);
}

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

    initMobileMenu();
    
    // Load logged-in user profile, saved settings, and dishes table
    await loadUserProfile();
    loadSavedPreferences();
    await loadDishes();
    
    // Logout button handler
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (supabaseClient) {
                await supabaseClient.auth.signOut();
            }
            localStorage.removeItem('foodwaste_user_name');
            window.location.href = "index.html";
        });
    }

    // Profile Settings Form Save Handler
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', () => {
            const adminNameInput = document.getElementById('adminName');
            const branchLocationInput = document.getElementById('branchLocation');
            
            if (adminNameInput) {
                const newName = adminNameInput.value.trim() || "Kitchen User";
                localStorage.setItem('foodwaste_user_name', newName);
                
                // Update UI elements instantly across sidebar and header
                const nameElements = document.querySelectorAll('.admin-info h4, .header-admin-name');
                nameElements.forEach(elem => {
                    elem.textContent = newName;
                });
            }

            if (branchLocationInput) {
                localStorage.setItem('foodwaste_branch', branchLocationInput.value.trim());
            }
            
            alert('Kitchen profile updated successfully!');
        });
    }

    // System Preferences Save Handler
    const savePreferencesBtn = document.getElementById('savePreferencesBtn');
    if (savePreferencesBtn) {
        savePreferencesBtn.addEventListener('click', () => {
            const weightUnit = document.getElementById('weightUnit')?.value;
            const wasteThreshold = document.getElementById('wasteThreshold')?.value;
            const reportFrequency = document.getElementById('reportFrequency')?.value;

            localStorage.setItem('foodwaste_weight_unit', weightUnit);
            localStorage.setItem('foodwaste_threshold', wasteThreshold);
            localStorage.setItem('foodwaste_frequency', reportFrequency);

            alert('Measurement & AI preferences saved successfully!');
        });
    }

    // Add New Dish Form Submit Handler (NEW)
    const addDishForm = document.getElementById('addDishForm');
    if (addDishForm) {
        addDishForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dishName = document.getElementById('newDishName').value.trim();
            const category = document.getElementById('newDishCategory').value;

            if (!dishName) {
                alert('Please enter a valid dish name.');
                return;
            }

            if (!supabaseClient) {
                alert('Supabase client not initialized.');
                return;
            }

            try {
                const { error } = await supabaseClient
                    .from('dishes')
                    .insert([{ dish_name: dishName, category: category }]);

                if (error) {
                    throw error;
                }

                alert('Dish added successfully!');
                addDishForm.reset();
                await loadDishes(); // Refresh table list
            } catch (err) {
                console.error('Error adding dish:', err);
                alert('Failed to add dish: ' + (err.message || 'Duplicate or connection error'));
            }
        });
    }

    // Export Settings JSON
    const exportConfigBtn = document.getElementById('exportConfigBtn');
    if (exportConfigBtn) {
        exportConfigBtn.addEventListener('click', () => {
            const configData = {
                userName: localStorage.getItem('foodwaste_user_name') || 'Kitchen User',
                branch: localStorage.getItem('foodwaste_branch') || 'Main Mess & Canteen',
                weightUnit: localStorage.getItem('foodwaste_weight_unit') || 'kg',
                wasteThreshold: localStorage.getItem('foodwaste_threshold') || '50',
                reportFrequency: localStorage.getItem('foodwaste_frequency') || 'weekly',
                exportDate: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'foodwaste_settings_backup.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Reset Local Settings
    const resetCacheBtn = document.getElementById('resetCacheBtn');
    if (resetCacheBtn) {
        resetCacheBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all local preferences to default?')) {
                localStorage.removeItem('foodwaste_user_name');
                localStorage.removeItem('foodwaste_branch');
                localStorage.removeItem('foodwaste_weight_unit');
                localStorage.removeItem('foodwaste_threshold');
                localStorage.removeItem('foodwaste_frequency');
                alert('Preferences reset successfully. Reloading page...');
                location.reload();
            }
        });
    }
});

/* ==========================================================================
   Fetch User Profile and Update UI (Sidebar, Header, Footer)
   ========================================================================== */
async function loadUserProfile() {
    let userName = "Kitchen User";
    let branchName = "Main Mess & Canteen";

    try {
        if (supabaseClient) {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && session.user) {
                userName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
            }
        }
    } catch (err) {
        console.error('Supabase session read error:', err);
    }

    const savedName = localStorage.getItem('foodwaste_user_name');
    if (savedName) userName = savedName;

    const savedBranch = localStorage.getItem('foodwaste_branch');
    if (savedBranch) branchName = savedBranch;

    // Update input fields
    const adminNameInput = document.getElementById('adminName');
    const branchLocationInput = document.getElementById('branchLocation');
    if (adminNameInput) adminNameInput.value = userName;
    if (branchLocationInput) branchLocationInput.value = branchName;

    // Update sidebar header, main header, and footer profile elements
    const nameElements = document.querySelectorAll('.admin-info h4, .header-admin-name');
    nameElements.forEach(elem => {
        elem.textContent = userName;
    });
}

/* ==========================================================================
   Load Saved Preferences into Form Fields
   ========================================================================== */
function loadSavedPreferences() {
    const savedUnit = localStorage.getItem('foodwaste_weight_unit');
    const savedThreshold = localStorage.getItem('foodwaste_threshold');
    const savedFreq = localStorage.getItem('foodwaste_frequency');

    if (savedUnit) {
        const weightUnitSelect = document.getElementById('weightUnit');
        if (weightUnitSelect) weightUnitSelect.value = savedUnit;
    }

    if (savedThreshold) {
        const thresholdInput = document.getElementById('wasteThreshold');
        if (thresholdInput) thresholdInput.value = savedThreshold;
    }

    if (savedFreq) {
        const freqSelect = document.getElementById('reportFrequency');
        if (freqSelect) freqSelect.value = savedFreq;
    }
}

/* ==========================================================================
   Fetch and Render Dishes from Supabase (NEW)
   ========================================================================== */
async function loadDishes() {
    const tbody = document.getElementById('dishesTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="3" style="padding: 15px; text-align: center; color: var(--slate-400);">Loading dishes...</td></tr>`;

    if (!supabaseClient) {
        tbody.innerHTML = `<tr><td colspan="3" style="padding: 15px; text-align: center; color: #991b1b;">Supabase client not connected.</td></tr>`;
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('dishes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="padding: 15px; text-align: center; color: var(--slate-400);">No dishes added yet. Add your first dish above!</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        data.forEach(dish => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--slate-100)';
            tr.innerHTML = `
                <td style="padding: 12px 10px; font-weight: 600; color: var(--slate-800);">${escapeHtml(dish.dish_name)}</td>
                <td style="padding: 12px 10px;"><span style="background: var(--emerald-50); color: var(--emerald-700); padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${escapeHtml(dish.category || 'General')}</span></td>
                <td style="padding: 12px 10px; text-align: right;">
                    <button onclick="deleteDish(${dish.id})" style="background: #fee2e2; color: #991b1b; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;" title="Delete Dish">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error loading dishes:', err);
        tbody.innerHTML = `<tr><td colspan="3" style="padding: 15px; text-align: center; color: #991b1b;">Error loading dishes from database.</td></tr>`;
    }
}

/* ==========================================================================
   Delete Dish Function (NEW)
   ========================================================================== */
async function deleteDish(dishId) {
    if (!confirm('Are you sure you want to delete this dish?')) return;

    try {
        const { error } = await supabaseClient
            .from('dishes')
            .delete()
            .eq('id', dishId);

        if (error) throw error;

        alert('Dish deleted successfully!');
        await loadDishes();
    } catch (err) {
        console.error('Error deleting dish:', err);
        alert('Failed to delete dish. It might be linked to existing waste logs.');
    }
}

// Utility to prevent XSS
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/* ==========================================================================
   Mobile Menu Interactions
   ========================================================================== */
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
