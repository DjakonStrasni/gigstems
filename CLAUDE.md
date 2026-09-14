# GigLab — vodič za rad na ovom repozitorijumu

## Šta je GigLab

Web aplikacija za muzičare: organizacija bendova, članstva, repertoara, setlisti, kalendara
svirki i multitrack stem plejera za vežbanje. **Live na `giglab.app`** (GitHub Pages preko
`CNAME` fajla) — ovo je aktivan sajt, ne samo razvojni kostur, iako trenutno bez korisnika van
testiranja. Svaka izmena koja ide na `main` grana potencijalno je odmah javno vidljiva.

Sestrinski proizvod: **Gigrek** (repo `djakonstrasni/gigrek`) — offline Pi5 uređaj za snimanje
sa mikseta koji će sinhronizovati tekstove/setliste sa GigLab-om (nikad audio stemove). Videti
`CLAUDE.md` u tom repou za detalje njegove arhitekture.

Za razliku od Gigreka, ovaj projekat je rađen bez formalnog changelog/pravila procesa do sada —
ovaj fajl je prva formalizacija konvencija, na osnovu arhitekturnih odluka dogovorenih do sada.

## Stack — i zašto

- **Frontend**: vanilla HTML/CSS/JS (`index.html`, `style.css`, `app.js`, `translations.js`),
  bez build koraka, hostovano besplatno na GitHub Pages.
- **Backend/baza**: Supabase (Postgres + Auth/GoTrue + Realtime + Storage + Edge Functions).
  Izabrano jer je open source (Apache 2.0) i self-hostable — ako hostovani free tier ikad postane
  neadekvatan ili promeni cenu, moguće je preseliti na sopstveni server bez menjanja ostatka
  sistema (isti Postgres ispod haube).
- **Email**: Resend (nalog postoji, još nije povezan u kodu) — nije open source servis, ali ima
  besplatan tier; slanje mejlova treba apstrahovati kroz jednu funkciju da bi zamena provajdera
  bila laka ako ikad zatreba.
- **Sve zavisnosti moraju biti besplatne i po mogućstvu open source** — ovo je tvrd zahtev
  proizvoda (freemium model sa vrlo jeftinim plaćenim tier-om, ~$10/god), ne preporuka. Pre
  dodavanja bilo kog novog servisa/biblioteke, proveriti da li postoji besplatna/open-source
  alternativa i da li uvodi trošak koji raste sa brojem korisnika.

## Trenutno stanje implementacije (orijentaciono, ažurirati kad se nešto doda)

Urađeno: auth (email/password + OTP verifikacija), kreiranje/pridruživanje bendova, osnovna
lista članova (uloge samo `admin`/`member`), stem plejer/mikser (mute/solo/reorder — najzreliji
deo aplikacije). "Pesme" trenutno NISU baza podataka — čitaju se uživo kao imena foldera sa
Google Drive-a. Repertoar sa punim poljima, setliste, kalendar, chat, email/notifikacije, sistem
nivoa dozvola — nije početo.

## Arhitekturne odluke već dogovorene (pratiti ih pri implementaciji, ne redizajnirati bez razloga)

- **Sistem dozvola**: default = ništa vidljivo članu dok vlasnik eksplicitno ne odobri, po
  sekciji (kalendar/repertoar/setliste/chat/email) i po nivou člana (`owner`, `full_member`,
  `trial_member`, `temp_member`), uz mogućnost izuzetka po pojedincu.
- **Nasleđivanje vlasništva**: vlasnik definiše rangiranu listu naslednika. Kad se aktivira,
  naslednik postaje `acting_owner` sa ograničenim pravima (članovi, setliste, kalendar) — NIKAD
  brisanje benda/podataka niti promena storage konekcije. Mirror fajlova ka nasledniku je
  **opt-in podešavanje po bendu, default OFF**, uz jasno upozorenje da naslednik tada ima i
  direktan (ne samo kroz app) pristup toj kopiji.
- **Brisanje benda/podataka**: samo soft-delete sa periodom čekanja, dostupno isključivo pravom
  vlasniku, nikad acting owner-u.
- **Model pesama**: opcioni `songs_catalog` (identitet: naziv/izvođač/kanonski link, samo za
  autocomplete) + `band_song_arrangements` (sve izvedbeno specifično po bendu — BPM, takt, ton,
  pevač, napomene, status, stemovi — uvek nezavisno po bendu čak i za "istu" pesmu).
- **BPM/takt promene unutar pesme**: `song_sections` tabela (label, bpm, time_signature, order)
  kao dopuna glavnom zapisu pesme, ne zamena.
- **Storage (Google Drive prvo)**: `drive.file` OAuth scope (app vidi samo svoje fajlove, ne
  ceo korisnikov Drive). Članovi NIKAD ne dobijaju direktan Drive pristup — svako čitanje/pisanje
  ide preko Edge Function proxy-ja koji koristi sačuvani (enkriptovani) token vlasnika benda.
  Storage provider apstrahovan (`listFiles/readFile/writeFile/deleteFile` interfejs) da se
  OneDrive/drugi provajderi mogu dodati kasnije bez menjanja ostatka koda. Predložena struktura
  foldera: `GigLab-<BandName>/songs/<song-id>__<naziv>/{lyrics,stems,audio,notes}/`.
- **Login**: magic link (email OTP, već delimično postoji u kodu za verifikaciju — treba
  proširiti i na login) + WebAuthn/Passkey za biometrijski login na uređajima gde je već
  autentifikovan (SimpleWebAuthn biblioteka, MIT licenca).
- **Gigrek sync**: samo tekst/metapodaci/setliste, NIKAD stemovi. Scoped API token po bendu,
  eksplicitni opt-in vlasnika.

## Konvencije za novi kod (formalizovano od sada)

1. **SQL migracije obavezne od sada** — trenutna šema je napravljena ručno kroz Supabase
   dashboard bez verzionisanja. Svaka nova tabela/kolona ide kroz migracioni fajl u repou
   (npr. `supabase/migrations/`), ne ručno kroz dashboard, da promene budu praćene u git istoriji.
2. **Modularizacija**: `app.js` je već veliki monolit (~1800 linija). Nove funkcionalnosti
   (repertoar, setliste, chat, kalendar) pisati kao odvojeni moduli/fajlovi, ne dodavati u
   postojeći `app.js` bez granice — olakšava održavanje kako aplikacija raste.
3. **RLS (Row Level Security) obavezan** na svakoj novoj Supabase tabeli koja sadrži podatke
   vezane za bend/korisnika — pristup se filtrira na nivou baze, ne samo na frontu, jer su
   Supabase URL/anon key javno vidljivi u klijentskom kodu.
4. **Bez sirovih API ključeva trećih strana u klijentskom kodu bez ograničenja** — npr. Google
   API key mora imati restrikciju po HTTP referrer-u u Google Cloud Console.
5. **Nema komentara koji referenciraju AI/chat razgovor** — isto pravilo kao u Gigrek repou,
   komentar mora biti razumljiv nezavisno od konteksta u kom je nastao.
6. Pre push-a na `main` (koji je live sajt), lokalno testirati golden path — login, kreiranje
   benda, osnovna navigacija — pošto nema CI/staging environment trenutno.
