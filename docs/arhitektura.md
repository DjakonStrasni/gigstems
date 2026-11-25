# GigLab — arhitektura i plan razvoja

Ovaj dokument opisuje kako je nova GigLab aplikacija sklopljena i zašto. Pre izmene u nekoj
oblasti pročitati odgovarajući odeljak — odluke su već analizirane, uključujući odbačene
alternative.

## 1. Zašto nova aplikacija, a ne nadogradnja stare (v1.4.08)

Stara verzija (Supabase + jedan `app.js`) nije imala temelje za planirane funkcije:

- **Pesma nije postojala kao podatak** — bila je samo ime podfoldera na Drive-u. Nije bilo
  mesta za tekst, akorde, tonalitet, tempo, setliste.
- **Sva logika je bila u browseru**, a dozvole su zavisile isključivo od Supabase pravila koja
  nisu bila u repozitorijumu. Planirane dozvole (skriveni kontakti lokala, privremene zamene,
  plaćeni paketi) zahtevaju proveru na serveru.
- **Slike su čuvane kao base64 tekst u bazi**, miksevi samo u localStorage jednog uređaja.
- **Supabase besplatni plan** pauzira projekat posle nedelju dana neaktivnosti i ima male
  limite — za hiljade korisnika vodio bi ka plaćenom planu, što krši postulat o nultom trošku.

Iz stare verzije se preuzimaju: prevodi, vizuelni stil, logika Web Audio miksera (učitavanje
stemova, gain po kanalu, mute/solo, prevlačenje redosleda kanala).

## 2. Okruženje

| Deo | Rešenje | Trošak |
|---|---|---|
| Domen | giglab.app | zakup domena |
| Hosting | firmin Telekom "Linux SSD PRO" (deljeni, cPanel) | već plaćeno |
| Baza | nova MySQL baza na istom hostingu | 0 |
| Backend | PHP 8.1+ bez framework-a | 0 |
| Frontend | Vue 3 + Vite, build u statične fajlove | 0 |
| SSL | Let's Encrypt / AutoSSL iz cPanel-a | 0 |
| Email | SMTP nalog na hostingu | 0 |
| Fajlovi korisnika (stemovi) | korisnikov Google Drive | 0 |
| Build i postavljanje | GitHub Actions → FTP na hosting | 0 |

**Ograničenja deljenog hostinga** koja oblikuju arhitekturu: nema stalno pokrenutih procesa
(samo PHP po zahtevu + cron), nema websocket-a, ograničen RAM/CPU po nalogu. Zato:

- sve teško (audio) ide mimo servera — direktno Google Drive ↔ browser,
- "uživo" osvežavanje (npr. kad drugi član izmeni setlistu) radi se povremenim proveravanjem
  (polling na 30–60 s), ne websocket-om,
- pozadinski poslovi (podsetnici za svirke, brisanje isteklih zamena) idu kroz cPanel cron.

Za hiljade korisnika ovo je dovoljno: najveći deo saobraćaja su mali JSON odgovori.

## 3. Struktura repozitorijuma (cilj)

```
backend/
  public/           jedini folder vidljiv sa weba (index.php = ulazna tačka API-ja, .htaccess)
  src/              PHP kod: router, kontroleri po oblastima, provere dozvola, servisi
  config/           version.php, config.example.php (pravi config.php nikad u git-u)
  database/
    migrations/     001_init.sql = polazna šema, zatim numerisane izmene: 002_...sql
frontend/
  src/              Vue komponente, ekrani, i18n, audio engine
  public/
translations/       sr.json, en.json (zajedničko za frontend i poruke sa servera)
docs/               ovaj dokument, odluke, changelog
```

Na hostingu: `frontend` build ide u `public_html/`, `backend/public` u `public_html/api/`,
a `backend/src` i `config` IZNAD `public_html` (nedostupno sa weba).

## 4. Model podataka (sažetak)

Puna šema: `backend/database/migrations/001_init.sql` (+ kasnije migracije).

### Korisnici i pristup
- `users` — nalog, jezik, država/grad, vremenska zona, paket (`plan_code`).
- `auth_sessions` — prijave (heš tokena u kolačiću), može više uređaja, odjava sa svih.
- `email_tokens` — potvrda emaila, reset lozinke.
- `plans` — paketi i njihova ograničenja (JSON). Sada svi na `free`.

