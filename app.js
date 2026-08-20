// ==========================================================================
// GIGLAB WEB APP - CORE JAVASCRIPT LOGIC (VERZIJA 1.4.08)
// ==========================================================================

// Supabase konfiguracija baze podataka
const SUPABASE_URL = "https://yqmxwgikcqibbkpqstux.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbXh3Z2lrY3FpYmJrcHFzdHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNjEwNDksImV4cCI6MjEwMjczNzA0OX0.TVedwos2OOmvggCK-zyevtV6S2Vfdax9e9ygHhKr5nA";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Google API Key za očitavanje drajv linkova
let GOOGLE_API_KEY = "";

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
let currentSongName = "";
let allSongs = [];

// DOM elementi
let authContainer, appContainer, playBtn, stopBtn, statusLabel, songsList, tracksContainer, stemsPlayerContainer, bandDashboard;

// Registar država i gradova
const countriesData = {
    "Srbija": ["Beograd", "Novi Sad", "Niš", "Kragujevac", "Subotica", "Kraljevo", "Čačak", "Šabac", "Zrenjanin", "Kruševac"],
    "Hrvatska": ["Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Pula", "Slavonski Brod", "Karlovac", "Varaždin", "Šibenik"],
    "Bosna i Hercegovina": ["Sarajevo", "Banja Luka", "Tuzla", "Zenica", "Mostar", "Bijeljina", "Brčko", "Bihać", "Prijedor"],
    "Crna Gora": ["Podgorica", "Nikšić", "Herceg Novi", "Pljevlja", "Budva", "Bar", "Cetinje", "Kotor", "Tivat"],
    "Severna Makedonija": ["Skoplje", "Bitolj", "Kumanovo", "Prilep", "Ohrid", "Tetovo", "Veles", "Strumica"],
    "Slovenija": ["Ljubljana", "Maribor", "Celje", "Kranj", "Velenje", "Koper", "Novo Mesto"]
};

// Inicijalizacija DOM elemenata pri učitavanju
document.addEventListener("DOMContentLoaded", () => {
    authContainer = document.getElementById('authContainer');
    appContainer = document.getElementById('appContainer');
    playBtn = document.getElementById('playBtn');
    stopBtn = document.getElementById('stopBtn');
    statusLabel = document.getElementById('statusLabel');
    songsList = document.getElementById('songsList');
    tracksContainer = document.getElementById('tracksContainer');
    stemsPlayerContainer = document.getElementById('stemsPlayerContainer');
    bandDashboard = document.getElementById('bandDashboard');

    // Slušamo promene u auth stanju
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUserProfile = {
                id: session.user.id,
                email: session.user.email,
                display_name: session.user.user_metadata.display_name || ""
            };
            
            // Povlačimo profil iz baze radi jezika, države i grada
            const { data: prof } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

            if (prof) {
                currentUserProfile.display_name = prof.display_name || currentUserProfile.display_name;
                currentUserProfile.country = prof.country || "";
                currentUserProfile.city = prof.city || "";
                
                // Ako korisnik ima sačuvan jezik, primenjujemo ga
                if (prof.language && prof.language !== currentLang) {
                    currentLang = prof.language;
                    localStorage.setItem('gigstems_lang', currentLang);
                }
            }

            setLanguage(currentLang);
            loadSavedSettings();
            
            authContainer.style.display = "none";
            appContainer.style.display = "flex";
            
            renderUserProfilesUI();
            await loadUserBands();
        } else {
            currentUserProfile = null;
            appContainer.style.display = "none";
            authContainer.style.display = "block";
            setLanguage(currentLang);
        }
    });

    // Inicijalizujemo padajuće menije za države u formama
    populateCountryDropdowns();
});

// Popunjavanje dropdowna za države
function populateCountryDropdowns() {
    const dropdowns = ['newBandCountry', 'editBandCountry', 'settingCountry'];
    dropdowns.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        select.innerHTML = '<option value="">-- Izaberi državu --</option>';
        Object.keys(countriesData).forEach(country => {
            const opt = document.createElement('option');
            opt.value = country;
            opt.innerText = country;
            select.appendChild(opt);
        });

        // Dodajemo Custom opciju
        const customOpt = document.createElement('option');
        customOpt.value = "custom";
        customOpt.innerText = currentLang === 'sr' ? "Custom... (Slobodan unos)" : "Custom... (Free input)";
        select.appendChild(customOpt);
    });
}

// Promena države puni gradove
function handleCountryChange(selectEl, citySelectId, customCountryInputId, customCityInputId) {
    const val = selectEl.value;
    const citySelect = document.getElementById(citySelectId);
    const customCountryInput = document.getElementById(customCountryInputId);
    const customCityInput = document.getElementById(customCityInputId);

    if (val === "custom") {
        if (customCountryInput) customCountryInput.style.display = "block";
        if (customCityInput) customCityInput.style.display = "block";
        if (citySelect) {
            citySelect.style.display = "none";
            citySelect.disabled = true;
        }
    } else {
        if (customCountryInput) customCountryInput.style.display = "none";
        if (customCityInput) customCityInput.style.display = "none";
        if (citySelect) {
            citySelect.style.display = "block";
            citySelect.disabled = false;
            citySelect.innerHTML = '<option value="">-- Izaberi grad --</option>';

            if (countriesData[val]) {
                countriesData[val].forEach(city => {
                    const opt = document.createElement('option');
                    opt.value = city;
                    opt.innerText = city;
                    citySelect.appendChild(opt);
                });

                // Dodajemo Custom za grad
                const customCityOpt = document.createElement('option');
                customCityOpt.value = "custom";
                customCityOpt.innerText = currentLang === 'sr' ? "Custom..." : "Custom...";
                citySelect.appendChild(customCityOpt);
            }
        }
    }
}

// Promena grada za custom unos
function handleCityChange(selectEl, customCityInputId) {
    const val = selectEl.value;
    const customCityInput = document.getElementById(customCityInputId);
    if (val === "custom") {
        if (customCityInput) customCityInput.style.display = "block";
    } else {
        if (customCityInput) customCityInput.style.display = "none";
    }
}

// ==========================================================================
// 1. AUTENTIFIKACIJA & SIGN UP / OTP VERIFICATION
// ==========================================================================

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    isOTPMode = false;
    document.getElementById('authDisplayNameGroup').style.display = isRegisterMode ? "block" : "none";
    document.getElementById('authFormFields').style.display = "block";
    document.getElementById('otpFormFields').style.display = "none";
    setLanguage(currentLang);
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

