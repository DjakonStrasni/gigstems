// ==========================================================================
// GIGLAB CORE APPLICATION LOGIC - VERZIJA 1.4.08
// ==========================================================================

// Supabase konfiguracija baze podataka (FIKSIRAN I TAČAN ANON KEY)
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

// Globalne kontrole za dvojezičnost i lokalno stanje
let currentLang = localStorage.getItem('gigstems_lang') || 'sr';
let isRegisterMode = false;
let isOTPMode = false;
let pendingRegEmail = "";

// Korisnički nalozi, uloge i stanja bendova
let currentUserProfile = null;
let bands = [];
let activeBandId = "";
let expandedBandId = ""; // Prati koji je bend u sidebar-u rasklopljen/otvoren
let currentSongName = "";
let allSongs = [];

// Geografski registar sa ex-YU i većim evropskim zemljama i gradovima
const geoRegistry = {
    "Srbija": ["Beograd", "Novi Sad", "Niš", "Kragujevac", "Subotica", "Leskovac", "Kruševac", "Kraljevo", "Zrenjanin", "Pančevo", "Čačak", "Šabac", "Novi Pazar", "Smederevo"],
    "Hrvatska": ["Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Pula", "Slavonski Brod", "Karlovac", "Varaždin", "Šibenik", "Sisak", "Dubrovnik"],
    "Bosna i Hercegovina": ["Sarajevo", "Banja Luka", "Tuzla", "Zenica", "Mostar", "Bijeljina", "Brčko", "Bihać", "Prijedor", "Doboj", "Trebinje"],
    "Crna Gora": ["Podgorica", "Nikšić", "Herceg Novi", "Pljevlja", "Bar", "Budva", "Bijelo Polje", "Cetinje", "Kotor", "Tivat"],
    "Slovenija": ["Ljubljana", "Maribor", "Celje", "Kranj", "Velenje", "Koper", "Novo Mesto", "Ptuj"],
    "Severna Makedonija": ["Skoplje", "Bitola", "Kumanovo", "Prilep", "Tetovo", "Ohrid", "Veles", "Strumica"],
    "Austria": ["Vienna", "Salzburg", "Graz", "Linz", "Innsbruck", "Klagenfurt"],
    "Germany": ["Berlin", "Munich", "Frankfurt", "Hamburg", "Cologne", "Stuttgart", "Düsseldorf", "Dresden"],
    "United Kingdom": ["London", "Manchester", "Birmingham", "Glasgow", "Liverpool", "Leeds", "Bristol", "Edinburgh"],
    "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego"]
};

// DOM elementi
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const statusLabel = document.getElementById('statusLabel');
const songsList = document.getElementById('songsList');
const tracksContainer = document.getElementById('tracksContainer');
const stemsPlayerContainer = document.getElementById('stemsPlayerContainer');

// Slušač promena sesije
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

// ==========================================================================
// 1. AUTENTIFIKACIJA & PROFILI
// ==========================================================================

async function loadUserProfile(user) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (data) {
        currentUserProfile = data;
        
        // Postavljanje jezika iz profila ako postoji sačuvan
        if (data.language && data.language !== currentLang) {
            currentLang = data.language;
            localStorage.setItem('gigstems_lang', currentLang);
        }
        
        document.getElementById('currentUserName').innerText = data.display_name || "Marko Marković";
        document.getElementById('currentUserName').title = user.email;
        
        // Postavljanje avatara
        const avatarCircle = document.getElementById('userAvatarCircle');
        const settingsAvatar = document.getElementById('settingsAvatarCircle');
        
        if (data.avatar_url) {
            avatarCircle.innerHTML = `<img src="${data.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            settingsAvatar.innerHTML = `<img src="${data.avatar_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        } else {
            const firstLetter = (data.display_name || "M").charAt(0).toUpperCase();
            avatarCircle.innerText = firstLetter;
            settingsAvatar.innerText = firstLetter;
        }

        // Popunjavanje settings polja
        document.getElementById('settingDisplayName').value = data.display_name || "Marko Marković";
        document.getElementById('settingEmail').value = user.email;
        
        // Podesi geografiju korisnika u settings modal-u
        populateGeoDropdowns(
            data.country || "",
            data.city || "",
            "settingCountry",
            "settingCity",
            "settingCustomCountryInput",
            "settingCustomCityInput"
        );
        
        // Učitavanje bendova za ulogovanog korisnika
        loadUserBands();
    }
}

// Slanje forme za prijavu/registraciju na server
async function handleAuthSubmit() {
    const email = document.getElementById('authEmailInput').value.trim();
    const password = document.getElementById('authPasswordInput').value.trim();
    const displayName = document.getElementById('authDisplayNameInput').value.trim();

    if (!email || !password) {
        alert(currentLang === 'sr' ? "Popunite email i lozinku!" : "Please enter email and password!");
        return;
    }

    if (isRegisterMode) {
        // Registracija novog naloga
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName || "Marko Marković"
                }
            }
        });

        if (error) {
            alert(i18n[currentLang].authError.replace("{msg}", error.message));
        } else {
            alert(i18n[currentLang].authSuccessRegister);
            pendingRegEmail = email;
            showOTPFields(true);
        }
    } else {
        // Prijavljivanje na postojeći nalog
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            // Ako mail nije verifikovan, automatski prebaci na OTP unos!
            if (error.message.includes("Email not confirmed") || error.message.includes("unconfirmed")) {
                alert(currentLang === 'sr' ? "E-mail nije potvrđen. Unesite kod iz mejla." : "E-mail not confirmed. Please enter the code below.");
                pendingRegEmail = email;
                showOTPFields(true);
            } else {
                alert(i18n[currentLang].authError.replace("{msg}", error.message));
            }
        }
    }
}

// Verifikacija 6-cifrenog e-mail koda (OTP)
async function handleOTPVerify() {
    const code = document.getElementById('otpCodeInput').value.trim();
    if (!code || code.length !== 6) {
        alert(currentLang === 'sr' ? "Unesite tačan 6-cifreni kod!" : "Please enter a valid 6-digit code!");
        return;
    }

    const { data, error } = await supabaseClient.auth.verifyOtp({
        email: pendingRegEmail,
        token: code,
        type: 'signup'
    });

    if (error) {
        alert(i18n[currentLang].authError.replace("{msg}", error.message));
    } else {
        alert(currentLang === 'sr' ? "Email uspešno verifikovan!" : "E-mail successfully verified!");
        showOTPFields(false);
    }
}

