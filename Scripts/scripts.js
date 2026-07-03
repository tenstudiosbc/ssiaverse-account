    // ==================== FIREBASE INIT ====================
        let app, auth, db;
        let currentUser = null;
        let currentUsername = null;
        let isSignUp = false;

        try {
            app = firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            console.log("Firebase initialized successfully");
        } catch (e) {
            console.error("Firebase init error:", e);
            showToast("Failed to initialize Firebase. Please refresh.", "error");
        }

        // ==================== STAR BACKGROUND ====================
        function createStars() {
            const container = document.getElementById("stars");
            for (let i = 0; i < 80; i++) {
                const star = document.createElement("div");
                star.className = "star";
                star.style.left = Math.random() * 100 + "%";
                star.style.top = Math.random() * 100 + "%";
                star.style.setProperty("--duration", (2 + Math.random() * 4) + "s");
                star.style.setProperty("--opacity", 0.2 + Math.random() * 0.8);
                star.style.animationDelay = Math.random() * 5 + "s";
                container.appendChild(star);
            }
        }
        createStars();

        // ==================== NAVBAR SCROLL ====================
        window.addEventListener("scroll", function() {
            document.getElementById("navbar").classList.toggle("scrolled", window.scrollY > 50);
        });

        // ==================== MOBILE MENU ====================
        function toggleMobileMenu() {
            const overlay = document.getElementById("mobileMenuOverlay");
            overlay.classList.toggle("active");
        }
        function closeMobileMenu() {
            document.getElementById("mobileMenuOverlay").classList.remove("active");
        }

        // ==================== TOAST NOTIFICATIONS ====================
        function showToast(message, type) {
            type = type || "info";
            const container = document.getElementById("toastContainer");
            const toast = document.createElement("div");
            toast.className = "toast " + type;
            const icons = { success: "fa-check-circle", error: "fa-times-circle", warning: "fa-exclamation-triangle", info: "fa-info-circle" };
            toast.innerHTML = '<i class="fas ' + icons[type] + '"></i><span>' + message + "</span>";
            container.appendChild(toast);
            setTimeout(function() {
                toast.style.opacity = "0";
                toast.style.transform = "translateX(100%)";
                setTimeout(function() { toast.remove(); }, 300);
            }, 4000);
        }

        // ==================== DYNAMIC PAGE & COMPONENT LOADING ====================
        const htmlCache = {};

        async function fetchHtml(path) {
            if (htmlCache[path]) return htmlCache[path];
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error("Failed to load: " + path + " (" + response.status + ")");
            }
            const html = await response.text();
            htmlCache[path] = html;
            return html;
        }

        async function loadComponent(name, containerSelector) {
            const container = containerSelector
                ? document.querySelector(containerSelector)
                : document.querySelector('[data-component="' + name + '"]');
            if (!container) return;

            try {
                container.innerHTML = await fetchHtml("Components/" + name + ".html");
                await initLoadedComponents(container);
            } catch (error) {
                console.error("Component load error:", error);
                container.innerHTML = '<div class="load-error">Component "' + name + '" failed to load.</div>';
            }
        }

        async function loadComponentsInRoot(root = document) {
            const placeholders = Array.from(root.querySelectorAll("[data-component]"));
            await Promise.all(placeholders.map(async function(element) {
                const name = element.dataset.component;
                if (!name) return;
                try {
                    element.innerHTML = await fetchHtml("Components/" + name + ".html");
                } catch (error) {
                    console.error("Component placeholder load error:", name, error);
                    element.innerHTML = '<div class="load-error">Component "' + name + '" failed to load.</div>';
                }
            }));
            await initLoadedComponents(root);
        }

        async function loadPage(pageName) {
            const pageRoot = document.getElementById("pageRoot");
            if (!pageRoot) return;

            pageRoot.innerHTML = '<div class="loading-state"><p>Loading page...</p></div>';
            try {
                const pageHtml = await fetchHtml("Pages/" + pageName + ".html");
                pageRoot.innerHTML = pageHtml;
                await loadComponentsInRoot(pageRoot);
                window.scrollTo({ top: 0, behavior: "smooth" });
                document.title = pageName === "dashboard"
                    ? "Dashboard | SSIAVerse Account"
                    : "SSIAVerse Account | Your Gateway to the SSIAVerse";
                history.replaceState({ page: pageName }, "", "?page=" + pageName);
            } catch (error) {
                console.error("Page load error:", error);
                pageRoot.innerHTML = '<div class="page-error"><h2>Page not found</h2><p>The requested page "' + pageName + '" could not be loaded.</p><button class="btn btn-primary" onclick="showHome()">Back to Home</button></div>';
            }
        }

        async function initLoadedComponents(root = document) {
            const mobileMenuBtn = root.querySelector("#mobileMenuBtn");
            if (mobileMenuBtn) {
                mobileMenuBtn.addEventListener("click", function() {
                    toggleMobileMenu();
                });
            }

            const overlays = root.querySelectorAll(".modal-overlay");
            overlays.forEach(function(overlay) {
                overlay.addEventListener("click", function(e) {
                    if (e.target === overlay) overlay.classList.remove("active");
                });
            });
        }

        async function loadAppShell() {
            await loadComponent("nav", "#navRoot");
            await loadComponent("modals", "#modalRoot");
            const pageParam = new URLSearchParams(window.location.search).get("page") || "home";
            await loadPage(pageParam);
        }

        window.addEventListener("popstate", function(event) {
            const page = (event.state && event.state.page) || new URLSearchParams(window.location.search).get("page") || "home";
            loadPage(page).catch(function(error) { console.error(error); });
        });

        document.addEventListener("DOMContentLoaded", function() {
            loadAppShell().catch(function(error) {
                console.error("App shell load failed:", error);
            });
        });

        // ==================== AUTH STATE ====================
        auth.onAuthStateChanged(async function(user) {
            if (user) {
                currentUser = user;
                const storedUsername = localStorage.getItem("ssiavc_username");
                if (storedUsername) {
                    currentUsername = storedUsername;
                } else {
                    try {
                        const snapshot = await db.collection("usernameMappings").where("uid", "==", user.uid).limit(1).get();
                        if (!snapshot.empty) {
                            currentUsername = snapshot.docs[0].id;
                            localStorage.setItem("ssiavc_username", currentUsername);
                        }
                    } catch (e) { console.error(e); }
                }
                await showDashboard();
                updateNavForUser();
                loadUserData();
            } else {
                currentUser = null;
                currentUsername = null;
                await showHome();
                updateNavForGuest();
            }
        });

        function updateNavForUser() {
            const navUser = document.getElementById("navUser");
            const initial = currentUsername ? currentUsername.charAt(0).toUpperCase() : "?";
            navUser.innerHTML = '<div class="user-avatar" onclick="showDashboard()" title="' + (currentUsername || "User") + '">' + initial + "</div>";
        }

        function updateNavForGuest() {
            document.getElementById("navUser").innerHTML = '<button class="btn btn-primary" onclick="openSignInModal()"><i class="fas fa-sign-in-alt"></i> Sign In</button>';
        }

        // ==================== PAGE NAVIGATION ====================
        async function showHome() {
            await loadPage("home");
        }

        async function showDashboard() {
            if (!currentUser) {
                openSignInModal();
                return;
            }
            await loadPage("dashboard");
        }

        function scrollToGames() {
            const target = document.getElementById("games");
            if (target) {
                target.scrollIntoView({ behavior: "smooth" });
            }
        }

        function showSupport() {
            showToast("Support center coming soon!", "info");
        }

        function showGameDetail(game) {
            showToast(game === "vc" ? "SSIA Vanguard Chronicles - Is Available On PC(Windows) and Android" : "SSIA ShadowFront - Coming Soon", "info");
        }

        // ==================== DASHBOARD SECTIONS ====================
        function showSection(section) {
            document.querySelectorAll(".content-section").forEach(function(s) { s.classList.remove("active"); });
            document.querySelectorAll(".sidebar-menu a").forEach(function(a) { a.classList.remove("active"); });
            document.getElementById("section-" + section).classList.add("active");
            const link = document.querySelector('.sidebar-menu a[data-section="' + section + '"]');
            if (link) link.classList.add("active");
        }

        // ==================== MODALS ====================
        function openSignInModal() {
            isSignUp = false;
            updateAuthModal();
            document.getElementById("authModal").classList.add("active");
            document.getElementById("authUsername").focus();
        }

        function openRecoveryModal() {
            document.getElementById("recoveryModal").classList.add("active");
        }

        function closeModal(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.remove("active");
            if (id === "authModal") {
                const form = document.getElementById("authForm");
                if (form) form.reset();
                isSignUp = false;
                updateAuthModal();
            }
            if (id === "recoveryModal") {
                const form = document.getElementById("recoveryForm");
                if (form) form.reset();
            }
        }

        function toggleAuthMode() {
            isSignUp = !isSignUp;
            updateAuthModal();
        }

        function updateAuthModal() {
            const titleEl = document.getElementById("authModalTitle");
            const subtitleEl = document.getElementById("authModalSubtitle");
            const btnTextEl = document.getElementById("authBtnText");
            const toggleEl = document.getElementById("authToggleText");
            const confirmGroup = document.getElementById("confirmPasswordGroup");

            if (titleEl) titleEl.textContent = isSignUp ? "Sign Up" : "Sign In";
            if (subtitleEl) subtitleEl.textContent = isSignUp ? "Join the SSIAVerse today" : "Welcome back to the SSIAVerse";
            if (btnTextEl) btnTextEl.textContent = isSignUp ? "Create Account" : "Sign In";
            if (toggleEl) {
                toggleEl.innerHTML = isSignUp
                    ? 'Already have an account? <a onclick="toggleAuthMode()">Sign In</a>'
                    : 'Do not have an account? <a onclick="toggleAuthMode()">Sign Up</a>';
            }
            if (confirmGroup) confirmGroup.style.display = isSignUp ? "block" : "none";
        }

        // ==================== PASSWORD HASHING ====================
        async function hashPassword(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password + "ssiavc_salt_2026");
            const hashBuffer = await crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(function(b) { return b.toString(16).padStart(2, "0"); }).join("");
        }

        // ==================== AUTHENTICATION ====================
        async function handleAuth(e) {
            e.preventDefault();
            const usernameInput = document.getElementById("authUsername");
            const passwordInput = document.getElementById("authPassword");
            const confirmInput = document.getElementById("authConfirmPassword");
            const btn = document.getElementById("authSubmitBtn");

            if (!usernameInput || !passwordInput) {
                showToast("Form error. Please refresh and try again.", "error");
                return;
            }

            const username = usernameInput.value.trim().toLowerCase();
            const password = passwordInput.value;
            const confirmPassword = confirmInput ? confirmInput.value : "";
            const originalText = btn ? btn.innerHTML : "Sign In";

            if (!username || !password) {
                showToast("Please fill in all fields", "warning");
                return;
            }

            if (isSignUp) {
                if (password !== confirmPassword) {
                    showToast("Passwords do not match", "error");
                    return;
                }
                if (password.length < 6) {
                    showToast("Password must be at least 6 characters", "warning");
                    return;
                }
            }

            if (btn) {
                btn.innerHTML = '<div class="spinner"></div>';
                btn.disabled = true;
            }

            try {
                if (isSignUp) {
                    // SIGN UP
                    const usernameDoc = await db.collection("usernameMappings").doc(username).get();
                    if (usernameDoc.exists) {
                        showToast("Username already taken. Please choose another.", "error");
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                        return;
                    }

                    const anonResult = await auth.signInAnonymously();
                    const uid = anonResult.user.uid;

                    await db.collection("usernameMappings").doc(username).set({
                        uid: uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    await db.collection("accounts").doc(uid).set({
                        username: username,
                        displayName: username,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    const passwordHash = await hashPassword(password);
                    localStorage.setItem("ssiavc_pass_" + username, passwordHash);
                    localStorage.setItem("ssiavc_username", username);

                    currentUsername = username;
                    showToast("Account created successfully! Welcome to SSIAVerse.", "success");
                    closeModal("authModal");

                } else {
                    // SIGN IN
                    const usernameDoc = await db.collection("usernameMappings").doc(username).get();
                    if (!usernameDoc.exists) {
                        showToast("Username not found. Please check or sign up.", "error");
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                        return;
                    }

                    const storedHash = localStorage.getItem("ssiavc_pass_" + username);
                    const inputHash = await hashPassword(password);

                    if (storedHash && storedHash !== inputHash) {
                        showToast("Incorrect password. Please try again.", "error");
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                        return;
                    }

                    await auth.signInAnonymously();

                    const uid = usernameDoc.data().uid;
                    await db.collection("accounts").doc(uid).update({
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    localStorage.setItem("ssiavc_username", username);
                    currentUsername = username;
                    showToast("Welcome back, " + username + "!", "success");
                    closeModal("authModal");
                }
            } catch (error) {
                console.error("Auth error:", error);
                showToast("Authentication failed: " + (error.message || "Unknown error"), "error");
            } finally {
                if (btn) {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            }
        }

        // ==================== SIGN OUT ====================
        async function signOut() {
            try {
                await auth.signOut();
                localStorage.removeItem("ssiavc_username");
                currentUsername = null;
                currentUser = null;
                showToast("Signed out successfully", "info");
                showHome();
                updateNavForGuest();
            } catch (error) {
                showToast("Sign out failed: " + (error.message || "Unknown error"), "error");
            }
        }

        // ==================== LOAD USER DATA ====================
        async function loadUserData() {
            if (!currentUser || !currentUsername) return;

            const uid = currentUser.uid;

            // Load account profile
            try {
                const doc = await db.collection("accounts").doc(uid).get();
                if (doc.exists) {
                    const data = doc.data();
                    const profileName = document.getElementById("profileName");
                    const profileAvatar = document.getElementById("profileAvatar");
                    const profileUid = document.getElementById("profileUid");
                    const settingsUsername = document.getElementById("settingsUsername");
                    const settingsDisplayName = document.getElementById("settingsDisplayName");
                    const settingsEmail = document.getElementById("settingsEmail");
                    const settingsBio = document.getElementById("settingsBio");
                    const statMember = document.getElementById("statMember");

                    if (profileName) profileName.textContent = data.displayName || currentUsername;
                    if (profileAvatar) profileAvatar.textContent = (data.displayName || currentUsername).charAt(0).toUpperCase();
                    if (profileUid) profileUid.textContent = "UID: " + uid.substring(0, 12) + "...";
                    if (settingsUsername) settingsUsername.value = currentUsername;
                    if (settingsDisplayName) settingsDisplayName.value = data.displayName || "";
                    if (settingsEmail) settingsEmail.value = data.email || "";
                    if (settingsBio) settingsBio.value = data.bio || "";

                    if (data.createdAt && statMember) {
                        const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                        statMember.textContent = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                    }
                }
            } catch (error) {
                console.error("Load profile error:", error);
            }

            // Load cloud saves count (using username as key per your rules)
            try {
                const savesSnapshot = await db.collection("vaultsave").doc(currentUsername).collection("saves").get();
                const statSaves = document.getElementById("statSaves");
                if (statSaves) statSaves.textContent = savesSnapshot.size;
                loadSavesList(savesSnapshot);
            } catch (error) {
                console.error("Load saves error:", error);
                const statSaves = document.getElementById("statSaves");
                if (statSaves) statSaves.textContent = "0";
            }

            // Load linked games count
            try {
                const gamesSnapshot = await db.collection("accounts").doc(uid).collection("linkedGames").get();
                const statGames = document.getElementById("statGames");
                if (statGames) statGames.textContent = gamesSnapshot.size;
            } catch (error) {
                console.error("Load games error:", error);
                const statGames = document.getElementById("statGames");
                if (statGames) statGames.textContent = "0";
            }
        }

        function loadSavesList(snapshot) {
            const container = document.getElementById("savesList");
            if (snapshot.empty) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-cloud-upload-alt"></i><h4>No Cloud Saves Yet</h4><p>Your game saves will appear here once you start playing and syncing.</p></div>';
                return;
            }

            let html = "";
            snapshot.forEach(function(doc) {
                const data = doc.data();
                const date = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toLocaleString() : new Date(data.timestamp).toLocaleString()) : "Unknown";
                html += '<div class="save-item">' +
                    '<div class="save-info"><div class="save-icon"><i class="fas fa-save"></i></div>' +
                    '<div class="save-details"><h4>' + (data.gameName || "Unknown Game") + '</h4><p>Slot ' + (data.slot || "1") + " &bull; " + date + '</p></div></div>' +
                    '<div class="save-actions">' +
                    '<button class="btn btn-outline btn-sm" onclick="downloadSave(&quot;' + doc.id + '&quot;)"><i class="fas fa-download"></i></button>' +
                    '<button class="btn btn-danger btn-sm" onclick="deleteSave(&quot;' + doc.id + '&quot;)"><i class="fas fa-trash"></i></button>' +
                    '</div></div>';
            });
            container.innerHTML = html;
        }

        // ==================== ACCOUNT SETTINGS ====================
        async function updateAccount(e) {
            e.preventDefault();
            if (!currentUser) return;

            const displayNameInput = document.getElementById("settingsDisplayName");
            const emailInput = document.getElementById("settingsEmail");
            const bioInput = document.getElementById("settingsBio");

            const displayName = displayNameInput ? displayNameInput.value.trim() : "";
            const email = emailInput ? emailInput.value.trim() : "";
            const bio = bioInput ? bioInput.value.trim() : "";

            try {
                await db.collection("accounts").doc(currentUser.uid).update({
                    displayName: displayName || currentUsername,
                    email: email,
                    bio: bio,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                document.getElementById("profileName").textContent = displayName || currentUsername;
                document.getElementById("profileAvatar").textContent = (displayName || currentUsername).charAt(0).toUpperCase();
                showToast("Account settings saved successfully!", "success");
            } catch (error) {
                showToast("Failed to save settings: " + error.message, "error");
            }
        }

        // ==================== CHANGE PASSWORD ====================
        async function changePassword(e) {
            e.preventDefault();
            if (!currentUsername) return;

            const currentPassInput = document.getElementById("currentPassword");
            const newPassInput = document.getElementById("newPassword");
            const confirmPassInput = document.getElementById("confirmPassword");

            const currentPass = currentPassInput ? currentPassInput.value : "";
            const newPass = newPassInput ? newPassInput.value : "";
            const confirmPass = confirmPassInput ? confirmPassInput.value : "";

            if (newPass !== confirmPass) {
                showToast("New passwords do not match", "error");
                return;
            }
            if (newPass.length < 6) {
                showToast("Password must be at least 6 characters", "warning");
                return;
            }

            const storedHash = localStorage.getItem("ssiavc_pass_" + currentUsername);
            const currentHash = await hashPassword(currentPass);

            if (storedHash && storedHash !== currentHash) {
                showToast("Current password is incorrect", "error");
                return;
            }

            const newHash = await hashPassword(newPass);
            localStorage.setItem("ssiavc_pass_" + currentUsername, newHash);
            showToast("Password changed successfully!", "success");
            document.getElementById("passwordForm").reset();
            document.getElementById("passwordStrengthBar").className = "";
        }

        // ==================== PASSWORD STRENGTH ====================
        function checkPasswordStrength(password) {
            const bar = document.getElementById("passwordStrengthBar");
            const hint = document.getElementById("passwordHint");
            if (!bar || !hint) return;
            let strength = 0;
            if (password.length >= 8) strength++;
            if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
            if (password.match(/[0-9]/)) strength++;
            if (password.match(/[^a-zA-Z0-9]/)) strength++;

            bar.className = "password-strength-bar";
            if (strength <= 1) { bar.classList.add("strength-weak"); hint.textContent = "Weak - Add more variety"; }
            else if (strength === 2) { bar.classList.add("strength-medium"); hint.textContent = "Medium - Could be stronger"; }
            else { bar.classList.add("strength-strong"); hint.textContent = "Strong password!"; }
        }

        // ==================== PASSWORD RECOVERY ====================
        async function handleRecovery(e) {
            e.preventDefault();
            const usernameInput = document.getElementById("recoveryUsername");
            if (!usernameInput) return;
            const username = usernameInput.value.trim().toLowerCase();

            try {
                const usernameDoc = await db.collection("usernameMappings").doc(username).get();
                if (!usernameDoc.exists) {
                    showToast("Username not found", "error");
                    return;
                }

                const accountDoc = await db.collection("accounts").doc(usernameDoc.data().uid).get();
                const email = accountDoc.exists ? accountDoc.data().email : null;

                if (!email) {
                    showToast("No recovery email linked to this account. Contact support.", "warning");
                    return;
                }

                const recoveryCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                await db.collection("accounts").doc(usernameDoc.data().uid).update({
                    recoveryCode: recoveryCode,
                    recoveryCodeExpiry: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 3600000))
                });

                showToast("Recovery instructions sent to your linked email!", "success");
                closeModal("recoveryModal");
            } catch (error) {
                showToast("Recovery failed: " + error.message, "error");
            }
        }

        // ==================== DELETE ACCOUNT ====================
        async function deleteAccount() {
            if (!confirm("WARNING: This will permanently delete your account and all data. This action cannot be undone. Are you sure?")) return;
            if (!confirm("FINAL WARNING: This is irreversible. Confirm deletion?")) return;

            if (!currentUser || !currentUsername) {
                showToast("Not signed in", "error");
                return;
            }

            try {
                await db.collection("usernameMappings").doc(currentUsername).delete();
                await db.collection("accounts").doc(currentUser.uid).delete();

                const savesSnapshot = await db.collection("vaultsave").doc(currentUsername).collection("saves").get();
                const batch = db.batch();
                savesSnapshot.forEach(function(doc) { batch.delete(doc.ref); });
                await batch.commit();
                await db.collection("vaultsave").doc(currentUsername).delete();

                localStorage.removeItem("ssiavc_username");
                localStorage.removeItem("ssiavc_pass_" + currentUsername);

                await auth.signOut();
                showToast("Account deleted successfully", "info");
            } catch (error) {
                showToast("Failed to delete account: " + error.message, "error");
            }
        }

        // ==================== SAVE MANAGEMENT ====================
        async function downloadSave(saveId) {
            if (!currentUsername) return;
            try {
                const doc = await db.collection("vaultsave").doc(currentUsername).collection("saves").doc(saveId).get();
                if (doc.exists) {
                    const data = doc.data();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "save_" + saveId + ".json";
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast("Save downloaded", "success");
                }
            } catch (error) {
                showToast("Download failed: " + error.message, "error");
            }
        }

        async function deleteSave(saveId) {
            if (!confirm("Delete this save? This cannot be undone.")) return;
            if (!currentUsername) return;
            try {
                await db.collection("vaultsave").doc(currentUsername).collection("saves").doc(saveId).delete();
                showToast("Save deleted", "success");
                loadUserData();
            } catch (error) {
                showToast("Delete failed: " + error.message, "error");
            }
        }