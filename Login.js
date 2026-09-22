// ============================================================
// FoodWise - Supabase Authentication
// ============================================================

// Your Supabase Project URL
const SUPABASE_URL = "https://pjtyoexscnbafcmzatzo.supabase.co";

// IMPORTANT:
// Use the Supabase "Publishable key" / legacy "anon public" key.
// DO NOT use the service_role key here.
const SUPABASE_ANON_KEY = "sb_publishable_gEEREmvfXn_sCRLqz26z1A_VQpLG6IB";

// Create Supabase client
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ============================================================
// DOM ELEMENTS
// ============================================================

const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const rememberCheckbox = document.getElementById("remember");
const submitBtn = document.getElementById("submitBtn");

const alertBox = document.getElementById("alertBox");
const alertIcon = document.getElementById("alertIcon");
const alertTitle = document.getElementById("alertTitle");
const alertMessage = document.getElementById("alertMessage");

const forgotModal = document.getElementById("forgotModal");
const resetEmail = document.getElementById("resetEmail");

const toggleIcon = document.getElementById("toggleIcon");


// ============================================================
// ALERT FUNCTION
// ============================================================

function showAlert(type, title, message) {

    if (!alertBox) return;

    alertBox.classList.remove("hidden");

    // Remove previous styles
    alertBox.classList.remove(
        "bg-red-50",
        "border-red-200",
        "text-red-700",
        "bg-green-50",
        "border-green-200",
        "text-green-700",
        "bg-yellow-50",
        "border-yellow-200",
        "text-yellow-700"
    );

    alertIcon.className = "mt-0.5";

    if (type === "success") {

        alertBox.classList.add(
            "bg-green-50",
            "border-green-200",
            "text-green-700"
        );

        alertIcon.classList.add(
            "fa-solid",
            "fa-circle-check"
        );

    } else if (type === "warning") {

        alertBox.classList.add(
            "bg-yellow-50",
            "border-yellow-200",
            "text-yellow-700"
        );

        alertIcon.classList.add(
            "fa-solid",
            "fa-triangle-exclamation"
        );

    } else {

        alertBox.classList.add(
            "bg-red-50",
            "border-red-200",
            "text-red-700"
        );

        alertIcon.classList.add(
            "fa-solid",
            "fa-circle-exclamation"
        );
    }

    alertTitle.textContent = title;
    alertMessage.textContent = message;
}


// ============================================================
// HIDE ALERT
// ============================================================

function hideAlert() {

    if (alertBox) {
        alertBox.classList.add("hidden");
    }
}


// ============================================================
// LOADING BUTTON
// ============================================================

function setLoading(isLoading) {

    if (!submitBtn) return;

    if (isLoading) {

        submitBtn.disabled = true;

        submitBtn.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Signing In...</span>
        `;

        submitBtn.classList.add("opacity-75", "cursor-not-allowed");

    } else {

        submitBtn.disabled = false;

        submitBtn.innerHTML = `
            <span>Sign In to Dashboard</span>
            <i class="fa-solid fa-arrow-right text-xs"></i>
        `;

        submitBtn.classList.remove(
            "opacity-75",
            "cursor-not-allowed"
        );
    }
}


// ============================================================
// PASSWORD VISIBILITY TOGGLE
// ============================================================

function togglePassword() {

    if (!passwordInput || !toggleIcon) return;

    if (passwordInput.type === "password") {

        passwordInput.type = "text";

        toggleIcon.classList.remove("fa-eye");
        toggleIcon.classList.add("fa-eye-slash");

    } else {

        passwordInput.type = "password";

        toggleIcon.classList.remove("fa-eye-slash");
        toggleIcon.classList.add("fa-eye");
    }
}


// ============================================================
// DEMO CREDENTIALS
// ============================================================

function fillDemoCredentials() {

    usernameInput.value = "demo@foodwise.com";

    passwordInput.value = "Demo@12345";

    hideAlert();

    usernameInput.focus();
}


// ============================================================
// OPEN FORGOT PASSWORD MODAL
// ============================================================

function openForgotModal() {

    if (!forgotModal) return;

    forgotModal.classList.remove("hidden");
    forgotModal.classList.add("flex");

    if (resetEmail) {
        resetEmail.focus();
    }
}


// ============================================================
// CLOSE FORGOT PASSWORD MODAL
// ============================================================

function closeForgotModal() {

    if (!forgotModal) return;

    forgotModal.classList.add("hidden");
    forgotModal.classList.remove("flex");
}


// ============================================================
// LOGIN
// ============================================================

async function loginUser(event) {

    event.preventDefault();

    hideAlert();

    const emailOrUsername = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!emailOrUsername) {

        showAlert(
            "error",
            "Email Required",
            "Please enter your email address."
        );

        return;
    }

    if (!password) {

        showAlert(
            "error",
            "Password Required",
            "Please enter your password."
        );

        return;
    }

    if (!emailOrUsername.includes("@")) {

        showAlert(
            "error",
            "Invalid Email",
            "Please enter the email address registered with FoodWise."
        );

        return;
    }

    setLoading(true);

    try {

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: emailOrUsername,
                password: password
            });

        if (error) {
            throw error;
        }

        if (!data || !data.user) {

            throw new Error(
                "Login failed. User information was not returned."
            );
        }

        // Store remember preference
        if (rememberCheckbox && rememberCheckbox.checked) {

            localStorage.setItem(
                "foodwise_remember",
                "true"
            );

        } else {

            localStorage.removeItem(
                "foodwise_remember"
            );
        }

        showAlert(
            "success",
            "Login Successful",
            "Welcome back! Redirecting to your dashboard..."
        );

        // Redirect after successful login
        setTimeout(() => {

            window.location.href = "Dashboard.html";

        }, 1000);

    } catch (error) {

        console.error("Login Error:", error);

        let errorMessage =
            "Unable to sign in. Please check your email and password.";

        if (error.message) {

            if (
                error.message.toLowerCase().includes("invalid login")
            ) {

                errorMessage =
                    "Incorrect email or password.";

            } else if (
                error.message.toLowerCase().includes("email not confirmed")
            ) {

                errorMessage =
                    "Please confirm your email address before signing in.";

            } else {

                errorMessage = error.message;
            }
        }

        showAlert(
            "error",
            "Login Failed",
            errorMessage
        );

    } finally {

        setLoading(false);
    }
}


// ============================================================
// FORGOT PASSWORD
// ============================================================

async function sendPasswordReset() {

    hideAlert();

    if (!resetEmail) return;

    const email = resetEmail.value.trim();

    if (!email) {

        alert(
            "Please enter your registered email address."
        );

        return;
    }

    if (!email.includes("@")) {

        alert(
            "Please enter a valid email address."
        );

        return;
    }

    const resetButton =
        document.querySelector('[data-action="submit-reset"]');

    if (resetButton) {

        resetButton.disabled = true;

        resetButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Sending...
        `;
    }

    try {

        const { error } =
            await supabaseClient.auth.resetPasswordForEmail(
                email,
                {
                    redirectTo:
                        window.location.origin +
                        "/reset-password.html"
                }
            );

        if (error) {
            throw error;
        }

        closeForgotModal();

        showAlert(
            "success",
            "Reset Link Sent",
            "If this email is registered, password reset instructions have been sent."
        );

        resetEmail.value = "";

    } catch (error) {

        console.error(
            "Password Reset Error:",
            error
        );

        showAlert(
            "error",
            "Reset Failed",
            error.message ||
            "Unable to send the password reset email."
        );

    } finally {

        if (resetButton) {

            resetButton.disabled = false;

            resetButton.innerHTML =
                "Send Link";
        }
    }
}


