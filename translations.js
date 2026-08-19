/**
 * ==========================================================================
 * GIGSTEMS TRANSLATION DICTIONARY (translations.js)
 * v1.3.5 • Zaseban fajl sa prevodima radi lakšeg uređivanja i lokalizacije
 * ==========================================================================
 */

const i18n = {
    sr: {
        subtitle: "v1.3.4 • Google Drive Repertoar",
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
        bandNameLabel: "Naziv benda:",
        bandUrlLabel: "Google Drive Link Foldera:",
        connectBtn: "Dodaj bend",
        searchPlaceholder: "🔍 Pretraži pesmu...",
        activeBandLabel: "Bend:",
        songsTitle: "📋 Spisak Pesama",
        noBands: "Nema sačuvanih bendova. Dodaj novi iznad.",
        noSongs: "Nema pronađenih pesama.",
        deleteBandConfirm: "Da li ste sigurni da želite da obrišete ovaj bend?",
        addBandBtn: "Upravljaj",
        closeBtn: "Zatvori",
        statusConnecting: "Povezujem se sa drajvom...",
        statusConnected: "Uspešno povezan! Izaberi pesmu sa liste.",
        statusConnError: "Greška pri povezivanju. Proveri API ključ i link foldera.",
        
        // Menadžment i editovanje
        editSectionTitle: "✏️ Uredi Aktivni Bend",
        addSectionTitle: "➕ Dodaj Novi Bend",
        renameBandLabel: "Naziv trenutnog benda:",
        renameBandUrlLabel: "Link Drive foldera:",
        renameBtn: "Sačuvaj izmene",
        selectBandPlaceholder: "-- Bez benda --",
        deleteBandBtnText: "❌ Obriši ovaj bend",
        
        // Greške i validacija
        duplicateNameError: "Greška: Bend sa ovim nazivom već postoji!",
        duplicateUrlError: "Greška: Ovaj Google Drive link je već dodat za neki drugi bend!",
        emptyNameError: "Greška: Naziv benda ne može biti prazan!"
    },
    en: {
        subtitle: "v1.3.4 • Google Drive Repertoire",
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
        bandNameLabel: "Band Name:",
        bandUrlLabel: "Google Drive Folder Link:",
        connectBtn: "Add Band",
        searchPlaceholder: "🔍 Search song...",
        activeBandLabel: "Band:",
        songsTitle: "📋 Song Repertoire",
        noBands: "No saved bands. Add a new one above.",
        noSongs: "No songs found.",
        deleteBandConfirm: "Are you sure you want to delete this band?",
        addBandBtn: "Manage",
        closeBtn: "Close",
        statusConnecting: "Connecting to drive...",
        statusConnected: "Successfully connected! Select a song from the list.",
        statusConnError: "Connection error. Check API key and folder link.",
        
        // Management and editing
        editSectionTitle: "✏️ Edit Active Band",
        addSectionTitle: "➕ Add New Band",
        renameBandLabel: "Current band name:",
        renameBandUrlLabel: "Drive folder link:",
        renameBtn: "Save changes",
        selectBandPlaceholder: "-- No band --",
        deleteBandBtnText: "❌ Delete this band",
        
        // Errors and validation
        duplicateNameError: "Error: A band with this name already exists!",
        duplicateUrlError: "Error: This Google Drive link has already been added for another band!",
        emptyNameError: "Error: Band name cannot be empty!"
    }
};