function showOTPFields(active) {
    isOTPMode = active;
    document.getElementById('authFormFields').style.display = active ? "none" : "block";
    document.getElementById('otpFormFields').style.display = active ? "block" : "none";
}

function cancelOTPMode() {
    showOTPFields(false);
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
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

async function handleLogout() {
    await cleanAudioEngine();
    closeProfileMenu();
    await supabaseClient.auth.signOut();
}

// ==========================================================================
// 2. NAVIGACIJA, STABLO BENDOVA I PROFIL POPUP
// ==========================================================================

async function loadUserBands() {
    if (!currentUserProfile) return;

    // Prvo povlačimo veze iz tabele band_members
    const { data: mData, error: mError } = await supabaseClient
        .from('band_members')
        .select('band_id, role')
        .eq('user_id', currentUserProfile.id);

    if (mData && mData.length > 0) {
        const bIds = mData.map(m => m.band_id);

        // Zatim povlačimo kompletne podatke o tim bendovima
        const { data: bData, error: bError } = await supabaseClient
            .from('bands')
            .select('*')
            .in('id', bIds);

        if (bData) {
            bands = bData.map(b => {
                const linkInfo = mData.find(m => m.band_id === b.id);
                return {
                    ...b,
                    role: linkInfo ? linkInfo.role : 'member'
                };
            }).sort((a, b) => a.name.localeCompare(b.name));
            
            // Postavi podrazumevani aktivni bend ako nije izabran
            if (!activeBandId && bands.length > 0) {
                activeBandId = bands[0].id;
            }
        }
    } else {
        bands = [];
        activeBandId = "";
    }

    renderSidebarBands();
    updateDashboardUI();
}

function renderSidebarBands() {
    const listEl = document.getElementById('sidebarBandsList');
    listEl.innerHTML = "";

    if (bands.length === 0) {
        listEl.innerHTML = `<div style="padding:10px 15px; font-size:0.85em; color:var(--text-muted);">${i18n[currentLang].noBands}</div>`;
        return;
    }

    bands.forEach(band => {
        const itemWrapper = document.createElement('div');
        itemWrapper.className = "sidebar-band-item-wrapper";

        const isExpanded = (expandedBandId === band.id);
        const isActive = (activeBandId === band.id);

        const row = document.createElement('div');
        row.className = `sidebar-band-row ${isActive ? 'active' : ''}`;
        row.innerHTML = `
            <span class="dot-icon">🎸</span>
            <span class="band-title-text">${band.name}</span>
        `;
        row.onclick = () => selectBandRow(band.id);

        itemWrapper.appendChild(row);

        // Ako je ovaj bend otvoren u stablu, iscrtaj opcije
        if (isExpanded) {
            const submenu = document.createElement('div');
            submenu.className = "sidebar-band-submenu";
            submenu.innerHTML = `
                <button class="nav-sub-item" onclick="event.stopPropagation(); openSongsView('${band.id}')">🎵 Stems</button>
                <button class="nav-sub-item" onclick="event.stopPropagation(); showMembersSection('${band.id}')">👥 Members</button>
                <button class="nav-sub-item" onclick="event.stopPropagation(); showBandSettingsSection('${band.id}')">⚙️ Settings</button>
            `;
            itemWrapper.appendChild(submenu);
        }

        listEl.appendChild(itemWrapper);
    });
}

function selectBandRow(bandId) {
    if (expandedBandId === bandId) {
        expandedBandId = "";
    } else {
        expandedBandId = bandId;
    }
    activeBandId = bandId;
    renderSidebarBands();
    updateDashboardUI();
    
    // Pokaži glavnu tablu benda
    stemsPlayerContainer.style.display = "none";
    document.getElementById('bandDashboard').style.display = "flex";
}

// Prikaz i skrivanje profilnog podmenija
function toggleProfileMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('profilePopupMenu');
    menu.style.display = menu.style.display === "none" ? "flex" : "none";
}

function closeProfileMenu() {
    document.getElementById('profilePopupMenu').style.display = "none";
}

document.addEventListener('click', () => {
    closeProfileMenu();
});

// ==========================================================================
// 3. KONTROLNA TABLA BENDA (DASHBOARD)
// ==========================================================================

function updateDashboardUI() {
    const dashboard = document.getElementById('bandDashboard');
    const bandCard = document.getElementById('bandCard');
    const emptyState = document.getElementById('dashboardEmptyState');

    if (!activeBandId || bands.length === 0) {
        bandCard.style.display = "none";
        emptyState.style.display = "block";
        document.getElementById('bandDashboardMainTitle').innerText = "🎸 GigLab Dashboard";
        return;
    }

    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    emptyState.style.display = "none";
    bandCard.style.display = "flex";
    document.getElementById('bandDashboardMainTitle').innerText = `🎸 ${band.name}`;
    document.getElementById('bandCardName').innerText = band.name;

    // Logo benda
    const logoImg = document.getElementById('bandLogoImg');
    const placeholder = document.getElementById('bandLogoPlaceholderIcon');
    const uploadText = document.getElementById('bandLogoUploadText');

    if (band.logo_url) {
        logoImg.src = band.logo_url;
        logoImg.style.display = "block";
        placeholder.style.display = "none";
        uploadText.style.display = "none";
    } else {
        logoImg.style.display = "none";
        placeholder.style.display = "block";
        uploadText.style.display = "block";
    }

    // Bedž uloge
    const badge = document.getElementById('bandRoleBadge');
    if (band.role === 'admin') {
        badge.className = "badge-owner";
        badge.innerText = i18n[currentLang].roleAdmin;
    } else {
        badge.className = "badge-member";
        badge.innerText = i18n[currentLang].roleUser;
    }

    document.getElementById('bandCardOwnerName').innerText = currentUserProfile ? (currentUserProfile.display_name || "Marko Marković") : "Marko Marković";
}

// Otvaranje sekcije sa pesmama (Stems Player)
function openSongsView(bandId = null) {
    if (bandId) activeBandId = bandId;
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    document.getElementById('bandDashboard').style.display = "none";
    stemsPlayerContainer.style.display = "flex";
    
    // Na mobilnom uklanjamo klasu za učitanu pesmu da prvo prikažemo repertoar listu
    stemsPlayerContainer.classList.remove('song-loaded');
    
    connectToGoogleDrive(band);
}

function exitRepertoireToDashboard() {
    stemsPlayerContainer.style.display = "none";
    document.getElementById('bandDashboard').style.display = "flex";
}

