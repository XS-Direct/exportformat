# Install — Pace Visual Template Editor

## Vereisten

- Chromium-gebaseerde browser (Chrome / Edge / Brave / Arc) — versie 114 of nieuwer (side panel API).
- Toegang tot `https://pace-bp.xsdirect.nl`.

## Stappen

1. **Bouw de extensie** in een lokale checkout van de repo:

   ```bash
   cd pace-editor-extension
   npm install
   npm run build
   ```

   Het resultaat staat in `pace-editor-extension/dist/`.

2. **Laad de extensie** in je browser:

   - Open `chrome://extensions`
   - Schakel **Developer mode** in (rechtsboven)
   - Klik **Load unpacked**
   - Selecteer de map `pace-editor-extension/dist`

3. **Open Pace** en navigeer naar een modelEdit-pagina, bijvoorbeeld:

   ```
   https://pace-bp.xsdirect.nl/#modelId=42&show=modelEdit
   ```

4. Direct boven de **Repeating code**-textarea verschijnt een blauwe knop
   `✎ Open visual editor`. Klik die om het side panel te openen.

5. In het side panel:
   - **Editor** — visuele node-tree met add/remove/edit per blok
   - **Preview** — geserialiseerde string + voorbeeld-output met fixtures
   - **Simulator** — fixture-runner met groen/rood-diff en CSV/TSV-download
   - **Instellingen** — field-catalog beheer

6. Klik op **Send to Pace** rechtsonder om de bewerkte Repeating code terug te
   schrijven naar de textarea. Druk daarna zelf op Pace's eigen save-knop (✓)
   om de wijziging in Pace op te slaan.

## Bijwerken

```bash
git pull
cd pace-editor-extension
npm install
npm run build
```

Klik in `chrome://extensions` op het ↻ pijltje bij de extensie om de
nieuwe build te laden.

## Verwijderen

In `chrome://extensions` → klik **Verwijderen** bij _Pace Visual Template Editor_.
De field-catalog in `chrome.storage.local` wordt automatisch opgeruimd.

## Troubleshooting

| Symptoom | Oorzaak | Oplossing |
| --- | --- | --- |
| Knop verschijnt niet | Pace heeft de DOM herstructureerd of je staat niet op een modelEdit-route | Check `#show=modelEdit` in de URL; open DevTools-console en kijk naar `[pace-editor]` warnings |
| "Repeating code textarea not found" | Pace's label voor de textarea is anders dan verwacht | Open een issue met een screenshot van de field-labels |
| Side panel opent niet | Browser-versie < 114 | Update de browser |
| Round-trip mismatch waarschuwing | Parser ondersteunt een specifieke syntax-variant nog niet | Schakel naar **Raw**-modus in de editor; meld het template als parser-issue |
