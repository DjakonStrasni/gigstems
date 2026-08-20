// ==========================================================================
// GIGLAB WEB APP - CORE JAVASCRIPT LOGIC (VERZIJA 1.4.07)
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

// Držanje stanja uloga i bendova
let bands = [];
let activeBandId = "";
let expandedBandId = ""; // Prati koji je bend trenutno otvoren u meniju
let currentSongName = "";
let allSongs = [];
let currentUserProfile = null;
let currentTab = "dashboard";

// Pamćenje i učitavanje izabranog jezika iz Local Storage-a
let currentLang = localStorage.getItem('gigstems_lang') || 'sr';
let isRegisterMode = false;

// Predefinisani spisak država i njihovih gradova za standardizaciju
const countryRegistry = {
    "Srbija": ["Beograd", "Novi Sad", "Niš", "Kragujevac", "Subotica", "Leskovac", "Kruševac", "Kraljevo", "Pančevo", "Čačak", "Šabac", "Novi Pazar", "Zrenjanin", "Smederevo", "Vranje", "Užice", "Valjevo"],
    "Hrvatska": ["Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Pula", "Slavonski Brod", "Karlovac", "Varaždin", "Šibenik", "Sisak", "Dubrovnik"],
    "Bosna i Hercegovina": ["Sarajevo", "Banja Luka", "Tuzla", "Zenica", "Mostar", "Bijeljina", "Brčko", "Bihać", "Doboj", "Prijedor", "Trebinje"],
    "Crna Gora": ["Podgorica", "Nikšić", "Herceg Novi", "Pljevlja", "Bar", "Budva", "Cetinje", "Kotor", "Tivat"],
    "Slovenija": ["Ljubljana", "Maribor", "Celje", "Kranj", "Koper", "Velenje", "Novo Mesto"],
    "Makedonija": ["Skoplje", "Bitolj", "Kumanovo", "Prilep", "Tetovo", "Ohrid", "Veles"]
};

// DOM elementi
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const statusLabel = document.getElementById('statusLabel');
const songsList = document.getElementById('songsList');
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');

// URL Čišćenje tokena u realnom vremenu
if (window.location.hash && window.location.hash.includes('access_token')) {
    setTimeout(() => {
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
    }, 600);
}

// ==========================================================================
// 1. AUTENTIFIKACIJA (Supabase Auth & Profiles)
// ==========================================================================

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
        document.getElementById('currentUserName').innerText = data.display_name || user.email;
        document.getElementById('currentUserName').title = user.email;
        
        // Avatar krug
        const avatarCircle = document.getElementById('userAvatarCircle');
        if (data.avatar_url) {
            avatarCircle.innerHTML = `<img src="${data.avatar_url}" alt="avatar">`;
        } else {
            const firstLetter = (data.display_name || user.email).charAt(0).toUpperCase();
            avatarCircle.innerText = firstLetter;
        }

        // Popunjavanje polja u modal podešavanjima
        document.getElementById('settingDisplayName').value = data.display_name || "";
        document.getElementById('settingEmail').value = data.email || user.email;

        // Učitavamo bendove za ulogovanog korisnika
        loadUserBands();
    }
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const switchLink = document.getElementById('authSwitchLink');
    const displayNameGroup = document.getElementById('authDisplayNameGroup');
    const otpGroup = document.getElementById('authOtpGroup');
    
    otpGroup.style.display = "none";
    document.getElementById('authFieldsGroup').style.display = "block";
    submitBtn.style.display = "block";

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
            showOtpScreen(email);
        }
    } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes("Email not confirmed") || error.message.includes("confirm")) {
                showOtpScreen(email);
            } else {
                alert(i18n[currentLang].authError.replace("{msg}", error.message));
            }
        }
    }
}

function showOtpScreen(email) {
    document.getElementById('authFieldsGroup').style.display = "none";
    document.getElementById('authSubmitBtn').style.display = "none";
    const otpGroup = document.getElementById('authOtpGroup');
    otpGroup.style.display = "block";
    
    document.getElementById('authTitle').innerText = i18n[currentLang].otpTitle;
    document.getElementById('otpText').innerText = i18n[currentLang].otpText;
    document.getElementById('otpEmailInput').value = email;
}

function backToRegister() {
    isRegisterMode = false;
    toggleAuthMode();
}

async function handleOtpSubmit() {
    const email = document.getElementById('otpEmailInput').value;
    const token = document.getElementById('otpTokenInput').value.trim();

    if (!token) {
        alert(currentLang === 'sr' ? "Unesite verifikacioni kod!" : "Please enter confirmation token!");
        return;
    }

    const { data, error } = await supabaseClient.auth.verifyOtp({
        email,
        token,
        type: 'signup'
    });

    if (error) {
        alert(i18n[currentLang].authError.replace("{msg}", error.message));
    } else {
        alert(currentLang === 'sr' ? "Uspešna verifikacija i prijava!" : "Email successfully verified!");
        location.reload();
    }
}

async function handleLogout() {
    stopAudio();
    closeProfileMenu();
    const { error } = await supabaseClient.auth.signOut();
}

// ==========================================================================
// 2. NAVIGACIJA & STRUKTURA BENDOVA (Accordian sidebar)
// ==========================================================================