// Otvaranje i prikaz članova benda
async function showMembersSection(bandId) {
    activeBandId = bandId;
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    // Prebacivanje prikaza
    document.getElementById('bandDashboard').style.display = "flex";
    stemsPlayerContainer.style.display = "none";
    
    const adminSec = document.getElementById('bandAdminSection');
    adminSec.style.display = "block";
    document.getElementById('newBandForm').style.display = "none";
    document.getElementById('editBandForm').style.display = "none";
    
    const membersSec = document.getElementById('membersManagementSection');
    membersSec.style.display = "block";

    document.getElementById('bandJoinCodeDisplay').value = band.join_code;

    // Učitavanje članova benda
    const { data: membersData, error: mError } = await supabaseClient
        .from('band_members')
        .select(`
            user_id,
            role,
            profiles:user_id (display_name, email)
        `)
        .eq('band_id', activeBandId);

    const membersListEl = document.getElementById('bandMembersList');
    membersListEl.innerHTML = "";

    if (membersData) {
        membersData.forEach(m => {
            const row = document.createElement('div');
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.padding = "10px 14px";
            row.style.backgroundColor = "var(--bg-input)";
            row.style.borderRadius = "8px";
            row.style.border = "1px solid var(--border-color)";
            
            const profile = m.profiles;
            const name = profile ? (profile.display_name || "Marko Marković") : "Marko Marković";
            const roleName = m.role === 'admin' ? i18n[currentLang].roleAdmin : i18n[currentLang].roleUser;
            const roleStyle = m.role === 'admin' ? 'color: var(--accent-gold); font-weight:400;' : 'color: var(--text-secondary);';

            // Dugme za izbacivanje člana (Samo Šef vidi pored drugih članova)
            let actionBtn = "";
            if (band.role === 'admin' && m.user_id !== currentUserProfile.id) {
                actionBtn = `<button class="btn-stop" style="padding: 4px 10px; font-size: 0.8em;" onclick="kickMember('${m.user_id}', '${name}')">${i18n[currentLang].kickMemberBtn}</button>`;
            }

            row.innerHTML = `
                <div>
                    <span style="font-weight:400; margin-right: 10px;">🎸 ${name}</span>
                    <span style="${roleStyle}; font-size: 0.8em;">[${roleName}]</span>
                </div>
                ${actionBtn}
            `;
            membersListEl.appendChild(row);
        });

        // Dugme za napuštanje benda za trenutnog korisnika
        const leaveBtnRow = document.createElement('div');
        leaveBtnRow.style.marginTop = "15px";
        leaveBtnRow.innerHTML = `
            <button class="btn-stop" style="width: 100%;" onclick="leaveBand()">${i18n[currentLang].leaveBandBtn}</button>
        `;
        membersListEl.appendChild(leaveBtnRow);
    }
}

function toggleMembersSection() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;
    showMembersSection(band.id);
}

// Otvaranje forme za podešavanja benda (Samo Šef/Admin)
function showBandSettingsSection(bandId) {
    activeBandId = bandId;
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    // Prebacivanje prikaza
    document.getElementById('bandDashboard').style.display = "flex";
    stemsPlayerContainer.style.display = "none";
    
    const adminSec = document.getElementById('bandAdminSection');
    adminSec.style.display = "block";
    document.getElementById('newBandForm').style.display = "none";
    document.getElementById('membersManagementSection').style.display = "none";
    
    const editForm = document.getElementById('editBandForm');
    editForm.style.display = "block";

    // Popunjavanje polja sačuvanim vrednostima iz baze
    document.getElementById('editBandName').value = band.name || "Deep Purple";
    document.getElementById('editBandUrl').value = band.raw_url || "";
    document.getElementById('editContactName').value = band.contact_name || "";
    document.getElementById('editContactPhone').value = band.contact_phone || "";
    document.getElementById('editWebsite').value = band.website || "";
    document.getElementById('editInstagram').value = band.instagram || "";

    // Geografska polja u podešavanjima benda
    populateGeoDropdowns(
        band.country || "",
        band.city || "",
        "editBandCountry",
        "editBandCity",
        "editBandCustomCountryInput",
        "editBandCustomCityInput"
    );

    // Samo admin može da menja podatke ili obriše bend
    const isAdmin = band.role === 'admin';
    document.getElementById('editBandName').disabled = !isAdmin;
    document.getElementById('editBandUrl').disabled = !isAdmin;
    document.getElementById('editContactName').disabled = !isAdmin;
    document.getElementById('editContactPhone').disabled = !isAdmin;
    document.getElementById('editWebsite').disabled = !isAdmin;
    document.getElementById('editInstagram').disabled = !isAdmin;
    document.getElementById('editBandCountry').disabled = !isAdmin;
    document.getElementById('editBandCity').disabled = !isAdmin;
    
    document.getElementById('renameBtn').style.display = isAdmin ? "inline-block" : "none";
    document.getElementById('deleteBandBtn').style.display = isAdmin ? "inline-block" : "none";
}

function toggleBandSettingsSection() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;
    showBandSettingsSection(band.id);
}

// Otvaranje forme za kreiranje novog benda
function showNewBandCreation() {
    document.getElementById('bandDashboard').style.display = "flex";
    stemsPlayerContainer.style.display = "none";
    
    const adminSec = document.getElementById('bandAdminSection');
    adminSec.style.display = "block";
    document.getElementById('editBandForm').style.display = "none";
    document.getElementById('membersManagementSection').style.display = "none";
    
    document.getElementById('newBandForm').style.display = "block";

    // Čišćenje i popunjavanje geografije za novi bend
    document.getElementById('newBandName').value = "";
    document.getElementById('newBandUrl').value = "";
    document.getElementById('newContactName').value = "";
    document.getElementById('newContactPhone').value = "";
    document.getElementById('newWebsite').value = "";
    document.getElementById('newInstagram').value = "";
    
    populateGeoDropdowns(
        "",
        "",
        "newBandCountry",
        "newBandCity",
        "newBandCustomCountryInput",
        "newBandCustomCityInput"
    );
}

// ==========================================================================
// 4. LOGIKA DRŽAVA I GRADOVA (STANDARD REGISTRY)
// ==========================================================================

