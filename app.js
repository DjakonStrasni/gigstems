// ==========================================================================
// GIGSTEMS WEB APP - CORE JAVASCRIPT LOGIC (VERZIJA 1.4.07)
// ==========================================================================

// Supabase konfiguracija baze podataka
const SUPABASE_URL = "https://yqmxwgikcqibbkpqstux.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbXh3Z2lrY3FpYmJrcHFzdHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNjEwNDksImV4cCI6MjEwMjczNzA0OX0.TVedwos2OOmvggCK-zyevtV6S2Vfdax9e9ygHhKr5nA";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Google API Key za očitavanje drajv linkova
let GOOGLE_API_KEY = "AIzaSyBiq4QbYuCtVyy9_-dJTCTcCtPfwZc-Gu8";

// Globalne Web Audio API promenljive
let audioCtx = null;
let audioBuffers = [];
let sourceNodes = [];
let gainNodes = [];
let trackNames = [];
let masterGainNode = null;
let isPlaying = false;
let startTime = 0;
let pauseOffset = 0;
let timerInterval = null;
let isMasterMuted = false;

// Držanje stanja uloga i bendova
let bands = [];
let activeBandId = "";
let expandedBandId = ""; // Prati koji je bend trenutno otvoren u sidebar stablu
let currentSongName = "";
let allSongs = [];
let currentUserProfile = null;
let currentTab = "bands"; // bands, stems, members, settings, newband, joinband

// Jezik
let currentLang = localStorage.getItem('gigstems_lang') || 'sr';
let isRegisterMode = false;

// DOM elementi
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const statusLabel = document.getElementById('statusLabel');
const songsList = document.getElementById('songsList');
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');

// ==========================================================================
// 0. POKRETANJE & INSTANT URL ČIŠĆENJE
// ==========================================================================
if (window.location.hash && window.location.hash.includes('access_token')) {
    setTimeout(() => {
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
    }, 600);
}

// ==========================================================================
// 1. AUDIO ENGINE (Web Audio API & Memory Cleaner)
// ==========================================================================
function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (!masterGainNode || masterGainNode.context !== audioCtx) {
        masterGainNode = audioCtx.createGain();
        const masterVolInput = document.getElementById('masterVolumeRange');
        masterGainNode.gain.value = isMasterMuted ? 0 : (masterVolInput ? parseFloat(masterVolInput.value) : 1.0);
        masterGainNode.connect(audioCtx.destination);
    }
}

// Gvozdeno čišćenje RAM-a i audio resursa
function cleanAudioEngine() {
    stopAudio();
    if (audioCtx) {
        try {
            audioCtx.close();
        } catch(e) {}
        audioCtx = null;
    }
    masterGainNode = null;
    audioBuffers = [];
    sourceNodes = [];
    gainNodes = [];
    trackNames = [];
    currentSongName = "";
    if (document.getElementById('tracksContainer')) {
        document.getElementById('tracksContainer').innerHTML = "";
    }
    if (statusLabel) {
        updateStatusText('statusInit');
    }
}

// ==========================================================================
// 2. AUTENTIFIKACIJA, OTP VERIFIKACIJA I PROFILI
// ==========================================================================
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        authContainer.style.display = "none";
        appContainer.style.display = "flex";
        loadUserProfile(session.user);
    } else {
        appContainer.style.display = "none";
        authContainer.style.display = "block";
        cleanAudioEngine();
    }
});

async function loadUserProfile(user) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (data) {
        currentUserProfile = data;
        document.getElementById('currentUserName').innerText = data.display_name || user.email;
        document.getElementById('currentUserName').title = user.email;
        
        // Postavi avatar sliku ili početno slovo
        const avatarCircle = document.getElementById('userAvatarCircle');
        if (data.avatar_url) {
            avatarCircle.innerHTML = `<img src="${data.avatar_url}" />`;
        } else {
            const firstLetter = (data.display_name || user.email).charAt(0).toUpperCase();
            avatarCircle.innerHTML = firstLetter;
        }

        // Popuni modal podešavanja
        document.getElementById('settingDisplayName').value = data.display_name || "";
        document.getElementById('settingEmail').value = user.email;

        loadUserBands();
    }
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    updateAuthUILang();
}

function updateAuthUILang() {
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const switchLink = document.getElementById('authSwitchLink');
    const displayNameGroup = document.getElementById('authDisplayNameGroup');

    if (isRegisterMode) {
        title.innerText = i18n[currentLang].authTitleRegister;
        submitBtn.innerText = i18n[currentLang].authBtnRegister;
        switchLink.innerText = i18n[currentLang].authSwitchToLogin;
        displayNameGroup.style.display = "flex";
    } else {
        title.innerText = i18n[currentLang].authTitleLogin;
        submitBtn.innerText = i18n[currentLang].authBtnLogin;
        switchLink.innerText = i18n[currentLang].authSwitchToRegister;
        displayNameGroup.style.display = "none";
    }
}

async function handleAuthSubmit() {
    const email = document.getElementById('authEmailInput').value.trim();
    const password = document.getElementById('authPasswordInput').value.trim();
    const displayName = document.getElementById('authDisplayNameInput').value.trim();

    if (!email || !password) {
        alert(currentLang === 'sr' ? "Popunite email i lozinku!" : "Please enter email and password!");
        return;
    }

    if (isRegisterMode) {
        // Registracija
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName || email.split('@')[0]
                }
            }
        });

        if (error) {
            alert(i18n[currentLang].authError.replace("{msg}", error.message));
        } else {
            // Otvori ekran za unos OTP verifikacionog koda
            showOTPEkran(email);
        }
    } else {
        // Prijava
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes('Email not confirmed')) {
                // Ako e-mail nije potvrđen, automatski ga šaljemo na OTP unos
                showOTPEkran(email);
            } else {
                alert(i18n[currentLang].authError.replace("{msg}", error.message));
            }
        }
    }
}

// Prikaz OTP prozora za unos koda unutar istog rama
function showOTPEkran(email) {
    const authWrapper = document.getElementById('authContainer');
    authWrapper.innerHTML = `
        <div class="auth-header-langs">
            <button class="lang-pill ${currentLang === 'sr' ? 'active' : ''}" onclick="setLanguage('sr')">SR</button>
            <button class="lang-pill ${currentLang === 'en' ? 'active' : ''}" onclick="setLanguage('en')">EN</button>
        </div>
        <h2 class="auth-title">${i18n[currentLang].otpTitle}</h2>
        <p style="font-size: 0.95em; color: var(--color-text-muted); text-align: center; margin-bottom: 20px;">
            ${i18n[currentLang].otpSentText} <br><strong>${email}</strong>
        </p>
        <div class="input-group" style="margin-bottom: 15px;">
            <label class="input-label">${i18n[currentLang].otpTitle}:</label>
            <input type="text" id="otpCodeInput" class="settings-input" placeholder="${i18n[currentLang].otpPlaceholder}" style="text-align: center; font-size: 1.3em; letter-spacing: 4px;">
        </div>
        <button class="btn-connect" style="width: 100%; margin-bottom: 15px;" onclick="handleOTPVerify('${email}')">${i18n[currentLang].otpBtnConfirm}</button>
        <div class="auth-switch-link" onclick="restoreAuthMainScreen()">${i18n[currentLang].otpBackToRegister}</div>
    `;
}

