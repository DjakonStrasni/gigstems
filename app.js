// ==========================================================================
// GIGSTEMS WEB APP - CORE JAVASCRIPT LOGIC (VERZIJA 1.4.06)
// ==========================================================================

// Supabase konfiguracija baze podataka
const SUPABASE_URL = "https://yqmxwgikcqibbkpqstux.supabase.co";
const SUPABASE_ANON_KEY = "APISUPA"; // Biće automatski zamenjeno pravim ključem ili korisnik ubacuje svoj
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Google API Key za očitavanje drajv linkova (Korisnik upisuje svoj na liniji ~143 pre starta)
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

// ==========================================================================
// 1. AUTENTIFIKACIJA & SIGN UP / OTP VERIFICATION
// ==========================================================================

// Slušač sesije - automatski reaguje na prijavu ili odjavu
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

// Čisti dugačak i ružan access_token iz URL trake pretraživača odmah nakon što ga Supabase obradi
if (window.location.hash && window.location.hash.includes('access_token')) {
    setTimeout(() => {
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
    }, 600);
}

// Učitavanje i profilisanje ulogovanog korisnika
async function loadUserProfile(user) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (data) {
        currentUserProfile = data;
        renderUserProfilesUI();
        loadUserBands();
    }
}

// Iscrtava korisnikovo ime i avatar na ekranu
function renderUserProfilesUI() {
    if (!currentUserProfile) return;
    
    const displayName = currentUserProfile.display_name || currentUserProfile.email;
    document.getElementById('currentUserName').innerText = displayName;
    document.getElementById('currentUserName').title = currentUserProfile.email;
    
    // Prikaz avatara (Slika ili početno slovo)
    const avatarCircle = document.getElementById('userAvatarCircle');
    const settingsAvatarCircle = document.getElementById('settingsAvatarCircle');
    
    if (currentUserProfile.avatar_url && currentUserProfile.avatar_url.startsWith('data:image')) {
        avatarCircle.innerHTML = `<img src="${currentUserProfile.avatar_url}" alt="Avatar">`;
        settingsAvatarCircle.innerHTML = `<img src="${currentUserProfile.avatar_url}" alt="Avatar">`;
    } else {
        const firstLetter = displayName.charAt(0).toUpperCase();
        avatarCircle.innerText = firstLetter;
        settingsAvatarCircle.innerText = firstLetter;
    }

    // Modal podešavanja
    document.getElementById('settingDisplayName').value = currentUserProfile.display_name || "";
    document.getElementById('settingEmail').value = currentUserProfile.email;
}

// Prebacivanje između Login i Registracija ekrana
function toggleAuthMode() {
    if (isOTPMode) return;
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

// Pokretanje Login ili Registracije
async function handleAuthSubmit() {
    const email = document.getElementById('authEmailInput').value.trim();
    const password = document.getElementById('authPasswordInput').value.trim();
    const displayName = document.getElementById('authDisplayNameInput').value.trim();

    if (!email || !password) {
        alert(currentLang === 'sr' ? "Popunite email i lozinku!" : "Please enter email and password!");
        return;
    }

    if (isRegisterMode) {
        // Pokretanje Registracije
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
            // Prelazimo u integrisani OTP režim u istom prozoru!
            pendingRegEmail = email;
            switchToOTPMode();
        }
    } else {
        // Pokretanje prijave
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            // Ako je greška da email nije potvrđen, automatski ga šaljemo na OTP unos umesto blokiranja!
            if (error.message.includes("Email not confirmed") || error.message.includes("not confirmed")) {
                pendingRegEmail = email;
                switchToOTPMode();
            } else {
                alert(i18n[currentLang].authError.replace("{msg}", error.message));
            }
        }
    }
}

// Prebacivanje forme na unos OTP koda
function switchToOTPMode() {
    isOTPMode = true;
    document.getElementById('authFormFields').style.display = "none";
    document.getElementById('otpFormFields').style.display = "block";
    document.getElementById('authTitle').innerText = i18n[currentLang].verificationText;
}

