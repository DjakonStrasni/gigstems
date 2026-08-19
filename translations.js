/**
 * ==========================================================================
 * GIGSTEMS TRANSLATION DICTIONARY (translations.js)
 * v1.3.3 • Zaseban fajl sa prevodima radi lakšeg uređivanja i lokalizacije
 * ==========================================================================
 */

const i18n = {
    sr: {
        subtitle: "v1.3.3 • Repertoar i Menadžment",
        stopBtn: "Zaustavi",
        playBtn: "Pusti trake",
        pauseBtn: "Pauziraj",
        statusInit: "Izaberi pesmu sa leve strane da započneš...",
        statusNoFiles: "Nema ispravnih audio fajlova u izabranom folderu!",
        statusLoading: "Učitavam i sinhronizujem trake sa Google Drive-a u RAM...",
        statusDecoding: "Preuzimam i dekodiram kanal",
        statusReady: "Učitano je {count} traka sa Drive-a. Spremno za svirku!",
        statusError: "Greška pri učitavanju i dekodiranju fajlova.",
        masterMuteBtn: "UTIŠAJ SVE",
        masterVolLabel: "MASTER:",
        
        // Upravljanje bendovima, pretraga i sidebar
        settingsTitle: "⚙️ Upravljanje Bendovima",
        bandNameLabel: "Naziv novog benda:",
        bandUrlLabel: "Google Drive Link Foldera:",
        connectBtn: "Dodaj novi bend",
        searchPlaceholder: "🔍 Pretraži pesmu...",
        activeBandLabel: "Bend:",
        songsTitle: "📋 Spisak Pesama",
        noBands: "Nema sačuvanih bendova. Dodaj novi ispod.",
        noSongs: "Nema pronađenih pesama.",
        deleteBandConfirm: "Da li ste sigurni da želite da obrišete ovaj bend?",
        addBandBtn: "Upravljaj",
        closeBtn: "Zatvori",
        statusConnecting: "Povezujem se sa drajvom...",
        statusConnected: "Uspešno povezan! Izaberi pesmu sa liste.",
        statusConnError: "Greška pri povezivanju. Proveri API ključ i link foldera.",
        
        // #NOVO v1.3.3 - Unapređeni prevodi za editovanje i jasnu organizaciju
        editSectionTitle: "✏️ Uredi Aktivni Bend",
        addSectionTitle: "➕ Dodaj Novi Bend",
        renameBandLabel: "Naziv trenutnog benda:",
        renameBandUrlLabel: "Link Drive foldera:",
        renameBtn: "Sačuvaj izmene",
        selectBandPlaceholder: "-- Izaberi bend --",
        deleteBandBtnText: "❌ Obriši ovaj bend",
        duplicateNameError: "Bend sa tim nazivom već postoji!",
        emptyNameError: "Naziv benda ne može biti prazan!",
        duplicateUrlError: "Ovaj Drive folder je već dodat!"
    },
    en: {
        subtitle: "v1.3.3 • Repertoire & Management",
        stopBtn: "Stop",
        playBtn: "Play tracks",
        pauseBtn: "Pause",
        statusInit: "Select a song from the sidebar to begin...",
        statusNoFiles: "No valid audio files in the selected folder!",
        statusLoading: "Loading and syncing tracks from Google Drive to RAM...",
        statusDecoding: "Downloading and decoding channel",
        statusReady: "Loaded {count} tracks from Drive. Ready to play!",
        statusError: "Error loading and decoding files.",
        masterMuteBtn: "MUTE ALL",
        masterVolLabel: "MASTER:",
        
        // Translations for band management, search and sidebar
        settingsTitle: "⚙️ Manage Bands",
        bandNameLabel: "New Band Name:",
        bandUrlLabel: "Google Drive Folder Link:",
        connectBtn: "Add new band",
        searchPlaceholder: "🔍 Search song...",
        activeBandLabel: "Band:",
        songsTitle: "📋 Song Repertoire",
        noBands: "No saved bands. Add a new one below.",
        noSongs: "No songs found.",
        deleteBandConfirm: "Are you sure you want to delete this band?",
        addBandBtn: "Manage",
        closeBtn: "Close",
        statusConnecting: "Connecting to drive...",
        statusConnected: "Successfully connected! Select a song from the list.",
        statusConnError: "Connection error. Check API key and folder link.",
        
        // #NOVO v1.3.3 - Enhanced translations for editing and clear layout
        editSectionTitle: "✏️ Edit Active Band",
        addSectionTitle: "➕ Add New Band",
        renameBandLabel: "Current band name:",
        renameBandUrlLabel: "Drive folder link:",
        renameBtn: "Save changes",
        selectBandPlaceholder: "-- Select band --",
        deleteBandBtnText: "❌ Delete this band",
        duplicateNameError: "A band with that name already exists!",
        emptyNameError: "Band name cannot be empty!",
        duplicateUrlError: "This Drive folder is already added!"
    }
};