async function handleAuthSubmit() {
    const email = document.getElementById('authEmailInput').value.trim();
    const password = document.getElementById('authPasswordInput').value.trim();
    const displayName = document.getElementById('authDisplayNameInput').value.trim();

    if (!email || !password) {
        alert(currentLang === 'sr' ? "Popunite email i lozinku!" : "Please enter email and password!");
        return;
    }

    if (isRegisterMode) {
        if (!displayName) {
            alert(currentLang === 'sr' ? "Popunite tvoje ime!" : "Please enter your name!");
            return;
        }

        // Registracija preko Supabase
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName }
            }
        });

        if (error) {
            alert(error.message);
        } else {
            pendingRegEmail = email;
            alert(i18n[currentLang].authSuccessRegister);
            switchToOTPMode();
        }
    } else {
        // Prijava
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            alert(error.message);
        }
    }
}

async function handleOTPVerify() {
    const code = document.getElementById('otpCodeInput').value.trim();
    if (!code) {
        alert(currentLang === 'sr' ? "Unesite 6-cifreni kod!" : "Please enter the 6-digit code!");
        return;
    }

    const { data, error } = await supabaseClient.auth.verifyOtp({
        email: pendingRegEmail,
        token: code,
        type: 'signup'
    });

    if (error) {
        alert(error.message);
    } else {
        alert(currentLang === 'sr' ? "Uspešna verifikacija! Ulogovani ste." : "Verification successful! You are logged in.");
        isOTPMode = false;
        isRegisterMode = false;
    }
}

async function handleLogout() {
    await cleanAudioEngine();
    await supabaseClient.auth.signOut();
}

function renderUserProfilesUI() {
    if (!currentUserProfile) return;
    const initial = (currentUserProfile.display_name || currentUserProfile.email || "M").charAt(0).toUpperCase();
    document.getElementById('userAvatarCircle').innerText = initial;
    document.getElementById('currentUserName').innerText = currentUserProfile.display_name || currentUserProfile.email;
    
    // modal avatar
    document.getElementById('settingsAvatarCircle').innerText = initial;
    document.getElementById('settingEmail').value = currentUserProfile.email;
    document.getElementById('settingDisplayName').value = currentUserProfile.display_name || "";
}

// ==========================================================================
// 2. BENDOVI & ČLANSTVO (Supabase mrežna integracija)
// ==========================================================================

async function loadUserBands() {
    if (!currentUserProfile) return;

    const { data: membershipData, error: membershipError } = await supabaseClient
        .from('band_members')
        .select('band_id, role')
        .eq('user_id', currentUserProfile.id);

    if (membershipError) {
        console.error(membershipError);
        return;
    }

    if (!membershipData || membershipData.length === 0) {
        bands = [];
        renderSidebarBands();
        showEmptyDashboard();
        return;
    }

    const bandIds = membershipData.map(m => m.band_id);
    const { data: bandsData, error: bandsError } = await supabaseClient
        .from('bands')
        .select('*')
        .in('id', bandIds);

    if (bandsError) {
        console.error(bandsError);
        return;
    }

    bands = bandsData.map(b => {
        const mem = membershipData.find(m => m.band_id === b.id);
        return {
            ...b,
            userRole: mem ? mem.role : 'member'
        };
    });

    renderSidebarBands();

    if (activeBandId) {
        // Da li i dalje pripadamo tom bendu?
        if (bands.some(b => b.id === activeBandId)) {
            await selectActiveBand(activeBandId);
        } else {
            activeBandId = "";
            showEmptyDashboard();
        }
    } else {
        showEmptyDashboard();
    }
}

function renderSidebarBands() {
    const listEl = document.getElementById('sidebarBandsList');
    listEl.innerHTML = "";

    if (bands.length === 0) {
        listEl.innerHTML = `<p style="font-size:0.85em; color:var(--text-muted); padding:0 10px;">${i18n[currentLang].noBands}</p>`;
        return;
    }

    bands.forEach(band => {
        const item = document.createElement('div');
        item.className = `sidebar-band-item ${activeBandId === band.id ? 'active' : ''}`;

        let subMenuHTML = "";
        if (activeBandId === band.id) {
            subMenuHTML = `
                <div class="sidebar-band-sub-menu">
                    <div class="sub-menu-item" onclick="openSongsView(event)">🎵 ${currentLang === 'sr' ? 'Stemovi' : 'Stems'}</div>
                    <div class="sub-menu-item" onclick="toggleMembersSection(event)">👥 ${currentLang === 'sr' ? 'Članovi' : 'Members'}</div>
                    <div class="sub-menu-item" onclick="toggleBandSettingsSection(event)">⚙️ ${currentLang === 'sr' ? 'Podešavanja' : 'Settings'}</div>
                </div>
            `;
        }

        item.innerHTML = `
            <div class="sidebar-band-title" onclick="handleBandClick(event, '${band.id}')">${band.name}</div>
            ${subMenuHTML}
        `;
        listEl.appendChild(item);
    });
}

async function handleBandClick(event, bandId) {
    if (event) event.stopPropagation();
    if (activeBandId === bandId) {
        activeBandId = "";
        showEmptyDashboard();
        renderSidebarBands();
    } else {
        await selectActiveBand(bandId);
    }
}

function showEmptyDashboard() {
    document.getElementById('bandCard').style.display = "none";
    document.getElementById('bandAdminSection').style.display = "none";
    document.getElementById('dashboardEmptyState').style.display = "block";
    stemsPlayerContainer.style.display = "none";
}

async function selectActiveBand(bandId) {
    if (activeBandId !== bandId) {
        await cleanAudioEngine();
    }

    activeBandId = bandId;
    const band = bands.find(b => b.id === bandId);
    if (!band) return;

    renderSidebarBands();

    document.getElementById('dashboardEmptyState').style.display = "none";
    document.getElementById('bandCard').style.display = "flex";
    document.getElementById('bandAdminSection').style.display = "none";

    document.getElementById('bandCardName').innerText = band.name;
    const roleBadge = document.getElementById('bandRoleBadge');
    roleBadge.innerText = band.userRole === 'admin' ? i18n[currentLang].roleAdmin : i18n[currentLang].roleUser;
    roleBadge.className = band.userRole === 'admin' ? 'badge-owner' : 'badge-member';
    document.getElementById('bandCardOwnerName').innerText = band.contact_name || "Marko Marković";

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

    stemsPlayerContainer.style.display = "none";
    bandDashboard.style.display = "flex";
}

function showNewBandCreation() {
    activeBandId = "";
    renderSidebarBands();

    document.getElementById('dashboardEmptyState').style.display = "none";
    document.getElementById('bandCard').style.display = "none";
    
    document.getElementById('bandAdminSection').style.display = "block";
    document.getElementById('newBandForm').style.display = "block";
    document.getElementById('editBandForm').style.display = "none";
    document.getElementById('membersManagementSection').style.display = "none";
    
    stemsPlayerContainer.style.display = "none";
    bandDashboard.style.display = "flex";
}