function restoreAuthMainScreen() {
    window.location.reload(); // Najbezbedniji način za resetovanje Auth stanja
}

async function handleOTPVerify(email) {
    const code = document.getElementById('otpCodeInput').value.trim();
    if (!code) {
        alert(currentLang === 'sr' ? "Unesite kod!" : "Please enter the code!");
        return;
    }

    const { data, error } = await supabaseClient.auth.verifyOtp({
        email,
        token: code,
        type: 'signup'
    });

    if (error) {
        alert(i18n[currentLang].authError.replace("{msg}", error.message));
    } else {
        window.location.reload();
    }
}

async function handleLogout() {
    cleanAudioEngine();
    closeProfileMenu();
    const { error } = await supabaseClient.auth.signOut();
}

// ==========================================================================
// 3. SPA NAVIGACIJA & SIDEBAR TREE MENU
// ==========================================================================
function switchTab(tabId, bandId = "") {
    currentTab = tabId;
    if (bandId) activeBandId = bandId;
    
    // Zatvori mobilni sidebar
    closeAllMobilePanels();

    const repCol = document.getElementById('repertoireColumn');
    const mainView = document.getElementById('mainContentView');

    // Podrazumevano sakrij sve poglede i resurse
    repCol.style.display = "none";
    mainView.innerHTML = "";

    // Obeleži aktivne stavke u sidebar-u
    document.querySelectorAll('.submenu-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.band-tree-header').forEach(el => el.classList.remove('active'));

    if (tabId === 'dashboard') {
        const band = bands.find(b => b.id === bandId);
        if (band) {
            expandedBandId = bandId;
            renderSidebarBands();
            document.getElementById(`bandHeader-${bandId}`).classList.add('active');
            renderDashboardUI(band);
        }
    } else if (tabId === 'stems') {
        const band = bands.find(b => b.id === bandId);
        if (band) {
            expandedBandId = bandId;
            renderSidebarBands();
            document.getElementById(`submenu-stems-${bandId}`).classList.add('active');
            repCol.style.display = "flex";
            renderMixerConsoleUI(band);
            loadSongsFromActiveBand();
        }
    } else if (tabId === 'members') {
        const band = bands.find(b => b.id === bandId);
        if (band) {
            expandedBandId = bandId;
            renderSidebarBands();
            document.getElementById(`submenu-members-${bandId}`).classList.add('active');
            renderMembersUI(band);
        }
    } else if (tabId === 'settings') {
        const band = bands.find(b => b.id === bandId);
        if (band) {
            expandedBandId = bandId;
            renderSidebarBands();
            document.getElementById(`submenu-settings-${bandId}`).classList.add('active');
            renderBandSettingsUI(band);
        }
    } else if (tabId === 'newband') {
        renderNewBandUI();
    } else if (tabId === 'joinband') {
        renderJoinBandUI();
    }
}

// ==========================================================================
// 4. KORISNIČKI PODACI & BEND INTEGRACIJA
// ==========================================================================
async function loadUserBands() {
    if (!currentUserProfile) return;

    const { data, error } = await supabaseClient
        .from('band_members')
        .select(`
            band_id,
            role,
            bands (
                id,
                name,
                folder_id,
                raw_url,
                join_code,
                logo_url,
                web_url,
                instagram_url,
                contact_info
            )
        `)
        .eq('user_id', currentUserProfile.id);

    if (data) {
        bands = data.map(item => ({
            ...item.bands,
            user_role: item.role
        }));
        renderSidebarBands();
    }
}

function renderSidebarBands() {
    const listContainer = document.getElementById('sidebarBandsList');
    listContainer.innerHTML = "";

    if (bands.length === 0) {
        listContainer.innerHTML = `<div style="padding: 10px; font-size: 0.9em; color: var(--color-text-muted); text-align: center;">${i18n[currentLang].noBands}</div>`;
        return;
    }

    bands.forEach(band => {
        const isExpanded = expandedBandId === band.id;
        const logoSrc = band.logo_url || "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=100&auto=format&fit=crop&q=60";

        const itemDiv = document.createElement('div');
        itemDiv.className = `band-tree-item ${isExpanded ? 'expanded' : ''}`;

        itemDiv.innerHTML = `
            <div class="band-tree-header" id="bandHeader-${band.id}" onclick="toggleBandTree('${band.id}')">
                <img class="band-tree-logo" src="${logoSrc}" alt="Logo">
                <span>${band.name}</span>
                <span class="band-tree-arrow">▲</span>
            </div>
            <div class="band-tree-submenu" id="bandSubmenu-${band.id}">
                <div class="submenu-item" id="submenu-stems-${band.id}" onclick="switchTab('stems', '${band.id}')">🎵 ${i18n[currentLang].bandOptionStems}</div>
                <div class="submenu-item" id="submenu-members-${band.id}" onclick="switchTab('members', '${band.id}')">👥 ${i18n[currentLang].bandOptionMembers}</div>
                <div class="submenu-item" id="submenu-settings-${band.id}" onclick="switchTab('settings', '${band.id}')">⚙️ ${i18n[currentLang].bandOptionSettings}</div>
            </div>
        `;
        listContainer.appendChild(itemDiv);
    });
}

function toggleBandTree(bandId) {
    if (expandedBandId === bandId) {
        expandedBandId = ""; // zatvori
    } else {
        expandedBandId = bandId;
    }
    renderSidebarBands();
    if (expandedBandId) {
        switchTab('dashboard', bandId);
    }
}

// Dugme "+" za suptilne opcije dodavanja
function toggleAddBandMenu() {
    const subContainer = document.getElementById('plusAddSubmenu');
    if (subContainer.style.display === 'flex') {
        subContainer.style.display = 'none';
    } else {
        subContainer.style.display = 'flex';
    }
}

// ==========================================================================
// 5. POGLEDI DESNOG PROZORA (DASHBOARD, MEMBERS, SETTINGS, NEW BAND, JOIN)
// ==========================================================================