// Isključivanje OTP režima i povratak na Login
function cancelOTPMode() {
    isOTPMode = false;
    document.getElementById('authFormFields').style.display = "block";
    document.getElementById('otpFormFields').style.display = "none";
    isRegisterMode = false;
    const displayNameGroup = document.getElementById('authDisplayNameGroup');
    displayNameGroup.style.display = "none";
    document.getElementById('authTitle').innerText = i18n[currentLang].authTitleLogin;
    document.getElementById('authSubmitBtn').innerText = i18n[currentLang].authBtnLogin;
    document.getElementById('authSwitchLink').innerText = i18n[currentLang].authSwitchToRegister;
}

// Verifikacija OTP koda direktno u prozoru aplikacije
async function handleOTPVerify() {
    const token = document.getElementById('otpCodeInput').value.trim();
    if (!token) {
        alert(currentLang === 'sr' ? "Unesite 6-cifreni kod!" : "Please enter the 6-digit code!");
        return;
    }

    const { data, error } = await supabaseClient.auth.verifyOtp({
        email: pendingRegEmail,
        token: token,
        type: 'signup'
    });

    if (error) {
        alert(i18n[currentLang].verificationError);
    } else {
        // Uspešno registrovan i verifikovan, automatska prijava se odigrava preko onAuthStateChange
        isOTPMode = false;
        document.getElementById('authFormFields').style.display = "block";
        document.getElementById('otpFormFields').style.display = "none";
    }
}

// Odjava korisnika sa brisanjem privremene audio memorije
async function handleLogout() {
    await cleanAudioEngine();
    closeProfileMenu();
    await supabaseClient.auth.signOut();
}

// ==========================================================================
// 2. MENADŽMENT BENDOVA & KONTROLNA TABLA (GIGLAB DASHBOARD v1.4.06)
// ==========================================================================

// Učitavanje svih bendova u kojima je ulogovani muzičar član
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
            userRole: membership ? membership.role : 'user'
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