function handleCountryChange(countrySelect, citySelectId, customCountryId, customCityId) {
    const country = countrySelect.value;
    const citySelect = document.getElementById(citySelectId);
    const customCountryInput = document.getElementById(customCountryId);
    const customCityInput = document.getElementById(customCityId);

    if (country === "Custom") {
        customCountryInput.style.display = "block";
        customCountryInput.value = "";
        
        citySelect.innerHTML = `<option value="Custom">Ostalo (Custom)...</option>`;
        citySelect.value = "Custom";
        citySelect.disabled = false;
        customCityInput.style.display = "block";
        customCityInput.value = "";
    } else if (country) {
        customCountryInput.style.display = "none";
        citySelect.disabled = false;
        populateCitiesForCountry(country, citySelectId, customCityId);
    } else {
        customCountryInput.style.display = "none";
        citySelect.innerHTML = `<option value="">-- Prvo izaberi državu --</option>`;
        citySelect.disabled = true;
        customCityInput.style.display = "none";
    }
}

function handleCityChange(citySelect, customCityId) {
    const customCityInput = document.getElementById(customCityId);
    if (citySelect.value === "Custom") {
        customCityInput.style.display = "block";
        customCityInput.value = "";
    } else {
        customCityInput.style.display = "none";
    }
}

function populateCitiesForCountry(country, citySelectId, customCityId) {
    const citySelect = document.getElementById(citySelectId);
    const customCityInput = document.getElementById(customCityId);
    citySelect.innerHTML = `<option value="">-- Izaberi grad --</option>`;

    const cities = geoRegistry[country] || [];
    cities.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.innerText = city;
        citySelect.appendChild(opt);
    });

    const customOpt = document.createElement('option');
    customOpt.value = "Custom";
    customOpt.innerText = currentLang === 'sr' ? "Ostalo (Custom)..." : "Other (Custom)...";
    citySelect.appendChild(customOpt);
}

// ==========================================================================
// 5. BEND UPDATE, KICK, LEAVE & UNIQUE 3-TIER VERIFICATION
// ==========================================================================

// Kreiranje novog benda (Samo Šef/Admin)
async function addNewBandSubmit() {
    const name = document.getElementById('newBandName').value.trim();
    const rawUrl = document.getElementById('newBandUrl').value.trim();
    const contactName = document.getElementById('newContactName').value.trim();
    const contactPhone = document.getElementById('newContactPhone').value.trim();
    const website = document.getElementById('newWebsite').value.trim();
    const instagram = document.getElementById('newInstagram').value.trim();

    // Država i grad
    let country = document.getElementById('newBandCountry').value;
    if (country === "Custom") {
        country = document.getElementById('newBandCustomCountryInput').value.trim();
    }
    let city = document.getElementById('newBandCity').value;
    if (city === "Custom") {
        city = document.getElementById('newBandCustomCityInput').value.trim();
    }

    if (!name || !rawUrl || !country || !city || !contactName || !contactPhone) {
        alert(currentLang === 'sr' ? "Popunite sva obavezna polja (Naziv, Link, Državu, Grad i Kontakt)!" : "Please fill out all required fields!");
        return;
    }

    // 1. Trostepena provera jedinstvenosti (Ime + Država + Grad)
    const { data: duplicateCheck, error: checkError } = await supabaseClient
        .from('bands')
        .select('id')
        .eq('name', name)
        .eq('country', country)
        .eq('city', city)
        .maybeSingle();

    if (duplicateCheck) {
        alert(currentLang === 'sr' 
            ? "Osnivanje odbijeno! Bend sa tim imenom već postoji u izabranom gradu i državi. Unesite drugačije geografsko poreklo ili izmenite ime." 
            : "Registration denied! A band with this name already exists in the selected city and country.");
        return;
    }

    const folderId = extractFolderId(rawUrl);
    const joinCode = 'GL' + Math.floor(100000 + Math.random() * 900000); // 6-cifreni kod

    // 2. Upis benda u bazu
    const { data: newBand, error: insertError } = await supabaseClient
        .from('bands')
        .insert({
            name,
            raw_url: rawUrl,
            folder_id: folderId,
            join_code: joinCode,
            contact_name: contactName,
            contact_phone: contactPhone,
            website,
            instagram,
            country,
            city
        })
        .select()
        .single();

    if (insertError) {
        alert(insertError.message);
        return;
    }

    // 3. Upis osnivača kao Šefa/Admina
    const { error: memberError } = await supabaseClient
        .from('band_members')
        .insert({
            band_id: newBand.id,
            user_id: currentUserProfile.id,
            role: 'admin'
        });

    if (memberError) {
        alert(memberError.message);
    } else {
        alert(currentLang === 'sr' ? "Uspešno kreiran bend!" : "Band successfully created!");
        activeBandId = newBand.id;
        document.getElementById('bandAdminSection').style.display = "none";
        await loadUserBands();
    }
}

// Sačuvaj izmene benda (Samo Šef/Admin)
async function updateBandSubmit() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band || band.role !== 'admin') return;

    const name = document.getElementById('editBandName').value.trim();
    const rawUrl = document.getElementById('editBandUrl').value.trim();
    const contactName = document.getElementById('editContactName').value.trim();
    const contactPhone = document.getElementById('editContactPhone').value.trim();
    const website = document.getElementById('editWebsite').value.trim();
    const instagram = document.getElementById('editInstagram').value.trim();

    // Država i grad
    let country = document.getElementById('editBandCountry').value;
    if (country === "Custom") {
        country = document.getElementById('editBandCustomCountryInput').value.trim();
    }
    let city = document.getElementById('editBandCity').value;
    if (city === "Custom") {
        city = document.getElementById('editBandCustomCityInput').value.trim();
    }

    if (!name || !rawUrl || !country || !city) {
        alert(currentLang === 'sr' ? "Popunite sva obavezna polja!" : "Please fill out all required fields!");
        return;
    }

    const folderId = extractFolderId(rawUrl);

    const { error } = await supabaseClient
        .from('bands')
        .update({
            name,
            raw_url: rawUrl,
            folder_id: folderId,
            contact_name: contactName,
            contact_phone: contactPhone,
            website,
            instagram,
            country,
            city
        })
        .eq('id', activeBandId);

    if (error) {
        alert(error.message);
    } else {
        alert(currentLang === 'sr' ? "Izmene uspešno sačuvane!" : "Changes saved successfully!");
        
        // Vraćamo prikaz na glavnu tablu i sklanjamo formu
        document.getElementById('bandAdminSection').style.display = "none";
        
        await loadUserBands();
    }
}