// Dashboard tab
function renderDashboardUI(band) {
    const view = document.getElementById('mainContentView');
    const logoSrc = band.logo_url || "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=400&auto=format&fit=crop&q=60";
    
    view.innerHTML = `
        <div class="dashboard-wrapper">
            <div class="dashboard-card">
                <div class="dashboard-logo-section">
                    <img class="band-dashboard-logo" src="${logoSrc}">
                    <p style="font-size: 0.8em; color: var(--color-text-muted); text-align: center;">${band.name}</p>
                </div>
                <div class="dashboard-info-section">
                    <div>
                        <h2 class="dashboard-band-name">${band.name}</h2>
                        <span class="dashboard-role-badge">${band.user_role === 'admin' ? i18n[currentLang].roleAdmin : i18n[currentLang].roleUser}</span>
                        
                        <!-- Band Web / Social Info -->
                        <div style="margin-top: 10px; font-size: 0.95em; color: var(--color-text-muted); display: flex; flex-direction: column; gap: 6px;">
                            ${band.web_url ? `<span>🌐 Web: <a href="${band.web_url}" target="_blank" style="color: var(--color-primary-hover);">${band.web_url}</a></span>` : ''}
                            ${band.instagram_url ? `<span>📸 Instagram: <a href="${band.instagram_url}" target="_blank" style="color: var(--color-primary-hover);">${band.instagram_url}</a></span>` : ''}
                            ${band.contact_info ? `<span>📞 Kontakt: ${band.contact_info}</span>` : ''}
                        </div>
                    </div>
                    <div class="dashboard-actions-grid" style="margin-top: 25px;">
                        <button class="btn-dashboard-action" onclick="switchTab('stems', '${band.id}')">🎵 ${i18n[currentLang].bandOptionStems}</button>
                        <button class="btn-dashboard-action" onclick="switchTab('members', '${band.id}')">👥 ${i18n[currentLang].bandOptionMembers}</button>
                        <button class="btn-dashboard-action" onclick="switchTab('settings', '${band.id}')">⚙️ ${i18n[currentLang].bandOptionSettings}</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Members tab
async function renderMembersUI(band) {
    const view = document.getElementById('mainContentView');
    view.innerHTML = `<div class="right-panel-wrapper"><p>${i18n[currentLang].statusLoading}</p></div>`;

    const { data: members, error } = await supabaseClient
        .from('band_members')
        .select(`
            id,
            role,
            user_id,
            profiles (
                display_name,
                email,
                avatar_url
            )
        `)
        .eq('band_id', band.id);

    if (error) {
        view.innerHTML = `<div class="right-panel-wrapper"><p>Error: ${error.message}</p></div>`;
        return;
    }

    let tableRows = "";
    members.forEach(m => {
        const mProfile = m.profiles || {};
        const isSelf = m.user_id === currentUserProfile.id;
        const mAvatar = mProfile.avatar_url || "";
        const avatarHTML = mAvatar ? `<img src="${mAvatar}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; vertical-align:middle; margin-right:8px;" />` : `<span style="display:inline-block; width:30px; height:30px; border-radius:50%; background:#8b5cf6; color:white; text-align:center; line-height:30px; font-size:12px; margin-right:8px;">${(mProfile.display_name || "M").charAt(0).toUpperCase()}</span>`;

        let actionButton = "";
        if (band.user_role === 'admin' && !isSelf) {
            actionButton = `<button class="btn-danger-small" onclick="kickBandMember('${band.id}', '${m.user_id}', '${mProfile.display_name || mProfile.email}')">${i18n[currentLang].memberActionKick}</button>`;
        } else if (isSelf) {
            actionButton = `<span style="font-style:italic; color: var(--color-text-muted);">Vi</span>`;
        }

        tableRows += `
            <tr>
                <td>${avatarHTML} ${mProfile.display_name || 'Muzičar'}</td>
                <td>${mProfile.email || '-'}</td>
                <td><span class="dashboard-role-badge" style="margin-bottom:0;">${m.role === 'admin' ? i18n[currentLang].roleAdmin : i18n[currentLang].roleUser}</span></td>
                <td>${actionButton}</td>
            </tr>
        `;
    });

    view.innerHTML = `
        <div class="right-panel-wrapper">
            <h2 class="right-panel-title">👥 ${i18n[currentLang].bandMembersTitle}</h2>
            <table class="member-list-table">
                <thead>
                    <tr>
                        <th>Ime</th>
                        <th>Email</th>
                        <th>Uloga</th>
                        <th>Akcija</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            
            <div style="margin-top: 30px; display: flex; justify-content: flex-end;">
                <button class="btn-control" style="background-color: var(--color-danger); color: white;" onclick="leaveBand('${band.id}')">${i18n[currentLang].memberActionLeave}</button>
            </div>
        </div>
    `;
}

// Kickout
async function kickBandMember(bandId, userId, displayName) {
    if (!confirm(i18n[currentLang].memberActionKickConfirm.replace('{name}', displayName))) return;

    const { error } = await supabaseClient
        .from('band_members')
        .delete()
        .eq('band_id', bandId)
        .eq('user_id', userId);

    if (error) {
        alert(error.message);
    } else {
        const band = bands.find(b => b.id === bandId);
        renderMembersUI(band);
    }
}

// Napuštanje benda
async function leaveBand(bandId) {
    const band = bands.find(b => b.id === bandId);
    if (!band) return;

    // Proveri da li je jedini preostali admin
    const { data: admins } = await supabaseClient
        .from('band_members')
        .select('user_id')
        .eq('band_id', bandId)
        .eq('role', 'admin');

    if (admins && admins.length === 1 && admins[0].user_id === currentUserProfile.id) {
        alert(i18n[currentLang].memberLastAdminAlert);
        return;
    }

    if (!confirm(i18n[currentLang].memberActionLeaveConfirm)) return;

    const { error } = await supabaseClient
        .from('band_members')
        .delete()
        .eq('band_id', bandId)
        .eq('user_id', currentUserProfile.id);

    if (error) {
        alert(error.message);
    } else {
        // Osveži listu i vrati se na početnu
        await loadUserBands();
        expandedBandId = "";
        renderSidebarBands();
        const mainView = document.getElementById('mainContentView');
        mainView.innerHTML = `<div class="right-panel-wrapper"><p>${i18n[currentLang].noActiveBand}</p></div>`;
    }
}

// Band Settings tab
function renderBandSettingsUI(band) {
    const view = document.getElementById('mainContentView');
    const isAdmin = band.user_role === 'admin';
    const logoSrc = band.logo_url || "";

    view.innerHTML = `
        <div class="right-panel-wrapper">
            <h2 class="right-panel-title">⚙️ ${band.name} - ${i18n[currentLang].bandOptionSettings}</h2>
            
            <div class="input-group">
                <label class="input-label">${i18n[currentLang].bandNameLabel}</label>
                <input type="text" id="editBandName" class="settings-input" value="${band.name}" ${!isAdmin ? 'disabled' : ''}>
            </div>

            <div class="input-group" style="margin-top: 15px;">
                <label class="input-label">${i18n[currentLang].bandUrlLabel}</label>
                <input type="text" id="editBandUrl" class="settings-input" value="${band.raw_url || ''}" ${!isAdmin ? 'disabled' : ''}>
            </div>

            <div class="input-group" style="margin-top: 15px;">
                <label class="input-label">${i18n[currentLang].bandWebLabel}</label>
                <input type="text" id="editBandWebUrl" class="settings-input" placeholder="https://tvojbend.com" value="${band.web_url || ''}" ${!isAdmin ? 'disabled' : ''}>
            </div>

            <div class="input-group" style="margin-top: 15px;">
                <label class="input-label">${i18n[currentLang].bandInstagramLabel}</label>
                <input type="text" id="editBandInstagram" class="settings-input" placeholder="https://instagram.com/tvojbend" value="${band.instagram_url || ''}" ${!isAdmin ? 'disabled' : ''}>
            </div>

            <div class="input-group" style="margin-top: 15px;">
                <label class="input-label">${i18n[currentLang].bandContactLabel}</label>
                <input type="text" id="editBandContact" class="settings-input" placeholder="Telefon ili email menadžera" value="${band.contact_info || ''}" ${!isAdmin ? 'disabled' : ''}>
            </div>

            <div class="input-group" style="margin-top: 15px;">
                <label class="input-label">${i18n[currentLang].bandLogoLabel}</label>
                <div style="display:flex; align-items:center; gap: 20px;">
                    <img id="bandSettingsLogoPreview" src="${logoSrc || 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=100&auto=format&fit=crop&q=60'}" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover;">
                    ${isAdmin ? `
                        <input type="file" id="bandLogoFileInput" style="display:none;" onchange="uploadBandLogo(event, '${band.id}')">
                        <button class="btn-control" onclick="document.getElementById('bandLogoFileInput').click()">Izaberi sliku</button>
                    ` : ''}
                </div>
            </div>

            <div class="input-group" style="margin-top: 25px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                <label class="input-label">${i18n[currentLang].bandCodeTitle}</label>
                <div style="display:flex; align-items:center; gap:15px;">
                    <span style="font-size:1.4em; font-family:monospace; color:var(--color-primary-hover); letter-spacing:2px;">${band.join_code}</span>
                    ${isAdmin ? `<button class="btn-control" onclick="regenerateBandJoinCode('${band.id}')">${i18n[currentLang].bandRegenCodeBtn}</button>` : ''}
                </div>
            </div>

            ${isAdmin ? `
                <div style="margin-top: 30px; display:flex; justify-content: space-between; gap: 15px;">
                    <button class="btn-control" style="background-color: var(--color-danger); color: white;" onclick="deleteBand('${band.id}', '${band.name}')">${i18n[currentLang].deleteBandBtnText.replace('{name}', band.name)}</button>
                    <button class="btn-connect" onclick="saveBandSettings('${band.id}')">${i18n[currentLang].renameBtn}</button>
                </div>
            ` : ''}
        </div>
    `;
}

// Čuvanje izmena benda
async function saveBandSettings(bandId) {
    const name = document.getElementById('editBandName').value.trim();
    const rawUrl = document.getElementById('editBandUrl').value.trim();
    const webUrl = document.getElementById('editBandWebUrl').value.trim();
    const instagramUrl = document.getElementById('editBandInstagram').value.trim();
    const contactInfo = document.getElementById('editBandContact').value.trim();

    if (!name || !rawUrl) {
        alert(currentLang === 'sr' ? "Ime i Google Drive link su obavezni!" : "Name and Drive link are required!");
        return;
    }

    const folderId = extractFolderId(rawUrl);

    const { error } = await supabaseClient
        .from('bands')
        .update({
            name,
            raw_url: rawUrl,
            folder_id: folderId,
            web_url: webUrl,
            instagram_url: instagramUrl,
            contact_info: contactInfo
        })
        .eq('id', bandId);

    if (error) {
        alert(error.message);
    } else {
        alert(i18n[currentLang].saveSuccess);
        await loadUserBands();
        renderSidebarBands();
        const band = bands.find(b => b.id === bandId);
        renderBandSettingsUI(band);
    }
}

// Upload logotipa benda
function uploadBandLogo(event, bandId) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result;
        
        const { error } = await supabaseClient
            .from('bands')
            .update({ logo_url: base64Data })
            .eq('id', bandId);

        if (error) {
            alert(error.message);
        } else {
            document.getElementById('bandSettingsLogoPreview').src = base64Data;
            await loadUserBands();
            renderSidebarBands();
        }
    };
    reader.readAsDataURL(file);
}

// Regenerisanje koda benda
async function regenerateBandJoinCode(bandId) {
    const newCode = 'GIG-' + Math.floor(100 + Math.random() * 900);
    const { error } = await supabaseClient
        .from('bands')
        .update({ join_code: newCode })
        .eq('id', bandId);

    if (error) {
        alert(error.message);
    } else {
        await loadUserBands();
        const band = bands.find(b => b.id === bandId);
        renderBandSettingsUI(band);
    }
}

// Brisnje benda
async function deleteBand(bandId, bandName) {
    if (!confirm(i18n[currentLang].deleteBandConfirm)) return;

    const { error } = await supabaseClient
        .from('bands')
        .delete()
        .eq('id', bandId);

    if (error) {
        alert(error.message);
    } else {
        await loadUserBands();
        expandedBandId = "";
        renderSidebarBands();
        cleanAudioEngine();
        document.getElementById('mainContentView').innerHTML = `<div class="right-panel-wrapper"><p>${i18n[currentLang].noActiveBand}</p></div>`;
    }
}

// Novi bend tab
function renderNewBandUI() {
    const view = document.getElementById('mainContentView');
    view.innerHTML = `
        <div class="right-panel-wrapper">
            <h2 class="right-panel-title">➕ ${i18n[currentLang].addSectionTitle}</h2>
            
            <div class="input-group">
                <label class="input-label">${i18n[currentLang].bandNameLabel}</label>
                <input type="text" id="newBandName" class="settings-input" placeholder="Npr. Fankomatics">
            </div>

            <div class="input-group" style="margin-top: 15px;">
                <label class="input-label">${i18n[currentLang].bandUrlLabel}</label>
                <input type="text" id="newBandUrl" class="settings-input" placeholder="https://drive.google.com/drive/folders/...">
            </div>

            <div class="input-group" style="margin-top: 15px;">
                <label class="input-label">${i18n[currentLang].bandWebLabel}</label>
                <input type="text" id="newBandWeb" class="settings-input" placeholder="Opciono">
            </div>

            <div class="input-group" style="margin-top: 15px;">
                <label class="input-label">${i18n[currentLang].bandInstagramLabel}</label>
                <input type="text" id="newBandInstagram" class="settings-input" placeholder="Opciono">
            </div>

            <div class="input-group" style="margin-top: 15px;">
                <label class="input-label">${i18n[currentLang].bandContactLabel}</label>
                <input type="text" id="newBandContact" class="settings-input" placeholder="Opciono">
            </div>

            <button class="btn-connect" style="margin-top: 25px; width:100%;" onclick="addNewBandSubmit()">${i18n[currentLang].connectBtn}</button>
        </div>
    `;
}

// Osnivanje benda
async function addNewBandSubmit() {
    if (!currentUserProfile) return;

    const name = document.getElementById('newBandName').value.trim();
    const rawUrl = document.getElementById('newBandUrl').value.trim();
    const webUrl = document.getElementById('newBandWeb').value.trim();
    const instagramUrl = document.getElementById('newBandInstagram').value.trim();
    const contactInfo = document.getElementById('newBandContact').value.trim();

    if (!name || !rawUrl) {
        alert(currentLang === 'sr' ? "Ime i Google Drive link su obavezni!" : "Name and Drive link are required!");
        return;
    }

    const folderId = extractFolderId(rawUrl);
    const joinCode = 'GIG-' + Math.floor(100 + Math.random() * 900);

    const { data: bandData, error: bandError } = await supabaseClient
        .from('bands')
        .insert({
            name,
            folder_id: folderId,
            raw_url: rawUrl,
            join_code: joinCode,
            web_url: webUrl,
            instagram_url: instagramUrl,
            contact_info: contactInfo
        })
        .select()
        .single();

    if (bandError) {
        alert(bandError.message);
        return;
    }

    // Dodaj sebe kao admina
    const { error: memberError } = await supabaseClient
        .from('band_members')
        .insert({
            band_id: bandData.id,
            user_id: currentUserProfile.id,
            role: 'admin'
        });

    if (memberError) {
        alert(memberError.message);
    } else {
        await loadUserBands();
        expandedBandId = bandData.id;
        renderSidebarBands();
        switchTab('dashboard', bandData.id);
    }
}

// Pridruži se bendu tab
function renderJoinBandUI() {
    const view = document.getElementById('mainContentView');
    view.innerHTML = `
        <div class="right-panel-wrapper">
            <h2 class="right-panel-title">🔑 ${i18n[currentLang].joinBandTitle}</h2>
            
            <div class="input-group">
                <label class="input-label">${i18n[currentLang].joinCodeLabel}</label>
                <input type="text" id="joinCodeInput" class="settings-input" placeholder="${i18n[currentLang].joinCodePlaceholder}" style="text-align: center; letter-spacing: 2px;">
            </div>

            <button class="btn-connect" style="margin-top: 25px; width: 100%;" onclick="submitJoinCode()">${i18n[currentLang].joinBandSubmitBtn}</button>
        </div>
    `;
}

// Pridruži se bendu submit
async function submitJoinCode() {
    if (!currentUserProfile) return;

    const code = document.getElementById('joinCodeInput').value.trim();
    if (!code) {
        alert(currentLang === 'sr' ? "Unesite kod!" : "Please enter the code!");
        return;
    }

    // Pronađi bend sa ovim kodom
    const { data: bandData, error: bandError } = await supabaseClient
        .from('bands')
        .select('*')
        .eq('join_code', code)
        .single();

    if (bandError || !bandData) {
        alert(currentLang === 'sr' ? "Nevažeći kod benda!" : "Invalid band access code!");
        return;
    }

    // Proveri da li je već član
    const { data: isMember } = await supabaseClient
        .from('band_members')
        .select('*')
        .eq('band_id', bandData.id)
        .eq('user_id', currentUserProfile.id);

    if (isMember && isMember.length > 0) {
        alert(currentLang === 'sr' ? "Već ste član ovog benda!" : "You are already a member of this band!");
        return;
    }

    // Učlani ga
    const { error: joinError } = await supabaseClient
        .from('band_members')
        .insert({
            band_id: bandData.id,
            user_id: currentUserProfile.id,
            role: 'member'
        });

    if (joinError) {
        alert(joinError.message);
    } else {
        alert(i18n[currentLang].joinCodeSuccess);
        await loadUserBands();
        expandedBandId = bandData.id;
        renderSidebarBands();
        switchTab('dashboard', bandData.id);
    }
}

// ==========================================================================
// 6. STEAM PLAYING & MIXER CONSOLE VIEW
// ==========================================================================
function renderMixerConsoleUI(band) {
    const view = document.getElementById('mainContentView');
    view.innerHTML = `
        <!-- Zaglavlje Miksete -->
        <div class="mixer-header">
            <div class="song-info-badge">
                <span id="activeSongName" class="active-song-title">${i18n[currentLang].statusInit}</span>
                <span id="activeBandNameLabel" class="active-song-meta">${band.name}</span>
            </div>

            <div class="mixer-master-controls">
                <!-- Vreme -->
                <span id="timeDisplay" class="time-counter">00:00</span>
                
                <!-- Play i Stop dugmad sa integrisanim stanjem -->
                <button id="playBtn" class="btn-control" onclick="togglePlayPause()" disabled>
                    <span>▶ ${i18n[currentLang].playBtn}</span>
                </button>
                <button id="stopBtn" class="btn-control" onclick="stopAudio()" disabled>
                    <span>◼ ${i18n[currentLang].stopBtn}</span>
                </button>

                <!-- Master Jačina -->
                <div class="master-vol-container">
                    <span id="masterVolLabel" style="font-size:0.8em; color:var(--color-text-muted);">${i18n[currentLang].masterVolLabel}</span>
                    <input type="range" id="masterVolumeRange" class="master-vol-slider" min="0" max="1" step="0.01" value="0.8" oninput="changeMasterVolume(this.value)">
                    <button id="masterMuteBtn" class="btn-danger-small" style="padding: 6px 10px;" onclick="toggleMasterMute()">${i18n[currentLang].masterMuteBtn}</button>
                </div>
            </div>
        </div>

        <!-- Mikser Ploča -->
        <div class="mixer-board-wrapper">
            <p class="drag-drop-hint">${i18n[currentLang].dragDropTip}</p>
            <div id="tracksContainer" class="tracks-container">
                <!-- Kanali se dinamički crtaju levo-desno -->
            </div>
            
            <p id="statusLabel" style="text-align:center; font-size:0.9em; color:var(--color-text-muted); margin-top:15px;">
                ${i18n[currentLang].statusInit}
            </p>
        </div>
    `;
}

// ==========================================================================
// 7. GOOGLE DRIVE MUSIC LOADER
// ==========================================================================
function extractFolderId(url) {
    const reg = /folders\/([a-zA-Z0-9-_]+)/;
    const match = url.match(reg);
    return match ? match[1] : url;
}

async function loadSongsFromActiveBand() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band || !band.folder_id) return;

    if (!GOOGLE_API_KEY) {
        statusLabel.innerText = i18n[currentLang].apiKeyWarning;
        return;
    }

    updateStatusText('statusConnecting');
    
    // Čitamo pesme sa Drive-a
    const url = `https://www.googleapis.com/drive/v3/files?q='${band.folder_id}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&key=${GOOGLE_API_KEY}`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.files && data.files.length > 0) {
            allSongs = data.files.sort((a,b) => a.name.localeCompare(b.name));
            renderSongsUI();
        } else {
            songsList.innerHTML = `<p style="padding:15px; color:var(--color-text-muted); font-size:0.9em;">${i18n[currentLang].noSongs}</p>`;
            updateStatusText('statusNoFiles');
        }
    } catch(e) {
        updateStatusText('statusConnError');
    }
}

