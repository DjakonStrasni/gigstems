-- =====================================================================================
-- GigLab — početna šema baze
-- #NOVO v0.0.110 Build 1: kompletan model podataka nove aplikacije
--
-- Pravila:
--   * MySQL 5.7+ / MariaDB 10.3+, InnoDB, utf8mb4 (podržava sve jezike i emoji).
--   * Sva vremena se čuvaju u UTC; vremenska zona korisnika služi samo za prikaz.
--   * Brisanje korisnika/benda briše povezane podatke (ON DELETE CASCADE) osim tamo
--     gde je istorija važna (audit_log zadržava zapis, ali bez veze ka obrisanom).
-- =====================================================================================

SET NAMES utf8mb4;

-- =====================================================================================
-- ### KORISNICI I PRISTUP
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Paketi (besplatni sada, plaćeni kasnije). Ograničenja su JSON, npr.
-- {"max_bands": 3, "max_songs": 200, "export_opensong": true}
-- Aplikacija ih čita isključivo preko jedne funkcije plan_allows().
-- -------------------------------------------------------------------------------------
CREATE TABLE plans (
    code            VARCHAR(32)     NOT NULL,
    name_key        VARCHAR(64)     NOT NULL,              -- i18n ključ naziva paketa
    limits          JSON            NOT NULL,
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,
    PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO plans (code, name_key, limits) VALUES
    ('free', 'plan_free', '{}');

-- -------------------------------------------------------------------------------------
-- Korisnički nalozi
-- -------------------------------------------------------------------------------------
CREATE TABLE users (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email               VARCHAR(190)    NOT NULL,
    password_hash       VARCHAR(255)    NULL,              -- NULL ako se prijavljuje samo preko Google-a
    google_sub          VARCHAR(64)     NULL,              -- Google ID naloga (prijava preko Google-a)
    display_name        VARCHAR(100)    NOT NULL,
    language            VARCHAR(10)     NOT NULL DEFAULT 'sr',
    country             VARCHAR(100)    NULL,
    city                VARCHAR(100)    NULL,
    timezone            VARCHAR(64)     NOT NULL DEFAULT 'Europe/Belgrade',
    chord_notation      ENUM('english','german','solfege') NOT NULL DEFAULT 'english',  -- B/H, do-re-mi
    avatar_path         VARCHAR(255)    NULL,              -- putanja do malog fajla na hostingu, ne base64
    plan_code           VARCHAR(32)     NOT NULL DEFAULT 'free',
    email_verified_at   DATETIME        NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_google (google_sub),
    CONSTRAINT fk_users_plan FOREIGN KEY (plan_code) REFERENCES plans (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Prijave (sesije). U kolačiću je nasumičan token, ovde samo njegov SHA-256 heš,
-- pa ni curenje baze ne omogućava preuzimanje tuđe sesije.
-- -------------------------------------------------------------------------------------
CREATE TABLE auth_sessions (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    token_hash      CHAR(64)        NOT NULL,
    user_agent      VARCHAR(255)    NULL,
    ip_address      VARCHAR(45)     NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      DATETIME        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sessions_token (token_hash),
    KEY ix_sessions_user (user_id),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Jednokratni kodovi: potvrda emaila, reset lozinke, promena emaila
-- -------------------------------------------------------------------------------------
CREATE TABLE email_tokens (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    purpose         ENUM('verify_email','reset_password','change_email') NOT NULL,
    token_hash      CHAR(64)        NOT NULL,
    new_email       VARCHAR(190)    NULL,                  -- samo za change_email
    attempts        TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- zaštita od pogađanja koda
    expires_at      DATETIME        NOT NULL,
    used_at         DATETIME        NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_email_tokens_user (user_id, purpose),
    CONSTRAINT fk_email_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Ograničenje broja pokušaja (prijava, slanje koda...) — deljeni hosting nema Redis,
-- pa se brojanje radi u bazi. Stari zapisi se brišu cron-om.
-- -------------------------------------------------------------------------------------
CREATE TABLE rate_limits (
    bucket          VARCHAR(190)    NOT NULL,              -- npr. "login:email:marko@x.com" ili "login:ip:1.2.3.4"
    hits            INT UNSIGNED    NOT NULL DEFAULT 0,
    window_start    DATETIME        NOT NULL,
    PRIMARY KEY (bucket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- ### BENDOVI I ČLANSTVO
-- =====================================================================================

CREATE TABLE bands (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_user_id           BIGINT UNSIGNED NOT NULL,
    name                    VARCHAR(120)    NOT NULL,
    logo_path               VARCHAR(255)    NULL,
    country                 VARCHAR(100)    NULL,
    city                    VARCHAR(100)    NULL,
    website                 VARCHAR(255)    NULL,
    instagram               VARCHAR(100)    NULL,
    contact_name            VARCHAR(100)    NULL,
    contact_phone           VARCHAR(40)     NULL,
    join_code               VARCHAR(16)     NULL,          -- kod za učlanjenje; NULL = isključeno
    gigrek_sync_enabled     TINYINT(1)      NOT NULL DEFAULT 0,  -- vlasnik mora eksplicitno uključiti
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bands_join_code (join_code),
    KEY ix_bands_owner (owner_user_id),
    CONSTRAINT fk_bands_owner FOREIGN KEY (owner_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Članstvo. Uloge:
--   owner      — vlasnik (tačno jedan po bendu, isti kao bands.owner_user_id)
--   admin      — može da uređuje bend, svirke, lokale, da poziva članove
--   member     — stalni član, vidi sve što je podeljeno sa bendom (osim skrivenih polja)
--   substitute — zamena: privremen pristup (access_expires_at) i samo ono što je dodeljeno
--                kroz band_member_scopes
-- -------------------------------------------------------------------------------------
CREATE TABLE band_members (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    band_id             BIGINT UNSIGNED NOT NULL,
    user_id             BIGINT UNSIGNED NOT NULL,
    role                ENUM('owner','admin','member','substitute') NOT NULL DEFAULT 'member',
    instrument          VARCHAR(80)     NULL,
    access_expires_at   DATETIME        NULL,              -- obavezno za zamene, NULL za stalne članove
    invited_by          BIGINT UNSIGNED NULL,
    joined_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_band_members (band_id, user_id),
    KEY ix_band_members_user (user_id),
    CONSTRAINT fk_band_members_band FOREIGN KEY (band_id) REFERENCES bands (id) ON DELETE CASCADE,
    CONSTRAINT fk_band_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_band_members_inviter FOREIGN KEY (invited_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Šta tačno zamena vidi: konkretne svirke i/ili setliste. Pesme iz dodeljenih setlisti
-- su joj vidljive automatski (tekst, akordi, stemovi tih pesama).
-- Veza ka svirci/setlisti je "meka" (bez FK) jer pokazuje na dve različite tabele;
-- brisanje svirke/setliste briše i ove zapise u kodu.
-- -------------------------------------------------------------------------------------
CREATE TABLE band_member_scopes (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    band_member_id      BIGINT UNSIGNED NOT NULL,
    scope_type          ENUM('gig','setlist') NOT NULL,
    scope_id            BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_member_scope (band_member_id, scope_type, scope_id),
    KEY ix_scope_target (scope_type, scope_id),
    CONSTRAINT fk_scopes_member FOREIGN KEY (band_member_id) REFERENCES band_members (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Pozivi u bend (preko emaila ili linka). Za zamenu poziv nosi i rok važenja pristupa.
-- -------------------------------------------------------------------------------------
CREATE TABLE band_invites (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    band_id             BIGINT UNSIGNED NOT NULL,
    email               VARCHAR(190)    NULL,              -- NULL = poziv linkom (ko god ima link)
    role                ENUM('admin','member','substitute') NOT NULL DEFAULT 'member',
    substitute_until    DATETIME        NULL,
    token_hash          CHAR(64)        NOT NULL,
    created_by          BIGINT UNSIGNED NOT NULL,
    expires_at          DATETIME        NOT NULL,
    accepted_at         DATETIME        NULL,
    accepted_by         BIGINT UNSIGNED NULL,
    revoked_at          DATETIME        NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_invites_token (token_hash),
    KEY ix_invites_band (band_id),
    KEY ix_invites_email (email),
    CONSTRAINT fk_invites_band FOREIGN KEY (band_id) REFERENCES bands (id) ON DELETE CASCADE,
    CONSTRAINT fk_invites_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_invites_acceptor FOREIGN KEY (accepted_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- ### PESME
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Pesma pripada korisniku (ne bendu) — muzičar nosi svoju bazu iz benda u bend.
-- Tekst i akordi su u ChordPro formatu: [Am]Tekst [G]pesme, {title: ...}, {soc}...{eoc}
-- -------------------------------------------------------------------------------------
CREATE TABLE songs (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_user_id       BIGINT UNSIGNED NOT NULL,
    title               VARCHAR(200)    NOT NULL,
    artist              VARCHAR(200)    NULL,
    original_key        VARCHAR(8)      NULL,              -- npr. "Am", "F#", "Bb"
    song_key            VARCHAR(8)      NULL,              -- tonalitet u kom ga ovaj muzičar svira
    tempo_bpm           SMALLINT UNSIGNED NULL,
    time_signature      VARCHAR(8)      NULL DEFAULT '4/4',
    duration_sec        SMALLINT UNSIGNED NULL,
    capo                TINYINT UNSIGNED NULL,
    content_chordpro    MEDIUMTEXT      NULL,
    notes               TEXT            NULL,
    tags                VARCHAR(255)    NULL,              -- slobodne oznake odvojene zarezom
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME        NULL,              -- "korpa": GigReK mora saznati da je pesma obrisana
    PRIMARY KEY (id),
    KEY ix_songs_owner (owner_user_id, deleted_at),
    KEY ix_songs_updated (updated_at),
    CONSTRAINT fk_songs_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Pesma podeljena sa bendom. Bend može imati sopstveni tonalitet i tempo za istu pesmu.
-- -------------------------------------------------------------------------------------
CREATE TABLE song_band_shares (
    song_id             BIGINT UNSIGNED NOT NULL,
    band_id             BIGINT UNSIGNED NOT NULL,
    shared_by           BIGINT UNSIGNED NOT NULL,
    band_key            VARCHAR(8)      NULL,
    band_tempo_bpm      SMALLINT UNSIGNED NULL,
    band_notes          TEXT            NULL,
    shared_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (song_id, band_id),
    KEY ix_shares_band (band_id, updated_at),
    CONSTRAINT fk_shares_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE,
    CONSTRAINT fk_shares_band FOREIGN KEY (band_id) REFERENCES bands (id) ON DELETE CASCADE,
    CONSTRAINT fk_shares_user FOREIGN KEY (shared_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Fajlovi pesme (stemovi, ceo miks, PDF note...). Ovde je samo POKAZIVAČ na fajl na
-- korisnikovom disku — sam audio nikad ne dolazi na naš server.
-- -------------------------------------------------------------------------------------
CREATE TABLE song_files (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    song_id             BIGINT UNSIGNED NOT NULL,
    provider            ENUM('google_drive') NOT NULL DEFAULT 'google_drive',
    external_id         VARCHAR(255)    NOT NULL,          -- ID fajla na Drive-u
    kind                ENUM('stem','mix','click','chart','other') NOT NULL DEFAULT 'stem',
    name                VARCHAR(200)    NOT NULL,          -- prikazno ime (npr. "Bas", "Vokal")
    mime_type           VARCHAR(100)    NULL,
    size_bytes          BIGINT UNSIGNED NULL,
    sort_order          SMALLINT        NOT NULL DEFAULT 0,
    link_shared         TINYINT(1)      NOT NULL DEFAULT 0,  -- da li je uključeno deljenje linkom (za članove benda)
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_song_files_song (song_id, sort_order),
    CONSTRAINT fk_song_files_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Lični miks korisnika za pesmu (jačine, mute, solo, redosled kanala), isti na svim
-- njegovim uređajima. JSON: {"master": 0.9, "tracks": {"<song_file_id>": {"gain":0.8,"mute":false}}, "order": [..]}
-- -------------------------------------------------------------------------------------
CREATE TABLE user_mixes (
    user_id             BIGINT UNSIGNED NOT NULL,
    song_id             BIGINT UNSIGNED NOT NULL,
    settings            JSON            NOT NULL,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, song_id),
    CONSTRAINT fk_mixes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_mixes_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- ### LOKALI, SVIRKE, SETLISTE
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Lokal benda. field_visibility određuje za SVAKO polje ko ga vidi:
--   "owner" | "admins" | "members" | "everyone" (everyone = i zamene)
-- Primer: {"address":"everyone","photo_path":"everyone","contact_phone":"admins","notes":"owner"}
-- Polje koje nije navedeno ima podrazumevanu vidljivost iz koda ("members").
-- Server izbacuje skrivena polja PRE slanja odgovora — frontend ih nikad ne dobija.
-- -------------------------------------------------------------------------------------
CREATE TABLE venues (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    band_id             BIGINT UNSIGNED NOT NULL,
    name                VARCHAR(150)    NOT NULL,
    address             VARCHAR(255)    NULL,
    city                VARCHAR(100)    NULL,
    country             VARCHAR(100)    NULL,
    latitude            DECIMAL(9,6)    NULL,
    longitude           DECIMAL(9,6)    NULL,
    photo_path          VARCHAR(255)    NULL,
    contact_name        VARCHAR(100)    NULL,
    contact_phone       VARCHAR(40)     NULL,
    contact_email       VARCHAR(190)    NULL,
    stage_info          TEXT            NULL,              -- bina, struja, ozvučenje, parking...
    notes               TEXT            NULL,
    field_visibility    JSON            NOT NULL,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_venues_band (band_id),
    CONSTRAINT fk_venues_band FOREIGN KEY (band_id) REFERENCES bands (id) ON DELETE CASCADE,
    CONSTRAINT fk_venues_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Setliste. band_id NULL = lična setlista korisnika (za vežbu).
-- -------------------------------------------------------------------------------------
CREATE TABLE setlists (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_user_id       BIGINT UNSIGNED NOT NULL,
    band_id             BIGINT UNSIGNED NULL,
    name                VARCHAR(150)    NOT NULL,
    notes               TEXT            NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME        NULL,
    PRIMARY KEY (id),
    KEY ix_setlists_band (band_id, updated_at),
    KEY ix_setlists_owner (owner_user_id),
    CONSTRAINT fk_setlists_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_setlists_band FOREIGN KEY (band_id) REFERENCES bands (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Stavke setliste: pesma, pauza ili napomena; set_number deli svirku na setove (1, 2, 3...).
-- key_override / tempo_override menjaju tonalitet/tempo SAMO u ovoj setlisti.
-- -------------------------------------------------------------------------------------
CREATE TABLE setlist_items (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    setlist_id          BIGINT UNSIGNED NOT NULL,
    position            SMALLINT UNSIGNED NOT NULL,
    set_number          TINYINT UNSIGNED NOT NULL DEFAULT 1,
    item_type           ENUM('song','break','note') NOT NULL DEFAULT 'song',
    song_id             BIGINT UNSIGNED NULL,
    key_override        VARCHAR(8)      NULL,
    tempo_override      SMALLINT UNSIGNED NULL,
    note                VARCHAR(255)    NULL,
    PRIMARY KEY (id),
    KEY ix_items_setlist (setlist_id, position),
    CONSTRAINT fk_items_setlist FOREIGN KEY (setlist_id) REFERENCES setlists (id) ON DELETE CASCADE,
    CONSTRAINT fk_items_song FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Svirke. Honorar (fee_*) je podrazumevano vidljiv samo vlasniku i adminima.
-- -------------------------------------------------------------------------------------
CREATE TABLE gigs (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    band_id             BIGINT UNSIGNED NOT NULL,
    venue_id            BIGINT UNSIGNED NULL,
    setlist_id          BIGINT UNSIGNED NULL,
    title               VARCHAR(150)    NULL,              -- npr. "Svadba Petrović"; prazno = ime lokala
    status              ENUM('tentative','confirmed','cancelled') NOT NULL DEFAULT 'tentative',
    load_in_at          DATETIME        NULL,              -- dolazak / istovar opreme
    soundcheck_at       DATETIME        NULL,
    starts_at           DATETIME        NOT NULL,
    ends_at             DATETIME        NULL,
    dress_code          VARCHAR(150)    NULL,
    fee_amount          DECIMAL(10,2)   NULL,
    fee_currency        CHAR(3)         NULL,
    notes               TEXT            NULL,
    created_by          BIGINT UNSIGNED NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_gigs_band_time (band_id, starts_at),
    CONSTRAINT fk_gigs_band FOREIGN KEY (band_id) REFERENCES bands (id) ON DELETE CASCADE,
    CONSTRAINT fk_gigs_venue FOREIGN KEY (venue_id) REFERENCES venues (id) ON DELETE SET NULL,
    CONSTRAINT fk_gigs_setlist FOREIGN KEY (setlist_id) REFERENCES setlists (id) ON DELETE SET NULL,
    CONSTRAINT fk_gigs_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Ko svira na svirci (stalni članovi i zamene) i da li je potvrdio dolazak.
-- -------------------------------------------------------------------------------------
CREATE TABLE gig_participants (
    gig_id              BIGINT UNSIGNED NOT NULL,
    user_id             BIGINT UNSIGNED NOT NULL,
    status              ENUM('invited','confirmed','declined') NOT NULL DEFAULT 'invited',
    responded_at        DATETIME        NULL,
    PRIMARY KEY (gig_id, user_id),
    KEY ix_participants_user (user_id),
    CONSTRAINT fk_participants_gig FOREIGN KEY (gig_id) REFERENCES gigs (id) ON DELETE CASCADE,
    CONSTRAINT fk_participants_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- ### INTEGRACIJE
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Povezan online disk korisnika. Refresh token je ŠIFROVAN ključem iz config.php.
-- -------------------------------------------------------------------------------------
CREATE TABLE storage_connections (
    id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id                 BIGINT UNSIGNED NOT NULL,
    provider                ENUM('google_drive') NOT NULL DEFAULT 'google_drive',
    account_email           VARCHAR(190)    NULL,
    refresh_token_enc       TEXT            NOT NULL,
    root_folder_id          VARCHAR(255)    NULL,          -- folder "GigLab" koji je aplikacija napravila
    connected_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error_at           DATETIME        NULL,          -- npr. korisnik je opozvao pristup u Google nalogu
    PRIMARY KEY (id),
    UNIQUE KEY uq_storage_user_provider (user_id, provider),
    CONSTRAINT fk_storage_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Tajni iCal link korisnika (https://giglab.app/api/calendar/<token>.ics)
-- -------------------------------------------------------------------------------------
CREATE TABLE calendar_feeds (
    user_id             BIGINT UNSIGNED NOT NULL,
    token_hash          CHAR(64)        NOT NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_fetched_at     DATETIME        NULL,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_calendar_token (token_hash),
    CONSTRAINT fk_calendar_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- GigReK uređaji upareni sa bendom. Uređaj dobija samo tekstove/akorde/setliste.
-- -------------------------------------------------------------------------------------
CREATE TABLE gigrek_devices (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    band_id             BIGINT UNSIGNED NOT NULL,
    device_name         VARCHAR(100)    NOT NULL,
    device_uid          VARCHAR(100)    NULL,              -- UID uređaja koji GigReK već koristi
    token_hash          CHAR(64)        NOT NULL,
    paired_by           BIGINT UNSIGNED NULL,
    paired_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_sync_at        DATETIME        NULL,
    revoked_at          DATETIME        NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_gigrek_token (token_hash),
    KEY ix_gigrek_band (band_id),
    CONSTRAINT fk_gigrek_band FOREIGN KEY (band_id) REFERENCES bands (id) ON DELETE CASCADE,
    CONSTRAINT fk_gigrek_user FOREIGN KEY (paired_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================================
-- ### DNEVNIK I PODRŠKA
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Dnevnik značajnih akcija (log_event()). context je JSON sa punim kontekstom
-- (ime benda, naziv pesme...) da bi zapis bio razumljiv i kad je objekat obrisan.
-- -------------------------------------------------------------------------------------
CREATE TABLE audit_log (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id             BIGINT UNSIGNED NULL,
    band_id             BIGINT UNSIGNED NULL,
    event               VARCHAR(64)     NOT NULL,          -- npr. "band_member_removed"
    context             JSON            NULL,
    ip_address          VARCHAR(45)     NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_audit_band (band_id, created_at),
    KEY ix_audit_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE support_tickets (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id             BIGINT UNSIGNED NULL,
    email               VARCHAR(190)    NULL,
    message             TEXT            NOT NULL,
    page                VARCHAR(255)    NULL,
    app_version         VARCHAR(20)     NULL,
    status              ENUM('open','resolved') NOT NULL DEFAULT 'open',
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------------------
-- Evidencija primenjenih migracija
-- -------------------------------------------------------------------------------------
CREATE TABLE schema_migrations (
    version             VARCHAR(64)     NOT NULL,
    applied_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('001_init');
