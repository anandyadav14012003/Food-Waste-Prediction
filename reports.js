/* ==========================================================================
    FoodWaste AI - Reports Page JavaScript
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
// AUTHENTICATION GUARD
// ==========================================================================
async function checkAuthGuard() {
    if (!supabaseClient) return;

    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session) {
            window.location.href = "index.html";
        }
    } catch (err) {
        window.location.href = "index.html";
    }
}

let reportsData = [];
let totalDownloadsTracker = 0;
let lastExportTimeString = "None";

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthGuard();
    await loadUserProfile();
    
    // Logout button handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (supabaseClient) await supabaseClient.auth.signOut();
            localStorage.removeItem('foodwaste_admin_name');
            window.location.href = "index.html";
        });
    }

    // Fetch existing records from database to display them, without auto-generating new ones
    if (supabaseClient) {
        await fetchReportsFromSupabase();
    } else {
        renderReports();
        updateMetrics();
    }

    // Handle Report Generation Form Submit (Manual generation only)
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await generateAndSaveNewReport();
        });
    }
});

/* ==========================================================================
    Load User Profile
   ========================================================================== */
async function loadUserProfile() {
    if (!supabaseClient) return;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        let userName = "Anand Yadav";

        if (session && session.user) {
            userName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        } else {
            const savedName = localStorage.getItem('foodwaste_admin_name');
            if (savedName) userName = savedName;
        }

        const adminNameElements = document.querySelectorAll('.admin-info h4, #sidebarAdminName');
        adminNameElements.forEach(elem => {
            elem.textContent = userName;
        });
    } catch (err) {
        console.error('Error loading user profile:', err);
    }
}

/* ==========================================================================
    Fetch Existing Reports from Supabase Database
   ========================================================================== */
async function fetchReportsFromSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from('generated_reports')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            console.error('Error fetching reports:', error.message);
            return;
        }

        if (data) {
            reportsData = data.map(item => {
                // Remove extensions like .html, .xlsx, .xls, .pdf from name if present
                let cleanName = item.name ? item.name.replace(/\.[^/.]+$/, "") : "Food Records Report";
                
                return {
                    id: item.id,
                    name: cleanName,
                    category: item.category || 'food_records',
                    categoryText: item.category_text || 'Food Records Report',
                    date: item.date || 'Just now',
                    format: item.format || 'PDF',
                    status: item.status || 'Completed',
                    downloadsCount: item.downloads_count || 0
                };
            });

            totalDownloadsTracker = reportsData.reduce((sum, r) => sum + r.downloadsCount, 0);
            if (reportsData.length > 0) {
                lastExportTimeString = reportsData[0].date;
            }

            renderReports();
            updateMetrics();
        }
    } catch (err) {
        console.error('Unexpected error fetching reports:', err);
    }
}

/* ==========================================================================
    Render Reports Table
   ========================================================================== */
function renderReports() {
    const reportsTableBody = document.getElementById('reportsTableBody');
    if (!reportsTableBody) return;

    reportsTableBody.innerHTML = '';

    if (reportsData.length === 0) {
        reportsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">No reports generated yet. Click "Generate Report" above to create one.</td></tr>`;
        return;
    }

    reportsData.forEach((report, index) => {
        let badgeStyle = 'background: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 4px; font-weight: 500;';
        const formatUpper = (report.format || '').toUpperCase();
        
        if (formatUpper === 'EXCEL' || formatUpper === 'XLS') {
            badgeStyle = 'background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-weight: 500;';
        } else if (formatUpper === 'PDF') {
            badgeStyle = 'background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-weight: 500;';
        }

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';
        tr.innerHTML = `
            <td style="padding: 12px;"><strong>${report.name}</strong></td>
            <td style="padding: 12px; color: #475569;">${report.categoryText}</td>
            <td style="padding: 12px; color: #475569;">${report.date}</td>
            <td style="padding: 12px;"><span style="${badgeStyle}">${formatUpper}</span></td>
            <td style="padding: 12px;"><span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-weight: 500;">${report.status}</span></td>
            <td style="padding: 12px;">
                <button class="btn btn-outline btn-sm" onclick="handleDownloadAction(${index})" style="background: white; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; cursor: pointer; color: #334155; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-download" style="color: #10b981;"></i> Download (${report.downloadsCount || 0})
                </button>
            </td>
        `;
        reportsTableBody.appendChild(tr);
    });
}

