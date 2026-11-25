# GigLab — vodič za rad na ovom repozitorijumu

## Šta je GigLab

Web aplikacija za muzičare (`giglab.app`). Muzičar se registruje, osniva bend ili postaje član
benda, vodi sopstvenu bazu pesama (tekst, akordi, tonalitet, tempo, stemovi), pravi setliste,
vežba uz stemove, izvozi setliste za druge programe i dobija raspored svirki u svoj kalendar.

Sestrinski proizvod: **GigReK** (repo `djakonstrasni/gigrek`) — offline Raspberry Pi uređaj za
multitrack snimanje. GigReK preuzima tekstove/akorde/setliste iz GigLab-a da bi ih prikazivao
na svirci bez interneta. GigReK NIKAD ne čuva audio stemove.

Kompletna arhitektura, model podataka i plan razvoja: `docs/arhitektura.md`.
Šema baze: `backend/database/migrations/` (polazna šema je `001_init.sql`, svaka sledeća
izmena je nov numerisan fajl).

## Osnovni postulati (nepromenljivi)

1. **Trošak za vlasnika je uvek nula** osim zakupa domena. Nikakve plaćene usluge, pretplate,
   plaćeni dodaci ni servisi koji posle nekog limita počinju da naplaćuju. Besplatne biblioteke
   otvorenog koda su dozvoljene.
2. **Hosting je postojeći firmin deljeni Linux hosting** (Telekom Srbija, paket "Linux SSD PRO"):
   PHP + MySQL, bez root pristupa, bez stalno pokrenutih procesa (nema Node/Python servera,
   nema websocket-a). Sve mora da radi u tim okvirima.
3. **Audio nikad ne prolazi kroz naš server.** Stemovi žive na korisnikovom Google Drive-u (ili
   drugom online disku), browser ih preuzima direktno odande. Naš server čuva samo male podatke
   (tekstovi, akordi, setliste, svirke, lokali).
4. **Google Drive koristi isključivo `drive.file` dozvolu** (ne traži Google verifikaciju ni
   plaćenu bezbednosnu proveru). Šire dozvole (`drive`, `drive.readonly`) su zabranjene jer
   povlače godišnju plaćenu CASA proveru.
5. **Aplikacija se pravi besplatna, ali spremna za pretplatu** — model paketa (`plans`) postoji
   od prvog dana, ograničenja se proveravaju kroz jedno mesto u kodu.
6. **Bezbednost se proverava na serveru.** Frontend samo prikazuje; svaka dozvola (ko sme da
   vidi kontakt lokala, šta vidi zamena, ko sme da izbaci člana) proverava se u PHP-u pre
   nego što podatak napusti server.

## Dizajn i korisnik

Korisnik je muzičar, često ne-tehnički, i većinu vremena koristi **telefon** (računar retko i
nerado). Iz toga slede pravila koja važe za svaki ekran:

1. **Telefon je prvi.** Svaki ekran se osmišljava istovremeno za tri veličine — telefon
   (do 600 px), tablet (600–1024 px, često položen na notni stalak) i računar (preko 1024 px).
   Nijedan ekran nije gotov dok ne radi dobro na sve tri. Na telefonu: glavna navigacija je
   traka sa ikonama na dnu ekrana (na dohvat palca); na tabletu/računaru bočni meni.
2. **Poznati obrasci, ne izmišljeni.** Prijava, registracija, reset lozinke, podešavanja,
   pozivanje članova — izgledaju i rade onako kako korisnik zna sa drugih aplikacija
   (Google/Instagram/Spotify): dugme "Nastavi sa Google-om" na vrhu, email + lozinka ispod,
   "Zaboravljena lozinka?" uz polje za lozinku, prikaz lozinke okom, jasne poruke o grešci
   ispod polja.
3. **Jasno prosečnom korisniku.** Bez tehničkih reči (API, token, folder ID, sinhronizacija
   gde god može drugačije). Dugmad kažu šta rade ("Dodaj pesmu", ne "Nova stavka"). Svaka
   prazna strana objašnjava šta ide tu i ima dugme za prvi korak.
4. **Za upotrebu na bini.** Veliki dodirni ciljevi (najmanje 44 px), čitljiv tekst pesme sa
   podesivom veličinom, tamna tema kao podrazumevana (mračne bine), ekran ne sme da se ugasi
   dok je otvorena pesma ili setlista u režimu svirke.
5. **Moderan i dosledan izgled.** Jedan skup boja, razmaka i komponenti (dugmad, kartice,
   polja, modali) definisan na jednom mestu i korišćen svuda — ne stilovi pisani usput po
   ekranima. Izgled stare verzije (v1.4.08) se NE preuzima.

