// ==========================================================================
// GIGLAB TRANSLATIONS - VERZIJA 1.4.07
// ==========================================================================

const i18n = {
    sr: {
        subtitle: "v1.4.07 • Studio Platforma",
        stopBtn: "Zaustavi",
        playBtn: "Pusti trake",
        pauseBtn: "Pauza",
        masterMuteBtn: "UTIŠAJ SVE",
        masterVolLabel: "MASTER:",
        activeBandLabel: "Aktivni bend:",
        addBandBtn: "Upravljaj",
        bandNameLabel: "Naziv novog benda:",
        bandUrlLabel: "Google Drive Link Foldera:",
        connectBtn: "Dodaj novi bend",
        searchPlaceholder: "🔍 Pretraži pesmu...",
        songsTitle: "📋 Spisak Pesama",
        
        // Menadžment bendova
        editSectionTitle: "✏️ Uredi Aktivni Bend",
        addSectionTitle: "➕ Dodaj Novi Bend",
        deleteSectionTitle: "🗑️ Obriši Aktivni Bend",
        renameBandLabel: "Naziv benda:",
        renameBandUrlLabel: "Link Drive foldera:",
        renameBtn: "Sačuvaj izmene",
        deleteBandConfirm: "Da li sigurno želiš da obrišeš ovaj bend? Sve pesme i sačuvani miksevi iz baze će biti trajno uklonjeni!",
        deleteBandBtnText: "❌ Obriši bend: {name}",
        deleteSectionText: "Upozorenje! Brisanjem benda '{name}', brišu se i svi njegovi članovi i sačuvani miksevi pesama.",
        selectBandPlaceholder: "-- Bez benda --",
        noBands: "Nema sačuvanih bendova. Osnuj svoj prvi bend sa leve strane!",
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

        // Autentifikacija i Članstvo
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
        authSuccessRegister: "Uspešna registracija! Unesite kod sa e-maila ispod.",
        authError: "Greška: {msg}",
        
        roleAdmin: "ŠEF / ADMIN",
        roleUser: "KORISNIK",
        
        joinCodeLabel: "Kod za učlanjenje u bend:",
        joinCodeBtn: "Priključi se pomoću koda",
        joinCodeSuccess: "Uspešno ste se priključili bendu!",
        joinCodePlaceholder: "Npr. FANK99",
        
        inviteEmailLabel: "Pozovi člana preko Email-a:",
        inviteEmailBtn: "Pošalji pozivnicu",
        inviteEmailSuccess: "Pozivnica uspešno poslata!",
        
        bandOwnerLabel: "Vlasnik / Osnivač",
        bandMembersTitle: "👥 Članovi benda:",
        bandCodeTitle: "🔑 Pristupni kod benda:",
        
        createFirstBandMsg: "Još uvek niste član nijednog benda. Kreirajte svoj prvi bend ili se priključite postojećem preko pristupnog koda koji vam je poslao šef benda!",
        onlyAdminEditMsg: "Samo Šef / Admin benda može menjati drajv link ili brisati bend.",
        
        duplicateNameError: "Bend sa tim nazivom u tom gradu i državi već postoji u bazi!",
        duplicateUrlError: "Ovaj Google Drive folder je već unet!",
        emptyNameError: "Naziv ne može biti prazan!",
        
        // #NOVO v1.4.07 - Dodatne stavke za bend i podršku
        bandContactNameLabel: "Ime kontakt osobe:",
        bandContactPhoneLabel: "Telefon kontakt osobe:",
        bandWebsiteLabel: "Zvanični sajt benda:",
        bandInstagramLabel: "Instagram link:",
        bandCountryLabel: "Država:",
        bandCityLabel: "Grad:",
        
        supportTitle: "💬 Prijavi problem",
        supportSubjectLabel: "Naslov poruke:",
        supportMessageLabel: "Opis problema / žalba:",
        supportBtn: "Pošalji podršci",
        supportSuccess: "Poruka je uspešno poslata našem timu! Javićemo se na vaš e-mail.",
        
        otpTitle: "📩 Potvrdi Email",
        otpText: "Poslali smo vam 6-cifreni kod na e-mail. Unesite ga ispod da aktivirate nalog:",
        otpBtn: "Potvrdi nalog",
        otpBackBtn: "◀ Nazad na registraciju",
        
        btnSongs: "🎵 Stemovi",
        btnMembers: "👥 Članovi",
        btnSettings: "⚙️ Podešavanja",
        btnConcerts: "📅 Svirke",
        btnKit: "🎸 Oprema",
        btnDocs: "📄 Dokumenti",
        
        memberActionRemove: "Izbaci",
        memberActionLeave: "Napusti bend",
        regenerateCodeBtn: "🔄 Regeneriši pristupni kod",
        regenerateCodeSuccess: "Novi pristupni kod je uspešno generisan!",
        cannotLeaveLastAdmin: "Ne možete napustiti bend jer ste jedini preostali šef benda. Prvo prenesite ulogu drugom članu ili obrišite bend!"
    },
    en: {
        subtitle: "v1.4.07 • Studio Platform",
        stopBtn: "Stop",
        playBtn: "Play Stems",
        pauseBtn: "Pause",
        masterMuteBtn: "MUTE ALL",
        masterVolLabel: "MASTER:",
        activeBandLabel: "Active Band:",
        addBandBtn: "Manage",
        bandNameLabel: "New Band Name:",
        bandUrlLabel: "Google Drive Folder Link:",
        connectBtn: "Add New Band",
        searchPlaceholder: "🔍 Search song...",
        songsTitle: "📋 Song List",
        
        // Band Management
        editSectionTitle: "✏️ Edit Active Band",
        addSectionTitle: "➕ Add New Band",
        deleteSectionTitle: "🗑️ Delete Active Band",
        renameBandLabel: "Band Name:",
        renameBandUrlLabel: "Drive Folder Link:",
        renameBtn: "Save Changes",
        deleteBandConfirm: "Are you sure you want to delete this band? All songs and saved mixes will be permanently deleted from the cloud database!",
        deleteBandBtnText: "❌ Delete band: {name}",
        deleteSectionText: "Warning! Deleting band '{name}' will also delete all its members and saved song mixes.",
        selectBandPlaceholder: "-- No Band --",
        noBands: "No saved bands found. Create your first band on the left!",
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

        // Authentication & Membership
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
        authSuccessRegister: "Registration successful! Enter the code sent to your email below.",
        authError: "Error: {msg}",
        
        roleAdmin: "BAND LEADER / ADMIN",
        roleUser: "MEMBER / USER",
        
        joinCodeLabel: "Join band with access code:",
        joinCodeBtn: "Join Band",
        joinCodeSuccess: "Successfully joined the band!",
        joinCodePlaceholder: "E.g. FANK99",
        
        inviteEmailLabel: "Invite member by Email:",
        inviteEmailBtn: "Send Invite",
        inviteEmailSuccess: "Invitation sent successfully!",
        
        bandOwnerLabel: "Founder / Owner",
        bandMembersTitle: "👥 Band Members:",
        bandCodeTitle: "🔑 Band Access Code:",
        
        createFirstBandMsg: "You are not a member of any band yet. Create your first band or join an existing one using the access code sent by your band leader!",
        onlyAdminEditMsg: "Only the Band Leader / Admin can change the Drive link or delete the band.",
        
        duplicateNameError: "A band with this name in this city and country already exists in the database!",
        duplicateUrlError: "This Google Drive folder is already imported!",
        emptyNameError: "Name cannot be empty!",
        
        // #NOVO v1.4.07 - Additional items for band and support
        bandContactNameLabel: "Contact Person Name:",
        bandContactPhoneLabel: "Contact Person Phone:",
        bandWebsiteLabel: "Official Band Website:",
        bandInstagramLabel: "Instagram Link:",
        bandCountryLabel: "Country:",
        bandCityLabel: "City:",
        
        supportTitle: "💬 Report an issue",
        supportSubjectLabel: "Subject:",
        supportMessageLabel: "Describe issue / complaint:",
        supportBtn: "Send to Support",
        supportSuccess: "Message successfully sent to our team! We will contact you via email.",
        
        otpTitle: "📩 Confirm Email",
        otpText: "We have sent a 6-digit code to your email. Enter it below to activate your account:",
        otpBtn: "Confirm Account",
        otpBackBtn: "◀ Back to Register",
        
        btnSongs: "🎵 Stems",
        btnMembers: "👥 Members",
        btnSettings: "⚙️ Settings",
        btnConcerts: "📅 Concerts",
        btnKit: "🎸 Gear",
        btnDocs: "📄 Docs",
        
        memberActionRemove: "Kick",
        memberActionLeave: "Leave band",
        regenerateCodeBtn: "🔄 Regenerate access code",
        regenerateCodeSuccess: "New access code successfully generated!",
        cannotLeaveLastAdmin: "You cannot leave this band because you are the only remaining Band Leader. Please transfer the role to another member or delete the band first!"
    }
};
