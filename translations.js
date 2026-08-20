// ==========================================================================
// GIGSTEMS TRANSLATIONS - VERZIJA 1.4.07
// ==========================================================================

const i18n = {
    sr: {
        subtitle: "v1.4.07",
        stopBtn: "Zaustavi",
        playBtn: "Pusti trake",
        pauseBtn: "Pauza",
        masterMuteBtn: "UTIŠAJ SVE",
        masterVolLabel: "MASTER JAČINA:",
        activeBandLabel: "Aktivni bend:",
        addBandBtn: "Upravljaj",
        bandNameLabel: "Naziv benda:",
        bandUrlLabel: "Google Drive Link Foldera:",
        connectBtn: "Dodaj novi bend",
        searchPlaceholder: "🔍 Pretraži pesmu...",
        songsTitle: "📋 Spisak Pesama",
        
        // Menadžment bendova
        editSectionTitle: "✏️ Uredi Aktivni Bend",
        addSectionTitle: "➕ Osnivanje Novog Benda",
        deleteSectionTitle: "🗑️ Obriši Aktivni Bend",
        renameBandLabel: "Naziv trenutnog benda:",
        renameBandUrlLabel: "Link Drive foldera:",
        renameBtn: "Sačuvaj izmene",
        deleteBandConfirm: "Da li sigurno želiš da obrišeš ovaj bend? Sve pesme i sačuvani miksevi iz baze će biti trajno uklonjeni!",
        deleteBandBtnText: "❌ Obriši bend: {name}",
        deleteSectionText: "Upozorenje! Brisanjem benda '{name}', brišu se i svi njegovi članovi i sačuvani miksevi pesama.",
        selectBandPlaceholder: "-- Bez benda --",
        noBands: "Nema sačuvanih bendova. Kliknite na + da osnujete ili se priključite bendu!",
        noSongs: "Nema pronađenih pesama u ovom folderu.",
        
        // Audio Statusi
        statusInit: "Prijavi se i izaberi pesmu da započneš...",
        statusConnecting: "Povezujem se na Google Drive...",
        statusConnError: "Greška pri učitavanju pesama sa drajva. Proveri link ili API ključ.",
        statusLoading: "Preuzimanje audio traka u RAM...",
        statusDecoding: "Dekodiranje trake",
        statusReady: "Učitano traka: {count}. Spreman za binu!",
        statusError: "Greška u Audio Engine-u tokom strimovanja.",
        statusNoFiles: "Nema podržanih audio fajlova (.mp3, .wav, .m4a) u ovom folderu!",
        apiKeyWarning: "Unesi svoj Google API ključ u kod (linija ~11 u app.js) da bi učitao pesme!",

        // Autentifikacija, Članstvo i SPA Meni
        navBands: "🎸 Moji Bendovi",
        navRepertoire: "🎵 Repertoar",
        navCalendar: "📅 Kalendar",
        
        authTitleLogin: "🔑 Prijavljivanje",
        authTitleRegister: "📝 Registracija",
        authEmail: "Email adresa:",
        authPassword: "Lozinka:",
        authDisplayName: "Tvoje ime (muzičar):",
        authBtnLogin: "Prijavi se",
        authBtnRegister: "Registruj se",
        authSwitchToRegister: "Nemate nalog? Registrujte se",
        authSwitchToLogin: "Imate nalog? Prijavite se",
        authLogout: "Odjavi se",
        authWelcome: "Muzičar: {name}",
        authSuccessLogin: "Uspešna prijava!",
        authSuccessRegister: "Uspešna registracija! Poslat vam je 6-cifreni kod na mejl.",
        authError: "Greška: {msg}",
        
        roleAdmin: "ŠEF / ADMIN",
        roleUser: "KORISNIK",
        
        joinCodeLabel: "Pristupni kod benda:",
        joinCodeBtn: "Priključi se bendu",
        joinCodeSuccess: "Uspešno ste se priključili bendu!",
        joinCodePlaceholder: "Npr. GIG-184",
        
        inviteEmailLabel: "Pozovi člana preko Email-a:",
        inviteEmailBtn: "Pošalji pozivnicu",
        inviteEmailSuccess: "Pozivnica uspešno poslata!",
        
        bandOwnerLabel: "Osnivač / Šef",
        bandMembersTitle: "👥 Članovi benda:",
        bandCodeTitle: "🔑 Pristupni kod benda:",
        
        createFirstBandMsg: "Još uvek niste član nijednog benda. Kreirajte svoj prvi bend ili se priključite postojećem preko pristupnog koda koji vam je poslao šef benda!",
        onlyAdminEditMsg: "Samo Šef / Admin benda može menjati drajv link ili brisati bend.",
        
        duplicateNameError: "Bend sa tim nazivom već postoji u bazi!",
        duplicateUrlError: "Ovaj Google Drive folder je već unet!",
        emptyNameError: "Naziv ne može biti prazan!",
        
        // NOVO v1.4.07 - OTP Verifikacija, Podešavanja i Dashboard
        otpTitle: "📩 Potvrdi Email",
        otpSentText: "Poslat vam je 6-cifreni kod na e-mail. Unesite ga ispod da završite registraciju:",
        otpPlaceholder: "Npr. 123456",
        otpBtnConfirm: "Potvrdi kod",
        otpBackToRegister: "◀ Nazad na registraciju",
        otpUnconfirmedError: "Vaša email adresa nije verifikovana! Unesite kod koji smo vam poslali.",
        
        settingsTitle: "⚙️ Podešavanja",
        settingTabApp: "Aplikacija",
        settingTabProfile: "Profil",
        settingTabPassword: "Lozinka",
        settingTabAccount: "Nalog",
        
        timeFormatLabel: "Format vremena:",
        dateFormatLabel: "Format datuma:",
        timezoneLabel: "Vremenska zona:",
        tempUnitLabel: "Temperatura:",
        customTimezonePlaceholder: "Unesi vremensku zonu...",
        customDateFormatPlaceholder: "Unesi format datuma...",
        
        profileEmailLabel: "Email adresa (nije promenljiva):",
        profileNameLabel: "Tvoje ime (muzičar):",
        profileAvatarLabel: "Profilna slika (Avatar):",
        profileSaveBtn: "Sačuvaj profil",
        
        passwordOldLabel: "Trenutna lozinka:",
        passwordNewLabel: "Nova lozinka (min. 6 karaktera):",
        passwordSaveBtn: "Promeni lozinku",
        
        accountDangerTitle: "⚠️ Crvena zona (Brisanje naloga)",
        accountDangerText: "Brisanjem naloga trajno uklanjate sve svoje podatke, članstva i sačuvane presete.",
        accountDeleteBtn: "Trajno obriši moj nalog",
        accountDeleteConfirm: "Da li ste sigurni da želite trajno da obrišete nalog? Ova akcija je nepovratna!",
        
        // NOVO v1.4.07 - Dashboard, Meni i Članovi
        bandDashboardTitle: "Glavna tabla",
        bandOptionStems: "🎵 Stemovi",
        bandOptionMembers: "👥 Članovi",
        bandOptionSettings: "⚙️ Podešavanja",
        
        sidebarNewBandOption: "➕ Novi bend",
        sidebarJoinBandOption: "🔑 Pridruži se",
        
        bandWebLabel: "Zvanični sajt benda:",
        bandInstagramLabel: "Instagram link:",
        bandContactLabel: "Kontakt telefon / email:",
        bandLogoLabel: "Logotip benda:",
        bandRegenCodeBtn: "🔄 Regeneriši pristupni kod",
        
        memberActionKick: "Izbaci",
        memberActionLeave: "🚪 Napusti bend",
        memberActionLeaveConfirm: "Da li sigurno želiš da napustiš ovaj bend?",
        memberActionKickConfirm: "Da li sigurno želiš da izbaciš člana {name}?",
        memberLastAdminAlert: "Vi ste jedini preostali admin. Morate postaviti drugog člana za admina ili obrisati bend pre nego što ga napustite.",
        
        dragDropTip: "💡 Prevucite trake levo-desno da promenite redosled na mikseti!",
        
        noActiveBand: "Izaberite bend sa leve strane da vidite kontrolnu tablu.",
        joinBandTitle: "🔑 Priključi se bendu",
        joinBandSubmitBtn: "Priključi se",
        
        saveSuccess: "Uspešno sačuvano!",
        saveError: "Greška pri čuvanju: {msg}"
    },
    en: {
        subtitle: "v1.4.07",
        stopBtn: "Stop",
        playBtn: "Play Stems",
        pauseBtn: "Pause",
        masterMuteBtn: "MUTE ALL",
        masterVolLabel: "MASTER VOLUME:",
        activeBandLabel: "Active Band:",
        addBandBtn: "Manage",
        bandNameLabel: "Band Name:",
        bandUrlLabel: "Google Drive Folder Link:",
        connectBtn: "Add New Band",
        searchPlaceholder: "🔍 Search song...",
        songsTitle: "📋 Song List",
        
        // Band Management
        editSectionTitle: "✏️ Edit Active Band",
        addSectionTitle: "➕ Establish New Band",
        deleteSectionTitle: "🗑️ Delete Active Band",
        renameBandLabel: "Current Band Name:",
        renameBandUrlLabel: "Drive Folder Link:",
        renameBtn: "Save Changes",
        deleteBandConfirm: "Are you sure you want to delete this band? All songs and saved mixes will be permanently deleted from the cloud database!",
        deleteBandBtnText: "❌ Delete band: {name}",
        deleteSectionText: "Warning! Deleting band '{name}' will also delete all its members and saved song mixes.",
        selectBandPlaceholder: "-- No Band --",
        noBands: "No saved bands found. Click on + to create or join a band!",
        noSongs: "No songs found in this folder.",
        
        // Audio Statuses
        statusInit: "Log in and select a song to begin...",
        statusConnecting: "Connecting to Google Drive...",
        statusConnError: "Error loading songs from Drive. Check link or API key.",
        statusLoading: "Loading audio stems into RAM...",
        statusDecoding: "Decoding track",
        statusReady: "Stems loaded: {count}. Ready for the gig!",
        statusError: "Audio Engine error during streaming.",
        statusNoFiles: "No supported audio files (.mp3, .wav, .m4a) in this folder!",
        apiKeyWarning: "Enter your Google API Key in the code (line ~11 of app.js) to load songs!",

        // Authentication, Membership and SPA Menu
        navBands: "🎸 My Bands",
        navRepertoire: "🎵 Repertoire",
        navCalendar: "📅 Calendar",
        
        authTitleLogin: "🔑 Login",
        authTitleRegister: "📝 Register",
        authEmail: "Email Address:",
        authPassword: "Password:",
        authDisplayName: "Your Name (Musician):",
        authBtnLogin: "Log In",
        authBtnRegister: "Register",
        authSwitchToRegister: "Don't have an account? Register",
        authSwitchToLogin: "Already have an account? Log In",
        authLogout: "Log Out",
        authWelcome: "Musician: {name}",
        authSuccessLogin: "Successfully logged in!",
        authSuccessRegister: "Registration successful! A 6-digit code has been sent to your email.",
        authError: "Error: {msg}",
        
        roleAdmin: "BAND LEADER / ADMIN",
        roleUser: "MEMBER / USER",
        
        joinCodeLabel: "Band Access Code:",
        joinCodeBtn: "Join Band",
        joinCodeSuccess: "Successfully joined the band!",
        joinCodePlaceholder: "E.g. GIG-184",
        
        inviteEmailLabel: "Invite member by Email:",
        inviteEmailBtn: "Send Invite",
        inviteEmailSuccess: "Invitation sent successfully!",
        
        bandOwnerLabel: "Founder / Leader",
        bandMembersTitle: "👥 Band Members:",
        bandCodeTitle: "🔑 Band Access Code:",
        
        createFirstBandMsg: "You are not a member of any band yet. Create your first band or join an existing one using the access code sent by your band leader!",
        onlyAdminEditMsg: "Only the Band Leader / Admin can change the Drive link or delete the band.",
        
        duplicateNameError: "A band with this name already exists in the database!",
        duplicateUrlError: "This Google Drive folder is already imported!",
        emptyNameError: "Name cannot be empty!",
        
        // NOVO v1.4.07 - OTP Verification, Settings and Dashboard
        otpTitle: "📩 Verify Email",
        otpSentText: "A 6-digit confirmation code has been sent to your email. Enter it below to complete registration:",
        otpPlaceholder: "E.g. 123456",
        otpBtnConfirm: "Confirm Code",
        otpBackToRegister: "◀ Back to Registration",
        otpUnconfirmedError: "Your email is not verified! Please enter the code we sent you.",
        
        settingsTitle: "⚙️ Settings",
        settingTabApp: "App",
        settingTabProfile: "Profile",
        settingTabPassword: "Password",
        settingTabAccount: "Account",
        
        timeFormatLabel: "Time Format:",
        dateFormatLabel: "Date Format:",
        timezoneLabel: "Timezone:",
        tempUnitLabel: "Temperature:",
        customTimezonePlaceholder: "Enter timezone...",
        customDateFormatPlaceholder: "Enter date format...",
        
        profileEmailLabel: "Email address (cannot be changed):",
        profileNameLabel: "Your Name (Musician):",
        profileAvatarLabel: "Profile Picture (Avatar):",
        profileSaveBtn: "Save Profile",
        
        passwordOldLabel: "Current Password:",
        passwordNewLabel: "New Password (min. 6 characters):",
        passwordSaveBtn: "Change Password",
        
        accountDangerTitle: "⚠️ Danger Zone (Delete Account)",
        accountDangerText: "Deleting your account permanently removes all your data, memberships, and saved song presets.",
        accountDeleteBtn: "Permanently delete my account",
        accountDeleteConfirm: "Are you sure you want to permanently delete your account? This action is irreversible!",
        
        // NOVO v1.4.07 - Dashboard, Menu and Members
        bandDashboardTitle: "Dashboard",
        bandOptionStems: "🎵 Stems",
        bandOptionMembers: "👥 Members",
        bandOptionSettings: "⚙️ Settings",
        
        sidebarNewBandOption: "➕ New Band",
        sidebarJoinBandOption: "🔑 Join Band",
        
        bandWebLabel: "Official Band Website:",
        bandInstagramLabel: "Instagram Link:",
        bandContactLabel: "Contact Phone / Email:",
        bandLogoLabel: "Band Logo:",
        bandRegenCodeBtn: "🔄 Regenerate Access Code",
        
        memberActionKick: "Kick Out",
        memberActionLeave: "🚪 Leave Band",
        memberActionLeaveConfirm: "Are you sure you want to leave this band?",
        memberActionKickConfirm: "Are you sure you want to kick member {name}?",
        memberLastAdminAlert: "You are the last admin. You must assign another member as admin or delete the band before leaving.",
        
        dragDropTip: "💡 Drag tracks left-right to change the mixing board order!",
        
        noActiveBand: "Select a band on the left to see the dashboard.",
        joinBandTitle: "🔑 Join a Band",
        joinBandSubmitBtn: "Join Band",
        
        saveSuccess: "Successfully saved!",
        saveError: "Error saving: {msg}"
    }
};