## Stack

- **Backend**: PHP 8.1+ bez framework-a, PDO + MySQL/MariaDB (InnoDB, utf8mb4).
  Struktura u `backend/`. Bez Composer zavisnosti dok god je moguće (hosting nema SSH).
- **Frontend**: Vue 3 + Vite u `frontend/`. Build pravi obične statične fajlove koji se kače
  na hosting. Vue komponente (`.vue`) drže HTML, JS i CSS jednog dela ekrana na jednom mestu.
- **Prijava**: sopstveni nalozi (email + lozinka, potvrda emaila kodom) i "Prijavi se preko
  Google-a". Sesija preko httpOnly kolačića, nikad token u localStorage.
- **Email**: SMTP nalog sa firminog hostinga.
- **Kalendar**: iCal (.ics) link po korisniku koji se pretplati u Google/Apple/Outlook kalendaru.

Stara verzija aplikacije (v1.4.08, Supabase) ostaje u root-u (`index.html`, `app.js`,
`style.css`, `translations.js`) dok nova verzija ne zameni sajt na giglab.app — tada se briše.

## Pravila kodiranja

Preuzeta iz GigReK postulata, prilagođena GigLab-u. Važe od prvog reda koda.

1. **Bez punog prepisivanja fajla** kad se menja samo deo — ciljane izmene.
2. **Ne brisati postojeće komentare.** Komentari su za čoveka koji nastavlja rad.
3. **Očuvati postojeću strukturu** — imena, redosled funkcija koje rade, stil — osim ako je
   zadatak baš njihova izmena.
4. **Korak po korak** — analizirati stanje, naći logično mesto, dodati samo neophodno.
5. **Obavezno komentarisanje**, uz oznaku `#NOVO vX.X.X <opis>` (PHP/JS: `// #NOVO ...`) na
   novim delovima. Hijerarhija komentara sa višestrukim znakovima (`// ===`, `// ---`) da se
   vidi nivo celine.
6. **Nema AI referenci** u komentarima, kodu, commit porukama ni dokumentaciji.
7. **Logovanje**: svaka značajna korisnička akcija (registracija, osnivanje/brisanje benda,
   poziv/izbacivanje člana, dodela zamene, izmena svirke, brisanje pesme, povezivanje Drive-a,
   GigReK sinhronizacija) upisuje se u `audit_log` preko jedne funkcije (`log_event()`), sa
   punim kontekstom (ko, koji bend, koja pesma/svirka) — unos mora biti razumljiv sam za sebe.
8. **Nikad native `alert()/confirm()/prompt()`** — isključivo sopstveni modal sistem.
9. **Svi tekstovi ka korisniku idu kroz i18n** — server vraća `msg_key`, prevod je na klijentu.
   Nikad hardkodovan srpski/engleski tekst u komponenti ili PHP odgovoru.
10. **Brisanje** — poruka MORA eksplicitno reći da je akcija trajna i da se ne može poništiti.
11. **Jezički fallback je UVEK engleski, NIKAD srpski.** Srpski je prvi izbor za nove
    korisnike, ali nikad tehnički fallback.
12. **Zvanični engleski je britanski** ("cancelled", "colour", "organise").
13. **SQL samo preko pripremljenih upita** (PDO prepared statements). Nikad spajanje
    korisničkog unosa u SQL string.
14. **Šema baze se menja samo kroz migracije** u `backend/database/migrations/`
    (numerisani `.sql` fajlovi), nikad ručnom izmenom žive baze.

## Konvencija verzije

Isti format kao GigReK: `v0.0.<BILD><KORAK><POKUŠAJ>`. Nova GigLab aplikacija kreće od
Build 1 (`v0.0.110` = Build 1, korak 1, pokušaj 0). Jedno mesto istine za verziju:
`APP_VERSION` u `backend/config/version.php`, frontend je čita preko `/api/version`.

## Git — jedna grana, bez tragova AI razvoja

- **Prvi korak svake sesije**: `git branch --show-current`. Ako nije `main`, odmah prelazak na
  `main` pre bilo kakve izmene.
- **Sav rad ide direktno na `main`.** Bez feature-grana; ako nešto greškom završi na drugoj
  grani, prebaciti na `main` i obrisati tu granu lokalno i na remote-u.
- **Autor svakog commit-a je `djosko <djacic@yahoo.com>`.** Proveriti `git config user.name`
  i `user.email` pre prvog commit-a.
- **Nikakvi tragovi AI-asistiranog razvoja** — bez `Co-Authored-By`, bez linkova ka sesijama,
  bez pominjanja modela ili alata u commit porukama, kodu ili dokumentaciji.