async function addNewBandSubmit() {
    const name = document.getElementById('newBandName').value.trim();
    const rawUrl = document.getElementById('newBandUrl').value.trim();
    
    // Geografija
    let country = document.getElementById('newBandCountry').value;
    if (country === "custom") country = document.getElementById('newBandCustomCountryInput').value.trim();
    
    let city = document.getElementById('newBandCity').value;
    if (city === "custom" || document.getElementById('newBandCustomCityInput').style.display === "block") {
        city = document.getElementById('newBandCustomCityInput').value.trim();
    }

    // Kontakt podaci
    const contactName = document.getElementById('newContactName').value.trim();
    const contactPhone = document.getElementById('newContactPhone').value.trim();
    const website = document.getElementById('newWebsite').value.trim();
    const instagram = document.getElementById('newInstagram').value.trim();

    if (!name || !rawUrl || !country || !city) {
        alert(currentLang === 'sr' ? "Naziv, Link, Država i Grad su obavezni!" : "Name, Link, Country, and City are required!");
        return;
    }

    // 1. TROSTEPENA JEDINSTVENA PROVERA (Name + Country + City)
    const { data: duplicates, error: checkError } = await supabaseClient
        .from('bands')
        .select('id')
        .eq('name', name)
        .eq('country', country)
        .eq('city', city);

    if (duplicates && duplicates.length > 0) {
        alert(currentLang === 'sr' 
            ? "Ovaj bend već postoji u izabranom gradu i državi! Izaberite drugo ime." 
            : "This band already exists in the selected city and country! Please choose another name.");
        return;
    }

    const folderId = extractFolderId(rawUrl);
    const joinCode = 'GL' + Math.floor(100000 + Math.random() * 900000); // Dinamički kod

    // Upisujemo u bazu bands
    const { data: newBand, error: insertError } = await supabaseClient
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

    if (insertError) {
        alert(insertError.message);
        return;
    }

    // Upisujemo u članstvo (Uloga: admin)
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
        alert(currentLang === 'sr' ? "Bend uspešno osnovan!" : "Band successfully created!");
        
        // Čistimo formu
        document.getElementById('newBandName').value = "";
        document.getElementById('newBandUrl').value = "";
        document.getElementById('newContactName').value = "";
        document.getElementById('newContactPhone').value = "";
        document.getElementById('newWebsite').value = "";
        document.getElementById('newInstagram').value = "";
        
        activeBandId = newBand.id;
        await loadUserBands();
    }
}

function toggleBandSettingsSection(event) {
    if (event) event.stopPropagation();
    
    const adminSec = document.getElementById('bandAdminSection');
    const editForm = document.getElementById('editBandForm');
    
    if (adminSec.style.display === "block" && editForm.style.display === "block") {
        adminSec.style.display = "none";
        return;
    }

    adminSec.style.display = "block";
    editForm.style.display = "block";
    document.getElementById('newBandForm').style.display = "none";
    document.getElementById('membersManagementSection').style.display = "none";

    const band = bands.find(b => b.id === activeBandId);
    if (band) {
        document.getElementById('editBandName').value = band.name || "";
        document.getElementById('editBandUrl').value = band.raw_url || "";
        
        // Popunjavamo selekciju države i grada
        const countrySelect = document.getElementById('editBandCountry');
        countrySelect.value = band.country || "";
        handleCountryChange(countrySelect, 'editBandCity', 'editBandCustomCountryInput', 'editBandCustomCityInput');
        
        setTimeout(() => {
            const citySelect = document.getElementById('editBandCity');
            citySelect.value = band.city || "";
        }, 100);

        document.getElementById('editContactName').value = band.contact_name || "";
        document.getElementById('editContactPhone').value = band.contact_phone || "";
        document.getElementById('editWebsite').value = band.website || "";
        document.getElementById('editInstagram').value = band.instagram || "";

        // Isključujemo polja ako nismo Admin / Šef benda
        const isAdmin = band.userRole === 'admin';
        document.getElementById('editBandName').disabled = !isAdmin;
        document.getElementById('editBandUrl').disabled = !isAdmin;
        document.getElementById('editBandCountry').disabled = !isAdmin;
        document.getElementById('editBandCity').disabled = !isAdmin;
        document.getElementById('editContactName').disabled = !isAdmin;
        document.getElementById('editContactPhone').disabled = !isAdmin;
        document.getElementById('editWebsite').disabled = !isAdmin;
        document.getElementById('editInstagram').disabled = !isAdmin;

        document.getElementById('renameBtn').style.display = isAdmin ? "inline-block" : "none";
        document.getElementById('deleteBandBtn').style.display = isAdmin ? "inline-block" : "none";
    }
}

async function updateBandSubmit() {
    const name = document.getElementById('editBandName').value.trim();
    const rawUrl = document.getElementById('editBandUrl').value.trim();
    const country = document.getElementById('editBandCountry').value;
    const city = document.getElementById('editBandCity').value;
    const contactName = document.getElementById('editContactName').value.trim();
    const contactPhone = document.getElementById('editContactPhone').value.trim();
    const website = document.getElementById('editWebsite').value.trim();
    const instagram = document.getElementById('editInstagram').value.trim();

    if (!name || !rawUrl) {
        alert(currentLang === 'sr' ? "Polja ne smeju biti prazna!" : "Fields cannot be empty!");
        return;
    }

    const folderId = extractFolderId(rawUrl);

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
        alert(currentLang === 'sr' ? "Izmene sačuvane!" : "Changes saved!");
        await loadUserBands();
        
        // Vraćamo se na prikaz Dashboard-a po dogovoru
        document.getElementById('bandAdminSection').style.display = "none";
    }
}

async function deleteActiveBand() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    if (!confirm(i18n[currentLang].deleteBandConfirm)) return;

    // Prvo brišemo članove
    await supabaseClient.from('band_members').delete().eq('band_id', activeBandId);

    // Brišemo bend
    const { error } = await supabaseClient
        .from('bands')
        .delete()
        .eq('id', activeBandId);

    if (error) {
        alert(error.message);
    } else {
        activeBandId = "";
        await loadUserBands();
    }
}

