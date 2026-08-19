/**
 * ==========================================================================
 * GIGSTEMS TRANSLATION DICTIONARY (translations.js)
 * v1.3.2 • Zaseban fajl sa prevodima radi lakšeg uređivanja i lokalizacije
 * ==========================================================================
 */

const i18n = {
    sr: {
        subtitle: "v1.3.2 • Google Drive Repertoar",
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
        
        // #NOVO v1.3.2 - Prevodi za rename sekciju i prazno stanje
        renameBandLabel: "Preimenuj trenutni bend:",
        renameBtn: "Sačuvaj naziv",
        selectBandPlaceholder: "-- Izaberi bend --",
        deleteBandBtnText: "Obriši trenutni bend"
    },
    en: {
        subtitle: "v1.3.2 • Google Drive Repertoire",
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
        
        // #NOVO v1.3.2 - English translations for rename and empty state
        renameBandLabel: "Rename current band:",
        renameBtn: "Save name",
        selectBandPlaceholder: "-- Select band --",
        deleteBandBtnText: "Delete current band"
    }
};
