# GigLab

Web aplikacija za muzičare i bendove — [giglab.app](https://giglab.app).

Baza pesama (tekstovi, akordi, tonaliteti, stemovi), bendovi sa članovima i zamenama, setliste
sa izvozom (OpenSong, ChordPro, PDF), vežbanje uz stemove, svirke i lokali u kalendaru,
sinhronizacija sa GigReK uređajem za offline prikaz na svirci.

## Stanje

U toku je izrada nove verzije (Build 1). Stara verzija (v1.4.08) i dalje radi na giglab.app
iz fajlova u root-u, dok je nova ne zameni.

- Arhitektura i plan razvoja: [`docs/arhitektura.md`](docs/arhitektura.md)
- Šema baze: [`backend/database/migrations/`](backend/database/migrations/)
- Pravila razvoja: [`CLAUDE.md`](CLAUDE.md)

## Stack

PHP 8.1+ i MySQL na deljenom Linux hostingu, Vue 3 frontend, audio direktno sa korisnikovog
Google Drive-a.