// Članovi benda, izbacivanje i napuštanje
async function toggleMembersSection(event) {
    if (event) event.stopPropagation();

    const adminSec = document.getElementById('bandAdminSection');
    const membersSec = document.getElementById('membersManagementSection');

    if (adminSec.style.display === "block" && membersSec.style.display === "block") {
        adminSec.style.display = "none";
        return;
    }

    adminSec.style.display = "block";
    membersSec.style.display = "block";
    document.getElementById('newBandForm').style.display = "none";
    document.getElementById('editBandForm').style.display = "none";

    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    document.getElementById('bandJoinCodeDisplay').value = band.join_code || "";

    // Povlačimo spisak članova i njihove profile
    const { data: membersData, error: mError } = await supabaseClient
        .from('band_members')
        .select('id, role, user_id, profiles(display_name, email)')
        .eq('band_id', activeBandId);

    const membersListEl = document.getElementById('bandMembersList');
    membersListEl.innerHTML = "";

    if (membersData) {
        const isAdminOfBand = band.userRole === 'admin';
        
        membersData.forEach(m => {
            const row = document.createElement('div');
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.padding = "10px 14px";
            row.style.backgroundColor = "var(--bg-dark-800)";
            row.style.borderRadius = "8px";
            row.style.border = "1px solid var(--border-color)";
            
            const profile = m.profiles;
            const name = profile ? (profile.display_name || profile.email) : "Marko Marković";
            
            let roleText = i18n[currentLang].roleUser;
            let roleStyle = "color: var(--text-secondary); font-size: 0.85em;";
            if (m.role === 'admin') {
                roleText = i18n[currentLang].roleAdmin;
                roleStyle = "color: var(--accent-gold); font-size: 0.85em; font-weight:400;";
            }

            // Šef benda može da izbaci bilo koga ko nije on sam
            let actionBtnHTML = "";
            if (isAdminOfBand && m.user_id !== currentUserProfile.id) {
                actionBtnHTML = `<button class="btn-stop" style="padding: 4px 8px; font-size:0.75em;" onclick="kickBandMember('${m.id}')">${i18n[currentLang].kickMember}</button>`;
            }

            row.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-size:0.95em; color:var(--text-primary); font-weight:400;">🎸 ${name}</span>
                    <span style="${roleStyle}">${roleText}</span>
                </div>
                ${actionBtnHTML}
            `;
            membersListEl.appendChild(row);
        });

        // Dodajemo i dugme "Napusti bend" na dnu ako smo član
        const leaveRow = document.createElement('div');
        leaveRow.style.marginTop = "15px";
        leaveRow.style.textAlign = "right";
        leaveRow.innerHTML = `<button class="btn-stop" onclick="leaveActiveBand()">${i18n[currentLang].leaveBandBtn}</button>`;
        membersListEl.appendChild(leaveRow);
    }
}

// Regeneracija pristupnog koda (Samo za Šefa / Admina)
async function regenerateJoinCode() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band || band.userRole !== 'admin') {
        alert(i18n[currentLang].onlyAdminEditMsg);
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
        band.join_code = newCode;
        document.getElementById('bandJoinCodeDisplay').value = newCode;
        alert(currentLang === 'sr' ? "Novi pristupni kod uspešno generisan!" : "New access code successfully generated!");
    }
}

// Učlanjenje u bend pomoću pristupnog koda
async function submitJoinCode() {
    if (!currentUserProfile) return;

    const codeInput = document.getElementById('joinCodeInput');
    const code = codeInput.value.trim().toUpperCase();

    if (!code) {
        alert(currentLang === 'sr' ? "Unesite pristupni kod!" : "Please enter the access code!");
        return;
    }

    // Pronalazimo bend sa tim pristupnim kodom
    const { data: bandData, error: bandError } = await supabaseClient
        .from('bands')
        .select('*')
        .eq('join_code', code)
        .maybeSingle();

    if (bandError || !bandData) {
        alert(currentLang === 'sr' ? "Bend sa tim pristupnim kodom nije pronađen!" : "Band with that access code not found!");
        return;
    }

    // Proveravamo da li je korisnik već član
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

    // Upisujemo korisnika u članstvo (Uloga: 'member' po dogovoru)
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
        await loadUserBands();
    }
}

// Izbaci člana (Samo Admin)
async function kickBandMember(membershipId) {
    if (!confirm(i18n[currentLang].kickMemberConfirm)) return;

    const { error } = await supabaseClient
        .from('band_members')
        .delete()
        .eq('id', membershipId);

    if (error) {
        alert(error.message);
    } else {
        await toggleMembersSection();
    }
}

// Napusti bend (Muzičar)
async function leaveActiveBand() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    if (!confirm(i18n[currentLang].leaveBandConfirm)) return;

    // Gvozdeno pravilo - provera da li je poslednji admin u bendu
    const { data: members, error: mError } = await supabaseClient
        .from('band_members')
        .select('id, role, user_id')
        .eq('band_id', activeBandId);

    const admins = members.filter(m => m.role === 'admin');
    const isUserAdmin = band.userRole === 'admin';

    if (isUserAdmin && admins.length === 1 && members.length > 1) {
        alert(i18n[currentLang].leaveBandAdminBlock);
        return;
    }

    const myMembership = members.find(m => m.user_id === currentUserProfile.id);
    if (!myMembership) return;

    const { error } = await supabaseClient
        .from('band_members')
        .delete()
        .eq('id', myMembership.id);

    if (error) {
        alert(error.message);
    } else {
        // Ako nema više članova, u potpunosti brišemo i sam bend iz baze
        if (members.length === 1) {
            await supabaseClient.from('bands').delete().eq('id', activeBandId);
        }

        activeBandId = "";
        await loadUserBands();
    }
}

// Prijavi problem / Support tiket
async function submitSupportTicket() {
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
            message: message,
            status: 'open'
        });

    if (error) {
        alert(i18n[currentLang].ticketError + error.message);
    } else {
        alert(i18n[currentLang].ticketSuccess);
        document.getElementById('supportSubject').value = "";
        document.getElementById('supportMessage').value = "";
        toggleSupportModal();
    }
}

function toggleSupportModal() {
    const modal = document.getElementById('supportModal');
    modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
}

function extractFolderId(url) {
    if (!url) return "";
    const match = url.match(/\/folders\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
}

// ==========================================================================
// 3. REPERTOAR & AUDIO ENGINE (MULTITRACK WEB AUDIO v1.4.08)
// ==========================================================================

function openSongsView(event) {
    if (event) event.stopPropagation();
    
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    bandDashboard.style.display = "none";
    stemsPlayerContainer.style.display = "flex";
    
    // Na mobilnom uklanjamo klasu pre nego što se nova pesma otvori
    stemsPlayerContainer.classList.remove('song-loaded');

    loadSongsFromActiveBand();
}

async function exitRepertoireToDashboard() {
    await cleanAudioEngine();
    stemsPlayerContainer.style.display = "none";
    bandDashboard.style.display = "flex";
}

async function loadSongsFromActiveBand() {
    if (bands.length === 0 || !activeBandId) {
        songsList.innerHTML = `<div style="padding:15px; text-align:center; color:var(--text-muted);">${i18n[currentLang].noBands}</div>`;
        return;
    }

    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    if (!GOOGLE_API_KEY) {
        songsList.innerHTML = `<div style="padding:10px; color:var(--accent-gold); font-size:0.9em; line-height:1.4;">⚠️ ${i18n[currentLang].apiKeyWarning}</div>`;
        return;
    }

    songsList.innerHTML = `<div style="padding:15px; text-align:center; color:var(--text-secondary);">${i18n[currentLang].statusConnecting}</div>`;

    const url = `https://www.googleapis.com/drive/v3/files?q='${band.folder_id}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&key=${GOOGLE_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.files && data.files.length > 0) {
            allSongs = data.files.sort((a, b) => a.name.localeCompare(b.name));
            renderSongsListUI(allSongs);
        } else {
            songsList.innerHTML = `<div style="padding:10px; color:var(--text-muted);">${i18n[currentLang].noSongs}</div>`;
        }
    } catch (err) {
        console.error(err);
        songsList.innerHTML = `<div style="padding:10px; color:var(--accent-red);">${i18n[currentLang].statusConnError}</div>`;
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

// Učitavanje svih MP3 traka izabrane pesme
async function selectSongToPlay(songFolder) {
    if (isPlaying) {
        stopAudio();
    }
    
    await cleanAudioEngine();
    
    currentSongName = songFolder.name;
    renderSongsListUI(allSongs);

    updateStatusText('statusLoading');
    tracksContainer.innerHTML = "";

    // Na mobilnom dodajemo klasu da prebacimo ekran na mikser!
    stemsPlayerContainer.classList.add('song-loaded');

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

        audioBuffers = [];
        trackNames = [];
        gainNodes = [];

        // Preuzimanje i dekodiranje svih kanala (Sinhrono po dogovoru za izbegavanje trkačkih uslova)
        for (let i = 0; i < audioFiles.length; i++) {
            const file = audioFiles[i];
            updateStatusText('statusDecoding');
            statusLabel.innerText = `${i18n[currentLang].statusDecoding} [${i+1}/${audioFiles.length}]: ${file.name}...`;

            const streamUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GOOGLE_API_KEY}`;
            const res = await fetch(streamUrl);
            const arrayBuf = await res.arrayBuffer();
            const decodedBuffer = await audioCtx.decodeAudioData(arrayBuf);
            
            audioBuffers.push(decodedBuffer);
            const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/^[0-9]+[_-]/, "");
            trackNames.push(cleanName);
        }

        buildMixerUI();
        
        playBtn.disabled = false;
        stopBtn.disabled = false;
        updateStatusText('statusReady', audioBuffers.length);

    } catch (err) {
        console.error(err);
        updateStatusText('statusError');
    }
}

// Iscrtavanje v1.3.7-style horizontalne miksete sa LocalStorage podrškom
function buildMixerUI() {
    tracksContainer.innerHTML = "";
    gainNodes = [];

    if (!audioCtx) return;

    if (!masterGainNode) {
        masterGainNode = audioCtx.createGain();
        const savedMasterVol = localStorage.getItem('gigstems_master_volume');
        const initMasterVol = savedMasterVol !== null ? parseFloat(savedMasterVol) : 0.8;
        masterGainNode.gain.setValueAtTime(isMasterMuted ? 0 : initMasterVol, audioCtx.currentTime);
        masterGainNode.connect(audioCtx.destination);
    }

    // Sačuvani miks
    let savedMix = {};
    if (currentSongName) {
        const rawSave = localStorage.getItem('gigstems_mix_' + currentSongName);
        if (rawSave) {
            try { savedMix = JSON.parse(rawSave); } catch (e) { console.error(e); }
        }
    }

    // Sačuvani redosled traka
    let savedOrder = [];
    if (currentSongName) {
        const rawOrder = localStorage.getItem('gigstems_order_' + currentSongName);
        if (rawOrder) {
            try { savedOrder = JSON.parse(rawOrder); } catch (e) { console.error(e); }
        }
    }

    // Generišemo indekse prema sačuvanom redosledu ili podrazumevano
    let orderIndices = trackNames.map((_, i) => i);
    if (savedOrder && savedOrder.length > 0) {
        orderIndices.sort((a, b) => {
            const nameA = trackNames[a];
            const nameB = trackNames[b];
            const indexA = savedOrder.indexOf(nameA);
            const indexB = savedOrder.indexOf(nameB);
            const posA = indexA === -1 ? 999 : indexA;
            const posB = indexB === -1 ? 999 : indexB;
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
                <input type="range" class="track-volume-slider" min="0" max="1.2" step="0.01" value="${trackPreset.volume}" oninput="setVolume(${index}, this.value)" data-index="${index}">
            </div>
            <button id="muteBtn-${index}" class="${muteClass}" onclick="toggleMute(${index})">MUTE</button>
            <button id="soloBtn-${index}" class="${soloClass}" onclick="toggleSolo(${index})">SOLO</button>
        `;
        tracksContainer.appendChild(strip);
    });

    applyGainsFromUI();
    makeMixerSortable();
}

// Drag & Drop logika za sortiranje horizontalnih traka
function makeMixerSortable() {
    const container = document.getElementById('tracksContainer');
    const strips = container.querySelectorAll('.track-strip');

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

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingElement = container.querySelector('.dragging');
        if (!draggingElement) return;

        const afterElement = getDragAfterElement(container, e.clientY);
        if (afterElement == null) {
            container.appendChild(draggingElement);
        } else {
            container.insertBefore(draggingElement, afterElement);
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
    const container = document.getElementById('tracksContainer');
    const strips = container.querySelectorAll('.track-strip');
    const order = [];

    strips.forEach(strip => {
        const index = parseInt(strip.getAttribute('data-index'));
        order.push(trackNames[index]);
    });

    localStorage.setItem('gigstems_order_' + currentSongName, JSON.stringify(order));
}

function applyGainsFromUI() {
    if (!audioCtx) return;

    let isAnySoloActive = false;
    trackNames.forEach((_, i) => {
        const soloBtn = document.getElementById(`soloBtn-${i}`);
        if (soloBtn && soloBtn.classList.contains('active')) {
            isAnySoloActive = true;
        }
    });

    trackNames.forEach((_, i) => {
        const slider = document.querySelector(`.track-volume-slider[data-index="${i}"]`);
        const vol = slider ? parseFloat(slider.value) : 0.8;
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
        const slider = document.querySelector(`.track-volume-slider[data-index="${index}"]`);
        const muteBtn = document.getElementById(`muteBtn-${index}`);
        const soloBtn = document.getElementById(`soloBtn-${index}`);

        mixState[name] = {
            volume: slider ? parseFloat(slider.value) : 0.8,
            muted: muteBtn ? muteBtn.classList.contains('active') : false,
            solo: soloBtn ? soloBtn.classList.contains('active') : false
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

function setMasterVolume(val) {
    localStorage.setItem('gigstems_master_volume', val);
    if (masterGainNode) {
        masterGainNode.gain.setValueAtTime(isMasterMuted ? 0 : parseFloat(val), audioCtx.currentTime);
    }
}

function toggleMasterMute() {
    const btn = document.getElementById('masterMuteBtn');
    isMasterMuted = !isMasterMuted;
    
    if (isMasterMuted) {
        btn.classList.add('active');
        btn.innerText = currentLang === 'sr' ? "ODMUTIRAJ SVE" : "UNMUTE ALL";
        if (masterGainNode) masterGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    } else {
        btn.classList.remove('active');
        btn.innerText = i18n[currentLang].masterMuteBtn;
        const sliderVal = parseFloat(document.getElementById('masterVolumeSlider').value);
        if (masterGainNode) masterGainNode.gain.setValueAtTime(sliderVal, audioCtx.currentTime);
    }
}

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
        timerInterval = setInterval(updateAudioTimer, 250);
    }
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

function stopAudio() {
    stopSourceNodes();
    isPlaying = false;
    pauseOffset = 0;
    updatePlayBtnUI();
    clearInterval(timerInterval);
}

function updateAudioTimer() {
    if (!isPlaying) return;
    const elapsed = pauseOffset + (audioCtx.currentTime - startTime);
    // Ako pesma dođe do kraja, gasimo plejer
    const maxDur = Math.max(...audioBuffers.map(b => b.duration));
    if (elapsed >= maxDur) {
        stopAudio();
    }
}

function updatePlayBtnUI() {
    if (isPlaying) {
        playBtn.innerHTML = `<span>⏸ ${i18n[currentLang].pauseBtn}</span>`;
    } else {
        playBtn.innerHTML = `<span>▶ ${i18n[currentLang].playBtn}</span>`;
    }
}

async function cleanAudioEngine() {
    stopAudio();
    
    if (audioCtx) {
        try {
            await audioCtx.close();
        } catch (e) {
            console.warn(e);
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

// Avatar i Logo upload funkcije (Base64)
function triggerAvatarUpload() {
    document.getElementById('avatarFileInput').click();
}

async function handleAvatarUpload(input) {
    if (!input.files || !input.files[0] || !currentUserProfile) return;
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        const base64Img = e.target.result;
        
        const { error } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: base64Img })
            .eq('id', currentUserProfile.id);
            
        if (error) {
            alert("Error saving avatar: " + error.message);
        } else {
            currentUserProfile.avatar_url = base64Img;
            renderUserProfilesUI();
        }
    };
    reader.readAsDataURL(file);
}

function triggerLogoUpload() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band || band.userRole !== 'admin') {
        alert(i18n[currentLang].onlyAdminEditMsg);
        return;
    }
    document.getElementById('bandLogoFileInput').click();
}

async function handleLogoUpload(input) {
    if (!input.files || !input.files[0] || !activeBandId) return;
    
    const spinner = document.getElementById('logoLoadingSpinner');
    spinner.style.display = "block";
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        const base64Img = e.target.result;
        
        const { error } = await supabaseClient
            .from('bands')
            .update({ logo_url: base64Img })
            .eq('id', activeBandId);
            
        spinner.style.display = "none";
        
        if (error) {
            alert("Error saving logo: " + error.message);
        } else {
            const band = bands.find(b => b.id === activeBandId);
            if (band) band.logo_url = base64Img;
            
            const logoImg = document.getElementById('bandLogoImg');
            const logoPlaceholder = document.getElementById('bandLogoPlaceholderIcon');
            logoImg.src = base64Img;
            logoImg.style.display = "block";
            logoPlaceholder.style.display = "none";
        }
    };
    reader.readAsDataURL(file);
}

async function deleteCurrentUserAccount() {
    if (!currentUserProfile) return;
    
    const confirmMsg = currentLang === 'sr' 
        ? "Da li sigurno želiš da obrišeš svoj nalog? Ovo je neopoziv korak!" 
        : "Are you sure you want to delete your account? This action is irreversible!";
        
    if (!confirm(confirmMsg)) return;
    
    const { error } = await supabaseClient
        .from('profiles')
        .delete()
        .eq('id', currentUserProfile.id);
        
    if (error) {
        alert("Delete account failed: " + error.message);
    } else {
        await handleLogout();
    }
}

// Regionalna podešavanja & Modali
function toggleProfileMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('profilePopupMenu');
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

function closeProfileMenu() {
    const menu = document.getElementById('profilePopupMenu');
    if (menu) menu.style.display = 'none';
}

document.addEventListener('click', () => {
    closeProfileMenu();
});

function openSettingsModal() {
    document.getElementById('settingsModal').style.display = "flex";
    switchSettingsTab('Regional');
    loadSavedSettings();
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = "none";
}

function switchSettingsTab(tabId) {
    document.querySelectorAll('.modal-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.modal-tab').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`settingsTab${tabId}`).style.display = 'block';
    document.getElementById(`tabBtn${tabId}`).classList.add('active');
}

async function saveSettings() {
    const timeFormat = document.getElementById('settingTimeFormat').value;
    const dateFormat = document.getElementById('settingDateFormat').value;
    const timezone = document.getElementById('settingTimezone').value;
    const langSelection = document.getElementById('settingLanguage').value;
    
    // Geografija korisnika
    let country = document.getElementById('settingCountry').value;
    if (country === "custom") country = document.getElementById('settingCustomCountryInput').value.trim();
    let city = document.getElementById('settingCity').value;
    if (city === "custom" || document.getElementById('settingCustomCityInput').style.display === "block") {
        city = document.getElementById('settingCustomCityInput').value.trim();
    }

    localStorage.setItem('gigstems_time_format', timeFormat);
    localStorage.setItem('gigstems_date_format', dateFormat);
    localStorage.setItem('gigstems_timezone', timezone);

    // Profil podaci
    const newName = document.getElementById('settingDisplayName').value.trim();
    if (currentUserProfile) {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ 
                display_name: newName,
                country: country,
                city: city,
                language: langSelection
            })
            .eq('id', currentUserProfile.id);
            
        if (error) {
            alert("Error updating profile: " + error.message);
        } else {
            currentUserProfile.display_name = newName;
            currentUserProfile.country = country;
            currentUserProfile.city = city;
            currentLang = langSelection;
            localStorage.setItem('gigstems_lang', langSelection);
            
            // Izmena lozinke ako je uneta
            const newPass = document.getElementById('settingNewPassword').value.trim();
            if (newPass) {
                if (newPass.length < 6) {
                    alert(currentLang === 'sr' ? "Lozinka mora imati bar 6 karaktera!" : "Password must be at least 6 characters!");
                    return;
                }
                const { error: passErr } = await supabaseClient.auth.updateUser({ password: newPass });
                if (passErr) {
                    alert(passErr.message);
                } else {
                    document.getElementById('settingNewPassword').value = "";
                }
            }

            closeSettingsModal();
            
            // Kompletno osvežavamo sajt po zahtevu korisnika za ujednačen jezik!
            window.location.reload();
        }
    }
}