/* ==========================================================================
    Update Metrics Cards
   ========================================================================== */
function updateMetrics() {
    const totalReportsElem = document.getElementById('totalReportsCount');
    const totalDownloadsElem = document.getElementById('totalDownloadsCount');
    const lastExportElem = document.getElementById('lastExportTime');

    if (totalReportsElem) totalReportsElem.textContent = reportsData.length;
    if (totalDownloadsElem) totalDownloadsElem.textContent = totalDownloadsTracker;
    if (lastExportElem) lastExportElem.textContent = lastExportTimeString;
}

/* ==========================================================================
    Generate New Report (Manual User Action Only & Saves to Database)
   ========================================================================== */
async function generateAndSaveNewReport() {
    if (!supabaseClient) {
        alert('Supabase client not connected.');
        return;
    }

    const reportTypeSelect = document.getElementById('reportType');
    const reportFormatSelect = document.getElementById('reportFormat');

    if (!reportTypeSelect || !reportFormatSelect) return;

    const reportTypeVal = reportTypeSelect.value;
    const reportTypeName = reportTypeSelect.options[reportTypeSelect.selectedIndex].text;
    const formatValue = reportFormatSelect.value.toUpperCase(); // PDF or EXCEL
    
    const now = new Date();
    const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    const currentDateStr = now.toLocaleDateString('en-US', options);

    // Clean name without extensions
    const cleanReportName = `Food Records Report - ${now.toISOString().slice(0, 10)}`;

    const newReportRecord = {
        name: cleanReportName,
        category: reportTypeVal,
        category_text: reportTypeName,
        date: currentDateStr,
        format: formatValue,
        status: "Completed",
        downloads_count: 0
    };

    const { data, error } = await supabaseClient
        .from('generated_reports')
        .insert([newReportRecord])
        .select();

    if (error) {
        console.error('Error inserting report:', error.message);
        alert(`Failed to save report: ${error.message}`);
        return;
    }

    if (data && data.length > 0) {
        alert(`Report generated and saved successfully!`);
        await fetchReportsFromSupabase();
    }
}

/* ==========================================================================
    Handle Download Button Click (PDF opens format page, Excel downloads spreadsheet)
   ========================================================================== */
async function handleDownloadAction(index) {
    const report = reportsData[index];
    if (!report || !supabaseClient) return;

    // Increment download count in Supabase
    const newCount = (report.downloadsCount || 0) + 1;
    const { error } = await supabaseClient
        .from('generated_reports')
        .update({ downloads_count: newCount })
        .eq('id', report.id);

    if (error) {
        console.error('Error updating download count:', error.message);
    }

    await fetchReportsFromSupabase();

    const format = (report.format || '').toUpperCase();

    if (format === 'PDF') {
        // PDF format hone par direct download nahi hoga, format view page open hoga
        window.open('report_format.html', '_blank');
        return;
    } 
    
    if (format === 'EXCEL' || format === 'XLS') {
        // Excel hone par live food_records table ka data fetch karke Excel download hogi
        const { data: foodData, error: foodError } = await supabaseClient
            .from('food_records')
            .select('*')
            .order('record_date', { ascending: false });

        if (foodError) {
            console.error('Error fetching food records for Excel:', foodError.message);
            alert('Could not fetch live records for Excel export.');
            return;
        }

        const excelData = (foodData && foodData.length > 0) ? foodData.map((item, idx) => ({
            "S.No.": idx + 1,
            "Record Date": item.record_date,
            "Day": item.day || item.day_of_week || '-',
            "Customers": item.customers || 0,
            "Food Prepared (kg)": item.food_prepared || 0,
            "Food Consumed (kg)": item.food_consumed || 0,
            "Food Wasted (kg)": item.food_wasted || 0,
            "Waste Percentage": item.waste_percentage !== null ? `${item.waste_percentage}%` : '0%',
            "Weather": item.weather || '-',
            "Holiday": item.holiday || 'No',
            "Special Event": item.special_event || 'No'
        })) : [{ "Message": "No food records found" }];

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        worksheet['!cols'] = [
            { wch: 6 },  { wch: 14 }, { wch: 12 }, { wch: 12 }, 
            { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, 
            { wch: 12 }, { wch: 10 }, { wch: 14 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Food Records");

        const excelFileName = `${report.name}.xlsx`;
        XLSX.writeFile(workbook, excelFileName);
    }
}
