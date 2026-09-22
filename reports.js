/* ==========================================================================
    FoodWaste AI - Reports Page JavaScript (Complete & Updated)
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

let reportsData = [];
let totalDownloadsTracker = 0;
let lastExportTimeString = "None";

document.addEventListener('DOMContentLoaded', async () => {
    // Sabse pehle Authentication check run karo
    await checkAuthGuard();

    initMobileMenu();
    
    // Logged-in user ka naam dynamic load karne ke liye
    await loadUserProfile();
    
    // Logout button handler
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (supabaseClient) {
                await supabaseClient.auth.signOut();
            }
            localStorage.removeItem('foodwaste_admin_name');
            window.location.href = "index.html";
        });
    }

    if (supabaseClient) {
        await fetchReportsFromSupabase();
    } else {
        console.error("Supabase client is not initialized!");
    }

    // Handle Report Generation Form Submit
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await generateAndSaveNewReport();
        });
    }

    // Set default date input value to today (agar element exist kare)
    const dateInput = document.getElementById('reportDateFilter');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
});

/* ==========================================================================
    Fetch Logged-In User Profile and Update UI
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

        // Yeh ab sabhi jagah dynamic naam update kar dega
        const adminNameElements = document.querySelectorAll('.admin-info h4, .header-admin-name, #sidebarAdminName');
        adminNameElements.forEach(elem => {
            elem.textContent = userName;
        });

    } catch (err) {
        console.error('Error loading user profile:', err);
    }
}

/* ==========================================================================
    Fetch Reports from Supabase Database
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
            reportsData = data.map(item => ({
                id: item.id,
                name: item.name,
                category: item.category,
                categoryText: item.category_text,
                date: item.date,
                format: item.format,
                status: item.status,
                downloadsCount: item.downloads_count
            }));

            totalDownloadsTracker = reportsData.reduce((sum, r) => sum + (r.downloadsCount || 0), 0);
            if (reportsData.length > 0) {
                lastExportTimeString = reportsData[0].date;
            }

            renderReports();
            updateMetrics();
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

/* ==========================================================================
    Render Reports Table Dynamically
    ========================================================================== */