function loadSavedSettings() {
    document.getElementById('settingTimeFormat').value = localStorage.getItem('gigstems_time_format') || '24h';
    document.getElementById('settingDateFormat').value = localStorage.getItem('gigstems_date_format') || 'dd.mm.yyyy';
    document.getElementById('settingTimezone').value = localStorage.getItem('gigstems_timezone') || 'Europe/Belgrade';
    document.getElementById('settingLanguage').value = currentLang;

    if (currentUserProfile) {
        const countrySelect = document.getElementById('settingCountry');
        countrySelect.value = currentUserProfile.country || "";
        handleCountryChange(countrySelect, 'settingCity', 'settingCustomCountryInput', 'settingCustomCityInput');
        
        setTimeout(() => {
            const citySelect = document.getElementById('settingCity');
            citySelect.value = currentUserProfile.city || "";
        }, 100);
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
    
    document.querySelectorAll('.btn-lang').forEach(btn => btn.classList.remove('active'));
    
    const srBtn = document.getElementById('btnLangSR');
    const enBtn = document.getElementById('btnLangEN');
    const sidebarSR = document.getElementById('sidebarLangSR');
    const sidebarEN = document.getElementById('sidebarLangEN');

    if (lang === 'sr') {
        if (srBtn) srBtn.classList.add('active');
        if (sidebarSR) sidebarSR.classList.add('active');
    } else {
        if (enBtn) enBtn.classList.add('active');
        if (sidebarEN) sidebarEN.classList.add('active');
    }

    // Ažuriranje tekstova u DOM-u
    const elSongsTitle = document.getElementById('songsTitle');
    const elSearchInput = document.getElementById('searchInput');
    const elPlayBtn = document.getElementById('playBtn');
    const elStopBtn = document.getElementById('stopBtn');
    const elMasterMuteBtn = document.getElementById('masterMuteBtn');
    const elMasterVolLabel = document.getElementById('masterVolLabel');
    const elJoinCodeTitle = document.getElementById('bandCodeTitle');
    const elJoinCodeLabel = document.getElementById('joinCodeLabel');
    const elJoinCodeInput = document.getElementById('joinCodeInput');
    const elJoinCodeSubmitBtn = document.getElementById('joinCodeSubmitBtn');
    const elAddSectionTitle = document.getElementById('addSectionTitle');
    const elBandNameLabel = document.getElementById('bandNameLabel');
    const elBandUrlLabel = document.getElementById('bandUrlLabel');
    const elConnectBtn = document.getElementById('connectBtn');
    const elSidebarBandsHeader = document.getElementById('sidebarBandsHeader');
    const elBtnNewBandSidebar = document.getElementById('btnNewBandSidebar');
    const elBtnNewBandDashboard = document.getElementById('btnNewBandDashboard');
    const elBandDashboardMainTitle = document.getElementById('bandDashboardMainTitle');
    const elBtnBackToDashboardLink = document.getElementById('btnBackToDashboardLink');
    const elBtnSongsText = document.getElementById('btnSongsText');
    const elBandLogoUploadText = document.getElementById('bandLogoUploadText');
    const elModalSettingsTitle = document.getElementById('modalSettingsTitle');
    const elTabBtnRegional = document.getElementById('tabBtnRegional');
    const elTabBtnProfile = document.getElementById('tabBtnProfile');
    const elTabBtnPassword = document.getElementById('tabBtnPassword');
    const elTabBtnAccount = document.getElementById('tabBtnAccount');
    const elTimeFormatLabel = document.getElementById('timeFormatLabel');
    const elDateFormatLabel = document.getElementById('dateFormatLabel');
    const elTimezoneLabel = document.getElementById('timezoneLabel');
    const elProfileEmailLabel = document.getElementById('profileEmailLabel');
    const elProfileNameLabel = document.getElementById('profileNameLabel');
    const elNewPasswordLabel = document.getElementById('newPasswordLabel');
    const elDeleteAccountText = document.getElementById('deleteAccountText');
    const elBtnDeleteAccount = document.getElementById('btnDeleteAccount');
    const elBtnUploadAvatar = document.getElementById('btnUploadAvatar');
    const elPopMenuSettings = document.getElementById('popMenuSettings');
    const elPopMenuLogout = document.getElementById('popMenuLogout');
    const elAuthDisplayNameLabel = document.getElementById('authDisplayNameLabel');
    const elAuthDisplayNameInput = document.getElementById('authDisplayNameInput');
    const elAuthEmailLabel = document.getElementById('authEmailLabel');
    const elAuthPasswordLabel = document.getElementById('authPasswordLabel');
    const elOtpSubText = document.getElementById('otpSubText');
    const elOtpVerifyBtn = document.getElementById('otpVerifyBtn');
    const elOtpCancelBtn = document.getElementById('otpCancelBtn');
    const elAuthTitle = document.getElementById('authTitle');
    const elAuthSubmitBtn = document.getElementById('authSubmitBtn');
    const elAuthSwitchLink = document.getElementById('authSwitchLink');
    const elSupportModalTitle = document.getElementById('supportModalTitle');
    const elSupportSubjectLabel = document.getElementById('supportSubjectLabel');
    const elSupportMessageLabel = document.getElementById('supportMessageLabel');
    const elSupportSendBtn = document.getElementById('supportSendBtn');

    if (elSongsTitle) elSongsTitle.innerText = i18n[lang].songsTitle;
    if (elSearchInput) elSearchInput.placeholder = i18n[lang].searchPlaceholder;
    if (elPlayBtn) elPlayBtn.querySelector('span').innerText = isPlaying ? i18n[lang].pauseBtn : i18n[lang].playBtn;
    if (elStopBtn) elStopBtn.querySelector('span').innerText = i18n[lang].stopBtn;
    if (elMasterMuteBtn) elMasterMuteBtn.innerText = isMasterMuted ? (lang === 'sr' ? "ODMUTIRAJ SVE" : "UNMUTE ALL") : i18n[lang].masterMuteBtn;
    if (elMasterVolLabel) elMasterVolLabel.innerText = i18n[lang].masterVolLabel;
    
    if (elJoinCodeTitle) elJoinCodeTitle.innerText = i18n[lang].bandCodeTitle;
    if (elJoinCodeLabel) elJoinCodeLabel.innerText = i18n[lang].joinCodeLabel;
    if (elJoinCodeInput) elJoinCodeInput.placeholder = i18n[lang].joinCodePlaceholder;
    if (elJoinCodeSubmitBtn) elJoinCodeSubmitBtn.innerText = i18n[lang].joinCodeBtn;

    if (elAddSectionTitle) elAddSectionTitle.innerText = i18n[lang].addSectionTitle;
    if (elBandNameLabel) elBandNameLabel.innerText = i18n[lang].bandNameLabel;
    if (elBandUrlLabel) elBandUrlLabel.innerText = i18n[lang].bandUrlLabel;
    if (elConnectBtn) elConnectBtn.innerText = i18n[lang].connectBtn;

    if (elSidebarBandsHeader) elSidebarBandsHeader.innerText = i18n[lang].navBands;
    if (elBtnNewBandSidebar) elBtnNewBandSidebar.innerText = i18n[lang].btnNewBand;
    if (elBtnNewBandDashboard) elBtnNewBandDashboard.innerText = i18n[lang].btnNewBand;
    if (elBandDashboardMainTitle) elBandDashboardMainTitle.innerText = "🎸 " + (lang === 'sr' ? "GigLab Dashboard" : "GigLab Dashboard");

    if (elBtnBackToDashboardLink) elBtnBackToDashboardLink.innerText = i18n[lang].btnBackToDashboard;
    if (elBtnSongsText) elBtnSongsText.innerText = i18n[lang].songsBadge;
    if (elBandLogoUploadText) elBandLogoUploadText.innerText = i18n[lang].uploadLogo;

    if (elModalSettingsTitle) elModalSettingsTitle.innerText = i18n[lang].settingsTitle;
    if (elTabBtnRegional) elTabBtnRegional.innerText = i18n[lang].tabRegional;
    if (elTabBtnProfile) elTabBtnProfile.innerText = i18n[lang].tabProfile;
    if (elTabBtnPassword) elTabBtnPassword.innerText = i18n[lang].tabPassword;
    if (elTabBtnAccount) elTabBtnAccount.innerText = i18n[lang].tabAccount;
    if (elTimeFormatLabel) elTimeFormatLabel.innerText = i18n[lang].timeFormatLabel;
    if (elDateFormatLabel) elDateFormatLabel.innerText = i18n[lang].dateFormatLabel;
    if (elTimezoneLabel) elTimezoneLabel.innerText = i18n[lang].timezoneLabel;
    if (elProfileEmailLabel) elProfileEmailLabel.innerText = i18n[lang].authEmail;
    if (elProfileNameLabel) elProfileNameLabel.innerText = i18n[lang].authDisplayName;
    if (elNewPasswordLabel) elNewPasswordLabel.innerText = i18n[lang].authPassword;
    if (elDeleteAccountText) elDeleteAccountText.innerText = i18n[lang].deleteAccountText;
    if (elBtnDeleteAccount) elBtnDeleteAccount.innerText = i18n[lang].btnDeleteAccount;
    if (elBtnUploadAvatar) elBtnUploadAvatar.innerText = i18n[lang].uploadAvatar;
    if (elPopMenuSettings) elPopMenuSettings.innerText = "⚙️ " + (lang === 'sr' ? "Podešavanja" : "Settings");
    if (elPopMenuLogout) elPopMenuLogout.innerText = "🚪 " + i18n[lang].authLogout;

    if (elAuthDisplayNameLabel) elAuthDisplayNameLabel.innerText = i18n[lang].authDisplayName;
    if (elAuthDisplayNameInput) elAuthDisplayNameInput.placeholder = lang === 'sr' ? "Npr. Marko Marković" : "E.g. John Doe";
    if (elAuthEmailLabel) elAuthEmailLabel.innerText = i18n[lang].authEmail;
    if (elAuthPasswordLabel) elAuthPasswordLabel.innerText = i18n[lang].authPassword;

    if (elOtpSubText) elOtpSubText.innerHTML = i18n[lang].verificationSub;
    if (elOtpVerifyBtn) elOtpVerifyBtn.innerText = i18n[lang].btnVerify;
    if (elOtpCancelBtn) elOtpCancelBtn.innerText = i18n[lang].btnBackToAuth;

    if (elSupportModalTitle) elSupportModalTitle.innerText = i18n[lang].supportModalTitle;
    if (elSupportSubjectLabel) elSupportSubjectLabel.innerText = i18n[lang].supportSubject;
    if (elSupportMessageLabel) elSupportMessageLabel.innerText = i18n[lang].supportMessage;
    if (elSupportSendBtn) elSupportSendBtn.innerText = i18n[lang].btnSend;

    if (!isOTPMode) {
        if (isRegisterMode) {
            if (elAuthTitle) elAuthTitle.innerText = i18n[lang].authTitleRegister;
            if (elAuthSubmitBtn) elAuthSubmitBtn.innerText = i18n[lang].authBtnRegister;
            if (elAuthSwitchLink) elAuthSwitchLink.innerText = i18n[lang].authSwitchToLogin;
        } else {
            if (elAuthTitle) elAuthTitle.innerText = i18n[lang].authTitleLogin;
            if (elAuthSubmitBtn) elAuthSubmitBtn.innerText = i18n[lang].authBtnLogin;
            if (elAuthSwitchLink) elAuthSwitchLink.innerText = i18n[lang].authSwitchToRegister;
        }
    } else {
        if (elAuthTitle) elAuthTitle.innerText = i18n[lang].verificationText;
    }

    if (!currentSongName) {
        updateStatusText('statusInit');
    }

    if (activeBandId) {
        const band = bands.find(b => b.id === activeBandId);
        if (band) {
            const elRoleBadge = document.getElementById('bandRoleBadge');
            if (elRoleBadge) {
                elRoleBadge.innerText = band.userRole === 'admin' ? i18n[lang].roleAdmin : i18n[lang].roleUser;
                elRoleBadge.className = band.userRole === 'admin' ? 'badge-owner' : 'badge-member';
            }
        }
    }
}

// Mobilna navigacija
function toggleMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
}

function closeAllMobilePanels() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}