function switchTab(tabId) {
    currentTab = tabId;
    
    // Čišćenje audio resursa ako odlazimo sa plejera
    if (tabId !== 'songs') {
        cleanAudioEngine();
    }

    const repCol = document.getElementById('repertoireColumn');
    if (tabId === 'songs' && activeBandId) {
        repCol.style.display = "flex";
    } else {
        repCol.style.display = "none";
    }

    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    
    const targetElement = document.getElementById(`tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    if (targetElement) {
        targetElement.style.display = 'block';
    }
}

async function loadUserBands() {
    if (!currentUserProfile) return;

    // Prvo čitamo sva članstva
    const { data: membershipData, error: memError } = await supabaseClient
        .from('band_members')
        .select('band_id, role')
        .eq('user_id', currentUserProfile.id);

    if (membershipData && membershipData.length > 0) {
        const bandIds = membershipData.map(m => m.band_id);
        
        // Zatim čitamo podatke o bendovima
        const { data: bandData, error: bandError } = await supabaseClient
            .from('bands')
            .select('*')
            .in('id', bandIds);

        if (bandData) {
            bands = bandData.map(b => {
                const relation = membershipData.find(m => m.band_id === b.id);
                return {
                    ...b,
                    userRole: relation ? relation.role : 'member'
                };
            });
        }
    } else {
        bands = [];
    }

    renderSidebarBands();
    renderBandsUI();
}

function toggleBandExpand(bandId, event) {
    event.stopPropagation();
    if (expandedBandId === bandId) {
        expandedBandId = "";
    } else {
        expandedBandId = bandId;
        setActiveBand(bandId);
    }
    renderSidebarBands();
}

function setActiveBand(bandId) {
    activeBandId = bandId;
    const band = bands.find(b => b.id === bandId);
    if (band) {
        document.getElementById('dashboardBandName').innerText = band.name;
        document.getElementById('dashboardBandRole').innerText = band.userRole === 'admin' ? i18n[currentLang].roleAdmin : i18n[currentLang].roleUser;
        
        // Prikaz logotipa
        const logoImg = document.getElementById('dashboardLogoImg');
        if (band.logo_url) {
            logoImg.innerHTML = `<img src="${band.logo_url}" alt="band logo">`;
        } else {
            logoImg.innerHTML = `<span style="font-size: 2.5em;">🎸</span><br>Upload Logo`;
        }

        // Popunjavamo polja u postavkama benda
        document.getElementById('editBandName').value = band.name || "";
        document.getElementById('editBandUrl').value = band.raw_url || "";
        document.getElementById('editBandContactName').value = band.contact_name || "";
        document.getElementById('editBandContactPhone').value = band.contact_phone || "";
        document.getElementById('editBandWebsite').value = band.website || "";
        document.getElementById('editBandInstagram').value = band.instagram || "";
        
        // Država i grad u postavkama
        document.getElementById('editBandCountry').value = band.country || "";
        document.getElementById('editBandCity').value = band.city || "";

        // Pristupni kodovi
        document.getElementById('dashboardBandCode').innerText = band.join_code || "N/A";
        
        loadSongsFromActiveBand();
        loadBandMembersUI();
        switchTab('dashboard');
    }
}

function renderSidebarBands() {
    const listContainer = document.getElementById('sidebarBandsList');
    listContainer.innerHTML = "";

    if (bands.length === 0) {
        listContainer.innerHTML = `<div style="padding: 10px; font-size: 0.85em; color: var(--text-muted);">${i18n[currentLang].noBands}</div>`;
        return;
    }

    bands.forEach(b => {
        const item = document.createElement('div');
        item.className = `sidebar-band-item ${expandedBandId === b.id ? 'expanded' : ''}`;
        
        const isActive = activeBandId === b.id;
        
        item.innerHTML = `
            <div class="sidebar-band-header ${isActive ? 'active' : ''}" onclick="setActiveBand('${b.id}')">
                <span class="sidebar-band-name">
                    ${b.logo_url ? `<img src="${b.logo_url}" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover;">` : '🎸'} 
                    ${b.name}
                </span>
                <span class="band-arrow" onclick="toggleBandExpand('${b.id}', event)">▲</span>
            </div>
            ${expandedBandId === b.id ? `
                <div class="sidebar-band-sub-menu">
                    <div class="sub-menu-item ${currentTab === 'songs' ? 'active' : ''}" onclick="event.stopPropagation(); switchTab('songs')">${i18n[currentLang].btnSongs}</div>
                    <div class="sub-menu-item ${currentTab === 'members' ? 'active' : ''}" onclick="event.stopPropagation(); switchTab('members')">${i18n[currentLang].btnMembers}</div>
                    <div class="sub-menu-item ${currentTab === 'settings' ? 'active' : ''}" onclick="event.stopPropagation(); switchTab('settings')">${i18n[currentLang].btnSettings}</div>
                </div>
            ` : ''}
        `;
        listContainer.appendChild(item);
    });
}

function toggleAddOptions() {
    const el = document.getElementById('addBandOptionsContainer');
    el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

function triggerAddBand() {
    document.getElementById('addBandOptionsContainer').style.display = 'none';
    switchTab('newBand');
}

function triggerJoinBand() {
    document.getElementById('addBandOptionsContainer').style.display = 'none';
    switchTab('joinBand');
}

// Standardizacija države i grada
function setupCountryCitySelectors(prefix) {
    const countrySel = document.getElementById(`${prefix}BandCountry`);
    const citySel = document.getElementById(`${prefix}BandCity`);
    const customCountryGrp = document.getElementById(`${prefix}CustomCountryGroup`);
    const customCityGrp = document.getElementById(`${prefix}CustomCityGroup`);

    if (!countrySel) return;

    // Prvo punimo selektor država
    countrySel.innerHTML = '<option value="">-- Izaberi državu --</option>';
    Object.keys(countryRegistry).forEach(c => {
        countrySel.innerHTML += `<option value="${c}">${c}</option>`;
    });
    countrySel.innerHTML += '<option value="Custom">Custom...</option>';

    countrySel.onchange = () => {
        const val = countrySel.value;
        citySel.innerHTML = '<option value="">-- Izaberi grad --</option>';
        
        if (val === "Custom") {
            customCountryGrp.style.display = "flex";
            customCityGrp.style.display = "flex";
        } else {
            customCountryGrp.style.display = "none";
            customCityGrp.style.display = "none";
            
            if (countryRegistry[val]) {
                countryRegistry[val].forEach(city => {
                    citySel.innerHTML += `<option value="${city}">${city}</option>`;
                });
            }
            citySel.innerHTML += '<option value="Custom">Custom...</option>';
        }
    };

    citySel.onchange = () => {
        if (citySel.value === "Custom") {
            customCityGrp.style.display = "flex";
        } else {
            customCityGrp.style.display = "none";
        }
    };
}

// Osnivanje novog benda
async function addNewBandSubmit() {
    if (!currentUserProfile) return;

    const nameInput = document.getElementById('newBandName');
    const urlInput = document.getElementById('newBandUrl');
    const contactNameInput = document.getElementById('newBandContactName');
    const contactPhoneInput = document.getElementById('newBandContactPhone');
    const websiteInput = document.getElementById('newBandWebsite');
    const instagramInput = document.getElementById('newBandInstagram');
    
    // Zemlja i grad selektori
    const countrySel = document.getElementById('newBandCountry');
    const citySel = document.getElementById('newBandCity');
    
    let country = countrySel.value;
    let city = citySel.value;

    if (country === "Custom") {
        country = document.getElementById('newBandCustomCountryInput').value.trim();
    }
    if (city === "Custom") {
        city = document.getElementById('newBandCustomCityInput').value.trim();
    }

    const name = nameInput.value.trim();
    const rawUrl = urlInput.value.trim();
    const contactName = contactNameInput.value.trim();
    const contactPhone = contactPhoneInput.value.trim();
    const website = websiteInput.value.trim();
    const instagram = instagramInput.value.trim();

    if (!name || !rawUrl || !country || !city) {
        alert(currentLang === 'sr' ? "Popunite sva obavezna polja (Naziv, Link, Država, Grad)!" : "Please fill out all required fields (Name, Link, Country, City)!");
        return;
    }

    const folderId = extractFolderId(rawUrl);
    
    // 1. TROSTEPENA PROVERA: Jedinstveno ime benda u istoj zemlji i gradu
    const { data: dupeData, error: dupeError } = await supabaseClient
        .from('bands')
        .select('id')
        .eq('name', name)
        .eq('country', country)
        .eq('city', city);

    if (dupeData && dupeData.length > 0) {
        alert(i18n[currentLang].duplicateNameError);
        return;
    }

    const joinCode = 'GL-' + Math.floor(1000 + Math.random() * 9000);

    // Korak A: Upisujemo novi bend u bazu
    const { data: bandData, error: bandError } = await supabaseClient
        .from('bands')
        .insert({
            name,
            folder_id: folderId,
            raw_url: rawUrl,
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

    if (bandError) {
        alert(i18n[currentLang].authError.replace("{msg}", bandError.message));
        return;
    }

    // Korak B: Postavljamo osnivača kao glavnog ADMINA
    const { error: memberError } = await supabaseClient
        .from('band_members')
        .insert({
            band_id: bandData.id,
            user_id: currentUserProfile.id,
            role: 'admin'
        });

    if (memberError) {
        alert(i18n[currentLang].authError.replace("{msg}", memberError.message));
        return;
    }

    nameInput.value = "";
    urlInput.value = "";
    contactNameInput.value = "";
    contactPhoneInput.value = "";
    websiteInput.value = "";
    instagramInput.value = "";
    
    loadUserBands();
}

// Učitavanje logotipa benda (Base64)
async function uploadBandLogo(event) {
    if (!activeBandId) return;
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = reader.result;
        
        const { error } = await supabaseClient
            .from('bands')
            .update({ logo_url: base64String })
            .eq('id', activeBandId);

        if (error) {
            alert(error.message);
        } else {
            // Osvežavamo aktivni bend
            const band = bands.find(b => b.id === activeBandId);
            if (band) band.logo_url = base64String;
            setActiveBand(activeBandId);
        }
    };
    reader.readAsDataURL(file);
}

// Priključivanje postojećem bendu pomoću Join koda
async function submitJoinCode() {
    if (!currentUserProfile) return;

    const codeInput = document.getElementById('joinCodeInput');
    const code = codeInput.value.trim().toUpperCase();

    if (!code) {
        alert(currentLang === 'sr' ? "Unesite pristupni kod!" : "Please enter the access code!");
        return;
    }

    const { data: bandData, error: bandError } = await supabaseClient
        .from('bands')
        .select('*')
        .eq('join_code', code)
        .single();

    if (bandError || !bandData) {
        alert(currentLang === 'sr' ? "Nevažeći kod benda!" : "Invalid band access code!");
        return;
    }

    // Proveravamo da li je korisnik već član tog benda
    const { data: isMember } = await supabaseClient
        .from('band_members')
        .select('*')
        .eq('band_id', bandData.id)
        .eq('user_id', currentUserProfile.id);

    if (isMember && isMember.length > 0) {
        alert(currentLang === 'sr' ? "Već ste član ovog benda!" : "You are already a member of this band!");
        return;
    }

    // Upisujemo korisnika u članstvo benda
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
        loadUserBands();
    }
}

// Regeneracija pristupnog koda
async function regenerateAccessCode() {
    if (!activeBandId) return;
    const band = bands.find(b => b.id === activeBandId);
    if (!band || band.userRole !== 'admin') return;

    const newCode = 'GL-' + Math.floor(1000 + Math.random() * 9000);

    const { error } = await supabaseClient
        .from('bands')
        .update({ join_code: newCode })
        .eq('id', activeBandId);

    if (error) {
        alert(error.message);
    } else {
        band.join_code = newCode;
        document.getElementById('dashboardBandCode').innerText = newCode;
        alert(i18n[currentLang].regenerateCodeSuccess);
    }
}

// Napuštanje benda
async function leaveBandSubmit() {
    if (!activeBandId || !currentUserProfile) return;
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    // Ako je jedini preostali admin, ne može da napusti dok ne preda ulogu ili obriše bend
    if (band.userRole === 'admin') {
        const { data: admins } = await supabaseClient
            .from('band_members')
            .select('id')
            .eq('band_id', activeBandId)
            .eq('role', 'admin');

        if (admins && admins.length === 1) {
            alert(i18n[currentLang].cannotLeaveLastAdmin);
            return;
        }
    }

    const confirmMsg = currentLang === 'sr' ? "Da li sigurno želiš da napustiš ovaj bend?" : "Are you sure you want to leave this band?";
    if (!confirm(confirmMsg)) return;

    const { error } = await supabaseClient
        .from('band_members')
        .delete()
        .eq('band_id', activeBandId)
        .eq('user_id', currentUserProfile.id);

    if (error) {
        alert(error.message);
    } else {
        activeBandId = "";
        expandedBandId = "";
        loadUserBands();
        switchTab('dashboard');
    }
}

// Izbacivanje člana (samo za admine)
async function removeBandMember(memberUserId) {
    if (!activeBandId) return;
    const confirmMsg = currentLang === 'sr' ? "Da li sigurno želiš da izbaciš ovog člana?" : "Are you sure you want to remove this member?";
    if (!confirm(confirmMsg)) return;

    const { error } = await supabaseClient
        .from('band_members')
        .delete()
        .eq('band_id', activeBandId)
        .eq('user_id', memberUserId);

    if (error) {
        alert(error.message);
    } else {
        loadBandMembersUI();
    }
}

// Učitavanje članova benda na ekranu
async function loadBandMembersUI() {
    const listContainer = document.getElementById('bandMembersList');
    listContainer.innerHTML = "";
    if (!activeBandId) return;

    const band = bands.find(b => b.id === activeBandId);

    const { data: members, error } = await supabaseClient
        .from('band_members')
        .select(`
            user_id,
            role,
            profiles:user_id ( display_name, email, avatar_url )
        `)
        .eq('band_id', activeBandId);

    if (members) {
        members.forEach(m => {
            const row = document.createElement('tr');
            const profile = m.profiles;
            const displayName = profile ? (profile.display_name || profile.email) : "Nepoznato";
            const roleText = m.role === 'admin' ? i18n[currentLang].roleAdmin : i18n[currentLang].roleUser;
            
            const isMe = m.user_id === currentUserProfile.id;
            const canRemove = band.userRole === 'admin' && !isMe;

            row.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="user-avatar" style="width: 24px; height: 24px; font-size: 0.8em;">
                            ${profile && profile.avatar_url ? `<img src="${profile.avatar_url}">` : displayName.charAt(0).toUpperCase()}
                        </div>
                        ${displayName} ${isMe ? " (Ti)" : ""}
                    </div>
                </td>
                <td><span class="band-role-badge" style="background-color: ${m.role === 'admin' ? '#8b5cf6' : '#4b5563'}">${roleText}</span></td>
                <td>
                    ${canRemove ? `<button class="btn-popup-logout" style="border: none; background: transparent; cursor: pointer; text-decoration: underline;" onclick="removeBandMember('${m.user_id}')">${i18n[currentLang].memberActionRemove}</button>` : ""}
                </td>
            `;
            listContainer.appendChild(row);
        });
    }
}