function renderSongsUI() {
    songsList.innerHTML = "";
    allSongs.forEach(song => {
        const songDiv = document.createElement('div');
        songDiv.className = "song-item";
        songDiv.id = `songItem-${song.id}`;
        songDiv.onclick = () => selectSongToPlay(song.id, song.name);
        songDiv.innerHTML = `
            <span class="song-name">${song.name}</span>
        `;
        songsList.appendChild(songDiv);
    });
}

// Učitavanje i sinhronizacija izabrane pesme
async function selectSongToPlay(songId, songName) {
    cleanAudioEngine(); // GVOZDENO ČIŠĆENJE pre uvoza nove pesme!
    
    document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));
    const item = document.getElementById(`songItem-${songId}`);
    if (item) item.classList.add('active');

    const activeTitleLabel = document.getElementById('activeSongName');
    if (activeTitleLabel) activeTitleLabel.innerText = songName;

    currentSongName = songName;
    updateStatusText('statusLoading');

    // Učitaj audio fajlove iz tog foldera pesme
    const url = `https://www.googleapis.com/drive/v3/files?q='${songId}'+in+parents+and+trashed=false&key=${GOOGLE_API_KEY}`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        const audioFiles = (data.files || []).filter(f => 
            f.name.endsWith('.mp3') || f.name.endsWith('.wav') || f.name.endsWith('.m4a')
        ).sort((a,b) => a.name.localeCompare(b.name));

        if (audioFiles.length === 0) {
            updateStatusText('statusNoFiles');
            return;
        }

        initAudioContext(); // Inicijalizuj čist audio kontekst i master fader!

        audioBuffers = [];
        trackNames = [];
        gainNodes = [];

        // Preuzimanje i dekodiranje traka u radnu memoriju
        for (let i = 0; i < audioFiles.length; i++) {
            const file = audioFiles[i];
            const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/^\d+[\s_-]*/, "");
            
            updateStatusText('statusDecoding');
            statusLabel.innerText += `: ${cleanName} (${i+1}/${audioFiles.length})`;

            const trackUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GOOGLE_API_KEY}`;
            const fileRes = await fetch(trackUrl);
            const arrayBuf = await fileRes.arrayBuffer();
            const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
            
            audioBuffers.push(audioBuf);
            trackNames.push(cleanName);
        }

        buildUI();
        
        document.getElementById('playBtn').removeAttribute('disabled');
        document.getElementById('stopBtn').removeAttribute('disabled');
        updateStatusText('statusReady', audioFiles.length);

    } catch(e) {
        updateStatusText('statusError');
        console.error(e);
    }
}

// Isctravanje horizontalne miksete (sa drag-and-drop podrškom!)
function buildUI() {
    const tracksContainer = document.getElementById('tracksContainer');
    if (!tracksContainer) return;
    
    tracksContainer.innerHTML = '';
    gainNodes = []; // Resetujemo individualne gain nodove

    trackNames.forEach((name, index) => {
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 1.0;
        gainNodes.push(gainNode);

        const card = document.createElement('div');
        card.className = 'track-card';
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-index', index);
        card.id = `trackCard-${index}`;

        // Eventovi za Drag and Drop
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);

        card.innerHTML = `
            <div class="track-title">${name}</div>
            <div class="slider-container">
                <input type="range" class="volume-slider" min="0" max="1.5" step="0.01" value="1.0" data-index="${index}" oninput="changeTrackVolume(${index}, this.value)">
            </div>
            <div class="channel-actions">
                <button class="btn-mute" id="muteBtn-${index}" onclick="toggleMute(${index})">MUTE</button>
                <button class="btn-solo" id="soloBtn-${index}" onclick="toggleSolo(${index})">SOLO</button>
            </div>
        `;

        tracksContainer.appendChild(card);
    });
}

// Drag & Drop ređanje kanala
let draggedIndex = null;

function handleDragStart(e) {
    draggedIndex = parseInt(this.getAttribute('data-index'));
    this.classList.add('dragged');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    return false;
}

function handleDragEnd() {
    this.classList.remove('dragged');
}

function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    const targetIndex = parseInt(this.getAttribute('data-index'));
    
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
        // Swap nazive
        const tempName = trackNames[draggedIndex];
        trackNames[draggedIndex] = trackNames[targetIndex];
        trackNames[targetIndex] = tempName;

        // Swap audio bafere
        const tempBuffer = audioBuffers[draggedIndex];
        audioBuffers[draggedIndex] = audioBuffers[targetIndex];
        audioBuffers[targetIndex] = tempBuffer;
        
        // Ponovo iscrtaj UI sa novim poretkom
        buildUI();
        
        // Ako svira, neprekidno prespoj
        if (isPlaying) {
            const currentOffset = pauseOffset + (audioCtx.currentTime - startTime);
            stopSourceNodes();
            startSourceNodes(currentOffset);
        }
    }
}

// ==========================================================================
// 8. AUDIO CONTROLS & EVENT HANDLERS
// ==========================================================================
function togglePlayPause() {
    initAudioContext();

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const pBtn = document.getElementById('playBtn');

    if (isPlaying) {
        // Pauziraj
        pauseOffset += audioCtx.currentTime - startTime;
        stopSourceNodes();
        isPlaying = false;
        pBtn.querySelector('span').innerText = "▶ " + i18n[currentLang].playBtn;
        pBtn.classList.remove('btn-play-active');
        clearInterval(timerInterval);
    } else {
        // Pokreni reprodukciju
        startSourceNodes(pauseOffset);
        startTime = audioCtx.currentTime;
        isPlaying = true;
        pBtn.querySelector('span').innerText = "⏸ " + i18n[currentLang].pauseBtn;
        pBtn.classList.add('btn-play-active');
        timerInterval = setInterval(updateTimer, 250);
    }
}

function startSourceNodes(offset = 0) {
    sourceNodes = [];
    audioBuffers.forEach((buffer, index) => {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        
        // Poveži source na individualni gain, pa na master, pa na zvučnike!
        source.connect(gainNodes[index]);
        gainNodes[index].connect(masterGainNode);
        
        const duration = buffer.duration;
        if (offset < duration) {
            source.start(0, offset % duration);
        }
        sourceNodes.push(source);
    });
}

function stopSourceNodes() {
    sourceNodes.forEach(node => {
        try { node.stop(); } catch(e) {}
    });
    sourceNodes = [];
}

function stopAudio() {
    stopSourceNodes();
    isPlaying = false;
    pauseOffset = 0;
    
    const pBtn = document.getElementById('playBtn');
    if (pBtn) {
        pBtn.querySelector('span').innerText = "▶ " + i18n[currentLang].playBtn;
        pBtn.classList.remove('btn-play-active');
    }
    
    const tDisp = document.getElementById('timeDisplay');
    if (tDisp) tDisp.innerText = "00:00";
    
    clearInterval(timerInterval);
}

function updateTimer() {
    if (!isPlaying) return;
    const current = pauseOffset + (audioCtx.currentTime - startTime);
    const mins = Math.floor(current / 60).toString().padStart(2, '0');
    const secs = Math.floor(current % 60).toString().padStart(2, '0');
    const tDisp = document.getElementById('timeDisplay');
    if (tDisp) tDisp.innerText = `${mins}:${secs}`;
}

// Individualni Volume fader
function changeTrackVolume(index, val) {
    if (gainNodes[index]) {
        gainNodes[index].gain.value = parseFloat(val);
        // Isključi MUTE ako je bio uključen i jačina se pomeri
        const muteBtn = document.getElementById(`muteBtn-${index}`);
        if (muteBtn && muteBtn.classList.contains('active')) {
            muteBtn.classList.remove('active');
        }
    }
}

// MUTE dugme
function toggleMute(index) {
    const btn = document.getElementById(`muteBtn-${index}`);
    const slider = document.querySelector(`.volume-slider[data-index="${index}"]`);
    
    if (btn.classList.toggle('active')) {
        gainNodes[index].gain.value = 0;
    } else {
        gainNodes[index].gain.value = parseFloat(slider.value);
    }
}

// SOLO dugme
function toggleSolo(index) {
    const btn = document.getElementById(`soloBtn-${index}`);
    const isSoloActive = btn.classList.toggle('active');

    if (isSoloActive) {
        // Isključi solo sa svih drugih
        document.querySelectorAll('.btn-solo').forEach((b, i) => {
            if (i !== index) b.classList.remove('active');
        });
        
        // Utišaj sve osim izabranog
        gainNodes.forEach((gn, i) => {
            if (i !== index) {
                gn.gain.value = 0;
            } else {
                const sliderVal = document.querySelector(`.volume-slider[data-index="${i}"]`).value;
                gn.gain.value = parseFloat(sliderVal);
            }
        });
    } else {
        // Vrati sve jačine na vrednosti klizača
        gainNodes.forEach((gn, i) => {
            const sliderVal = document.querySelector(`.volume-slider[data-index="${i}"]`).value;
            const isMuted = document.getElementById(`muteBtn-${i}`).classList.contains('active');
            gn.gain.value = isMuted ? 0 : parseFloat(sliderVal);
        });
    }
}

// Master Volume
function changeMasterVolume(val) {
    initAudioContext();
    if (!isMasterMuted) {
        masterGainNode.gain.value = parseFloat(val);
    }
}

function toggleMasterMute() {
    initAudioContext();
    const btn = document.getElementById('masterMuteBtn');
    isMasterMuted = !isMasterMuted;

    if (isMasterMuted) {
        masterGainNode.gain.value = 0;
        btn.classList.add('active');
        btn.style.backgroundColor = "var(--color-danger)";
    } else {
        const sliderVal = document.getElementById('masterVolumeRange').value;
        masterGainNode.gain.value = parseFloat(sliderVal);
        btn.classList.remove('active');
        btn.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
    }
}

// ==========================================================================
// 9. SETTINGS MODAL & REGIONAL OPTIONS (Custom timezones / formats)
// ==========================================================================
function openSettingsModal() {
    closeProfileMenu();
    document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

function switchSettingsTab(tabName) {
    document.querySelectorAll('.modal-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(content => content.classList.remove('active'));

    document.getElementById(`tabBtn${tabName}`).classList.add('active');
    document.getElementById(`settingsTab${tabName}`).classList.add('active');
}

// Custom Timezone i Date Format detekcija
function checkCustomTimezone(val) {
    const customDiv = document.getElementById('customTimezoneGroup');
    if (val === 'custom') {
        customDiv.style.display = 'flex';
    } else {
        customDiv.style.display = 'none';
    }
}

function checkCustomDateFormat(val) {
    const customDiv = document.getElementById('customDateFormatGroup');
    if (val === 'custom') {
        customDiv.style.display = 'flex';
    } else {
        customDiv.style.display = 'none';
    }
}

// Profilna izmena i Base64 slika
async function saveUserProfileSettings() {
    if (!currentUserProfile) return;
    const name = document.getElementById('settingDisplayName').value.trim();
    if (!name) return;

    const { error } = await supabaseClient
        .from('profiles')
        .update({ display_name: name })
        .eq('id', currentUserProfile.id);

    if (error) {
        alert(error.message);
    } else {
        alert(i18n[currentLang].saveSuccess);
        loadUserProfile(supabaseClient.auth.user() || currentUserProfile);
    }
}

function uploadUserAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result;
        
        const { error } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: base64Data })
            .eq('id', currentUserProfile.id);

        if (error) {
            alert(error.message);
        } else {
            document.getElementById('settingAvatarPreview').src = base64Data;
            loadUserProfile({ id: currentUserProfile.id, email: document.getElementById('settingEmail').value });
        }
    };
    reader.readAsDataURL(file);
}

// Promena šifre
async function changeUserPassword() {
    const newPass = document.getElementById('settingNewPassword').value;
    if (!newPass || newPass.length < 6) {
        alert(currentLang === 'sr' ? "Šifra mora imati najmanje 6 karaktera!" : "Password must be at least 6 characters!");
        return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password: newPass });

    if (error) {
        alert(error.message);
    } else {
        alert(i18n[currentLang].saveSuccess);
        document.getElementById('settingNewPassword').value = "";
    }
}

// Brisanje naloga
async function deleteUserAccount() {
    if (!confirm(i18n[currentLang].accountDeleteConfirm)) return;
    
    // U realnom sistemu poziva se edge funkcija za brisanje, ovde čistimo podatke korisnika
    const { error } = await supabaseClient.from('profiles').delete().eq('id', currentUserProfile.id);
    if (error) {
        alert(error.message);
    } else {
        await supabaseClient.auth.signOut();
        window.location.reload();
    }
}

// ==========================================================================
// 10. MULTILANGUAGE ENGINE
// ==========================================================================
function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('gigstems_lang', lang);

    // Obeleži aktivne pilule na jeziku
    document.querySelectorAll('.lang-pill').forEach(btn => {
        if (btn.innerText.toLowerCase() === lang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Ako smo na ekranu za prijavu
    if (authContainer && authContainer.style.display !== "none") {
        updateAuthUILang();
        const emailLabel = document.getElementById('authEmailLabel');
        const passLabel = document.getElementById('authPasswordLabel');
        const dNameLabel = document.getElementById('authDisplayNameLabel');
        
        if (emailLabel) emailLabel.innerText = i18n[lang].authEmail;
        if (passLabel) passLabel.innerText = i18n[lang].authPassword;
        if (dNameLabel) dNameLabel.innerText = i18n[lang].authDisplayName;
        return;
    }

    // Prevodi modalnog prozora podešavanja
    const modalTitle = document.getElementById('modalSettingsTitle');
    if (modalTitle) modalTitle.innerText = i18n[lang].settingsTitle;
    
    const tabRegional = document.getElementById('tabBtnRegional');
    const tabProfile = document.getElementById('tabBtnProfile');
    const tabPassword = document.getElementById('tabBtnPassword');
    const tabAccount = document.getElementById('tabBtnAccount');
    if (tabRegional) tabRegional.innerText = i18n[lang].settingTabApp;
    if (tabProfile) tabProfile.innerText = i18n[lang].settingTabProfile;
    if (tabPassword) tabPassword.innerText = i18n[lang].settingTabPassword;
    if (tabAccount) tabAccount.innerText = i18n[lang].settingTabAccount;

    // Prevodi unutar Aplikacija taba
    const timeLabel = document.getElementById('timeFormatLabel');
    const dateLabel = document.getElementById('dateFormatLabel');
    const tzLabel = document.getElementById('timezoneLabel');
    const tempLabel = document.getElementById('tempUnitLabel');
    if (timeLabel) timeLabel.innerText = i18n[lang].timeFormatLabel;
    if (dateLabel) dateLabel.innerText = i18n[lang].dateFormatLabel;
    if (tzLabel) tzLabel.innerText = i18n[lang].timezoneLabel;
    if (tempLabel) tempLabel.innerText = i18n[lang].tempUnitLabel;

    // Prevodi unutar Profil taba
    const profEmailL = document.getElementById('profileEmailLabel');
    const profNameL = document.getElementById('profileNameLabel');
    const profAvL = document.getElementById('profileAvatarLabel');
    const profSavB = document.getElementById('profileSaveBtn');
    if (profEmailL) profEmailL.innerText = i18n[lang].profileEmailLabel;
    if (profNameL) profNameL.innerText = i18n[lang].profileNameLabel;
    if (profAvL) profAvL.innerText = i18n[lang].profileAvatarLabel;
    if (profSavB) profSavB.innerText = i18n[lang].profileSaveBtn;

    // Lozinka i Nalog
    const pNewL = document.getElementById('passwordNewLabel');
    const pSavB = document.getElementById('passwordSaveBtn');
    if (pNewL) pNewL.innerText = i18n[lang].passwordNewLabel;
    if (pSavB) pSavB.innerText = i18n[lang].passwordSaveBtn;

    const accTitle = document.getElementById('accountDangerTitle');
    const accText = document.getElementById('accountDangerText');
    const accDelB = document.getElementById('accountDeleteBtn');
    if (accTitle) accTitle.innerText = i18n[lang].accountDangerTitle;
    if (accText) accText.innerText = i18n[lang].accountDangerText;
    if (accDelB) accDelB.innerText = i18n[lang].accountDeleteBtn;

    // Sidebar naslov i opcije dodavanja
    const sidebarHeader = document.getElementById('sidebarBandsHeader');
    if (sidebarHeader) sidebarHeader.innerText = i18n[lang].navBands;
    
    const optNew = document.getElementById('optNewBandSidebar');
    const optJoin = document.getElementById('optJoinBandSidebar');
    if (optNew) optNew.innerText = i18n[lang].sidebarNewBandOption;
    if (optJoin) optJoin.innerText = i18n[lang].sidebarJoinBandOption;

    // Repertoar spisak naslov i pretraga
    const songsTitle = document.getElementById('songsTitle');
    const searchInput = document.getElementById('searchInput');
    if (songsTitle) songsTitle.innerText = i18n[lang].songsTitle;
    if (searchInput) searchInput.placeholder = i18n[lang].searchPlaceholder;

    // Osveži aktivni tab da se primene prevodi
    switchTab(currentTab, activeBandId);
}

// ==========================================================================
// 11. POMOĆNE UI FUNKCIJE
// ==========================================================================
function toggleProfileMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('profilePopupMenu');
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

function closeProfileMenu() {
    const menu = document.getElementById('profilePopupMenu');
    if (menu) menu.style.display = 'none';
}

// Mobilna navigacija
function toggleMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeAllMobilePanels() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

function updateStatusText(key, count = 0) {
    if (!statusLabel) return;
    let text = i18n[currentLang][key] || key;
    if (count > 0) {
        text = text.replace('{count}', count);
    }
    statusLabel.innerText = text;
}

// Zatvaranje popupa na klik van njega
document.addEventListener('click', () => {
    closeProfileMenu();
});

window.onload = () => {
    setLanguage(currentLang);
};