// Trajno brisanje aktivnog benda (Samo Admin)
async function deleteActiveBand() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band || band.role !== 'admin') return;

    if (!confirm(i18n[currentLang].deleteBandConfirm)) return;

    const { error } = await supabaseClient
        .from('bands')
        .delete()
        .eq('id', activeBandId);

    if (error) {
        alert(error.message);
    } else {
        activeBandId = "";
        document.getElementById('bandAdminSection').style.display = "none";
        await loadUserBands();
    }
}

// Izbaci člana (Samo Šef/Admin)
async function kickMember(memberUserId, memberName) {
    const confirmMsg = currentLang === 'sr' 
        ? `Da li ste sigurni da želite da izbacite člana "${memberName}"?` 
        : `Are you sure you want to remove "${memberName}" from the band?`;
    if (!confirm(confirmMsg)) return;

    const { error } = await supabaseClient
        .from('band_members')
        .delete()
        .eq('band_id', activeBandId)
        .eq('user_id', memberUserId);

    if (error) {
        alert(error.message);
    } else {
        alert(currentLang === 'sr' ? "Član je uspešno izbačen." : "Member successfully removed.");
        await showMembersSection(activeBandId); // osveži listu
    }
}

// Napuštanje benda sa gvozdenom zaštitom od poslednjeg admina
async function leaveBand() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    const confirmMsg = currentLang === 'sr' 
        ? `Da li ste sigurni da želite da napustite bend "${band.name}"?` 
        : `Are you sure you want to leave the band "${band.name}"?`;
    if (!confirm(confirmMsg)) return;

    // Proveravamo sve administratore ovog benda unutar baze
    const { data: members, error: err } = await supabaseClient
        .from('band_members')
        .select('*')
        .eq('band_id', activeBandId);

    if (err || !members) return;

    const admins = members.filter(m => m.role === 'admin');
    const isUserAdmin = admins.some(m => m.user_id === currentUserProfile.id);

    // Gvozdena zaštita: ako je poslednji admin, ne dozvoli izlazak
    if (isUserAdmin && admins.length === 1) {
        alert(i18n[currentLang].lastAdminWarning);
        return;
    }

    // Slobodno ukloni korisnika iz članstva
    const { error: leaveErr } = await supabaseClient
        .from('band_members')
        .delete()
        .eq('band_id', activeBandId)
        .eq('user_id', currentUserProfile.id);

    if (leaveErr) {
        alert(leaveErr.message);
    } else {
        alert(currentLang === 'sr' ? "Uspešno ste napustili bend." : "Successfully left the band.");
        activeBandId = "";
        document.getElementById('bandAdminSection').style.display = "none";
        await loadUserBands();
    }
}

// Regeneracija koda (Samo Šef/Admin)
async function regenerateJoinCode() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band || band.role !== 'admin') return;

    const newCode = 'GL' + Math.floor(100000 + Math.random() * 900000);

    const { error } = await supabaseClient
        .from('bands')
        .update({ join_code: newCode })
        .eq('id', activeBandId);

    if (error) {
        alert(error.message);
    } else {
        alert(currentLang === 'sr' ? "Novi pristupni kod uspešno generisan!" : "New join code successfully generated!");
        document.getElementById('bandJoinCodeDisplay').value = newCode;
        band.join_code = newCode;
    }
}

// Učlanjenje u postojeći bend pomoću pristupnog koda (Role: 'member')
async function submitJoinCode() {
    if (!currentUserProfile) return;

    const codeInput = document.getElementById('joinCodeInput');
    const code = codeInput.value.trim();

    if (!code) {
        alert(currentLang === 'sr' ? "Unesite pristupni kod!" : "Please enter the access code!");
        return;
    }

    // Pronalazimo bend sa tim pristupnim kodom
    const { data: bandData, error: bandError } = await supabaseClient
        .from('bands')
        .select('*')
        .eq('join_code', code)
        .single();

    if (bandError || !bandData) {
        alert(currentLang === 'sr' ? "Bend sa tim pristupnim kodom nije pronađen!" : "Band with that access code not found!");
        return;
    }

    // Proveravamo da li je korisnik već član tog benda
    const { data: isMember } = await supabaseClient
        .from('band_members')
        .select('*')
        .eq('band_id', bandData.id)
        .eq('user_id', currentUserProfile.id)
        .maybeSingle();

    if (isMember) {
        alert(currentLang === 'sr' ? "Već ste član ovog benda!" : "You are already a member of this band!");
        return;
    }

    // Upisujemo korisnika u članstvo (Uloga: 'member' - fiksirano!)
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
        codeInput.value = "";
        activeBandId = bandData.id;
        document.getElementById('bandAdminSection').style.display = "none";
        await loadUserBands();
    }
}