// Sačuvanje izmena podešavanja benda (Admin)
async function saveBandSettings() {
    if (!activeBandId) return;
    const band = bands.find(b => b.id === activeBandId);
    if (!band || band.userRole !== 'admin') return;

    const name = document.getElementById('editBandName').value.trim();
    const rawUrl = document.getElementById('editBandUrl').value.trim();
    const contactName = document.getElementById('editBandContactName').value.trim();
    const contactPhone = document.getElementById('editBandContactPhone').value.trim();
    const website = document.getElementById('editBandWebsite').value.trim();
    const instagram = document.getElementById('editBandInstagram').value.trim();

    if (!name || !rawUrl) {
        alert(currentLang === 'sr' ? "Naziv i Drive link su obavezni!" : "Name and Drive link are required!");
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
            instagram
        })
        .eq('id', activeBandId);

    if (error) {
        alert(error.message);
    } else {
        alert(currentLang === 'sr' ? "Izmene na bendu uspešno sačuvane!" : "Band changes successfully saved!");
        loadUserBands();
    }
}

// Brisanje celog benda
async function deleteBandSubmit() {
    if (!activeBandId) return;
    const band = bands.find(b => b.id === activeBandId);
    if (!band || band.userRole !== 'admin') return;

    if (!confirm(i18n[currentLang].deleteBandConfirm)) return;

    const { error } = await supabaseClient
        .from('bands')
        .delete()
        .eq('id', activeBandId);

    if (error) {
        alert(error.message);
    } else {
        activeBandId = "";
        expandedBandId = "";
        loadUserBands();
        switchTab('dashboard');
    }
}

