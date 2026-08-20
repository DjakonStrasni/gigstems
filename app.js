# -*- coding: utf-8 -*-
import sys

app_js_code = """// ==========================================================================
// GIGLAB WEB APP - CORE JAVASCRIPT LOGIC (VERZIJA 1.4.08)
// ==========================================================================

// Supabase konfiguracija baze podataka
const SUPABASE_URL = "https://yqmxwgikcqibbkpqstux.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbXh3Z2lrY3FpYmJrcHFzdHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNjEwNDksImV4cCI6MjEwMjczNzA0OX0.TVedwos2OOmvggCK-zyevtV6S2Vfdax9e9ygHhKr5nA";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Google API Key za očitavanje drajv linkova
let GOOGLE_API_KEY = "AIzaSyBiq4QbYuCtVyy9_-dJTCTcCtPfwZc-Gu8";

// Zvanični geografski registar država i gradova (v1.4.08)
const geoDb = {
    "Srbija": ["Beograd", "Novi Sad", "Niš", "Kragujevac", "Subotica", "Čačak", "Kraljevo", "Kruševac", "Pančevo", "Zrenjanin"],
    "Hrvatska": ["Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Slavonski Brod", "Pula", "Sesvete", "Karlovac", "Varaždin"],
    "Bosna i Hercegovina": ["Sarajevo", "Banja Luka", "Tuzla", "Zenica", "Mostar", "Bijeljina", "Brčko", "Bihać", "Prijedor", "Doboj"],
    "Crna Gora": ["Podgorica", "Nikšić", "Herceg Novi", "Pljevlja", "Budva", "Bar", "Bijelo Polje", "Cetinje", "Kotor", "Tivat"],
    "Slovenija": ["Ljubljana", "Maribor", "Celje", "Kranj", "Velenje", "Koper", "Novo Mesto", "Ptuj", "Kamnik", "Jesenice"],
    "Severna Makedonija": ["Skoplje", "Bitolj", "Kumanovo", "Prilep", "Tetovo", "Ohrid", "Veles", "Štip", "Gostivar", "Strumica"],
    "Austrija": ["Beč", "Grac", "Linc", "Salcburg", "Inzbruk", "Klagenfurt", "Beljak", "Sankt Pelten", "Krems"],
    "Nemačka": ["Berlin", "Minhen", "Frankfurt", "Hamburg", "Keln", "Štutgart", "Diseldorf", "Dortmund", "Esen", "Bremen"],
    "Custom...": []
};

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
let totalDuration = 0;

// Globalne kontrole za dvojezičnost i lokalno stanje
let currentLang = localStorage.getItem('gigstems_lang') || 'sr';
let isRegisterMode = false;
let isOTPMode = false;
let pendingRegEmail = "";

// Korisnički nalozi, uloge i stanja bendova
let currentUserProfile = null;
let bands = [];
let activeBandId = "";
let currentActiveSubView = ""; // "songs", "members", "settings" ili ""
let currentSongName = "";
let allSongs = [];

// DOM elementi
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const statusLabel = document.getElementById('statusLabel');
const songsList = document.getElementById('songsList');
const tracksContainer = document.getElementById('tracksContainer');
const stemsPlayerContainer = document.getElementById('stemsPlayerContainer');

// ==========================================================================
// 1. AUTENTIFIKACIJA & SIGN UP / OTP VERIFICATION
// ==========================================================================

// Slušač promena stanja sesije (Automatsko logovanje pri osvežavanju)
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        authContainer.style.display = "none";
        appContainer.style.display = "flex";
        loadUserProfile(session.user);
    } else {
        appContainer.style.display = "none";
        authContainer.style.display = "block";
        resetAudioState();
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
        
        // Podesi podrazumevani jezik iz baze ako postoji
        if (data.language && data.language !== currentLang) {
            currentLang = data.language;
            localStorage.setItem('gigstems_lang', currentLang);
            setLanguage(currentLang);
        }

        renderUserProfilesUI();
        loadUserBands();
    }
}

function renderUserProfilesUI() {
    if (!currentUserProfile) return;
    document.getElementById('currentUserName').innerText = currentUserProfile.display_name || currentUserProfile.email;
    document.getElementById('currentUserName').title = currentUserProfile.email;
    
    // Avatar krug
    const avatarCircle = document.getElementById('userAvatarCircle');
    const settingsAvatar = document.getElementById('settingsAvatarCircle');
    
    const letter = (currentUserProfile.display_name || currentUserProfile.email).charAt(0).toUpperCase();
    
    if (currentUserProfile.avatar_url && currentUserProfile.avatar_url.startsWith('data:image')) {
        const imgHTML = `<img class="user-avatar-img" src="${currentUserProfile.avatar_url}" alt="Avatar">`;
        avatarCircle.innerHTML = imgHTML;
        settingsAvatar.innerHTML = imgHTML;
    } else {
        avatarCircle.innerText = letter;
        settingsAvatar.innerText = letter;
    }

    // Popunjavanje polja u modal podešavanjima
    document.getElementById('settingDisplayName').value = currentUserProfile.display_name || "";
    document.getElementById('settingEmail').value = currentUserProfile.email || "";
}

function toggleAuthMode() {
    if (isOTPMode) return;
    isRegisterMode = !isRegisterMode;
    setLanguage(currentLang);
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
            pendingRegEmail = email;
            switchToOTPMode();
        }
    } else {
        // Prijavljivanje na postojeći nalog
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            // Ako e-mail nije potvrđen, prebacujemo korisnika u OTP režim da može da unese kod!
            if (error.message.includes("Email not confirmed") || error.message.includes("confirm")) {
                pendingRegEmail = email;
                switchToOTPMode();
            } else {
                alert(i18n[currentLang].authError.replace("{msg}", error.message));
            }
        }
    }
}

function switchToOTPMode() {
    isOTPMode = true;
    document.getElementById('authFormFields').style.display = "none";
    document.getElementById('otpFormFields').style.display = "block";
    setLanguage(currentLang);
}

function cancelOTPMode() {
    isOTPMode = false;
    document.getElementById('authFormFields').style.display = "block";
    document.getElementById('otpFormFields').style.display = "none";
    setLanguage(currentLang);
}

async function handleOTPVerify() {
    const token = document.getElementById('otpCodeInput').value.trim();
    if (!token || token.length < 6) {
        alert(currentLang === 'sr' ? "Unesite validan 6-cifreni kod!" : "Please enter a valid 6-digit token!");
        return;
    }

    const { data, error } = await supabaseClient.auth.verifyOtp({
        email: pendingRegEmail,
        token: token,
        type: 'signup'
    });

    if (error) {
        // Pokušavamo i sa tipom 'login' u slučaju da je već registrovan ali unosi kod
        const { data: secondData, error: secondError } = await supabaseClient.auth.verifyOtp({
            email: pendingRegEmail,
            token: token,
            type: 'login'
        });
        
        if (secondError) {
            alert(i18n[currentLang].authError.replace("{msg}", secondError.message));
        } else {
            isOTPMode = false;
            cancelOTPMode();
        }
    } else {
        isOTPMode = false;
        cancelOTPMode();
    }
}

async function handleLogout() {
    await cleanAudioEngine();
    closeProfileMenu();
    const { error } = await supabaseClient.auth.signOut();
}

// ==========================================================================
// 2. BANDS AND MEMBERSHIP MANAGEMENT
// ==========================================================================

async function loadUserBands() {
    if (!currentUserProfile) return;

    // Prvo povlačimo veze iz tabele band_members
    const { data: membershipData, error: membershipError } = await supabaseClient
        .from('band_members')
        .select('band_id, role')
        .eq('user_id', currentUserProfile.id);

    if (membershipError) {
        console.error("Membership load error:", membershipError);
        return;
    }

    if (!membershipData || membershipData.length === 0) {
        bands = [];
        renderSidebarBands();
        showEmptyDashboard();
        return;
    }

    // Povlačimo detalje o bendovima iz tabele bands
    const bandIds = membershipData.map(m => m.band_id);
    const { data: bandsData, error: bandsError } = await supabaseClient
        .from('bands')
        .select('*')
        .in('id', bandIds);

    if (bandsError) {
        console.error("Bands data load error:", bandsError);
        return;
    }

    // Kombinujemo podatke o bendu sa ulogom korisnika u tom bendu
    bands = bandsData.map(b => {
        const membership = membershipData.find(m => m.band_id === b.id);
        return {
            ...b,
            userRole: membership ? membership.role : 'member'
        };
    });

    renderSidebarBands();
    
    // Ako imamo sačuvan aktivni bend, učitavamo ga, inače ostajemo na praznom dashboardu
    if (activeBandId) {
        selectActiveBand(activeBandId);
    } else {
        showEmptyDashboard();
    }
}

// Iscrtavanje liste bendova u levom sidebar meniju (ELEGANTNO STABLO / ACCORDION)
function renderSidebarBands() {
    const listEl = document.getElementById('sidebarBandsList');
    listEl.innerHTML = "";

    if (bands.length === 0) {
        listEl.innerHTML = `<p style="font-size:0.85em; color:var(--text-muted); padding:0 10px;">${i18n[currentLang].noBands}</p>`;
        return;
    }

    bands.forEach(band => {
        const item = document.createElement('div');
        const isActive = activeBandId === band.id;
        item.className = `sidebar-band-item-wrapper ${isActive ? 'active' : ''}`;

        let subMenuHTML = "";
        // Ako je ovaj bend aktivan, otvara mu se podmeni ispod njega u levoj koloni (bez trouglova)
        if (isActive) {
            subMenuHTML = `
                <div class="sidebar-band-sub-menu">
                    <div class="sub-menu-item ${currentActiveSubView === 'songs' ? 'active' : ''}" onclick="openSongsView(event)">🎵 ${i18n[currentLang].subSongs}</div>
                    <div class="sub-menu-item ${currentActiveSubView === 'members' ? 'active' : ''}" onclick="openMembersViewFromSidebar(event)">👥 ${i18n[currentLang].subMembers}</div>
                    <div class="sub-menu-item ${currentActiveSubView === 'settings' ? 'active' : ''}" onclick="openSettingsViewFromSidebar(event)">⚙️ ${i18n[currentLang].subSettings}</div>
                </div>
            `;
        }

        item.innerHTML = `
            <div class="sidebar-band-row" onclick="selectActiveBand('${band.id}')">
                <span class="dot-icon">⚫</span>
                <span class="band-title-text">${band.name}</span>
            </div>
            ${subMenuHTML}
        `;
        listEl.appendChild(item);
    });
}

// Prikaz praznog stanja dashboarda
function showEmptyDashboard() {
    document.getElementById('bandCard').style.display = "none";
    document.getElementById('bandAdminSection').style.display = "none";
    document.getElementById('dashboardEmptyState').style.display = "block";
}

// Izbor aktivnog benda i učitavanje njegove kontrolne table (Dashboard)
async function selectActiveBand(bandId) {
    if (activeBandId === bandId) {
        // Klik na već aktivan bend skuplja podmeni (zatvara ga)
        activeBandId = "";
        currentActiveSubView = "";
        await cleanAudioEngine();
        showEmptyDashboard();
        renderSidebarBands();
        return;
    }

    // Ako menjamo aktivni bend, čistimo audio mašinu iz predostrožnosti
    await cleanAudioEngine();
    
    activeBandId = bandId;
    currentActiveSubView = ""; // resetujemo aktivni podmeni view
    
    const band = bands.find(b => b.id === bandId);
    if (!band) return;

    // Osvežavamo sidebar oznake
    renderSidebarBands();

    // Sakrij prazno stanje i prikaži Dashboard karticu benda
    document.getElementById('dashboardEmptyState').style.display = "none";
    document.getElementById('bandCard').style.display = "flex";
    document.getElementById('bandAdminSection').style.display = "none";

    // Prikazujemo ime benda i bedževe uloge
    document.getElementById('bandCardName').innerText = band.name;
    const roleBadge = document.getElementById('bandRoleBadge');
    roleBadge.innerText = band.userRole === 'admin' ? i18n[currentLang].roleAdmin : i18n[currentLang].roleUser;
    roleBadge.className = band.userRole === 'admin' ? 'badge-owner' : 'badge-member';
    document.getElementById('bandCardOwnerName').innerText = currentUserProfile.display_name || currentUserProfile.email;

    // Učitavamo logo benda ako postoji (base64)
    const logoImg = document.getElementById('bandLogoImg');
    const logoPlaceholder = document.getElementById('bandLogoPlaceholderIcon');
    if (band.logo_url && band.logo_url.startsWith('data:image')) {
        logoImg.src = band.logo_url;
        logoImg.style.display = "block";
        logoPlaceholder.style.display = "none";
    } else {
        logoImg.style.display = "none";
        logoPlaceholder.style.display = "block";
    }

    // Sakrivamo Repertoar/Stems prozor i prikazujemo čistu kontrolnu tablu
    document.getElementById('stemsPlayerContainer').style.display = "none";
    document.getElementById('bandDashboard').style.display = "flex";
    
    // Popunjavamo formu za izmenu
    fillBandSettingsFields(band);
}

// Aktivacija pogleda za kreiranje novog benda
function showNewBandCreation() {
    activeBandId = "";
    currentActiveSubView = "";
    renderSidebarBands();
    
    document.getElementById('dashboardEmptyState').style.display = "none";
    document.getElementById('bandCard').style.display = "none";
    document.getElementById('stemsPlayerContainer').style.display = "none";
    document.getElementById('bandDashboard').style.display = "flex";
    
    const adminSec = document.getElementById('bandAdminSection');
    adminSec.style.display = "block";
    document.getElementById('newBandForm').style.display = "block";
    document.getElementById('editBandForm').style.display = "none";
    document.getElementById('membersManagementSection').style.display = "none";

    // Inicijalizujemo geografske selects
    initGeoSelects('newBandCountry', 'newBandCity', 'newBandCustomCountryInput', 'newBandCustomCityInput');
}

// Pravljenje i slanje novog benda u bazu podataka (Sa trostepenom jedinstvenošću)
async function addNewBandSubmit() {
    const name = document.getElementById('newBandName').value.trim();
    const rawUrl = document.getElementById('newBandUrl').value.trim();

    if (!name || !rawUrl) {
        alert(currentLang === 'sr' ? "Popunite sva polja!" : "Please fill out all fields!");
        return;
    }

    const folderId = extractFolderId(rawUrl);

    // Geografski podaci
    const countrySel = document.getElementById('newBandCountry');
    const citySel = document.getElementById('newBandCity');
    
    const country = countrySel.value === "Custom..." ? document.getElementById('newBandCustomCountryInput').value.trim() : countrySel.value;
    const city = citySel.value === "Custom..." ? document.getElementById('newBandCustomCityInput').value.trim() : citySel.value;

    const contactName = document.getElementById('newContactName').value.trim();
    const contactPhone = document.getElementById('newContactPhone').value.trim();
    const website = document.getElementById('newWebsite').value.trim();
    const instagram = document.getElementById('newInstagram').value.trim();

    if (!country || !city) {
        alert(currentLang === 'sr' ? "Popunite državu i grad!" : "Please fill out country and city!");
        return;
    }

    // 1. Provera trostepene jedinstvenosti (Ime benda + Država + Grad)
    const { data: existingBands, error: checkError } = await supabaseClient
        .from('bands')
        .select('*')
        .eq('name', name)
        .eq('country', country)
        .eq('city', city);

    if (checkError) {
        console.error(checkError);
    } else if (existingBands && existingBands.length > 0) {
        alert(currentLang === 'sr' 
            ? `Bend sa nazivom \"${name}\" već postoji u bazi u državi ${country}, grad ${city}!`
            : `A band named \"${name}\" already exists in the database for country ${country}, city ${city}!`
        );
        return;
    }

    // 2. Kreiranje benda u bazi podataka
    const joinCode = 'GL' + Math.floor(100000 + Math.random() * 900000); // 6-cifreni nasumični kod

    const { data: bandData, error: bandError } = await supabaseClient
        .from('bands')
        .insert({
            name,
            raw_url: rawUrl,
            folder_id: folderId,
            join_code: joinCode,
            country,
            city,
            contact_name: contactName,
            contact_phone: contactPhone,
            website,
            instagram
        })
        .select()
        .single();

    if (bandError) {
        alert(bandError.message);
        return;
    }

    // 3. Upis osnivača kao Admina benda u band_members
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
        alert(currentLang === 'sr' ? "Bend je uspešno osnovan!" : "Band successfully created!");
        
        // Reset formulara
        document.getElementById('newBandName').value = "";
        document.getElementById('newBandUrl').value = "";
        document.getElementById('newContactName').value = "";
        document.getElementById('newContactPhone').value = "";
        document.getElementById('newWebsite').value = "";
        document.getElementById('newInstagram').value = "";

        activeBandId = bandData.id;
        await loadUserBands();
    }
}

// Otvaranje sekcije podešavanja iz Dashboard-a ili Sidebara
function toggleBandSettingsSection() {
    if (currentActiveSubView === "settings") {
        currentActiveSubView = "";
        renderSidebarBands();
        document.getElementById('bandAdminSection').style.display = "none";
    } else {
        openSettingsViewFromSidebar();
    }
}

function openSettingsViewFromSidebar(event) {
    if (event) event.stopPropagation();
    currentActiveSubView = "settings";
    renderSidebarBands();

    document.getElementById('stemsPlayerContainer').style.display = "none";
    document.getElementById('bandDashboard').style.display = "flex";
    document.getElementById('dashboardEmptyState').style.display = "none";
    document.getElementById('bandCard').style.display = "flex";
    
    const adminSec = document.getElementById('bandAdminSection');
    const editForm = document.getElementById('editBandForm');
    
    adminSec.style.display = "block";
    editForm.style.display = "block";
    document.getElementById('newBandForm').style.display = "none";
    document.getElementById('membersManagementSection').style.display = "none";

    const band = bands.find(b => b.id === activeBandId);
    if (band) {
        fillBandSettingsFields(band);
    }
}

function fillBandSettingsFields(band) {
    document.getElementById('editBandName').value = band.name || "";
    document.getElementById('editBandUrl').value = band.raw_url || "";
    document.getElementById('editContactName').value = band.contact_name || "";
    document.getElementById('editContactPhone').value = band.contact_phone || "";
    document.getElementById('editWebsite').value = band.website || "";
    document.getElementById('editInstagram').value = band.instagram || "";

    populateGeoFields(
        band.country,
        band.city,
        'editBandCountry',
        'editBandCity',
        'editBandCustomCountryInput',
        'editBandCustomCityInput'
    );

    // Isključujemo polja ako ulogovani korisnik nije Admin / Šef benda
    const isAdmin = band.userRole === 'admin';
    document.getElementById('editBandName').disabled = !isAdmin;
    document.getElementById('editBandUrl').disabled = !isAdmin;
    document.getElementById('editContactName').disabled = !isAdmin;
    document.getElementById('editContactPhone').disabled = !isAdmin;
    document.getElementById('editWebsite').disabled = !isAdmin;
    document.getElementById('editInstagram').disabled = !isAdmin;
    document.getElementById('editBandCountry').disabled = !isAdmin;
    document.getElementById('editBandCity').disabled = !isAdmin;
    document.getElementById('editBandCustomCountryInput').disabled = !isAdmin;
    document.getElementById('editBandCustomCityInput').disabled = !isAdmin;
    
    document.getElementById('renameBtn').style.display = isAdmin ? "inline-block" : "none";
    document.getElementById('deleteBandBtn').style.display = isAdmin ? "inline-block" : "none";
}

// Sačuvanje izmena o nazivu i drajv linku benda (Prebacuje automatski nazad na opcije)
async function updateBandSubmit() {
    const name = document.getElementById('editBandName').value.trim();
    const rawUrl = document.getElementById('editBandUrl').value.trim();

    if (!name || !rawUrl) {
        alert(currentLang === 'sr' ? "Polja ne smeju biti prazna!" : "Fields cannot be empty!");
        return;
    }

    const folderId = extractFolderId(rawUrl);

    // Geografija i kontakt podaci
    const countrySel = document.getElementById('editBandCountry');
    const citySel = document.getElementById('editBandCity');
    const country = countrySel.value === "Custom..." ? document.getElementById('editBandCustomCountryInput').value.trim() : countrySel.value;
    const city = citySel.value === "Custom..." ? document.getElementById('editBandCustomCityInput').value.trim() : citySel.value;

    const contactName = document.getElementById('editContactName').value.trim();
    const contactPhone = document.getElementById('editContactPhone').value.trim();
    const website = document.getElementById('editWebsite').value.trim();
    const instagram = document.getElementById('editInstagram').value.trim();

    const { error } = await supabaseClient
        .from('bands')
        .update({
            name,
            raw_url: rawUrl,
            folder_id: folderId,
            country,
            city,
            contact_name: contactName,
            contact_phone: contactPhone,
            website,
            instagram
        })
        .eq('id', activeBandId);

    if (error) {
        alert(error.message);
    } else {
        alert(currentLang === 'sr' ? "Izmene su uspešno sačuvane!" : "Changes saved successfully!");
        currentActiveSubView = ""; // Vraća na čisti Dashboard
        await loadUserBands();
    }
}

// Trajno brisanje aktivnog benda (Samo Admin)
async function deleteActiveBand() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    if (!confirm(i18n[currentLang].deleteBandConfirm)) return;

    const { error } = await supabaseClient
        .from('bands')
        .delete()
        .eq('id', activeBandId);

    if (error) {
        alert(error.message);
    } else {
        activeBandId = "";
        currentActiveSubView = "";
        await loadUserBands();
    }
}

// Prikaz i kontrola članstva u bendu, pristupnih kodova i učlanjenja
function toggleMembersSection() {
    if (currentActiveSubView === "members") {
        currentActiveSubView = "";
        renderSidebarBands();
        document.getElementById('bandAdminSection').style.display = "none";
    } else {
        openMembersViewFromSidebar();
    }
}

function openMembersViewFromSidebar(event) {
    if (event) event.stopPropagation();
    currentActiveSubView = "members";
    renderSidebarBands();

    document.getElementById('stemsPlayerContainer').style.display = "none";
    document.getElementById('bandDashboard').style.display = "flex";
    document.getElementById('dashboardEmptyState').style.display = "none";
    document.getElementById('bandCard').style.display = "flex";
    
    const adminSec = document.getElementById('bandAdminSection');
    const membersSec = document.getElementById('membersManagementSection');
    
    adminSec.style.display = "block";
    membersSec.style.display = "block";
    document.getElementById('newBandForm').style.display = "none";
    document.getElementById('editBandForm').style.display = "none";

    loadBandMembersData();
}

async function loadBandMembersData() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    document.getElementById('bandJoinCodeDisplay').value = band.join_code;

    // Povlačimo spisak članova i njihove profile
    const { data: membersData, error: mError } = await supabaseClient
        .from('band_members')
        .select(`
            id,
            role,
            user_id,
            profiles:user_id (display_name, email)
        `)
        .eq('band_id', activeBandId);

    const membersListEl = document.getElementById('bandMembersList');
    membersListEl.innerHTML = "";

    const isCurrentUserAdmin = band.userRole === 'admin';

    if (membersData) {
        membersData.forEach(m => {
            const row = document.createElement('div');
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.padding = "8px 12px";
            row.style.backgroundColor = "#1f2335";
            row.style.borderRadius = "6px";
            row.style.marginBottom = "4px";
            
            const profile = m.profiles;
            const name = profile ? (profile.display_name || profile.email) : "Unknown Musician";
            const roleName = m.role === 'admin' ? i18n[currentLang].roleAdmin : i18n[currentLang].roleUser;
            const roleStyle = m.role === 'admin' ? 'color: var(--accent-gold); font-weight:400;' : 'color: var(--text-secondary);';

            // Dugme "Izbaci" ako je trenutni korisnik admin i član nije on sam
            let kickBtnHTML = "";
            if (isCurrentUserAdmin && m.user_id !== currentUserProfile.id) {
                kickBtnHTML = `<button class="btn-kick-small" style="background-color: var(--accent-red); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:0.75em; cursor:pointer;" onclick="kickBandMember('${m.user_id}', '${name}')">${i18n[currentLang].btnKick || 'Izbaci'}</button>`;
            }

            row.innerHTML = `
                <div style=\"display:flex; flex-direction:column; gap:2px;\">
                    <span>🎸 ${name}</span>
                    <span style=\"font-size:0.75em; ${roleStyle}\">${roleName}</span>
                </div>
                ${kickBtnHTML}
            `;
            membersListEl.appendChild(row);
        });
        
        // Dodajemo dugme "Napusti bend" na dnu liste članova
        const leaveContainer = document.createElement('div');
        leaveContainer.style.marginTop = "15px";
        leaveContainer.style.display = "flex";
        leaveContainer.style.justifyContent = "flex-end";
        
        leaveContainer.innerHTML = `
            <button class="btn-stop" style="padding:6px 12px; font-size:0.85em;" onclick="handleLeaveBand()">${i18n[currentLang].btnLeaveBand || 'Napusti bend'}</button>
        `;
        membersListEl.appendChild(leaveContainer);
    }
}

// Funkcija za napuštanje benda (sa gvozdenim pravilom za poslednjeg admina)
async function handleLeaveBand() {
    if (!activeBandId || !currentUserProfile) return;
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    if (!confirm(currentLang === 'sr' ? `Da li ste sigurni da želite da napustite bend \"${band.name}\"?` : `Are you sure you want to leave the band \"${band.name}\"?`)) {
        return;
    }

    // 1. Proveravamo spisak članova i njihove uloge u ovom bendu
    const { data: members, error: mError } = await supabaseClient
        .from('band_members')
        .select('user_id, role')
        .eq('band_id', activeBandId);

    if (mError) {
        alert(mError.message);
        return;
    }

    const admins = members.filter(m => m.role === 'admin');
    const isCurrentUserAdmin = admins.some(a => a.user_id === currentUserProfile.id);

    // Ako je korisnik jedini admin i ima drugih članova, ne može da napusti bend!
    if (isCurrentUserAdmin && admins.length === 1 && members.length > 1) {
        alert(currentLang === 'sr' 
            ? "Ne možete napustiti bend jer ste poslednji admin! Morate prvo dodeliti ulogu admina nekom drugom članu."
            : "You cannot leave the band because you are the last admin! You must first assign the admin role to another member."
        );
        return;
    }

    // Inače, brišemo korisnika iz članstva
    const { error: deleteError } = await supabaseClient
        .from('band_members')
        .delete()
        .eq('band_id', activeBandId)
        .eq('user_id', currentUserProfile.id);

    if (deleteError) {
        alert(deleteError.message);
    } else {
        alert(currentLang === 'sr' ? "Uspešno ste napustili bend!" : "Successfully left the band!");
        activeBandId = "";
        currentActiveSubView = "";
        await loadUserBands();
    }
}

// Funkcija za izbacivanje člana (Samo Admin)
async function kickBandMember(memberUserId, memberName) {
    if (!activeBandId || !currentUserProfile) return;

    if (!confirm(currentLang === 'sr' 
        ? `Da li sigurno želite da izbacite člana \"${memberName}\" iz benda?` 
        : `Are you sure you want to remove \"${memberName}\" from the band?`
    )) {
        return;
    }

    const { error } = await supabaseClient
        .from('band_members')
        .delete()
        .eq('band_id', activeBandId)
        .eq('user_id', memberUserId);

    if (error) {
        alert(error.message);
    } else {
        alert(currentLang === 'sr' ? "Član je uspešno izbačen!" : "Member successfully removed!");
        loadBandMembersData();
    }
}

// Učlanjenje u postojeći bend pomoću pristupnog koda (Upisuje kao 'member')
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

    // Upisujemo korisnika u članstvo (Uloga: Običan član 'member')
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
        currentActiveSubView = "";
        await loadUserBands();
    }
}

// Regeneracija pristupnog koda benda u bazu (Samo Admin)
async function regenerateJoinCode() {
    if (!activeBandId) return;
    
    if (!confirm(currentLang === 'sr' 
        ? "Da li sigurno želite da promenite pristupni kod? Stari kod će prestati da važi!" 
        : "Are you sure you want to regenerate the join code? The old code will stop working!"
    )) {
        return;
    }

    const newCode = 'GL' + Math.floor(100000 + Math.random() * 900000);
    const { error } = await supabaseClient
        .from('bands')
        .update({ join_code: newCode })
        .eq('id', activeBandId);

    if (error) {
        alert(error.message);
    } else {
        document.getElementById('bandJoinCodeDisplay').value = newCode;
        // Osvežavamo lokalni bands niz
        const band = bands.find(b => b.id === activeBandId);
        if (band) band.join_code = newCode;
        alert(currentLang === 'sr' ? "Novi pristupni kod je uspešno kreiran!" : "New join code successfully generated!");
    }
}

function extractFolderId(url) {
    if (!url) return "";
    const match = url.match(/\\/folders\\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
}

// ==========================================================================
// 3. REPERTOAR & AUDIO ENGINE (MULTITRACK WEB AUDIO v1.4.08)
// ==========================================================================

function openSongsView(event) {
    if (event) event.stopPropagation();
    currentActiveSubView = "songs";
    renderSidebarBands();
    
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    document.getElementById('bandDashboard').style.display = "none";
    stemsPlayerContainer.style.display = "flex";
    
    // Osvežavamo i učitavamo pesme sa Google drajva aktivnog benda
    loadSongsFromActiveBand();
}

async function exitRepertoireToDashboard() {
    await cleanAudioEngine();
    currentActiveSubView = "";
    renderSidebarBands();
    
    document.getElementById('stemsPlayerContainer').style.display = "none";
    document.getElementById('bandDashboard').style.display = "flex";
}

async function loadSongsFromActiveBand() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    if (!GOOGLE_API_KEY) {
        songsList.innerHTML = `<div style="padding:15px; color:var(--accent-gold); font-size:0.9em; line-height:1.4;">⚠️ ${i18n[currentLang].apiKeyWarning}</div>`;
        return;
    }

    songsList.innerHTML = `<div style="padding:15px; color:var(--text-muted);">${i18n[currentLang].statusConnecting}</div>`;

    const url = `https://www.googleapis.com/drive/v3/files?q='${band.folder_id}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&key=${GOOGLE_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.files && data.files.length > 0) {
            allSongs = data.files.sort((a, b) => a.name.localeCompare(b.name));
            renderSongsListUI(allSongs);
        } else {
            songsList.innerHTML = `<div style="padding:15px; color:var(--text-muted);">${i18n[currentLang].noSongs}</div>`;
        }
    } catch (err) {
        console.error("Drive connect error:", err);
        songsList.innerHTML = `<div style="padding:15px; color:var(--accent-red);">${i18n[currentLang].statusConnError}</div>`;
    }
}

function renderSongsListUI(songs) {
    songsList.innerHTML = "";
    songs.forEach(song => {
        const item = document.createElement('div');
        item.className = `song-item ${currentSongName === song.name ? 'active' : ''}`;\n        item.innerText = song.name;\n        item.onclick = () => selectSongToPlay(song);\n        songsList.appendChild(item);\n    });\n}\n\nfunction filterSongs(query) {\n    const filtered = allSongs.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));\n    renderSongsListUI(filtered);\n}\n\n// Učitavanje i dekodiranje u RAM sa eliminacijom trkačkih uslova (Race Conditions)\nasync function selectSongToPlay(songFolder) {\n    if (isPlaying) {\n        stopAudio();\n    }\n    \n    await cleanAudioEngine();\n    \n    currentSongName = songFolder.name;\n    renderSongsListUI(allSongs);\n\n    updateStatusText('statusLoading');\n    tracksContainer.innerHTML = \"\";\n    \n    // Na mobilnim telefonima se glatko aktivira prelazak na pun ekran miksete\n    stemsPlayerContainer.classList.add('song-loaded');\n\n    const url = `https://www.googleapis.com/drive/v3/files?q='${songFolder.id}'+in+parents+and+trashed=false&key=${GOOGLE_API_KEY}`;\n\n    try {\n        const response = await fetch(url);\n        const data = await response.json();\n\n        const audioFiles = (data.files || []).filter(f => \n            f.name.endsWith('.mp3') || f.name.endsWith('.wav') || f.name.endsWith('.m4a') || f.name.endsWith('.aac')\n        );\n\n        if (audioFiles.length === 0) {\n            updateStatusText('statusNoFiles');\n            return;\n        }\n\n        // Sortiranje po abecednom redu pre skidanja\n        audioFiles.sort((a, b) => a.name.localeCompare(b.name));\n\n        if (!audioCtx) {\n            audioCtx = new (window.AudioContext || window.webkitAudioContext)();\n        }\n\n        // Fiksiramo veličinu nizova kako bismo predupredili race conditions\n        audioBuffers = new Array(audioFiles.length);\n        trackNames = new Array(audioFiles.length);\n        gainNodes = new Array(audioFiles.length);\n        totalDuration = 0;\n\n        const loadPromises = audioFiles.map(async (file, index) => {\n            const streamUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GOOGLE_API_KEY}`;\n            \n            const res = await fetch(streamUrl);\n            const arrayBuf = await res.arrayBuffer();\n            const decodedBuffer = await audioCtx.decodeAudioData(arrayBuf);\n            \n            // Upisujemo tačno na pripadajući indeks\n            audioBuffers[index] = decodedBuffer;\n            \n            const cleanName = file.name.replace(/\\\\.[^/.]+$/, \"\").replace(/^[0-9]+[_-]/, \"\");\n            const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);\n            trackNames[index] = formattedName;\n\n            if (decodedBuffer.duration > totalDuration) {\n                totalDuration = decodedBuffer.duration;\n            }\n        });\n\n        await Promise.all(loadPromises);\n\n        buildMixerUI();\n        \n        playBtn.disabled = false;\n        stopBtn.disabled = false;\n        updateStatusText('statusReady', audioBuffers.length);\n\n    } catch (err) {\n        console.error(\"Audio load and decode error:\", err);\n        updateStatusText('statusError');\n    }\n}\n\n// Iscrtavanje horizontalnih traka (v1.3.7 stil) sa drag & drop sortom\nfunction buildMixerUI() {\n    tracksContainer.innerHTML = \"\";\n\n    if (!masterGainNode) {\n        masterGainNode = audioCtx.createGain();\n        const savedMasterVol = localStorage.getItem('gigstems_master_volume');\n        const initMasterVol = savedMasterVol !== null ? parseFloat(savedMasterVol) : 0.8;\n        masterGainNode.gain.setValueAtTime(isMasterMuted ? 0 : initMasterVol, audioCtx.currentTime);\n        masterGainNode.connect(audioCtx.destination);\n    }\n\n    // Učitavamo sačuvani mix\n    let savedMix = {};\n    if (currentSongName) {\n        const rawSave = localStorage.getItem('gigstems_mix_' + currentSongName);\n        if (rawSave) {\n            try { savedMix = JSON.parse(rawSave); } catch(e) {}\n        }\n    }\n\n    // Učitavamo sačuvani redosled traka\n    let savedOrder = [];\n    if (currentSongName) {\n        const rawOrder = localStorage.getItem('gigstems_order_' + currentSongName);\n        if (rawOrder) {\n            try { savedOrder = JSON.parse(rawOrder); } catch(e) {}\n        }\n    }\n\n    let orderIndices = trackNames.map((_, i) => i);\n    if (savedOrder && savedOrder.length > 0) {\n        orderIndices.sort((a, b) => {\n            const nameA = trackNames[a];\n            const nameB = trackNames[b];\n            const idxA = savedOrder.indexOf(nameA);\n            const idxB = savedOrder.indexOf(nameB);\n            const posA = idxA === -1 ? 999 : idxA;\n            const posB = idxB === -1 ? 999 : idxB;\n            return posA - posB;\n        });\n    }\n\n    orderIndices.forEach((index) => {\n        const name = trackNames[index];\n        const trackPreset = savedMix[name] || { volume: 0.8, muted: false, solo: false };\n\n        const gainNode = audioCtx.createGain();\n        gainNode.gain.value = trackPreset.muted ? 0 : trackPreset.volume;\n        gainNode.connect(masterGainNode);\n        gainNodes[index] = gainNode; // fiksiran originalni indeks u gainNodes\n\n        const strip = document.createElement('div');\n        strip.className = 'track-strip';\n        strip.setAttribute('draggable', 'true');\n        strip.setAttribute('data-index', index);\n\n        const muteClass = trackPreset.muted ? \"btn-mute active\" : \"btn-mute\";\n        const soloClass = trackPreset.solo ? \"btn-solo active\" : \"btn-solo\";\n\n        strip.innerHTML = `\n            <div class=\"drag-handle\" title=\"Prevucite da promenite redosled\">☰</div>\n            <div class=\"track-name\" title=\"${name}\">${name}</div>\n            <div class=\"volume-slider-container\">\n                <input type=\"range\" id=\"volumeSlider-${index}\" class=\"volume-slider\" min=\"0\" max=\"1.2\" step=\"0.01\" value=\"${trackPreset.volume}\" oninput=\"setVolume(${index}, this.value)\">\n            </div>\n            <button id=\"muteBtn-${index}\" class=\"${muteClass}\" onclick=\"toggleMute(${index})\">MUTE</button>\n            <button id=\"soloBtn-${index}\" class=\"${soloClass}\" onclick=\"toggleSolo(${index})\">SOLO</button>\n        `;\n        tracksContainer.appendChild(strip);\n    });\n\n    applyGainsFromUI();\n    makeMixerSortable();\n}\n\nfunction applyGainsFromUI() {\n    if (!audioCtx) return;\n    \n    let isAnySoloActive = false;\n    trackNames.forEach((_, i) => {\n        const soloBtn = document.getElementById(`soloBtn-${i}`);\n        if (soloBtn && soloBtn.classList.contains('active')) {\n            isAnySoloActive = true;\n        }\n    });\n\n    trackNames.forEach((_, i) => {\n        const slider = document.getElementById(`volumeSlider-${i}`);\n        const muteBtn = document.getElementById(`muteBtn-${i}`);\n        const soloBtn = document.getElementById(`soloBtn-${i}`);\n\n        const vol = slider ? parseFloat(slider.value) : 0.8;\n        const isMuted = muteBtn ? muteBtn.classList.contains('active') : false;\n        const isSolo = soloBtn ? soloBtn.classList.contains('active') : false;\n\n        let finalGain = vol;\n        if (isMuted) {\n            finalGain = 0;\n        } else if (isAnySoloActive && !isSolo) {\n            finalGain = 0;\n        }\n\n        if (gainNodes[i]) {\n            gainNodes[i].gain.setValueAtTime(finalGain, audioCtx.currentTime);\n        }\n    });\n}\n\nfunction setVolume(index, value) {\n    applyGainsFromUI();\n    saveMixState();\n}\n\nfunction toggleMute(index) {\n    const btn = document.getElementById(`muteBtn-${index}`);\n    if (btn) btn.classList.toggle('active');\n    applyGainsFromUI();\n    saveMixState();\n}\n\n// Popravljen Solo krug\nfunction toggleSolo(index) {\n    const btn = document.getElementById(`soloBtn-${index}`);\n    if (btn) btn.classList.toggle('active');\n    applyGainsFromUI();\n    saveMixState();\n}\n\nfunction saveMixState() {\n    if (!currentSongName) return;\n    const mixState = {};\n    trackNames.forEach((name, index) => {\n        const slider = document.getElementById(`volumeSlider-${index}`);\n        const muteBtn = document.getElementById(`muteBtn-${index}`);\n        const soloBtn = document.getElementById(`soloBtn-${index}`);\n\n        mixState[name] = {\n            volume: slider ? parseFloat(slider.value) : 0.8,\n            muted: muteBtn ? muteBtn.classList.contains('active') : false,\n            solo: soloBtn ? soloBtn.classList.contains('active') : false\n        };\n    });\n    localStorage.setItem('gigstems_mix_' + currentSongName, JSON.stringify(mixState));\n}\n\nfunction saveTrackOrder() {\n    if (!currentSongName) return;\n    const strips = tracksContainer.querySelectorAll('.track-strip');\n    const order = [];\n    strips.forEach(strip => {\n        const index = parseInt(strip.getAttribute('data-index'));\n        order.push(trackNames[index]);\n    });\n    localStorage.setItem('gigstems_order_' + currentSongName, JSON.stringify(order));\n}\n\nfunction makeMixerSortable() {\n    const strips = tracksContainer.querySelectorAll('.track-strip');\n    \n    strips.forEach(strip => {\n        strip.addEventListener('dragstart', (e) => {\n            e.dataTransfer.setData('text/plain', strip.getAttribute('data-index'));\n            strip.classList.add('dragging');\n        });\n        \n        strip.addEventListener('dragend', () => {\n            strip.classList.remove('dragging');\n            saveTrackOrder();\n        });\n    });\n\n    tracksContainer.addEventListener('dragover', (e) => {\n        e.preventDefault();\n        const draggingElement = tracksContainer.querySelector('.dragging');\n        if (!draggingElement) return;\n\n        const afterElement = getDragAfterElement(tracksContainer, e.clientY);\n        if (afterElement == null) {\n            tracksContainer.appendChild(draggingElement);\n        } else {\n            tracksContainer.insertBefore(draggingElement, afterElement);\n        }\n    });\n}\n\nfunction getDragAfterElement(container, y) {\n    const draggableElements = [...container.querySelectorAll('.track-strip:not(.dragging)')];\n    return draggableElements.reduce((closest, child) => {\n        const box = child.getBoundingClientRect();\n        const offset = y - box.top - box.height / 2;\n        if (offset < 0 && offset > closest.offset) {\n            return { offset: offset, element: child };\n        } else {\n            return closest;\n        }\n    }, { offset: Number.NEGATIVE_INFINITY }).element;\n}\n\nfunction setMasterVolume(val) {\n    localStorage.setItem('gigstems_master_volume', val);\n    if (audioCtx && masterGainNode && !isMasterMuted) {\n        masterGainNode.gain.setValueAtTime(parseFloat(val), audioCtx.currentTime);\n    }\n}\n\nfunction toggleMasterMute() {\n    const btn = document.getElementById('masterMuteBtn');\n    isMasterMuted = !isMasterMuted;\n    \n    if (isMasterMuted) {\n        btn.classList.add('active');\n        btn.innerText = currentLang === 'sr' ? \"ODMUTIRAJ SVE\" : \"UNMUTE ALL\";\n        if (audioCtx && masterGainNode) {\n            masterGainNode.gain.setValueAtTime(0, audioCtx.currentTime);\n        }\n    } else {\n        btn.classList.remove('active');\n        btn.innerText = i18n[currentLang].masterMuteBtn;\n        const sliderVal = parseFloat(document.getElementById('masterVolumeSlider').value);\n        if (audioCtx && masterGainNode) {\n            masterGainNode.gain.setValueAtTime(sliderVal, audioCtx.currentTime);\n        }\n    }\n}\n\nfunction togglePlay() {\n    if (!audioCtx) return;\n\n    if (audioCtx.state === 'suspended') {\n        audioCtx.resume();\n    }\n\n    if (isPlaying) {\n        pauseOffset += audioCtx.currentTime - startTime;\n        stopSourceNodes();\n        isPlaying = false;\n        updatePlayBtnUI();\n        clearInterval(timerInterval);\n    } else {\n        startSourceNodes(pauseOffset);\n        startTime = audioCtx.currentTime;\n        isPlaying = true;\n        updatePlayBtnUI();\n        timerInterval = setInterval(updateAudioTimer, 250);\n    }\n}\n\nfunction startSourceNodes(offset = 0) {\n    sourceNodes = [];\n    audioBuffers.forEach((buffer, index) => {\n        if (!buffer) return;\n        const source = audioCtx.createBufferSource();\n        source.buffer = buffer;\n        source.connect(gainNodes[index]);\n        \n        const duration = buffer.duration;\n        if (offset < duration) {\n            source.start(0, offset);\n        } else {\n            source.start(0, duration);\n        }\n        sourceNodes.push(source);\n    });\n}\n\nfunction stopSourceNodes() {\n    sourceNodes.forEach(node => {\n        try { node.stop(); } catch(e) {}\n    });\n    sourceNodes = [];\n}\n\nfunction stopAudio() {\n    stopSourceNodes();\n    isPlaying = false;\n    pauseOffset = 0;\n    updatePlayBtnUI();\n    document.getElementById('currentTime').innerText = \"00:00\";\n    document.getElementById('seekBar').value = 0;\n    clearInterval(timerInterval);\n}\n\nfunction updateAudioTimer() {\n    if (!isPlaying) return;\n    const elapsed = pauseOffset + (audioCtx.currentTime - startTime);\n    \n    if (elapsed >= totalDuration) {\n        stopAudio();\n        return;\n    }\n\n    document.getElementById('currentTime').innerText = formatTime(elapsed);\n    document.getElementById('seekBar').value = (elapsed / totalDuration) * 100;\n}\n\nfunction formatTime(seconds) {\n    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');\n    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');\n    return `${mins}:${secs}`;\n}\n\nfunction updatePlayBtnUI() {\n    const span = playBtn.querySelector('span');\n    if (isPlaying) {\n        playBtn.classList.add('active');\n        span.innerText = i18n[currentLang].pauseBtn;\n    } else {\n        playBtn.classList.remove('active');\n        span.innerText = i18n[currentLang].playBtn;\n    }\n}\n\n// Gvozdeno čišćenje privremenih bafere i RAM-a\nasync function cleanAudioEngine() {\n    stopAudio();\n    \n    if (audioCtx) {\n        try {\n            await audioCtx.close();\n        } catch (e) {\n            console.warn(\"AudioContext closing issue:\", e);\n        }\n        audioCtx = null;\n    }\n\n    audioBuffers = [];\n    sourceNodes = [];\n    gainNodes = [];\n    currentSongName = \"\";\n    masterGainNode = null;\n    \n    tracksContainer.innerHTML = \"\";\n    \n    playBtn.disabled = true;\n    stopBtn.disabled = true;\n    updateStatusText('statusInit');\n}\n\nfunction resetAudioState() {\n    cleanAudioEngine();\n}\n\n// ==========================================================================\n// 4. AVATARS AND LOGO IMAGE UPLOADS\n// ==========================================================================\n\nfunction triggerAvatarUpload() {\n    document.getElementById('avatarFileInput').click();\n}\n\nasync function handleAvatarUpload(input) {\n    if (input.files && input.files[0] && currentUserProfile) {\n        const file = input.files[0];\n        const reader = new FileReader();\n        \n        reader.onload = async (e) => {\n            const base64Data = e.target.result;\n            \n            const { error } = await supabaseClient\n                .from('profiles')\n                .update({ avatar_url: base64Data })\n                .eq('id', currentUserProfile.id);\n                \n            if (error) {\n                alert(\"Avatar upload error: \" + error.message);\n            } else {\n                currentUserProfile.avatar_url = base64Data;\n                renderUserProfilesUI();\n                alert(currentLang === 'sr' ? \"Slika profila je uspešno postavljena!\" : \"Profile picture uploaded successfully!\");\n            }\n        };\n        reader.readAsDataURL(file);\n    }\n}\n\nfunction triggerLogoUpload() {\n    const band = bands.find(b => b.id === activeBandId);\n    if (band && band.userRole === 'admin') {\n        document.getElementById('bandLogoFileInput').click();\n    }\n}\n\nasync function handleLogoUpload(input) {\n    if (input.files && input.files[0] && activeBandId) {\n        const file = input.files[0];\n        const spinner = document.getElementById('logoLoadingSpinner');\n        spinner.style.display = \"block\";\n        \n        const reader = new FileReader();\n        reader.onload = async (e) => {\n            const base64Data = e.target.result;\n            \n            const { error } = await supabaseClient\n                .from('bands')\n                .update({ logo_url: base64Data })\n                .eq('id', activeBandId);\n                \n            spinner.style.display = \"none\";\n            if (error) {\n                alert(\"Logo upload error: \" + error.message);\n            } else {\n                // Osvežavamo i lokalni bands niz\n                const band = bands.find(b => b.id === activeBandId);\n                if (band) band.logo_url = base64Data;\n                \n                const logoImg = document.getElementById('bandLogoImg');\n                const logoPlaceholder = document.getElementById('bandLogoPlaceholderIcon');\n                logoImg.src = base64Data;\n                logoImg.style.display = \"block\";\n                logoPlaceholder.style.display = \"none\";\n                \n                alert(currentLang === 'sr' ? \"Logo benda je uspešno postavljen!\" : \"Band logo uploaded successfully!\");\n            }\n        };\n        reader.readAsDataURL(file);\n    }\n}\n\n// ==========================================================================\n// 5. USER SETTINGS AND POPUPS\n// ==========================================================================\n\nfunction toggleProfileMenu(event) {\n    if (event) event.stopPropagation();\n    const menu = document.getElementById('profilePopupMenu');\n    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';\n}\n\nfunction closeProfileMenu() {\n    document.getElementById('profilePopupMenu').style.display = 'none';\n}\n\ndocument.addEventListener('click', () => {\n    closeProfileMenu();\n});\n\nfunction openSettingsModal() {\n    document.getElementById('settingsModal').style.display = \"flex\";\n    switchSettingsTab('Regional');\n    loadSavedSettings();\n}\n\nfunction closeSettingsModal() {\n    document.getElementById('settingsModal').style.display = \"none\";\n}\n\nfunction switchSettingsTab(tabId) {\n    document.querySelectorAll('.modal-tab-content').forEach(el => el.style.display = 'none');\n    document.querySelectorAll('.modal-tab').forEach(el => el.classList.remove('active'));\n    \n    document.getElementById(`settingsTab${tabId}`).style.display = 'block';\n    document.getElementById(`tabBtn${tabId}`).classList.add('active');\n}\n\nasync function saveSettings() {\n    const timeFormat = document.getElementById('settingTimeFormat').value;\n    const dateFormat = document.getElementById('settingDateFormat').value;\n    const timezone = document.getElementById('settingTimezone').value;\n    \n    localStorage.setItem('gigstems_time_format', timeFormat);\n    localStorage.setItem('gigstems_date_format', dateFormat);\n    localStorage.setItem('gigstems_timezone', timezone);\n    \n    const newName = document.getElementById('settingDisplayName').value.trim();\n    \n    // Geografija i jezik za korisnika\n    const langSel = document.getElementById('settingLanguage');\n    const selectedLang = langSel.value;\n    \n    const countrySel = document.getElementById('settingCountry');\n    const citySel = document.getElementById('settingCity');\n    const country = countrySel.value === \"Custom...\" ? document.getElementById('settingCustomCountryInput').value.trim() : countrySel.value;\n    const city = citySel.value === \"Custom...\" ? document.getElementById('settingCustomCityInput').value.trim() : citySel.value;\n\n    if (currentUserProfile) {\n        const { error } = await supabaseClient\n            .from('profiles')\n            .update({ \n                display_name: newName || currentUserProfile.display_name,\n                language: selectedLang,\n                country: country,\n                city: city\n            })\n            .eq('id', currentUserProfile.id);\n\n        if (error) {\n            alert(\"Error updating profile: \" + error.message);\n            return;\n        } else {\n            currentUserProfile.display_name = newName || currentUserProfile.display_name;\n            currentUserProfile.language = selectedLang;\n            currentUserProfile.country = country;\n            currentUserProfile.city = city;\n            \n            localStorage.setItem('gigstems_lang', selectedLang);\n            \n            if (selectedLang !== currentLang) {\n                currentLang = selectedLang;\n                window.location.reload();\n                return;\n            }\n        }\n    }\n\n    const newPass = document.getElementById('settingNewPassword').value.trim();\n    if (newPass) {\n        if (newPass.length < 6) {\n            alert(currentLang === 'sr' ? \"Lozinka mora imati bar 6 karaktera!\" : \"Password must be at least 6 characters!\");\n            return;\n        }\n        const { error } = await supabaseClient.auth.updateUser({ password: newPass });\n        if (error) {\n            alert(\"Password change error: \" + error.message);\n            return;\n        } else {\n            alert(currentLang === 'sr' ? \"Lozinka uspešno promenjena!\" : \"Password successfully changed!\");\n            document.getElementById('settingNewPassword').value = \"\";\n        }\n    }\n\n    renderUserProfilesUI();\n    closeSettingsModal();\n}\n\nfunction loadSavedSettings() {\n    document.getElementById('settingTimeFormat').value = localStorage.getItem('gigstems_time_format') || '24h';\n    document.getElementById('settingDateFormat').value = localStorage.getItem('gigstems_date_format') || 'dd.mm.yyyy';\n    document.getElementById('settingTimezone').value = localStorage.getItem('gigstems_timezone') || 'Europe/Belgrade';\n\n    if (currentUserProfile) {\n        document.getElementById('settingLanguage').value = currentUserProfile.language || currentLang;\n        populateGeoFields(\n            currentUserProfile.country,\n            currentUserProfile.city,\n            'settingCountry',\n            'settingCity',\n            'settingCustomCountryInput',\n            'settingCustomCityInput'\n        );\n    } else {\n        initGeoSelects('settingCountry', 'settingCity', 'settingCustomCountryInput', 'settingCustomCityInput');\n    }\n}\n\n// ==========================================================================\n// 6. SUPPORT TICKETS\n// ==========================================================================\n\nfunction toggleSupportModal() {\n    const modal = document.getElementById('supportModal');\n    if (modal.style.display === \"none\") {\n        modal.style.display = \"flex\";\n        document.getElementById('supportSubject').value = \"\";\n        document.getElementById('supportMessage').value = \"\";\n    } else {\n        modal.style.display = \"none\";\n    }\n}\n\nasync function submitSupportTicket() {\n    if (!currentUserProfile) return;\n    const subject = document.getElementById('supportSubject').value.trim();\n    const message = document.getElementById('supportMessage').value.trim();\n\n    if (!subject || !message) {\n        alert(currentLang === 'sr' ? \"Sva polja su obavezna!\" : \"All fields are required!\");\n        return;\n    }\n\n    const { error } = await supabaseClient\n        .from('support_tickets')\n        .insert({\n            user_id: currentUserProfile.id,\n            user_email: currentUserProfile.email,\n            subject: subject,\n            message: message\n        });\n\n    if (error) {\n        alert(error.message);\n    } else {\n        alert(currentLang === 'sr' ? \"Vaša poruka je uspešno poslata podršci!\" : \"Your message was successfully sent to support!\");\n        toggleSupportModal();\n    }\n}\n\n// ==========================================================================\n// 7. RESPONSIVE SIDEPANEL & GEOGRAPHY INPUT ACTIONS\n// ==========================================================================\n\nfunction toggleMobileSidebar() {\n    const sidebar = document.getElementById('appSidebar');\n    const overlay = document.getElementById('sidebarOverlay');\n    sidebar.classList.toggle('open');\n    overlay.classList.toggle('open');\n}\n\nfunction closeAllMobilePanels() {\n    const sidebar = document.getElementById('appSidebar');\n    const overlay = document.getElementById('sidebarOverlay');\n    sidebar.classList.remove('open');\n    overlay.classList.remove('open');\n}\n\nfunction initGeoSelects(countrySelectId, citySelectId, customCountryId, customCityId) {\n    const countrySel = document.getElementById(countrySelectId);\n    countrySel.innerHTML = '<option value=\"\">-- Izaberi državu --</option>';\n    \n    Object.keys(geoDb).forEach(country => {\n        const opt = document.createElement('option');\n        opt.value = country;\n        opt.innerText = country;\n        countrySel.appendChild(opt);\n    });\n}\n\nfunction handleCountryChange(selectEl, citySelectId, customCountryId, customCityId) {\n    const country = selectEl.value;\n    const citySel = document.getElementById(citySelectId);\n    const customCountryInput = document.getElementById(customCountryId);\n    const customCityInput = document.getElementById(customCityId);\n\n    citySel.innerHTML = '<option value=\"\">-- Izaberi grad --</option>';\n    citySel.disabled = true;\n    \n    if (customCountryInput) customCountryInput.style.display = \"none\";\n    if (customCityInput) customCityInput.style.display = \"none\";\n\n    if (!country) return;\n\n    if (country === \"Custom...\") {\n        if (customCountryInput) customCountryInput.style.display = \"block\";\n        if (customCityInput) customCityInput.style.display = \"block\";\n        citySel.innerHTML = '<option value=\"Custom...\">Custom...</option>';\n        citySel.value = \"Custom...\";\n        citySel.disabled = false;\n        return;\n    }\n\n    const cities = geoDb[country] || [];\n    cities.forEach(city => {\n        const opt = document.createElement('option');\n        opt.value = city;\n        opt.innerText = city;\n        citySel.appendChild(opt);\n    });\n\n    const optCustom = document.createElement('option');\n    optCustom.value = \"Custom...\";\n    optCustom.innerText = \"Custom...\";\n    citySel.appendChild(optCustom);\n\n    citySel.disabled = false;\n}\n\nfunction handleCityChange(selectEl, customCityId) {\n    const city = selectEl.value;\n    const customCityInput = document.getElementById(customCityId);\n\n    if (city === \"Custom...\") {\n        if (customCityInput) customCityInput.style.display = \"block\";\n    } else {\n        if (customCityInput) customCityInput.style.display = \"none\";\n    }\n}\n\nfunction populateGeoFields(country, city, countrySelectId, citySelectId, customCountryId, customCityId) {\n    const countrySel = document.getElementById(countrySelectId);\n    const citySel = document.getElementById(citySelectId);\n    const customCountryInput = document.getElementById(customCountryId);\n    const customCityInput = document.getElementById(customCityId);\n\n    // Inicijalizacija država ako je prazno\n    if (countrySel.options.length <= 1) {\n        countrySel.innerHTML = '<option value=\"\">-- Izaberi državu --</option>';\n        Object.keys(geoDb).forEach(c => {\n            const opt = document.createElement('option');\n            opt.value = c;\n            opt.innerText = c;\n            countrySel.appendChild(opt);\n        });\n    }\n\n    if (!country) {\n        countrySel.value = \"\";\n        citySel.innerHTML = '<option value=\"\">-- Izaberi grad --</option>';\n        citySel.disabled = true;\n        customCountryInput.style.display = \"none\";\n        customCityInput.style.display = \"none\";\n        return;\n    }\n\n    if (geoDb[country]) {\n        countrySel.value = country;\n        customCountryInput.style.display = \"none\";\n        \n        citySel.innerHTML = '<option value=\"\">-- Izaberi grad --</option>';\n        geoDb[country].forEach(c => {\n            const opt = document.createElement('option');\n            opt.value = c;\n            opt.innerText = c;\n            citySel.appendChild(opt);\n        });\n        const optCustom = document.createElement('option');\n        optCustom.value = \"Custom...\";\n        optCustom.innerText = \"Custom...\";\n        citySel.appendChild(optCustom);\n        \n        citySel.disabled = false;\n\n        if (geoDb[country].includes(city)) {\n            citySel.value = city;\n            customCityInput.style.display = \"none\";\n        } else if (city) {\n            citySel.value = \"Custom...\";\n            customCityInput.style.display = \"block\";\n            customCityInput.value = city;\n        } else {\n            citySel.value = \"\";\n            customCityInput.style.display = \"none\";\n        }\n    } else {\n        countrySel.value = \"Custom...\";\n        customCountryInput.style.display = \"block\";\n        customCountryInput.value = country;\n\n        citySel.innerHTML = '<option value=\"Custom...\">Custom...</option>';\n        citySel.value = \"Custom...\";\n        citySel.disabled = false;\n        \n        customCityInput.style.display = \"block\";\n        customCityInput.value = city || \"\";\n    }\n}\n\n// ==========================================================================\n// 8. GLOBAL TRANSLATION SETTER\n// ==========================================================================\n\nfunction updateStatusText(key, count = 0) {\n    let text = i18n[currentLang][key] || key;\n    if (count > 0) {\n        text = text.replace('{count}', count);\n    }\n    statusLabel.innerText = text;\n}\n\nfunction setLanguage(lang) {\n    currentLang = lang;\n    localStorage.setItem('gigstems_lang', lang);\n    \n    document.querySelectorAll('.btn-lang').forEach(btn => btn.classList.remove('active'));\n    const btnSR = document.getElementById('btnLangSR');\n    const btnEN = document.getElementById('btnLangEN');\n    const sLangSR = document.getElementById('sidebarLangSR');\n    const sLangEN = document.getElementById('sidebarLangEN');\n    \n    if (btnSR) btnSR.classList.toggle('active', lang === 'sr');\n    if (btnEN) btnEN.classList.toggle('active', lang === 'en');\n    if (sLangSR) sLangSR.classList.toggle('active', lang === 'sr');\n    if (sLangEN) sLangEN.classList.toggle('active', lang === 'en');\n\n    // Ažuriranje statičkih labela u aplikaciji\n    document.getElementById('songsTitle').innerText = i18n[lang].songsTitle;\n    document.getElementById('searchInput').placeholder = i18n[lang].searchPlaceholder;\n    document.getElementById('playBtn').querySelector('span').innerText = isPlaying ? i18n[lang].pauseBtn : i18n[lang].playBtn;\n    document.getElementById('stopBtn').querySelector('span').innerText = i18n[lang].stopBtn;\n    document.getElementById('masterMuteBtn').innerText = isMasterMuted ? (lang === 'sr' ? \"ODMUTIRAJ SVE\" : \"UNMUTE ALL\") : i18n[lang].masterMuteBtn;\n    document.getElementById('masterVolLabel').innerText = i18n[lang].masterVolLabel;\n    \n    document.getElementById('joinCodeTitle').innerText = i18n[lang].bandCodeTitle;\n    document.getElementById('joinCodeLabel').innerText = i18n[lang].joinCodeLabel;\n    document.getElementById('joinCodeInput').placeholder = i18n[lang].joinCodePlaceholder;\n    document.getElementById('joinCodeSubmitBtn').innerText = i18n[lang].joinCodeBtn;\n    \n    document.getElementById('addSectionTitle').innerText = i18n[lang].addSectionTitle;\n    document.getElementById('bandNameLabel').innerText = i18n[lang].bandNameLabel;\n    document.getElementById('bandUrlLabel').innerText = i18n[lang].bandUrlLabel;\n    document.getElementById('connectBtn').innerText = i18n[lang].connectBtn;\n\n    document.getElementById('sidebarBandsHeader').innerText = i18n[lang].navBands;\n    document.getElementById('btnNewBandSidebar').innerText = i18n[lang].btnNewBand;\n    document.getElementById('btnNewBandDashboard').innerText = i18n[lang].btnNewBand;\n    document.getElementById('bandDashboardMainTitle').innerText = \"🎸 \" + (lang === 'sr' ? \"GigLab Kontrolna Tabla\" : \"GigLab Dashboard\");\n\n    document.getElementById('btnBackToDashboardLink').innerText = i18n[lang].btnBackToDashboard;\n    document.getElementById('btnSongsText').innerText = i18n[lang].songsBadge;\n    document.getElementById('bandLogoUploadText').innerText = i18n[lang].uploadLogo;\n\n    // Modal podešavanja\n    document.getElementById('modalSettingsTitle').innerText = i18n[lang].settingsTitle;\n    document.getElementById('tabBtnRegional').innerText = i18n[lang].tabRegional;\n    document.getElementById('tabBtnProfile').innerText = i18n[lang].tabProfile;\n    document.getElementById('tabBtnPassword').innerText = i18n[lang].tabPassword;\n    document.getElementById('tabBtnAccount').innerText = i18n[lang].tabAccount;\n    document.getElementById('timeFormatLabel').innerText = i18n[lang].timeFormatLabel;\n    document.getElementById('dateFormatLabel').innerText = i18n[lang].dateFormatLabel;\n    document.getElementById('timezoneLabel').innerText = i18n[lang].timezoneLabel;\n    document.getElementById('profileEmailLabel').innerText = i18n[lang].authEmail;\n    document.getElementById('profileNameLabel').innerText = i18n[lang].authDisplayName;\n    document.getElementById('newPasswordLabel').innerText = i18n[lang].authPassword;\n    document.getElementById('deleteAccountText').innerText = i18n[lang].deleteAccountText;\n    document.getElementById('btnDeleteAccount').innerText = i18n[lang].btnDeleteAccount;\n    document.getElementById('btnUploadAvatar').innerText = i18n[lang].uploadAvatar;\n    document.getElementById('popMenuSettings').innerText = \"⚙️ \" + (lang === 'sr' ? \"Podešavanja\" : \"Settings\");\n    document.getElementById('popMenuLogout').innerText = \"🚪 \" + i18n[lang].authLogout;\n\n    // Support modal\n    document.getElementById('supportModalTitle').innerText = \"💬 \" + (lang === 'sr' ? \"Prijavi problem\" : \"Report a problem\");\n    document.getElementById('supportSubjectLabel').innerText = lang === 'sr' ? \"Naslov poruke:\" : \"Message subject:\";\n    document.getElementById('supportSubject').placeholder = lang === 'sr' ? \"Npr. Problem sa očitavanjem traka\" : \"E.g. Problem loading stems\";\n    document.getElementById('supportMessageLabel').innerText = lang === 'sr' ? \"Opis problema / primedba:\" : \"Problem description / feedback:\";\n    document.getElementById('supportMessage').placeholder = lang === 'sr' ? \"Unesi opis problema ili primedbu ovde...\" : \"Enter problem description or feedback here...\";\n    document.getElementById('supportSendBtn').innerText = lang === 'sr' ? \"Pošalji\" : \"Send\";\n\n    // Login ekran labele\n    document.getElementById('authDisplayNameLabel').innerText = i18n[lang].authDisplayName;\n    document.getElementById('authDisplayNameInput').placeholder = lang === 'sr' ? \"Npr. Marko Marković\" : \"E.g. John Bassist\";\n    document.getElementById('authEmailLabel').innerText = i18n[lang].authEmail;\n    document.getElementById('authPasswordLabel').innerText = i18n[lang].authPassword;\n\n    // OTP tekstovi\n    document.getElementById('otpSubText').innerHTML = i18n[lang].verificationSub;\n    document.getElementById('otpVerifyBtn').innerText = i18n[lang].btnVerify;\n    document.getElementById('otpCancelBtn').innerText = i18n[lang].btnBackToAuth;\n\n    // Osvežavamo login labele bez šaltanja\n    const title = document.getElementById('authTitle');\n    const submitBtn = document.getElementById('authSubmitBtn');\n    const switchLink = document.getElementById('authSwitchLink');\n\n    if (!isOTPMode) {\n        if (isRegisterMode) {\n            title.innerText = i18n[lang].authTitleRegister;\n            submitBtn.innerText = i18n[lang].authBtnRegister;\n            switchLink.innerText = i18n[lang].authSwitchToLogin;\n        } else {\n            title.innerText = i18n[lang].authTitleLogin;\n            submitBtn.innerText = i18n[lang].authBtnLogin;\n            switchLink.innerText = i18n[lang].authSwitchToRegister;\n        }\n    } else {\n        title.innerText = i18n[lang].verificationText;\n    }\n\n    if (!currentSongName) {\n        updateStatusText('statusInit');\n    }\n\n    // Ponovo iscrtavamo sve dinamičke liste radi prevoda uloga\n    if (activeBandId) {\n        const band = bands.find(b => b.id === activeBandId);\n        if (band) {\n            const roleBadge = document.getElementById('bandRoleBadge');\n            roleBadge.innerText = band.userRole === 'admin' ? i18n[lang].roleAdmin : i18n[lang].roleUser;\n            roleBadge.className = band.userRole === 'admin' ? 'badge-owner' : 'badge-member';\n        }\n    }\n}\n\nwindow.onload = () => {\n    loadSavedSettings();\n    setLanguage(currentLang);\n};\n"""

with open("/workspace/scratch/app.js", "w") as f:
    f.write(app_js_code)
print("app.js successfully written!")
"""

with open("/workspace/scratch/build_1_4_08_app.py", "w") as f:
    f.write(app_js_code)
print("build_1_4_08_app.py successfully written!")