function extractFolderId(url) {
    if (!url) return "";
    const match = url.match(/\/folders\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
}

// ==========================================================================
// 6. REPERTOAR & AUDIO ENGINE (ORDER-PRESERVING SYNC)
// ==========================================================================

async function connectToGoogleDrive(band) {
    const sList = document.getElementById('songsList');
    sList.innerHTML = `<div style="padding:15px; text-align:center; color:var(--text-secondary);">${i18n[currentLang].statusConnecting}</div>`;

    if (!GOOGLE_API_KEY) {
        sList.innerHTML = `<div style="padding:10px; color:var(--accent-gold); font-size:0.9em; line-height:1.4;">⚠️ ${i18n[currentLang].apiKeyWarning}</div>`;
        return;
    }

    const url = `https://www.googleapis.com/drive/v3/files?q='${band.folder_id}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&key=${GOOGLE_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.files && data.files.length > 0) {
            allSongs = data.files.sort((a, b) => a.name.localeCompare(b.name));
            renderSongsListUI(allSongs);
        } else {
            sList.innerHTML = `<div style="padding:10px; color:var(--text-secondary);">${i18n[currentLang].noSongs}</div>`;
        }
    } catch (err) {
        console.error("Drive connect error:", err);
        sList.innerHTML = `<div style="padding:10px; color:var(--accent-red);">${i18n[currentLang].statusConnError}</div>`;
    }
}

function renderSongsListUI(songs) {
    songsList.innerHTML = "";
    songs.forEach(song => {
        const item = document.createElement('div');
        item.className = `song-item ${currentSongName === song.name ? 'active' : ''}`;
        item.innerText = song.name;
        item.onclick = () => selectSongToPlay(song);
        songsList.appendChild(item);
    });
}

function filterSongs(query) {
    const filtered = allSongs.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
    renderSongsListUI(filtered);
}

// Učitavanje i sinhronizacija svih MP3 traka (Gvožđe: Order-Preserving)
async function selectSongToPlay(songFolder) {
    if (isPlaying) {
        stopAudio();
    }
    
    await cleanAudioEngine();
    
    currentSongName = songFolder.name;
    renderSongsListUI(allSongs);

    updateStatusText('statusLoading');
    tracksContainer.innerHTML = "";

    const url = `https://www.googleapis.com/drive/v3/files?q='${songFolder.id}'+in+parents+and+trashed=false&key=${GOOGLE_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        const audioFiles = (data.files || []).filter(f => 
            f.name.endsWith('.mp3') || f.name.endsWith('.wav') || f.name.endsWith('.m4a') || f.name.endsWith('.aac')
        );

        if (audioFiles.length === 0) {
            updateStatusText('statusNoFiles');
            return;
        }

        audioFiles.sort((a, b) => a.name.localeCompare(b.name));

        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        audioBuffers = new Array(audioFiles.length);
        trackNames = new Array(audioFiles.length);
        gainNodes = new Array(audioFiles.length);

        // Preuzimanje i dekodiranje u paralelnom poretku - sa fiksiranim indeksima!
        const loadPromises = audioFiles.map(async (file, index) => {
            const streamUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GOOGLE_API_KEY}`;
            const res = await fetch(streamUrl);
            const arrayBuf = await res.arrayBuffer();
            
            // Dekodiranje
            const decodedBuffer = await audioCtx.decodeAudioData(arrayBuf);
            audioBuffers[index] = decodedBuffer; // fiksirano na tvoj indeks!
            
            // Lepše ime
            let cleanName = file.name.replace(/\.[^/.]+$/, "");
            cleanName = cleanName.replace(/^[0-9]+[_-]*/, "");
            cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
            trackNames[index] = cleanName; // fiksirano na tvoj indeks!
        });

        await Promise.all(loadPromises);

        // Iscrtavanje horizontalnih traka poređanih jedna ispod druge
        buildMixerUI();
        
        playBtn.disabled = false;
        stopBtn.disabled = false;
        updateStatusText('statusReady', audioBuffers.length);

        // Na mobilnom: aktiviraj song-loaded prikaz koji sakriva repertoar
        stemsPlayerContainer.classList.add('song-loaded');

    } catch (err) {
        console.error("Audio engine load failure:", err);
        updateStatusText('statusError');
    }
}

// Dinamičko iscrtavanje miksete (Horizontal strips, vertical stack)
function buildMixerUI() {
    tracksContainer.innerHTML = "";
    gainNodes = [];

    if (!masterGainNode) {
        masterGainNode = audioCtx.createGain();
        masterGainNode.connect(audioCtx.destination);
    }

    // Čitanje sačuvanog miksa iz localStorage-a ako postoji
    let savedMix = {};
    if (currentSongName) {
        const rawSave = localStorage.getItem('gigstems_mix_' + currentSongName);
        if (rawSave) {
            try { savedMix = JSON.parse(rawSave); } catch (e) {}
        }
    }

    // Čitanje sačuvanog redosleda traka
    let savedOrder = [];
    if (currentSongName) {
        const rawOrder = localStorage.getItem('gigstems_order_' + currentSongName);
        if (rawOrder) {
            try { savedOrder = JSON.parse(rawOrder); } catch (e) {}
        }
    }

    // Redosled indeksa
    let orderIndices = trackNames.map((_, i) => i);
    if (savedOrder && savedOrder.length > 0) {
        orderIndices.sort((a, b) => {
            const nameA = trackNames[a];
            const nameB = trackNames[b];
            const posA = savedOrder.indexOf(nameA) === -1 ? 999 : savedOrder.indexOf(nameA);
            const posB = savedOrder.indexOf(nameB) === -1 ? 999 : savedOrder.indexOf(nameB);
            return posA - posB;
        });
    }

    orderIndices.forEach((index) => {
        const name = trackNames[index];
        const trackPreset = savedMix[name] || { volume: 0.8, muted: false, solo: false };

        const gainNode = audioCtx.createGain();
        gainNode.gain.value = trackPreset.muted ? 0 : trackPreset.volume;
        gainNode.connect(masterGainNode);
        gainNodes[index] = gainNode;

        const strip = document.createElement('div');
        strip.className = 'track-strip';
        strip.setAttribute('draggable', 'true');
        strip.setAttribute('data-index', index);

        const muteClass = trackPreset.muted ? "btn-mute active" : "btn-mute";
        const soloClass = trackPreset.solo ? "btn-solo active" : "btn-solo";

        strip.innerHTML = `
            <div class="drag-handle" title="Prevucite da promenite redosled">☰</div>
            <span class="track-name" title="${name}">${name}</span>
            <div class="volume-slider-container">
                <input type="range" class="track-volume-slider" min="0" max="1.2" step="0.01" value="${trackPreset.volume}" oninput="setVolume(${index}, this.value)">
            </div>
            <button id="muteBtn-${index}" class="${muteClass}" onclick="toggleMute(${index})">MUTE</button>
            <button id="soloBtn-${index}" class="${soloClass}" onclick="toggleSolo(${index})">SOLO</button>
        `;
        tracksContainer.appendChild(strip);
    });

    makeMixerSortable();
}

// Drag & Drop logika za sortiranje traka (Gvožđe v1.3.7)
function makeMixerSortable() {
    const strips = tracksContainer.querySelectorAll('.track-strip');
    
    strips.forEach(strip => {
        strip.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', strip.getAttribute('data-index'));
            strip.classList.add('dragging');
        });
        
        strip.addEventListener('dragend', () => {
            strip.classList.remove('dragging');
            saveTrackOrder();
        });
    });

    tracksContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingElement = tracksContainer.querySelector('.dragging');
        if (!draggingElement) return;

        const afterElement = getDragAfterElement(tracksContainer, e.clientY);
        if (afterElement == null) {
            tracksContainer.appendChild(draggingElement);
        } else {
            tracksContainer.insertBefore(draggingElement, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.track-strip:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveTrackOrder() {
    if (!currentSongName) return;
    const strips = tracksContainer.querySelectorAll('.track-strip');
    const order = [];
    
    strips.forEach(strip => {
        const index = parseInt(strip.getAttribute('data-index'));
        order.push(trackNames[index]);
    });
    
    localStorage.setItem('gigstems_order_' + currentSongName, JSON.stringify(order));
}

// Centralni proračun audio nivoa (Mute & Solo)
function applyGainsFromUI() {
    if (!audioCtx) return;

    let isAnySoloActive = false;
    trackNames.forEach((_, i) => {
        const sBtn = document.getElementById(`soloBtn-${i}`);
        if (sBtn && sBtn.classList.contains('active')) {
            isAnySoloActive = true;
        }
    });

    trackNames.forEach((_, i) => {
        const slider = document.querySelectorAll('.track-volume-slider')[i];
        if (!slider) return;
        const vol = parseFloat(slider.value);
        
        const muteBtn = document.getElementById(`muteBtn-${i}`);
        const soloBtn = document.getElementById(`soloBtn-${i}`);

        const isMuted = muteBtn ? muteBtn.classList.contains('active') : false;
        const isSolo = soloBtn ? soloBtn.classList.contains('active') : false;

        let finalGain = vol;
        if (isMuted) {
            finalGain = 0;
        } else if (isAnySoloActive && !isSolo) {
            finalGain = 0;
        }

        if (gainNodes[i]) {
            gainNodes[i].gain.setValueAtTime(finalGain, audioCtx.currentTime);
        }
    });
}

function saveMixState() {
    if (!currentSongName) return;

    const mixState = {};
    trackNames.forEach((name, index) => {
        const slider = document.querySelectorAll('.track-volume-slider')[index];
        const muteBtn = document.getElementById(`muteBtn-${index}`);
        const soloBtn = document.getElementById(`soloBtn-${index}`);

        const isMuted = muteBtn ? muteBtn.classList.contains('active') : false;
        const isSolo = soloBtn ? soloBtn.classList.contains('active') : false;

        mixState[name] = {
            volume: slider ? parseFloat(slider.value) : 0.8,
            muted: isMuted,
            solo: isSolo
        };
    });

    localStorage.setItem('gigstems_mix_' + currentSongName, JSON.stringify(mixState));
}

function setVolume(index, value) {
    applyGainsFromUI();
    saveMixState();
}

function toggleMute(index) {
    const btn = document.getElementById(`muteBtn-${index}`);
    if (btn) btn.classList.toggle('active');
    applyGainsFromUI();
    saveMixState();
}

function toggleSolo(index) {
    const btn = document.getElementById(`soloBtn-${index}`);
    if (btn) btn.classList.toggle('active');
    applyGainsFromUI();
    saveMixState();
}

// Master Volume & Master Mute
function setMasterVolume(val) {
    localStorage.setItem('gigstems_master_volume', val);
    if (!audioCtx || !masterGainNode) return;
    if (!isMasterMuted) {
        masterGainNode.gain.setValueAtTime(parseFloat(val), audioCtx.currentTime);
    }
}

function toggleMasterMute() {
    if (!audioCtx || !masterGainNode) return;
    const btn = document.getElementById('masterMuteBtn');
    isMasterMuted = !isMasterMuted;

    if (isMasterMuted) {
        btn.classList.add('active');
        btn.innerText = currentLang === 'sr' ? "ODMUTIRAJ SVE" : "UNMUTE ALL";
        masterGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    } else {
        btn.classList.remove('active');
        btn.innerText = i18n[currentLang].masterMuteBtn;
        const savedMasterVol = parseFloat(document.getElementById('masterVolumeSlider').value);
        masterGainNode.gain.setValueAtTime(savedMasterVol, audioCtx.currentTime);
    }
}

// Play / Pause / Stop
function togglePlay() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (isPlaying) {
        pauseOffset += audioCtx.currentTime - startTime;
        stopSourceNodes();
        isPlaying = false;
        updatePlayBtnUI();
        clearInterval(timerInterval);
    } else {
        startSourceNodes(pauseOffset);
        startTime = audioCtx.currentTime;
        isPlaying = true;
        updatePlayBtnUI();
        timerInterval = setInterval(updateAudioTimer, 200);
    }
}

function startSourceNodes(offset = 0) {
    sourceNodes = [];
    audioBuffers.forEach((buffer, index) => {
        if (!buffer) return;
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNodes[index]);
        
        const duration = buffer.duration;
        if (offset < duration) {
            source.start(0, offset);
        } else {
            source.start(0, duration);
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
    updatePlayBtnUI();
    clearInterval(timerInterval);
}

function updateAudioTimer() {
    if (!isPlaying || !audioCtx) return;
    const elapsed = pauseOffset + (audioCtx.currentTime - startTime);
    // Ako smo stigli do kraja pesme
    let maxDur = 0;
    audioBuffers.forEach(b => { if (b && b.duration > maxDur) maxDur = b.duration; });
    if (elapsed >= maxDur && maxDur > 0) {
        stopAudio();
    }
}

function updatePlayBtnUI() {
    const playSpan = playBtn.querySelector('span');
    if (isPlaying) {
        playBtn.className = "btn-connect active";
        playSpan.innerText = i18n[currentLang].pauseBtn;
    } else {
        playBtn.className = "btn-connect";
        playSpan.innerText = i18n[currentLang].playBtn;
    }
}

function updateStatusText(key, count = 0) {
    let text = i18n[currentLang][key] || key;
    if (count > 0) {
        text = text.replace('{count}', count);
    }
    statusLabel.innerText = text;
}

// ==========================================================================
// 7. BUG REPORT & ŽALBE KORISNIKA (SUPPORT TICKETS)
// ==========================================================================

function toggleSupportModal() {
    const modal = document.getElementById('supportModal');
    modal.style.display = modal.style.display === "none" ? "flex" : "none";
    if (modal.style.display === "flex") {
        document.getElementById('supportSubject').value = "";
        document.getElementById('supportMessage').value = "";
    }
}

async function submitSupportTicket() {
    if (!currentUserProfile) return;

    const subject = document.getElementById('supportSubject').value.trim();
    const message = document.getElementById('supportMessage').value.trim();

    if (!subject || !message) {
        alert(currentLang === 'sr' ? "Popunite sva polja!" : "Please fill out all fields!");
        return;
    }

    const { error } = await supabaseClient
        .from('support_tickets')
        .insert({
            user_id: currentUserProfile.id,
            user_email: currentUserProfile.email || "singer@yourband.com",
            subject: subject,
            message: message
        });

    if (error) {
        alert(error.message);
    } else {
        alert(i18n[currentLang].supportSuccessMsg);
        toggleSupportModal();
    }
}

// ==========================================================================
// 8. KORISNIČKA PODEŠAVANJA (SETTINGS MODAL)
// ==========================================================================

function openSettingsModal() {
    document.getElementById('settingsModal').style.display = "flex";
    switchSettingsTab('Regional');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = "none";
}

function switchSettingsTab(tabName) {
    document.querySelectorAll('.modal-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.modal-tab').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`settingsTab${tabName}`).style.display = 'block';
    document.getElementById(`tabBtn${tabName}`).classList.add('active');
}

async function saveSettings() {
    if (!currentUserProfile) return;

    const displayName = document.getElementById('settingDisplayName').value.trim();
    const language = document.getElementById('settingLanguage').value;

    // Država i grad iz settings-a
    let country = document.getElementById('settingCountry').value;
    if (country === "Custom") {
        country = document.getElementById('settingCustomCountryInput').value.trim();
    }
    let city = document.getElementById('settingCity').value;
    if (city === "Custom") {
        city = document.getElementById('settingCustomCityInput').value.trim();
    }

    const updates = {
        display_name: displayName || "Marko Marković",
        language: language,
        country: country,
        city: city
    };

    const { error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', currentUserProfile.id);

    if (error) {
        alert(error.message);
    } else {
        alert(currentLang === 'sr' ? "Podešavanja uspešno sačuvana!" : "Settings saved successfully!");
        
        // Sačuvaj jezik u localStorage i osveži stranu za primenu jezika!
        localStorage.setItem('gigstems_lang', language);
        closeSettingsModal();
        window.location.reload(); // reload
    }
}

// Trajno brisanje naloga
async function deleteCurrentUserAccount() {
    if (!confirm(currentLang === 'sr' ? "Da li ste sigurni da želite trajno da obrišete nalog? Ova akcija je nepovratna!" : "Are you sure you want to delete your account? This action is irreversible!")) return;

    const { error } = await supabaseClient
        .from('profiles')
        .delete()
        .eq('id', currentUserProfile.id);

    if (error) {
        alert(error.message);
    } else {
        await handleLogout();
        window.location.reload();
    }
}

// ==========================================================================
// 9. LOGOTIP BENDA & KORISNIČKI AVATAR (BASE64 DIRECT TO DATABASE)
// ==========================================================================

function triggerLogoUpload() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band || band.role !== 'admin') return;
    document.getElementById('bandLogoFileInput').click();
}

function handleLogoUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64 = reader.result;
        
        // Prikaz spinner-a
        document.getElementById('logoLoadingSpinner').style.display = "block";

        const { error } = await supabaseClient
            .from('bands')
            .update({ logo_url: base64 })
            .eq('id', activeBandId);

        document.getElementById('logoLoadingSpinner').style.display = "none";

        if (error) {
            alert(error.message);
        } else {
            // Osveži podatke benda
            const band = bands.find(b => b.id === activeBandId);
            if (band) band.logo_url = base64;
            updateDashboardUI();
        }
    };
    reader.readAsDataURL(file);
}

function triggerAvatarUpload() {
    document.getElementById('avatarFileInput').click();
}

function handleAvatarUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64 = reader.result;

        const { error } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: base64 })
            .eq('id', currentUserProfile.id);

        if (error) {
            alert(error.message);
        } else {
            // Osveži avatar
            currentUserProfile.avatar_url = base64;
            document.getElementById('userAvatarCircle').innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            document.getElementById('settingsAvatarCircle').innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
    };
    reader.readAsDataURL(file);
}

// ==========================================================================
// 10. JAVNE/GLOBALNE KONTROLE ZA INICIJALIZACIJU I JEZIK
// ==========================================================================

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('gigstems_lang', lang);
    
    // Aktiviraj ispravno dugme
    document.querySelectorAll('.btn-lang').forEach(btn => {
        btn.classList.toggle('active', btn.id.toLowerCase().includes(lang.toLowerCase()));
    });

    // Osveži interfejs
    document.getElementById('songsTitle').innerText = i18n[lang].songsTitle;
    document.getElementById('searchInput').placeholder = i18n[lang].searchPlaceholder;
    document.getElementById('sidebarBandsHeader').innerText = i18n[lang].navBands;
    document.getElementById('btnNewBandSidebar').innerText = "➕ " + (lang === 'sr' ? "Novi bend" : "New band");
    
    // Dashboard akcije
    document.getElementById('btnSongsText').innerText = lang === 'sr' ? "Pesme" : "Songs";
    
    // Profil opcije
    document.getElementById('popMenuSettings').innerText = "⚙️ " + (lang === 'sr' ? "Podešavanja" : "Settings");
    document.getElementById('popMenuLogout').innerText = "🚪 " + (lang === 'sr' ? "Odjavi se" : "Log Out");

    // Modal Podešavanja
    document.getElementById('modalSettingsTitle').innerText = "⚙️ " + (lang === 'sr' ? "Podešavanja" : "Settings");
    document.getElementById('tabBtnRegional').innerText = lang === 'sr' ? "Aplikacija" : "App";
    document.getElementById('tabBtnProfile').innerText = lang === 'sr' ? "Profil" : "Profile";
    document.getElementById('tabBtnPassword').innerText = lang === 'sr' ? "Lozinka" : "Password";
    document.getElementById('tabBtnAccount').innerText = lang === 'sr' ? "Nalog" : "Account";
    
    document.getElementById('btnCancelSettings').innerText = lang === 'sr' ? "Otkaži" : "Cancel";
    document.getElementById('btnSaveSettings').innerText = lang === 'sr' ? "Sačuvaj" : "Save";

    updatePlayBtnUI();
    toggleAuthMode();
    isRegisterMode = !isRegisterMode; 
    toggleAuthMode(); // trik za osvežavanje labela
}

// Mobilni hamburger meni
function toggleMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
}

function closeAllMobilePanels() {
    document.getElementById('appSidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
}

// Gvozdeno čišćenje i resetovanje AudioContext-a i RAM-a
async function cleanAudioEngine() {
    stopAudio();
    
    if (audioCtx) {
        try {
            await audioCtx.close();
        } catch (e) {
            console.warn("AudioContext close issue:", e);
        }
        audioCtx = null;
    }

    audioBuffers = [];
    sourceNodes = [];
    gainNodes = [];
    currentSongName = "";
    masterGainNode = null;
    
    tracksContainer.innerHTML = "";
    
    playBtn.disabled = true;
    stopBtn.disabled = true;
    updateStatusText('statusInit');
}

window.onload = () => {
    setLanguage(currentLang);
    
    // Inicijalizuj dropdown-ove za državu i grad u registracionom delu
    populateGeoDropdowns(
        "",
        "",
        "settingCountry",
        "settingCity",
        "settingCustomCountryInput",
        "settingCustomCityInput"
    );
};