// Prikaz tabli na dashboardu (prazan nalog ili ulogovani interfejs)
function renderBandsUI() {
    const mainDashboard = document.getElementById('bandDashboardContainer');
    const emptyState = document.getElementById('emptyDashboardContainer');

    if (bands.length > 0) {
        mainDashboard.style.display = "block";
        emptyState.style.display = "none";
    } else {
        mainDashboard.style.display = "none";
        emptyState.style.display = "block";
        document.getElementById('emptyStateMsg').innerText = i18n[currentLang].createFirstBandMsg;
    }
}

// ==========================================================================
// 3. KORISNIČKA PODEŠAVANJA (Regional, Profil, Podrška)
// ==========================================================================

async function saveProfileSettings() {
    if (!currentUserProfile) return;
    const displayName = document.getElementById('settingDisplayName').value.trim();

    const { error } = await supabaseClient
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', currentUserProfile.id);

    if (error) {
        alert(error.message);
    } else {
        alert(currentLang === 'sr' ? "Profil je uspešno ažuriran!" : "Profile successfully updated!");
        location.reload();
    }
}

async function uploadUserAvatar(event) {
    if (!currentUserProfile) return;
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = reader.result;
        
        const { error } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: base64String })
            .eq('id', currentUserProfile.id);

        if (error) {
            alert(error.message);
        } else {
            alert(currentLang === 'sr' ? "Avatar uspešno postavljen!" : "Avatar successfully uploaded!");
            location.reload();
        }
    };
    reader.readAsDataURL(file);
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
            user_email: currentUserProfile.email,
            subject: subject,
            message: message
        });

    if (error) {
        alert(error.message);
    } else {
        alert(i18n[currentLang].supportSuccess);
        document.getElementById('supportSubject').value = "";
        document.getElementById('supportMessage').value = "";
        closeSupportModal();
    }
}