### Bendovi i članstvo
- `bands` — bend; vlasnik je jedan korisnik.
- `band_members` — uloga: `owner`, `admin`, `member`, `substitute`.
  Zamena ima `access_expires_at` i vidi samo ono što joj je dodeljeno.
- `band_member_scopes` — šta tačno zamena vidi: konkretne svirke i/ili setliste.
- `band_invites` — poziv preko emaila ili koda/linka, sa rokom važenja.

### Pesme
- `songs` — pripadaju KORISNIKU, ne bendu. Tekst i akordi u ChordPro formatu (jedan tekst
  sa akordima u uglastim zagradama, npr. `[Am]Tekst [G]pesme`) — iz njega se renderuje prikaz,
  transponuje tonalitet i izvozi u druge formate.
- `song_band_shares` — korisnik deli pesmu sa bendom; bend može imati svoj tonalitet/tempo
  za tu pesmu (pevač benda peva u drugom tonalitetu od originala).
- `song_files` — stemovi i drugi fajlovi pesme: samo pokazivač na fajl (ID na Drive-u), ne sam
  fajl.
- `user_mixes` — lični miks korisnika za pesmu (jačine, mute, redosled), sinhronizovan
  između uređaja.

### Svirke
- `venues` — lokali benda. `field_visibility` (JSON) određuje za svako polje ko ga vidi:
  `owner` / `admins` / `members` / `everyone` (uključujući zamene).
  Primer: adresa i slika `everyone`, kontakt telefon `admins`, napomena o honoraru `owner`.
- `gigs` — svirka: lokal, vreme (dolazak, tonska proba, početak, kraj), status, setlista,
  honorar (podrazumevano vidljiv samo vlasniku i adminima).
- `gig_participants` — ko svira na svirci (članovi + zamene), potvrda dolaska.
- `setlists`, `setlist_items` — setlista benda ili lična; stavke su pesme, pauze, napomene,
  podela na setove; tonalitet/tempo može da se promeni samo za tu setlistu.

### Integracije
- `storage_connections` — povezan Google Drive (šifrovan refresh token, ID GigLab foldera).
- `calendar_feeds` — tajni token za iCal link korisnika.
- `gigrek_devices` — GigReK uređaji povezani sa bendom (heš API tokena, poslednja sinhronizacija).
- `audit_log` — dnevnik značajnih akcija.
- `support_tickets` — prijave problema.

## 5. Ključni tokovi

### 5.1 Povezivanje Google Drive-a (korisnik ne zna ništa o API-ju)
1. Korisnik klikne "Poveži Google Drive" → Google prozor za prijavu i dozvolu.
2. Tražimo samo `drive.file` dozvolu: aplikacija vidi isključivo fajlove koje je sama napravila
   ili koje je korisnik eksplicitno izabrao.
3. GigLab na njegovom Drive-u napravi folder `GigLab` (pa ga vidi zauvek).
4. Stemovi se dodaju na dva načina:
   - **otpremanje kroz GigLab** — browser šalje fajl direktno na Drive (u `GigLab/<pesma>/`),
     ne preko našeg servera;
   - **izbor postojećih fajlova** — Google Picker prozor, korisnik označi više fajlova odjednom.
5. **Važno ograničenje `drive.file` dozvole**: izbor celog foldera u Picker-u NE daje pristup
   fajlovima unutar njega — korisnik bira same fajlove (višestruki izbor). To je cena izbegavanja
   plaćene Google provere i treba da bude jasno objašnjeno u interfejsu.

**Odbačeno**: `drive.readonly` / `drive` dozvola (godišnja plaćena CASA bezbednosna provera);
traženje od korisnika da pravi API ključ (previše tehnički).

### 5.2 Slušanje stemova u bendu
Fajlovi pripadaju korisniku koji ih je dodao; ostali članovi nemaju njegov Google pristup.
Rešenje: kad se pesma sa stemovima podeli sa bendom, GigLab (u ime vlasnika fajla) postavi
fajlove na "svako ko ima link može da pregleda", a browser člana ih preuzima preko javnog
Drive API ključa (ograničenog na giglab.app). Fajl ID se daje samo članovima benda.
Kad se pesma prestane deliti, deljenje linkom se uklanja.

**Odbačeno za sada**: prosleđivanje audio fajlova kroz naš server (opterećenje deljenog
hostinga). Može kao opcija u plaćenom paketu ako se pređe na jači server.

