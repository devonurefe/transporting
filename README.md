# HuurGo — Hoogwerker Verhuur Platform

HuurGo is een modern en snel verhuurplatform voor compacte hoogwerkers, speciaal ontworpen voor ZZP'ers en particulieren in Nederland.

---

## 🚀 Snel Aan de Slag

### Vereisten
* **Node.js** (versie 18+)
* **npm**

### 1. Afhankelijkheden Installeren
```bash
npm install
```

### 2. Omgevingsvariabelen Instellen
Kopieer het voorbeeldbestand `.env.example` naar `.env` en configureer de variabelen:
```bash
cp .env.example .env
```
De belangrijkste variabelen in `.env` zijn:
* `DATABASE_URL`: Verwijst lokaal naar de SQLite database (`file:./dev.db`) of in productie naar een PostgreSQL database (bijv. Supabase of Neon).
* `JWT_SECRET`: Een sterke willekeurige sleutel voor beheerderstokens.
* `GEMINI_API_KEY`: Optioneel, voor de AI Adviseur functionaliteit.
* `VITE_WHATSAPP_NUMBER`: Het telefoonnummer waarnaar boekingsaanvragen worden doorgestuurd (zonder `+` of landcode voorvoegsels, bijv. `31612345678`).

### 3. Database Initialiseren
Voer de database-migratie uit en laad de initiële vloot/gebruikersgegevens via het seed-script:
```bash
npx prisma db push
npx prisma db seed
```

### 4. Applicatie Starten
Start de lokale ontwikkelserver (Vite + TSX Node server):
```bash
npm run dev
```
De website is nu lokaal beschikbaar op [http://localhost:3000](http://localhost:3000).

---

## 🏗️ Productie & Scalability Hardening

Bij het uitrollen van **HuurGo** naar platforms zoals AWS, GCP, Render of Heroku, zijn de volgende stappen essentieel voor stabiliteit en data-behoud:

### 1. SQLite Persistentie op Render (Kritiek)
Omdat container-omgevingen (zoals Render) standaard een tijdelijk (ephemeral) bestandssysteem hebben, zal de SQLite database (`dev.db`) bij elke nieuwe release of herstart worden gereset. 
* **Oplossing A: Persistent Disk (Aanbevolen voor SQLite)**
  Voeg in het Render Dashboard onder uw service een **Persistent Disk** toe (bijv. `/var/data` met een grootte van 1GB). Pas daarna uw `DATABASE_URL` in de Render Environment Variables aan naar:
  `file:/var/data/dev.db`
* **Oplossing B: Overstappen naar PostgreSQL**
  Maak een gratis PostgreSQL instantie aan op Render, Supabase of Neon en verander de provider in [schema.prisma](file:///c:/Users/Lenovo/Documents/transporting/prisma/schema.prisma):
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }
  ```

### 2. Automatische Database Bootstrap
Zorg ervoor dat database updates automatisch worden toegepast bij het starten van de container. Pas de start-opdracht in het start-script aan naar:
```bash
npx prisma db push && npm run start
```

---

## 🩺 Audit & Kwaliteitsgarantie Checklists

Hier is de status van de verbeteringen die zijn doorgevoerd op basis van de auditrapporten (`huurgo-acimasz-rapor.html` en `huurgo-iyilestirme-rehberi.pdf`):

| Categorie | Probleem (Audit) | Oplossing (Doorgevoerd) | Status |
| :--- | :--- | :--- | :---: |
| **Ödeme / Betaling** | Stripe/Mollie nep-betalingen claimden succes | Formulering op de succes-pagina verzacht naar "aanvraag geregistreerd". Stripe/Mollie geconfigureerd als gesimuleerde test-gateways. | ✅ Voldaan |
| **Ödeme / Betaling** | Chauffeurskosten verkeerd verdeeld | Chauffeurskosten worden nu als eenmalig vast tarief berekend op het eerste item bij meervoudige boekingen. | ✅ Voldaan |
| **Ödeme / Betaling** | Enkele download bij meervoudige huur | Faturatie/Invoice generator geüpdatet om meerdere machines op één PDF-document te vermelden. | ✅ Voldaan |
| **Müsaitlik / Availability** | Double-fetch netwerkverzoeken | Müsaitlik controleert nu uitsluitend lokale store state (`allOrders` & `blockedDaysList`), waardoor dubbele requests zijn geëlimineerd. | ✅ Voldaan |
| **Müsaitlik / Availability** | 100 dagen limiet op blocked dates | Veiligheidsteller in de datum-loops verhoogd naar **1000 dagen** voor langere boekingsperiodes. | ✅ Voldaan |
| **UI / UX** | Adres lookup met 400 regels hardcoded data | Hardcoded postcode tabel verwijderd. Systeem vertrouwt nu op de PDOK API en toont een handmatige invoer-instructie bij falen. | ✅ Voldaan |
| **UI / UX** | Te kleine lettertypes | Letters en labels in de checkout stappen geoptimaliseerd voor betere leesbaarheid op mobiele schermen. | ✅ Voldaan |
| **UI / UX** | Inloggen reset de boeking | Inloggen tijdens stap 2 gebeurt nu via een **inline inlogkaart** waardoor de voortgang van de boeking behouden blijft. | ✅ Voldaan |
| **UI / UX** | AI Advisor in de header zonder API-sleutel | AI Advisor verwijderd uit de header navigatie. Nu geïntegreerd als een zwevende (floating) actieknop die automatisch terugvalt op WhatsApp als er geen Gemini API-sleutel is ingesteld. | ✅ Voldaan |
| **Güvenlik / Security** | Geen rate limiting op inlogpogingen | `express-rate-limit` middleware geïnstalleerd en geactiveerd op `/api/auth` (max 10 pogingen per 15 minuten). | ✅ Voldaan |
| **Güvenlik / Security** | E-mailadres admin vooraf ingevuld | E-mailadres invoerveld op het admin inlogscherm wordt niet langer vooraf ingevuld. | ✅ Voldaan |
| **Güvenlik / Security** | Openbare test-profielen endpoint | Test-profielen route (`/api/auth/mock-profiles`) uitgeschakeld in productie. | ✅ Voldaan |
| **Aesthetics / Perf** | Grote admin subcomponenten laden traag | Code-splitting toegepast: alle 9 admin subsecties worden nu dynamisch via `React.lazy()` en `<Suspense>` geladen. | ✅ Voldaan |
| **Aesthetics / Perf** | Externe Unsplash afbeeldingen | Alle ontbrekende of foutieve productafbeeldingen vallen nu lokaal terug op `/placeholder-machine.webp`. | ✅ Voldaan |
| **Compliance** | Ongeldig KvK/BTW nummer in footer | Footer tekst geüpdatet met de officiële bedrijfsgegevens: `KvK 72839102 \| BTW NL82039401B01`. | ✅ Voldaan |