async function changePasswordSubmit() {
    const newPassword = document.getElementById('settingNewPassword').value;
    if (!newPassword || newPassword.length < 6) {
        alert(currentLang === 'sr' ? "Lozinka mora imati najmanje 6 karaktera!" : "Password must be at least 6 characters long!");
        return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
        alert(error.message);
    } else {
        alert(currentLang === 'sr' ? "Lozinka uspešno promenjena!" : "Password successfully updated!");
        document.getElementById('settingNewPassword').value = "";
    }
}

async function deleteAccountSubmit() {
    const confirmMsg = currentLang === 'sr' ? "UPOZORENJE! Da li ste sigurni da želite trajno da obrišete svoj nalog? Ova akcija je nepovratna." : "WARNING! Are you sure you want to permanently delete your account? This action is irreversible.";
    if (!confirm(confirmMsg)) return;

    const { error } = await supabaseClient
        .from('profiles')
        .delete()
        .eq('id', currentUserProfile.id);

    if (error) {
        alert(error.message);
    } else {
        handleLogout();
    }
}

// ==========================================================================
// 4. GOOGLE DRIVE GOOGLE API AUDIO ENGINE
// ==========================================================================

function extractFolderId(url) {
    const match = url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
}

async function loadSongsFromActiveBand() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band || !band.folder_id) return;

    songsList.innerHTML = `<div style="color: var(--text-muted);">${i18n[currentLang].statusConnecting}</div>`;

    const url = `https://www.googleapis.com/drive/v3/files?q='${band.folder_id}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&key=${GOOGLE_API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            songsList.innerHTML = `<div style="color: var(--accent-red);">${i18n[currentLang].statusConnError}</div>`;
            return;
        }

        allSongs = data.files || [];
        renderSongs(allSongs);
    } catch (e) {
        songsList.innerHTML = `<div style="color: var(--accent-red);">${i18n[currentLang].statusConnError}</div>`;
    }
}

function renderSongs(songs) {
    songsList.innerHTML = "";
    if (songs.length === 0) {
        songsList.innerHTML = `<div style="color: var(--text-muted);">${i18n[currentLang].noSongs}</div>`;
        return;
    }

    songs.sort((a, b) => a.name.localeCompare(b.name));

    songs.forEach(s => {
        const item = document.createElement('div');
        item.className = "song-item";
        if (currentSongName === s.name) item.className += " active";
        item.innerText = s.name;
        item.onclick = () => selectSong(s.id, s.name);
        songsList.appendChild(item);
    });
}

function filterSongs(query) {
    const filtered = allSongs.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
    renderSongs(filtered);
}

async function selectSong(folderId, songName) {
    currentSongName = songName;
    document.querySelectorAll('.song-item').forEach(el => {
        if (el.innerText === songName) el.classList.add('active');
        else el.classList.remove('active');
    });

    cleanAudioEngine();
    updateStatusText('statusLoading');

    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&key=${GOOGLE_API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        let files = data.files || [];
        files = files.filter(f => f.name.endsWith('.mp3') || f.name.endsWith('.wav') || f.name.endsWith('.m4a'));

        if (files.length === 0) {
            updateStatusText('statusNoFiles');
            return;
        }

        files.sort((a, b) => a.name.localeCompare(b.name));

        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        audioBuffers = [];
        trackNames = [];
        gainNodes = [];

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const fileUrl = `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${GOOGLE_API_KEY}`;
            
            updateStatusText('statusDecoding', i + 1);
            
            const fileResp = await fetch(fileUrl);
            const arrayBuf = await fileResp.arrayBuffer();
            const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
            
            audioBuffers.push(audioBuf);
            trackNames.push(f.name.replace(/\.[^/.]+$/, ""));
        }

        buildMixerUI();
        updateStatusText('statusReady', audioBuffers.length);
        playBtn.disabled = false;
        stopBtn.disabled = false;
    } catch (e) {
        updateStatusText('statusError');
    }
}

function buildMixerUI() {
    const container = document.getElementById('tracksContainer');
    container.innerHTML = "";

    masterGainNode = audioCtx.createGain();
    masterGainNode.connect(audioCtx.destination);

    trackNames.forEach((name, index) => {
        const gn = audioCtx.createGain();
        gn.connect(masterGainNode);
        gainNodes.push(gn);

        const card = document.createElement('div');
        card.className = "track-card";
        card.setAttribute('draggable', 'true');
        card.dataset.index = index;

        card.innerHTML = `
            <div class="track-title">${name}</div>
            <div class="slider-container">
                <input type="range" class="volume-slider" min="0" max="1" step="0.01" value="0.8" data-index="${index}">
            </div>
            <div class="track-controls">
                <button class="btn-mute" id="mute-${index}" onclick="toggleMute(${index})">MUTE</button>
                <button class="btn-solo" id="solo-${index}" onclick="toggleSolo(${index})">SOLO</button>
            </div>
        `;
        container.appendChild(card);
    });

    // Povezivanje fader klizača
    document.querySelectorAll('.volume-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const val = parseFloat(e.target.value);
            const isMuted = document.getElementById(`mute-${idx}`).classList.contains('active');
            if (!isMuted) {
                gainNodes[idx].gain.value = val;
            }
        });
    });

    setupDragAndDrop();
}

function toggleMute(index) {
    const btn = document.getElementById(`mute-${index}`);
    const slider = document.querySelector(`.volume-slider[data-index="${index}"]`);
    const isMuted = btn.classList.toggle('active');

    if (isMuted) {
        gainNodes[index].gain.value = 0;
    } else {
        gainNodes[index].gain.value = parseFloat(slider.value);
    }
}

function toggleSolo(index) {
    const btn = document.getElementById(`solo-${index}`);
    const isSolo = btn.classList.toggle('active');

    if (isSolo) {
        gainNodes.forEach((gn, i) => {
            if (i !== index) {
                gn.gain.value = 0;
            } else {
                const slider = document.querySelector(`.volume-slider[data-index="${i}"]`);
                gn.gain.value = parseFloat(slider.value);
                document.getElementById(`mute-${i}`).classList.remove('active');
            }
        });
    } else {
        gainNodes.forEach((gn, i) => {
            const slider = document.querySelector(`.volume-slider[data-index="${i}"]`);
            const isMuted = document.getElementById(`mute-${i}`).classList.contains('active');
            gn.gain.value = isMuted ? 0 : parseFloat(slider.value);
        });
    }
}

// Drag & Drop funkcionalnost za promenu redosleda traka na mikseti
function setupDragAndDrop() {
    const cards = document.querySelectorAll('.track-card');
    const container = document.getElementById('tracksContainer');
    let dragSrcEl = null;

    cards.forEach(card => {
        card.addEventListener('dragstart', function(e) {
            dragSrcEl = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
            this.style.opacity = '0.4';
        });

        card.addEventListener('dragover', function(e) {
            e.preventDefault();
            return false;
        });

        card.addEventListener('drop', function(e) {
            e.stopPropagation();
            if (dragSrcEl !== this) {
                // Razmenjujemo html sadržaj i indekse u bazu u realnom vremenu
                dragSrcEl.style.opacity = '1';
                
                const srcIdx = dragSrcEl.dataset.index;
                const destIdx = this.dataset.index;

                // Zamena podataka u memoriji
                const tempBuf = audioBuffers[srcIdx];
                audioBuffers[srcIdx] = audioBuffers[destIdx];
                audioBuffers[destIdx] = tempBuf;

                const tempName = trackNames[srcIdx];
                trackNames[srcIdx] = trackNames[destIdx];
                trackNames[destIdx] = tempName;

                // Rekonstruiši mikser sa novim rasporedom bez prekida muzike
                const isAlreadyPlaying = isPlaying;
                if (isAlreadyPlaying) {
                    pauseOffset += audioCtx.currentTime - startTime;
                    stopSourceNodes();
                }
                
                buildMixerUI();

                if (isAlreadyPlaying) {
                    startSourceNodes(pauseOffset);
                    startTime = audioCtx.currentTime;
                }
            }
            return false;
        });

        card.addEventListener('dragend', function() {
            this.style.opacity = '1';
        });
    });
}

// Gvozdeno čišćenje i RAM oslobađanje audio engine-a
function cleanAudioEngine() {
    stopAudio();
    if (audioCtx) {
        audioCtx.close().then(() => {
            audioCtx = null;
        });
    }
    audioBuffers = [];
    sourceNodes = [];
    gainNodes = [];
    trackNames = [];
    document.getElementById('tracksContainer').innerHTML = "";
}

function startSourceNodes(offset = 0) {
    sourceNodes = [];
    audioBuffers.forEach((buffer, index) => {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNodes[index]);
        
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

function playAudio() {
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (isPlaying) {
        // Pauza
        pauseOffset += audioCtx.currentTime - startTime;
        stopSourceNodes();
        isPlaying = false;
        clearInterval(timerInterval);
        updatePlayBtnUI();
    } else {
        // Play
        startSourceNodes(pauseOffset);
        startTime = audioCtx.currentTime;
        isPlaying = true;
        timerInterval = setInterval(updateTimer, 200);
        updatePlayBtnUI();
    }
}

function stopAudio() {
    stopSourceNodes();
    isPlaying = false;
    pauseOffset = 0;
    clearInterval(timerInterval);
    if (document.getElementById('timeDisplay')) {
        document.getElementById('timeDisplay').innerText = "00:00";
    }
    updatePlayBtnUI();
}

function resetAudioState() {
    stopAudio();
    currentSongName = "";
    allSongs = [];
    renderSongs([]);
}

function updateTimer() {
    if (!isPlaying) return;
    const current = pauseOffset + (audioCtx.currentTime - startTime);
    const mins = Math.floor(current / 60).toString().padStart(2, '0');
    const secs = Math.floor(current % 60).toString().padStart(2, '0');
    const display = document.getElementById('timeDisplay');
    if (display) display.innerText = `${mins}:${secs}`;
}

// ==========================================================================
// 5. KONTROLE INTERFEJSA (Modali, Hamburgeri, Jezik)
// ==========================================================================

function updatePlayBtnUI() {
    const playSpan = playBtn.querySelector('span');
    if (isPlaying) {
        playBtn.classList.add('active');
        playSpan.innerText = i18n[currentLang].pauseBtn;
    } else {
        playBtn.classList.remove('active');
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

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('gigstems_lang', lang);
    
    // Aktivno dugme SR/EN na login i sidebar-u
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.innerText.toLowerCase() === lang) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Prevođenje HTML natpisa
    document.getElementById('songsTitle').innerText = i18n[lang].songsTitle;
    document.getElementById('searchInput').placeholder = i18n[lang].searchPlaceholder;
    document.getElementById('playBtn').querySelector('span').innerText = isPlaying ? i18n[lang].pauseBtn : i18n[lang].playBtn;
    document.getElementById('stopBtn').querySelector('span').innerText = i18n[lang].stopBtn;
    document.getElementById('masterMuteBtn').innerText = isMasterMuted ? i18n[lang].masterMuteBtn : i18n[lang].masterMuteBtn;
    document.getElementById('masterVolLabel').innerText = i18n[lang].masterVolLabel;
    
    document.getElementById('sidebarBandsHeader').innerText = i18n[lang].navBands;
    document.getElementById('subtitleText').innerText = i18n[lang].subtitle;

    // Prevodi modal podešavanja
    document.getElementById('modalSettingsTitle').innerText = i18n[lang].btnSettings;
    document.getElementById('tabBtnRegional').innerText = currentLang === 'sr' ? "Aplikacija" : "Application";
    document.getElementById('tabBtnProfile').innerText = currentLang === 'sr' ? "Profil" : "Profile";
    document.getElementById('tabBtnPassword').innerText = currentLang === 'sr' ? "Lozinka" : "Password";
    document.getElementById('tabBtnAccount').innerText = currentLang === 'sr' ? "Nalog" : "Account";

    // Novi bend prevodi
    document.getElementById('newBandTitle').innerText = i18n[lang].addSectionTitle;
    document.getElementById('newBandNameLabel').innerText = i18n[lang].bandNameLabel;
    document.getElementById('newBandUrlLabel').innerText = i18n[lang].bandUrlLabel;
    document.getElementById('newBandContactNameLabel').innerText = i18n[lang].bandContactNameLabel;
    document.getElementById('newBandContactPhoneLabel').innerText = i18n[lang].bandContactPhoneLabel;
    document.getElementById('newBandWebsiteLabel').innerText = i18n[lang].bandWebsiteLabel;
    document.getElementById('newBandInstagramLabel').innerText = i18n[lang].bandInstagramLabel;
    document.getElementById('newBandCountryLabel').innerText = i18n[lang].bandCountryLabel;
    document.getElementById('newBandCityLabel').innerText = i18n[lang].bandCityLabel;
    document.getElementById('newBandSubmitBtn').innerText = i18n[lang].connectBtn;

    // Izmena benda prevodi
    document.getElementById('editBandTitle').innerText = i18n[lang].editSectionTitle;
    document.getElementById('editBandNameLabel').innerText = i18n[lang].renameBandLabel;
    document.getElementById('editBandUrlLabel').innerText = i18n[lang].renameBandUrlLabel;
    document.getElementById('editBandContactNameLabel').innerText = i18n[lang].bandContactNameLabel;
    document.getElementById('editBandContactPhoneLabel').innerText = i18n[lang].bandContactPhoneLabel;
    document.getElementById('editBandWebsiteLabel').innerText = i18n[lang].bandWebsiteLabel;
    document.getElementById('editBandInstagramLabel').innerText = i18n[lang].bandInstagramLabel;
    document.getElementById('editBandCountryLabel').innerText = i18n[lang].bandCountryLabel;
    document.getElementById('editBandCityLabel').innerText = i18n[lang].bandCityLabel;
    document.getElementById('editBandSaveBtn').innerText = i18n[lang].renameBtn;
    document.getElementById('editBandDeleteBtn').innerText = i18n[lang].deleteSectionTitle;

    // Podrška prevodi
    document.getElementById('supportModalTitle').innerText = i18n[lang].supportTitle;
    document.getElementById('supportSubjectLabel').innerText = i18n[lang].supportSubjectLabel;
    document.getElementById('supportMessageLabel').innerText = i18n[lang].supportMessageLabel;
    document.getElementById('supportSubmitBtn').innerText = i18n[lang].supportBtn;

    // Pridruživanje prevodi
    document.getElementById('joinBandTitle').innerText = i18n[lang].joinCodeBtn;
    document.getElementById('joinCodeLabel').innerText = i18n[lang].joinCodeLabel;
    document.getElementById('joinCodeInput').placeholder = i18n[lang].joinCodePlaceholder;
    document.getElementById('joinCodeSubmitBtn').innerText = i18n[lang].joinCodeBtn;

    // Dashboard grid tasteri
    document.getElementById('gridBtnSongs').innerText = i18n[lang].btnSongs;
    document.getElementById('gridBtnMembers').innerText = i18n[lang].btnMembers;
    document.getElementById('gridBtnSettings').innerText = i18n[lang].btnSettings;
    document.getElementById('gridBtnConcerts').innerText = i18n[lang].btnConcerts;
    document.getElementById('gridBtnKit').innerText = i18n[lang].btnKit;
    document.getElementById('gridBtnDocs').innerText = i18n[lang].btnDocs;

    // Auth screen prevodi
    if (isRegisterMode) {
        document.getElementById('authTitle').innerText = i18n[lang].authTitleRegister;
        document.getElementById('authSubmitBtn').innerText = i18n[lang].authBtnRegister;
        document.getElementById('authSwitchLink').innerText = i18n[lang].authSwitchToLogin;
    } else {
        document.getElementById('authTitle').innerText = i18n[lang].authTitleLogin;
        document.getElementById('authSubmitBtn').innerText = i18n[lang].authBtnLogin;
        document.getElementById('authSwitchLink').innerText = i18n[lang].authSwitchToRegister;
    }
    document.getElementById('authDisplayNameLabel').innerText = i18n[lang].authDisplayName;
    document.getElementById('authEmailLabel').innerText = i18n[lang].authEmail;
    document.getElementById('authPasswordLabel').innerText = i18n[lang].authPassword;

    if (!currentSongName) {
        updateStatusText('statusInit');
    }

    renderSidebarBands();
    renderBandsUI();
}

// Master Mute i Volum kontrola
let isMasterMuted = false;
function toggleMasterMute() {
    isMasterMuted = !isMasterMuted;
    const btn = document.getElementById('masterMuteBtn');
    if (isMasterMuted) {
        btn.classList.add('active');
        btn.innerText = currentLang === 'sr' ? 'ODMUTIRAJ SVE' : 'UNMUTE ALL';
        if (masterGainNode) masterGainNode.gain.value = 0;
    } else {
        btn.classList.remove('active');
        btn.innerText = i18n[currentLang].masterMuteBtn;
        if (masterGainNode) {
            const vol = parseFloat(document.getElementById('masterVolumeRange').value);
            masterGainNode.gain.value = vol;
        }
    }
}

function setMasterVolume(val) {
    if (masterGainNode && !isMasterMuted) {
        masterGainNode.gain.value = parseFloat(val);
    }
}

// Kontrola Hamburger menija za mobilne uređaje
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

// Profil pop-up meni
function toggleProfileMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('profilePopupMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function closeProfileMenu() {
    document.getElementById('profilePopupMenu').style.display = 'none';
}

// Modalni prozori
function openSettingsModal() {
    closeProfileMenu();
    document.getElementById('settingsModal').style.display = 'flex';
    switchSettingsTab('Regional');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
}

function openSupportModal() {
    closeProfileMenu();
    document.getElementById('supportModal').style.display = 'flex';
}

function closeSupportModal() {
    document.getElementById('supportModal').style.display = 'none';
}

function switchSettingsTab(tabName) {
    document.querySelectorAll('.modal-tab').forEach(btn => {
        if (btn.id === `tabBtn${tabName}`) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    document.querySelectorAll('.modal-tab-content').forEach(content => {
        if (content.id === `settingsTab${tabName}`) content.style.display = 'block';
        else content.style.display = 'none';
    });
}

// Custom input detekcija
function setupCustomInputDetection(prefix) {
    const tzSel = document.getElementById(`setting${prefix}`);
    const customGrp = document.getElementById(`custom${prefix}Group`);
    if (!tzSel) return;
    
    tzSel.onchange = () => {
        if (tzSel.value === "Custom") {
            customGrp.style.display = "flex";
        } else {
            customGrp.style.display = "none";
        }
    };
}

// Učitavanje i inicijalizacija sačuvanih opcija
function loadSavedSettings() {
    const tz = localStorage.getItem('gigstems_tz') || 'Europe/Belgrade';
    const df = localStorage.getItem('gigstems_df') || 'dd.mm.yyyy';
    const tf = localStorage.getItem('gigstems_tf') || '24h';
    const tu = localStorage.getItem('gigstems_tu') || 'C';

    document.getElementById('settingTimeFormat').value = tf;
    document.getElementById('settingTempUnit').value = tu;

    const tzSel = document.getElementById('settingTimezone');
    if ([...tzSel.options].some(o => o.value === tz)) {
        tzSel.value = tz;
    } else {
        tzSel.value = "Custom";
        document.getElementById('customTimezoneGroup').style.display = "flex";
        document.getElementById('customTimezoneInput').value = tz;
    }

    const dfSel = document.getElementById('settingDateFormat');
    if ([...dfSel.options].some(o => o.value === df)) {
        dfSel.value = df;
    } else {
        dfSel.value = "Custom";
        document.getElementById('customDateFormatGroup').style.display = "flex";
        document.getElementById('customDateFormatInput').value = df;
    }
}

function saveApplicationSettings() {
    const tf = document.getElementById('settingTimeFormat').value;
    const tu = document.getElementById('settingTempUnit').value;
    
    let tz = document.getElementById('settingTimezone').value;
    if (tz === "Custom") {
        tz = document.getElementById('customTimezoneInput').value.trim();
    }
    
    let df = document.getElementById('settingDateFormat').value;
    if (df === "Custom") {
        df = document.getElementById('customDateFormatInput').value.trim();
    }

    localStorage.setItem('gigstems_tf', tf);
    localStorage.setItem('gigstems_tu', tu);
    localStorage.setItem('gigstems_tz', tz);
    localStorage.setItem('gigstems_df', df);

    alert(currentLang === 'sr' ? "Aplikativna podešavanja su uspešno sačuvana!" : "Application settings successfully saved!");
}

// Zatvaranje popupa klikom bilo gde van
window.onclick = (e) => {
    if (!e.target.closest('.user-profile-trigger')) {
        closeProfileMenu();
    }
};

window.onload = () => {
    loadSavedSettings();
    setupCountryCitySelectors('new');
    setupCountryCitySelectors('edit');
    setupCustomInputDetection('Timezone');
    setupCustomInputDetection('DateFormat');
    setLanguage(currentLang);
};