// ============================================================
// CHECK CURRENT SESSION
// ============================================================

async function checkUserSession() {

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();

        if (error) {

            console.error(
                "Session Error:",
                error
            );

            return;
        }

        const session = data.session;

        // Agar user pehle se logged-in hai, toh seedha dashboard par bhej do
        if (session && session.user) {

            console.log(
                "Already logged in:",
                session.user.email
            );

            window.location.href = "Dashboard.html";
        }

    } catch (error) {

        console.error(
            "Session Check Error:",
            error
        );
    }
}


// ============================================================
// AUTH STATE LISTENER
// ============================================================

supabaseClient.auth.onAuthStateChange(
    (event, session) => {

        console.log(
            "Auth Event:",
            event
        );

        if (event === "SIGNED_IN") {

            console.log(
                "User signed in:",
                session?.user?.email
            );
        }

        if (event === "SIGNED_OUT") {

            console.log(
                "User signed out."
            );
        }

        if (event === "TOKEN_REFRESHED") {

            console.log(
                "Session token refreshed."
            );
        }
    }
);


// ============================================================
// EVENT LISTENERS
// ============================================================

// Login form
if (loginForm) {

    loginForm.addEventListener(
        "submit",
        loginUser
    );
}


// Password toggle
document.addEventListener(
    "click",
    function (event) {

        const actionElement =
            event.target.closest(
                '[data-action="toggle-password"]'
            );

        if (actionElement) {

            togglePassword();
        }
    }
);


// Forgot password
document.addEventListener(
    "click",
    function (event) {

        const actionElement =
            event.target.closest(
                '[data-action="forgot-password"]'
            );

        if (actionElement) {

            event.preventDefault();

            openForgotModal();
        }
    }
);


// Close forgot password modal
document.addEventListener(
    "click",
    function (event) {

        const actionElement =
            event.target.closest(
                '[data-action="close-forgot"]'
            );

        if (actionElement) {

            closeForgotModal();
        }
    }
);


// Submit password reset
document.addEventListener(
    "click",
    function (event) {

        const actionElement =
            event.target.closest(
                '[data-action="submit-reset"]'
            );

        if (actionElement) {

            sendPasswordReset();
        }
    }
);


// Demo credentials
document.addEventListener(
    "click",
    function (event) {

        const actionElement =
            event.target.closest(
                '[data-action="fill-demo"]'
            );

        if (actionElement) {

            fillDemoCredentials();
        }
    }
);


// Close modal by clicking outside
if (forgotModal) {

    forgotModal.addEventListener(
        "click",
        function (event) {

            if (event.target === forgotModal) {

                closeForgotModal();
            }
        }
    );
}


// Close modal with Escape key
document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape" &&
            forgotModal &&
            !forgotModal.classList.contains("hidden")
        ) {

            closeForgotModal();
        }
    }
);


// ============================================================
// REMEMBER ME
// ============================================================

function loadRememberPreference() {

    const remembered =
        localStorage.getItem(
            "foodwise_remember"
        );

    if (
        remembered === "true" &&
        rememberCheckbox
    ) {

        rememberCheckbox.checked = true;
    }
}


// ============================================================
// START APPLICATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "FoodWise Login initialized."
        );

        loadRememberPreference();

        checkUserSession();
    }
);