### 5.3 Tekstovi i akordi
- Uvoz: lepljenje teksta sa akordima iznad reči (najčešći format sa sajtova) → automatsko
  pretvaranje u ChordPro; uvoz `.cho/.chopro`, OpenSong XML.
- Uređivanje: editor sa prikazom uživo, transponovanje, izbor notacije (C-D-E ili do-re-mi, H/B).
- Tonalitet: original pesme + tonalitet benda + izmena u setlisti.

### 5.4 Izvoz setliste
- **OpenSong** — set fajl + pesme (XML), za projekciju teksta.
- **ChordPro** paket (`.cho`), PDF za štampu (generiše se u browseru).
- **Lista tempa** za metronom aplikacije bubnjara (CSV/tekst; konkretni formati
  aplikacija se dodaju po potrebi).
- **GigReK** — direktna sinhronizacija, ne izvoz.

### 5.5 Kalendar
Svaki korisnik dobija tajni link `https://giglab.app/api/calendar/<token>.ics`. Doda ga jednom
u Google/Apple/Outlook kalendar i sve svirke njegovih bendova se pojavljuju i osvežavaju same.
Zamena vidi samo svirke na kojima svira. Link može da se poništi i napravi nov.

### 5.6 GigReK sinhronizacija
- Vlasnik benda u GigLab-u odobri GigReK uređaj (kod za uparivanje) — sinhronizacija je
  isključena dok je vlasnik eksplicitno ne uključi za taj bend.
- GigReK, dok ima internet, poziva `/api/gigrek/sync?since=<vreme>` sa svojim tokenom i
  preuzima izmenjene pesme (tekst, akordi, metapodaci) i setliste benda u svoju lokalnu
  SQLite bazu. Na svirci radi potpuno offline.
- GigReK nikad ne dobija stemove ni lične podatke članova ni kontakte lokala.

### 5.7 Pretplata (kasnije)
Svaka provera ograničenja (broj bendova, broj pesama, izvoz…) ide kroz jednu funkciju
`plan_allows($user, $feature)`. Uvođenje plaćanja tada znači samo novu tabelu pretplata i
promenu `plan_code` — bez prepravke ostatka aplikacije.

## 6. Bezbednost

- Lozinke: `password_hash()` (bcrypt/argon2), nikad u čitljivom obliku.
- Sesija: nasumičan token u httpOnly + Secure + SameSite kolačiću; u bazi samo njegov heš.
- Google refresh token šifrovan ključem iz `config.php` (van weba, van git-a).
- Svaki API zahtev prolazi proveru dozvole za konkretan bend/pesmu/svirku na serveru.
- Ograničenje broja pokušaja prijave (po emailu i IP-u) kroz bazu.
- CSRF zaštita za zahteve koji menjaju podatke.
- Google API ključ (javni, za stemove) ograničen u Google konzoli na giglab.app i samo Drive API.

## 7. Plan razvoja (bildovi)

| Bild | Sadržaj |
|---|---|
| 1 | Temelj: backend kostur, migracije, nalozi (registracija, potvrda emaila, prijava, reset lozinke), i18n, deploy na hosting |
| 2 | Bendovi: osnivanje, pozivi, uloge, izbacivanje, zamene |
| 3 | Pesme: baza pesama, ChordPro editor, transponovanje, deljenje sa bendom |
| 4 | Google Drive: povezivanje, otpremanje i izbor stemova, mikser za vežbu (prenos stare logike) |
| 5 | Setliste: pravljenje, prevlačenje, izvoz (OpenSong, ChordPro, PDF, tempo lista) |
| 6 | Svirke i lokali: kalendar svirki, vidljivost polja lokala, iCal link |
| 7 | GigReK API i uparivanje uređaja |
| 8 | Prelazak: novi sajt na giglab.app, uklanjanje stare verzije |

## 8. Otvorena pitanja

- Tačne mogućnosti hostinga: verzija PHP-a, SSH, cron, "Git Version Control" u cPanel-u,
  FTP pristup za automatsko postavljanje.
- Gde trenutno pokazuje DNS za giglab.app (GitHub Pages) i ko upravlja DNS zapisima.
- Koje metronom aplikacije bubnjari koriste (za formate izvoza).
- Da li je potreban prenos postojećih korisnika/bendova iz Supabase baze.
