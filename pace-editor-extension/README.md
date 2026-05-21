# Pace Visual Template Editor

Chrome-extensie voor het visueel bewerken van Pace export-templates op `pace-bp.xsdirect.nl`.

## Installeren

### Vereisten

- Google Chrome of Brave browser
- [Node.js](https://nodejs.org/) 18 of hoger
- Git

### Stap 1 — Repository klonen

```bash
git clone https://github.com/XS-Direct/exportformat.git
cd exportformat/pace-editor-extension
```

### Stap 2 — Bouwen

```bash
npm install
npm run build
```

### Stap 3 — Laden in Chrome

1. Ga naar `chrome://extensions/`
2. Zet **Developer mode** aan (schakelaar rechtsboven)
3. Klik **Load unpacked**
4. Selecteer de map `pace-editor-extension/dist`

### Stap 4 — Gebruiken

1. Ga naar [Pace](https://pace-bp.xsdirect.nl/) en open een export model
2. Klik op het extensie-icoon in de toolbar (puzzelstukje) → **Pace Visual Template Editor**
3. Het side panel opent met de editor

## Updaten

Als er een update beschikbaar is, verschijnt er een gele banner in de extensie.

```bash
cd exportformat/pace-editor-extension
git pull
npm install
npm run build
```

Daarna in Chrome: `chrome://extensions/` → klik het **reload-icoon** (↻) bij de extensie.

## Functies

- **Kolommen-editor** — bekijk en bewerk kolommen visueel, drag-and-drop
- **Live preview** — zie direct hoe het exportbestand eruitziet (met testdata)
- **Simulator** — test de template met automatisch gegenereerde data
- **Visuele blokken** — bewerk $if/$ifelse condities, velden en functies visueel
- **Raw editor** — directe toegang tot de ruwe Pace-code
- **Send to Pace** — schrijf wijzigingen terug naar het Pace-formulier

## Sneltoetsen

| Toets | Actie |
| --- | --- |
| `Ctrl/Cmd + Z` | Ongedaan maken |
| `Ctrl/Cmd + Shift + Z` | Opnieuw |

## Problemen?

- **"Kon Pace niet uitlezen"** — Open eerst een export model in Pace, klik dan op **↻ Lezen**
- **Verkeerd model geladen** — Klik op **↻ Lezen** terwijl het juiste model open staat in Pace
- **Extensie reageert niet na update** — Reload de extensie op `chrome://extensions/`

## Ontwikkelen

```bash
npm run dev         # Dev-server met hot reload
npm run test        # Tests draaien
npm run build       # Productie-build
npm run package     # Build + ZIP voor distributie
```