function renderReports() {
    const reportsTableBody = document.getElementById('reportsTableBody');
    if (!reportsTableBody) return;

    reportsTableBody.innerHTML = '';

    if (reportsData.length === 0) {
        reportsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">No reports generated yet.</td></tr>`;
        return;
    }

    reportsData.forEach(report => {
        let badgeStyle = 'background: #f1f5f9; color: #475569; padding: 4px 8px; border-radius: 4px; font-weight: 500;';
        const formatUpper = (report.format || '').toUpperCase();
        
        if (formatUpper === 'EXCEL' || formatUpper === 'XLS') {
            badgeStyle = 'background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-weight: 500;';
        } else if (formatUpper === 'CSV') {
            badgeStyle = 'background: #fef3c7; color: #b45309; padding: 4px 8px; border-radius: 4px; font-weight: 500;';
        } else if (formatUpper === 'PDF' || formatUpper === 'HTML') {
            badgeStyle = 'background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-weight: 500;';
        }

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';
        tr.innerHTML = `
            <td style="padding: 12px;"><strong>${report.name}</strong></td>
            <td style="padding: 12px;">${report.categoryText}</td>
            <td style="padding: 12px;">${report.date}</td>
            <td style="padding: 12px;"><span style="${badgeStyle}">${formatUpper}</span></td>
            <td style="padding: 12px;"><span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-weight: 500;">${report.status}</span></td>
            <td style="padding: 12px;">
                <button class="btn btn-outline btn-sm" onclick="downloadReport(${report.id})" style="background: white; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; cursor: pointer; color: #334155; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-download"></i> Download (${report.downloadsCount || 0})
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

    if (totalReportsElem) {
        totalReportsElem.textContent = reportsData.length;
    }
    if (totalDownloadsElem) {
        totalDownloadsElem.textContent = totalDownloadsTracker;
    }
    if (lastExportElem) {
        lastExportElem.textContent = lastExportTimeString;
    }
}

/* ==========================================================================
    Mobile Menu Interactions Only
    ========================================================================== */
function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggleBtn');
    const closeBtn = document.getElementById('mobileCloseBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (!menuToggle || !sidebar || !overlay) return;

    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('show', 'active');
        overlay.classList.add('show', 'active');
    });

    const closeSidebar = () => {
        sidebar.classList.remove('show', 'active');
        overlay.classList.remove('show', 'active');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);
}

/* ==========================================================================
    Generate New Report and Save to Supabase
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
    const formatValue = reportFormatSelect.value.toUpperCase();
    
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    let fileExt = formatValue.toLowerCase();
    if (formatValue === 'EXCEL') fileExt = 'xls';
    if (formatValue === 'PDF') fileExt = 'html';

    const fileName = `${reportTypeVal}_${timestamp}.${fileExt}`;
    const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    const currentDateStr = now.toLocaleDateString('en-US', options);

    const newReportRecord = {
        name: fileName,
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
        alert(`Success! Report "${fileName}" generated and saved.`);
        await fetchReportsFromSupabase();
        downloadReport(data[0].id);
    }
}

/* ==========================================================================
    Structured Table-Based Download Logic (Excel, HTML PDF & CSV)
    ========================================================================== */
async function downloadReport(reportId) {
    const report = reportsData.find(r => r.id === reportId);
    if (!report || !supabaseClient) return;

    const newCount = (report.downloadsCount || 0) + 1;
    
    const { error } = await supabaseClient
        .from('generated_reports')
        .update({ downloads_count: newCount })
        .eq('id', reportId);

    if (error) {
        console.error('Error updating download count:', error.message);
    }

    await fetchReportsFromSupabase();

    const format = (report.format || '').toUpperCase();
    let blob;
    let mimeType = '';
    let fileName = report.name;

    if (format === 'EXCEL' || format === 'XLS') {
        const excelHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"></head>
        <body>
            <table border="1">
                <tr style="background-color: #10b981; color: #ffffff; font-weight: bold;">
                    <th>Report Name</th>
                    <th>Category</th>
                    <th>Generated Date</th>
                    <th>Status</th>
                </tr>
                <tr>
                    <td>${report.name}</td>
                    <td>${report.categoryText}</td>
                    <td>${report.date}</td>
                    <td>${report.status}</td>
                </tr>
            </table>
        </body>
        </html>`;
        
        mimeType = 'application/vnd.ms-excel;charset=utf-8;';
        blob = new Blob([excelHtml], { type: mimeType });
        
        if (!fileName.endsWith('.xls')) {
            fileName = fileName.replace(/\.[^/.]+$/, "") + '.xls';
        }

    } else if (format === 'PDF' || format === 'HTML') {
        const pdfHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${report.name}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
                .header { border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 25px; }
                .header h2 { color: #10b981; margin: 0; }
                .meta-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                .meta-table th, .meta-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                .meta-table th { background-color: #f8fafc; color: #334155; }
                .footer { margin-top: 40px; font-size: 12px; color: #64748b; text-align: center; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>FoodWaste AI System Report</h2>
                <p>Official Analytics & Generated Document</p>
            </div>
            <table class="meta-table">
                <tr><th>Report Name</th><td>${report.name}</td></tr>
                <tr><th>Category</th><td>${report.categoryText}</td></tr>
                <tr><th>Generation Date</th><td>${report.date}</td></tr>
                <tr><th>Document Format</th><td>PDF Document (HTML Layout)</td></tr>
                <tr><th>Status</th><td>${report.status}</td></tr>
            </table>
            <div class="footer">
                <p>&copy; 2026 FoodWaste AI Systems. All rights reserved.</p>
            </div>
        </body>
        </html>`;
        
        mimeType = 'text/html;charset=utf-8;';
        blob = new Blob([pdfHtml], { type: mimeType });
        
        if (!fileName.endsWith('.html')) {
            fileName = fileName.replace(/\.[^/.]+$/, "") + '.html';
        }

    } else {
        const csvContent = `Report Name,Category,Date,Status\n"${report.name}","${report.categoryText}","${report.date}","${report.status}"`;
        mimeType = 'text/csv;charset=utf-8;';
        blob = new Blob([csvContent], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = fileName;
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
}