// Iscrtavanje liste bendova u levom sidebar meniju
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
        item.onclick = () => selectActiveBand(band.id);

        let subMenuHTML = "";
        // Ako je ovaj bend aktivan, dinamički mu otvaramo podmeni "Songs" ispod njega u levoj koloni!
        if (activeBandId === band.id) {
            subMenuHTML = `
                <div class="sidebar-band-sub-menu">
                    <div class="sub-menu-item active" onclick="openSongsView(event)">🎵 Stemovi</div>
                </div>
            `;
        }

        item.innerHTML = `
            <span class="sidebar-band-title">${band.name}</span>
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
    // Ako menjamo aktivni bend, čistimo audio mašinu iz predostrožnosti
    if (activeBandId !== bandId) {
        await cleanAudioEngine();
    }
    
    activeBandId = bandId;
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
}

// Aktivacija pogleda za kreiranje novog benda
function showNewBandCreation() {
    activeBandId = "";
    renderSidebarBands();
    
    document.getElementById('dashboardEmptyState').style.display = "none";
    document.getElementById('bandCard').style.display = "none";
    
    const adminSec = document.getElementById('bandAdminSection');
    adminSec.style.display = "block";
    
    document.getElementById('newBandForm').style.display = "block";
    document.getElementById('editBandForm').style.display = "none";
    document.getElementById('membersManagementSection').style.display = "none";
}

// Osnivanje novog benda (Uloga: Admin)
async function addNewBandSubmit() {
    if (!currentUserProfile) return;

    const nameInput = document.getElementById('newBandName');
    const urlInput = document.getElementById('newBandUrl');
    const name = nameInput.value.trim();
    const rawUrl = urlInput.value.trim();

    if (!name || !rawUrl) {
        alert(currentLang === 'sr' ? "Popunite sva polja!" : "Please fill out all fields!");
        return;
    }

    const folderId = extractFolderId(rawUrl);
    // Generišemo jedinstveni pristupni kod za učlanjenje
    const joinCode = 'GIG-' + Math.floor(100 + Math.random() * 900);

    const { data: bandData, error: bandError } = await supabaseClient
        .from('bands')
        .insert({
            name,
            folder_id: folderId,
            raw_url: rawUrl,
            join_code: joinCode
        })
        .select()
        .single();

    if (bandError) {
        alert(i18n[currentLang].authError.replace("{msg}", bandError.message));
        return;
    }

    // Automatski upisujemo vlasnika kao glavnog admina benda
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
    
    // Osvežavamo i otvaramo novostvoreni bend
    activeBandId = bandData.id;
    await loadUserBands();
}

// Prebacivanje pod-sekcije za podešavanja benda (Uredi / Obriši)
function toggleBandSettingsSection() {
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
        document.getElementById('editBandName').value = band.name;
        document.getElementById('editBandUrl').value = band.raw_url;
        
        // Isključujemo polja ako ulogovani korisnik nije Admin / Šef benda
        const isAdmin = band.userRole === 'admin';
        document.getElementById('editBandName').disabled = !isAdmin;
        document.getElementById('editBandUrl').disabled = !isAdmin;
        document.getElementById('renameBtn').style.display = isAdmin ? "inline-block" : "none";
        document.getElementById('deleteBandBtn').style.display = isAdmin ? "inline-block" : "none";
    }
}

// Sačuvanje izmena o nazivu i drajv linku benda
async function updateBandSubmit() {
    const name = document.getElementById('editBandName').value.trim();
    const rawUrl = document.getElementById('editBandUrl').value.trim();

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
            folder_id: folderId
        })
        .eq('id', activeBandId);

    if (error) {
        alert(error.message);
    } else {
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
        await loadUserBands();
    }
}

// Prikaz i kontrola članstva u bendu, pristupnih kodova i učlanjenja
async function toggleMembersSection() {
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

    if (membersData) {
        membersData.forEach(m => {
            const row = document.createElement('div');
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.padding = "8px 12px";
            row.style.backgroundColor = "#1f2335";
            row.style.borderRadius = "6px";
            
            const profile = m.profiles;
            const name = profile ? (profile.display_name || profile.email) : "Unknown Musician";
            const roleName = m.role === 'admin' ? i18n[currentLang].roleAdmin : i18n[currentLang].roleUser;
            const roleStyle = m.role === 'admin' ? 'color: var(--accent-gold); font-weight:400;' : 'color: var(--text-secondary);';

            row.innerHTML = `
                <span>🎸 ${name}</span>
                <span style="${roleStyle}">${roleName}</span>
            `;
            membersListEl.appendChild(row);
        });
    }
}

// Učlanjenje u postojeći bend pomoću pristupnog koda
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

    // Upisujemo korisnika u članstvo (Uloga: Običan korisnik)
    const { error: joinError } = await supabaseClient
        .from('band_members')
        .insert({
            band_id: bandData.id,
            user_id: currentUserProfile.id,
            role: 'user'
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

// Pomoćni alat za izvlačenje Folder ID parametra iz drajv linka
function extractFolderId(url) {
    if (!url) return "";
    const match = url.match(/\/folders\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
}

// ==========================================================================
// 3. REPERTOAR & AUDIO ENGINE (MULTITRACK WEB AUDIO v1.4.06)
// ==========================================================================

// Prebacivanje na ekran sa listom pesama i audio plejerom
function openSongsView(event) {
    if (event) event.stopPropagation(); // sprečava zatvaranje podmenija na klik
    
    const band = bands.find(b => b.id === activeBandId);
    if (!band) return;

    document.getElementById('bandDashboard').style.display = "none";
    document.getElementById('stemsPlayerContainer').style.display = "flex";
    
    // Osvežavamo i učitavamo pesme sa Google drajva aktivnog benda
    loadSongsFromActiveBand();
}

// Povratak sa Stems Plejera na glavnu kontrolnu tablu benda
async function exitRepertoireToDashboard() {
    // Čistimo privremenu RAM memoriju prelazom na drugi ekran!
    await cleanAudioEngine();

    document.getElementById('stemsPlayerContainer').style.display = "none";
    document.getElementById('bandDashboard').style.display = "flex";
}

// Učitavanje spiska pesama sa Google drajva aktivnog benda
async function loadSongsFromActiveBand() {
    const band = bands.find(b => b.id === activeBandId);
    if (!band || !band.folder_id) return;

    songsList.innerHTML = `<div style="padding:10px; color:var(--text-secondary);">⏳ ${i18n[currentLang].statusConnecting}</div>`;

    if (!GOOGLE_API_KEY) {
        songsList.innerHTML = `<div style="padding:10px; color:var(--accent-gold); font-size:0.9em; line-height:1.4;">⚠️ ${i18n[currentLang].apiKeyWarning}</div>`;
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
            songsList.innerHTML = `<div style="padding:10px; color:var(--text-muted);">${i18n[currentLang].noSongs}</div>`;
        }
    } catch (err) {
        console.error("Drive connect error:", err);
        songsList.innerHTML = `<div style="padding:10px; color:var(--accent-red);">${i18n[currentLang].statusConnError}</div>`;
    }
}

// Iscrtavanje spiska pesama u Repertoaru
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

// Brza pretraga i filtriranje pesama u listi
function filterSongs(query) {
    const filtered = allSongs.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
    renderSongsListUI(filtered);
}

// Učitavanje svih MP3 traka izabrane pesme u RAM memoriju pretraživača
async function selectSongToPlay(songFolder) {
    if (isPlaying) {
        stopAudio();
    }
    
    // Čistimo prethodno učitane trake i oslobađamo RAM pre novog učitavanja
    await cleanAudioEngine();
    
    currentSongName = songFolder.name;
    renderSongsListUI(allSongs);

    updateStatusText('statusLoading');
    tracksContainer.innerHTML = "";

    const url = `https://www.googleapis.com/drive/v3/files?q='${songFolder.id}'+in+parents+and+trashed=false&key=${GOOGLE_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Podržani zvučni formati
        const audioFiles = (data.files || []).filter(f => 
            f.name.endsWith('.mp3') || f.name.endsWith('.wav') || f.name.endsWith('.m4a') || f.name.endsWith('.aac')
        );

        if (audioFiles.length === 0) {
            updateStatusText('statusNoFiles');
            return;
        }

        // Sortiranje radi sinhronizacije
        audioFiles.sort((a, b) => a.name.localeCompare(b.name));

        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        audioBuffers = [];
        trackNames = [];
        gainNodes = [];

        // Paralelno preuzimanje i dekodiranje svih kanala istovremeno
        const loadPromises = audioFiles.map(async (file, index) => {
            const streamUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GOOGLE_API_KEY}`;
            
            // Korak 1: Preuzimanje strima u privremeni buffer
            const res = await fetch(streamUrl);
            const arrayBuf = await res.arrayBuffer();
            
            // Korak 2: Dekodiranje u AudioBuffer
            const decodedBuffer = await audioCtx.decodeAudioData(arrayBuf);
            audioBuffers.push(decodedBuffer);
            
            // Čistimo redni broj iz naziva fajla za lepši mikser (Npr "01_Bubanj" -> "Bubanj")
            const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/^[0-9]+[_-]/, "");
            trackNames.push(cleanName);
        });

        await Promise.all(loadPromises);

        // Iscrtavanje miksete na ekranu
        buildMixerUI();
        
        playBtn.disabled = false;
        stopBtn.disabled = false;
        updateStatusText('statusReady', audioBuffers.length);

    } catch (err) {
        console.error("Audio download error:", err);
        updateStatusText('statusError');
    }
}

// Dinamičko iscrtavanje miksete na osnovu broja i naziva učitanih traka
function buildMixerUI() {
    tracksContainer.innerHTML = "";
    gainNodes = [];

    if (!masterGainNode) {
        masterGainNode = audioCtx.createGain();
        masterGainNode.connect(audioCtx.destination);
    }

    trackNames.forEach((name, index) => {
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.8; // podrazumevana jačina kanala
        gainNode.connect(masterGainNode);
        gainNodes.push(gainNode);

        const strip = document.createElement('div');
        strip.className = 'track-strip';
        strip.innerHTML = `
            <span class="track-name" title="${name}">${name}</span>
            <div class="fader-wrapper">
                <input type="range" class="vol-fader" min="0" max="1.2" step="0.01" value="0.8" data-index="${index}" oninput="handleFaderInput(this)">
            </div>
            <button class="btn-mute" data-index="${index}" onclick="handleMuteClick(this)">MUTE</button>
            <button class="btn-solo" data-index="${index}" onclick="handleSoloClick(this)">SOLO</button>
        `;
        tracksContainer.appendChild(strip);
    });
}

// Kontrola jačine pojedinačnog kanala (Fader)
function handleFaderInput(slider) {
    const idx = parseInt(slider.dataset.index);
    const val = parseFloat(slider.value);
    
    const muteBtn = document.querySelector(`.btn-mute[data-index="${idx}"]`);
    if (muteBtn && !muteBtn.classList.contains('active')) {
        gainNodes[idx].gain.value = val;
    }
}

// Utišavanje pojedinačnog kanala (Mute)
function handleMuteClick(btn) {
    const idx = parseInt(btn.dataset.index);
    const slider = document.querySelector(`.vol-fader[data-index="${idx}"]`);
    
    const isActive = btn.classList.toggle('active');
    if (isActive) {
        gainNodes[idx].gain.value = 0;
    } else {
        gainNodes[idx].gain.value = parseFloat(slider.value);
    }
}

// Izolacija pojedinačnog kanala (Solo)
function handleSoloClick(btn) {
    const idx = parseInt(btn.dataset.index);
    const isSoloActive = btn.classList.toggle('active');

    if (isSoloActive) {
        // Utišavamo sve ostale osim ovog
        gainNodes.forEach((gNode, i) => {
            if (i !== idx) {
                gNode.gain.value = 0;
            } else {
                const sliderVal = parseFloat(document.querySelector(`.vol-fader[data-index="${i}"]`).value);
                gNode.gain.value = sliderVal;
                // sklanjamo mute ako je bio aktivan
                const mBtn = document.querySelector(`.btn-mute[data-index="${i}"]`);
                if (mBtn) mBtn.classList.remove('active');
            }
        });
        
        // Isključujemo ostala solo dugmad
        document.querySelectorAll('.btn-solo').forEach(sBtn => {
            if (parseInt(sBtn.dataset.index) !== idx) sBtn.classList.remove('active');
        });
    } else {
        // Vraćamo sve jačine na vrednosti koje stoje na faderima
        gainNodes.forEach((gNode, i) => {
            const sliderVal = parseFloat(document.querySelector(`.vol-fader[data-index="${i}"]`).value);
            const isMuted = document.querySelector(`.btn-mute[data-index="${i}"]`).classList.contains('active');
            gNode.gain.value = isMuted ? 0 : sliderVal;
        });
    }
}

// Master kontrola jačine celog miksa
function setMasterVolume(val) {
    if (masterGainNode) {
        masterGainNode.gain.value = isMasterMuted ? 0 : parseFloat(val);
    }
}

// Utišavanje kompletnog zvučnog izlaza
function toggleMasterMute() {
    const btn = document.getElementById('masterMuteBtn');
    isMasterMuted = !isMasterMuted;
    
    if (isMasterMuted) {
        btn.classList.add('active');
        btn.innerText = currentLang === 'sr' ? "ODMUTIRAJ SVE" : "UNMUTE ALL";
        if (masterGainNode) masterGainNode.gain.value = 0;
    } else {
        btn.classList.remove('active');
        btn.innerText = i18n[currentLang].masterMuteBtn;
        const sliderVal = parseFloat(document.getElementById('masterVolumeSlider').value);
        if (masterGainNode) masterGainNode.gain.value = sliderVal;
    }
}

// Pokretanje i pauziranje strimovanja stemsa (Sviranje)
function togglePlay() {
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (isPlaying) {
        // Pauziranje
        pauseOffset += audioCtx.currentTime - startTime;
        stopSourceNodes();
        isPlaying = false;
        updatePlayBtnUI();
        clearInterval(timerInterval);
    } else {
        // Sviranje
        startSourceNodes(pauseOffset);
        startTime = audioCtx.currentTime;
        isPlaying = true;
        updatePlayBtnUI();
        timerInterval = setInterval(updateAudioTimer, 250);
    }
}

// Povezivanje svih traka na centralni sat i pokretanje zvučnih nodova
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

// Zaustavljanje aktivnih audio izvora
function stopSourceNodes() {
    sourceNodes.forEach(node => {
        try { node.stop(); } catch(e) {}
    });
    sourceNodes = [];
}

// Kompletno zaustavljanje i resetovanje plejera
function stopAudio() {
    stopSourceNodes();
    isPlaying = false;
    pauseOffset = 0;
    updatePlayBtnUI();
    clearInterval(timerInterval);
    updateAudioTimer();
}

// Dinamičko osvežavanje tajmera pesme u realnom vremenu
function updateAudioTimer() {
    if (!isPlaying && pauseOffset === 0) {
        statusLabel.innerText = i18n[currentLang].statusReady.replace('{count}', audioBuffers.length);
        return;
    }
    const current = pauseOffset + (isPlaying ? (audioCtx.currentTime - startTime) : 0);
    const mins = Math.floor(current / 60).toString().padStart(2, '0');
    const secs = Math.floor(current % 60).toString().padStart(2, '0');
    
    statusLabel.innerText = `🎵 ${currentSongName} [${mins}:${secs}]`;
}

// Osvežavanje izgleda Play/Pause dugmeta
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

// ==========================================================================
// 🚨 KRITIČNO - ČIŠĆENJE PRIVREMENIH FAJLOVA I RAM MEMORIJE (CACHE CLEANER)
// ==========================================================================
async function cleanAudioEngine() {
    stopAudio();
    
    // Potpuno gasimo AudioContext da primoramo pretraživač na oslobađanje memorije
    if (audioCtx) {
        try {
            await audioCtx.close();
        } catch (e) {
            console.warn("AudioContext closing issue:", e);
        }
        audioCtx = null;
    }

    // Čistimo sve globalne audio nizove i oslobađamo memoriju
    audioBuffers = [];
    sourceNodes = [];
    gainNodes = [];
    currentSongName = "";
    masterGainNode = null;
    
    // Čistimo HTML sadržaj miksete
    tracksContainer.innerHTML = "";
    
    playBtn.disabled = true;
    stopBtn.disabled = true;
    updateStatusText('statusInit');
}

// ==========================================================================
// 4. KORISNIČKI PANEL & PROFILE AVATAR / LOGO UPLOADS (v1.4.06)
// ==========================================================================

// Izmena i upload korisničkog avatara (Base64 direktno u bazu!)
function triggerAvatarUpload() {
    document.getElementById('avatarFileInput').click();
}

async function handleAvatarUpload(input) {
    if (!input.files || !input.files[0] || !currentUserProfile) return;
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        const base64Img = e.target.result;
        
        // Upisujemo direktno u kolonu avatar_url u public.profiles tabeli!
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

// Izmena i upload logotipa aktivnog benda
function triggerLogoUpload() {
    // Samo admini i šefovi bendova mogu postavljati logo!
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
        
        // Čuvamo base64 u kolonu logo_url u tabeli bands!
        const { error } = await supabaseClient
            .from('bands')
            .update({ logo_url: base64Img })
            .eq('id', activeBandId);
            
        spinner.style.display = "none";
        
        if (error) {
            alert("Error saving logo: " + error.message);
        } else {
            // Ažuriramo lokalno stanje
            const band = bands.find(b => b.id === activeBandId);
            if (band) band.logo_url = base64Img;
            
            // Osvežavamo vizuelni prikaz
            const logoImg = document.getElementById('bandLogoImg');
            const logoPlaceholder = document.getElementById('bandLogoPlaceholderIcon');
            logoImg.src = base64Img;
            logoImg.style.display = "block";
            logoPlaceholder.style.display = "none";
        }
    };
    reader.readAsDataURL(file);
}

// Trajno brisanje celokupnog korisničkog naloga (Cascade RLS)
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

// ==========================================================================
// 5. REGIONALNA PODEŠAVANJA & MODAL CONTROLS
// ==========================================================================

function toggleProfileMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('profilePopupMenu');
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

function closeProfileMenu() {
    document.getElementById('profilePopupMenu').style.display = 'none';
}

// Slušač za zatvaranje popup menija na klik van njega
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

// Snimanje korisničkih i regionalnih podešavanja
async function saveSettings() {
    const timeFormat = document.getElementById('settingTimeFormat').value;
    const dateFormat = document.getElementById('settingDateFormat').value;
    const timezone = document.getElementById('settingTimezone').value;
    const tempUnit = document.getElementById('settingTempUnit').value;
    
    localStorage.setItem('gigstems_time_format', timeFormat);
    localStorage.setItem('gigstems_date_format', dateFormat);
    localStorage.setItem('gigstems_timezone', timezone);
    localStorage.setItem('gigstems_temp_unit', tempUnit);
    
    // Izmena imena muzičara
    const newName = document.getElementById('settingDisplayName').value.trim();
    if (newName && currentUserProfile && newName !== currentUserProfile.display_name) {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ display_name: newName })
            .eq('id', currentUserProfile.id);
            
        if (error) {
            alert("Error updating profile name: " + error.message);
        } else {
            currentUserProfile.display_name = newName;
            renderUserProfilesUI();
        }
    }

    // Izmena lozinke ako je uneta
    const newPass = document.getElementById('settingNewPassword').value.trim();
    if (newPass) {
        if (newPass.length < 6) {
            alert(currentLang === 'sr' ? "Lozinka mora imati bar 6 karaktera!" : "Password must be at least 6 characters!");
            return;
        }
        const { error } = await supabaseClient.auth.updateUser({ password: newPass });
        if (error) {
            alert("Password change error: " + error.message);
            return;
        } else {
            alert(currentLang === 'sr' ? "Lozinka uspešno promenjena!" : "Password successfully changed!");
            document.getElementById('settingNewPassword').value = "";
        }
    }

    closeSettingsModal();
}

function loadSavedSettings() {
    document.getElementById('settingTimeFormat').value = localStorage.getItem('gigstems_time_format') || '24h';
    document.getElementById('settingDateFormat').value = localStorage.getItem('gigstems_date_format') || 'dd.mm.yyyy';
    document.getElementById('settingTimezone').value = localStorage.getItem('gigstems_timezone') || 'Europe/Belgrade';
    document.getElementById('settingTempUnit').value = localStorage.getItem('gigstems_temp_unit') || 'C';
}

// ==========================================================================
// 6. VIŠEJEZIČNOST & LOKALIZACIJA (Translations Framework)
// ==========================================================================

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
    
    // Osvežavamo aktivne klase na dugmadima za jezik
    document.querySelectorAll('.btn-lang').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btnLang${lang.toUpperCase()}`).classList.add('active');
    document.getElementById(`sidebarLang${lang.toUpperCase()}`).classList.add('active');

    // Ažuriranje kompletnih tekstova u DOM-u
    document.getElementById('songsTitle').innerText = i18n[lang].songsTitle;
    document.getElementById('searchInput').placeholder = i18n[lang].searchPlaceholder;
    document.getElementById('playBtn').querySelector('span').innerText = isPlaying ? i18n[lang].pauseBtn : i18n[lang].playBtn;
    document.getElementById('stopBtn').querySelector('span').innerText = i18n[lang].stopBtn;
    document.getElementById('masterMuteBtn').innerText = isMasterMuted ? (lang === 'sr' ? "ODMUTIRAJ SVE" : "UNMUTE ALL") : i18n[lang].masterMuteBtn;
    document.getElementById('masterVolLabel').innerText = i18n[lang].masterVolLabel;
    
    document.getElementById('joinCodeTitle').innerText = i18n[lang].bandCodeTitle;
    document.getElementById('joinCodeLabel').innerText = i18n[lang].joinCodeLabel;
    document.getElementById('joinCodeInput').placeholder = i18n[lang].joinCodePlaceholder;
    document.getElementById('joinCodeSubmitBtn').innerText = i18n[lang].joinCodeBtn;
    
    document.getElementById('addSectionTitle').innerText = i18n[lang].addSectionTitle;
    document.getElementById('bandNameLabel').innerText = i18n[lang].bandNameLabel;
    document.getElementById('bandUrlLabel').innerText = i18n[lang].bandUrlLabel;
    document.getElementById('connectBtn').innerText = i18n[lang].connectBtn;

    document.getElementById('sidebarBandsHeader').innerText = i18n[lang].navBands;
    document.getElementById('btnNewBandSidebar').innerText = i18n[lang].btnNewBand;
    document.getElementById('btnNewBandDashboard').innerText = i18n[lang].btnNewBand;
    document.getElementById('bandDashboardMainTitle').innerText = "🎸 " + (lang === 'sr' ? "GigLab Dashboard" : "GigLab Dashboard");

    document.getElementById('btnBackToDashboardLink').innerText = i18n[lang].btnBackToDashboard;
    document.getElementById('btnSongsText').innerText = i18n[lang].songsBadge;
    document.getElementById('btnConcertsText').innerText = i18n[lang].concertsBadge;
    document.getElementById('bandLogoUploadText').innerText = i18n[lang].uploadLogo;

    // Modal podešavanja
    document.getElementById('modalSettingsTitle').innerText = i18n[lang].settingsTitle;
    document.getElementById('tabBtnRegional').innerText = i18n[lang].tabRegional;
    document.getElementById('tabBtnProfile').innerText = i18n[lang].tabProfile;
    document.getElementById('tabBtnPassword').innerText = i18n[lang].tabPassword;
    document.getElementById('tabBtnAccount').innerText = i18n[lang].tabAccount;
    document.getElementById('timeFormatLabel').innerText = i18n[lang].timeFormatLabel;
    document.getElementById('dateFormatLabel').innerText = i18n[lang].dateFormatLabel;
    document.getElementById('timezoneLabel').innerText = i18n[lang].timezoneLabel;
    document.getElementById('tempUnitLabel').innerText = i18n[lang].tempUnitLabel;
    document.getElementById('profileEmailLabel').innerText = i18n[lang].authEmail;
    document.getElementById('profileNameLabel').innerText = i18n[lang].authDisplayName;
    document.getElementById('newPasswordLabel').innerText = i18n[lang].authPassword;
    document.getElementById('deleteAccountText').innerText = i18n[lang].deleteAccountText;
    document.getElementById('btnDeleteAccount').innerText = i18n[lang].btnDeleteAccount;
    document.getElementById('btnUploadAvatar').innerText = i18n[lang].uploadAvatar;
    document.getElementById('popMenuSettings').innerText = "⚙️ " + (lang === 'sr' ? "Podešavanja" : "Settings");
    document.getElementById('popMenuLogout').innerText = "🚪 " + i18n[lang].authLogout;

    // Login ekran labele
    document.getElementById('authDisplayNameLabel').innerText = i18n[lang].authDisplayName;
    document.getElementById('authDisplayNameInput').placeholder = lang === 'sr' ? "Npr. Marko Basista" : "E.g. John Bassist";
    document.getElementById('authEmailLabel').innerText = i18n[lang].authEmail;
    document.getElementById('authPasswordLabel').innerText = i18n[lang].authPassword;

    // OTP tekstovi
    document.getElementById('otpSubText').innerHTML = i18n[lang].verificationSub;
    document.getElementById('otpVerifyBtn').innerText = i18n[lang].btnVerify;
    document.getElementById('otpCancelBtn').innerText = i18n[lang].btnBackToAuth;

    // Osvežavamo login labele bez šaltanja režima!
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const switchLink = document.getElementById('authSwitchLink');
    if (!isOTPMode) {
        if (isRegisterMode) {
            title.innerText = i18n[lang].authTitleRegister;
            submitBtn.innerText = i18n[lang].authBtnRegister;
            switchLink.innerText = i18n[lang].authSwitchToLogin;
        } else {
            title.innerText = i18n[lang].authTitleLogin;
            submitBtn.innerText = i18n[lang].authBtnLogin;
            switchLink.innerText = i18n[lang].authSwitchToRegister;
        }
    } else {
        title.innerText = i18n[lang].verificationText;
    }

    if (!currentSongName) {
        updateStatusText('statusInit');
    }

    // Ponovo iscrtavamo sve dinamičke liste radi prevoda uloga
    if (activeBandId) {
        const band = bands.find(b => b.id === activeBandId);
        if (band) {
            const roleBadge = document.getElementById('bandRoleBadge');
            roleBadge.innerText = band.userRole === 'admin' ? i18n[lang].roleAdmin : i18n[lang].roleUser;
            roleBadge.className = band.userRole === 'admin' ? 'badge-owner' : 'badge-member';
        }
    }
}

// Sakupljanje i automatsko učitavanje klijentskih resursa pri paljenju aplikacije
window.onload = () => {
    loadSavedSettings();
    setLanguage(currentLang);
};
