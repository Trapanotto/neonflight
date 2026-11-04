# NEON SKYWAYS – Weiterentwicklungskonzept

**Stand:** 4. November 2026  
**Analysierte Version:** `main`, Commit `9144b93`  
**Produkt:** https://trapanotto.github.io/neonflight/  
**Repository:** https://github.com/Trapanotto/neonflight

## 1. Kernempfehlung

> **NEON SKYWAYS sollte von einer visuell starken Tech-Demo zu einem kompakten, fairen Score-Attack-Racer weiterentwickelt werden – nicht zu einem möglichst großen Flugspiel.**

Das Alleinstellungsmerkmal ist bereits vorhanden: eine sofort spielbare Synthwave-Stadt, eigener Jet, Regen, Bloom und prozedurale Musik ganz ohne Installation. Der nächste Schritt ist deshalb nicht primär „mehr Grafik“, sondern ein wiederholbarer Spielreiz:

**verstehen → fliegen → Zeit vergleichen → Linie verbessern → sofort neu starten.**

Das Zielbild ist ein browserbasierter Time-Attack-Racer mit 60–120 Sekunden langen Läufen, drei bis sechs klar unterscheidbaren Kursen, Medaillen, persönlichem Ghost und fairen Bestzeiten. Online-Ranglisten sind eine spätere Option, keine Voraussetzung für den Spielspaß.

---

## 2. Ausgangslage

### 2.1 Was bereits gut funktioniert

- Sofortiger Einstieg über eine statische Webseite; keine Accounts oder Assets-Downloads nötig.
- Geschlossener Basis-Loop: Start, 30 Ringe in Reihenfolge, Checkpoints, Boost, Kollisionen, Ziel und lokale Bestzeit.
- Wiedererkennbare, stimmige Präsentation aus Neonstadt, Synthwave-Himmel, Regen, Blitzen und prozeduralem Audio.
- Seed-basierte Kursgenerierung und reproduzierbarer Kurs-Test.
- Schlanke Technologie: JavaScript, Three.js, Vite und GitHub Pages.
- Gute Ausgangsbasis für schnelle Iterationen: überschaubare Module und kein schweres Backend.

**Lokal verifiziert:** Alle sechs vorhandenen Kursprüfungen bestehen; `npm run build` ist erfolgreich. Der kurze Browser-Check zeigte keine Konsolenfehler.

### 2.2 Zentrale Lücken

| Bereich | Ist-Zustand | Konsequenz |
|---|---|---|
| Langzeitmotivation | Ein fester Kurs und eine globale lokale Bestzeit | Nach einigen Läufen fehlt ein neues Ziel. |
| Kursvarianz | Beim Seed `1337` ca. 5,8 km Strecke, Ringhöhen nur ca. 48–88 m | Die mögliche vertikale Spannweite bis 235 m wird praktisch nicht genutzt. |
| Flugtiefe | Digitale Eingaben, sanfte Kurven und einfaches Boost-Regenerationsmodell | Optimale Linien und Boost-Entscheidungen sind noch nicht prägend genug. |
| Feedback | Zeit, Ringzähler und Bestzeit | Keine Sektoren, Delta-Zeit, Medaille oder Erklärung, wie man schneller wird. |
| Orientierung | Aktiver Ring leuchtet cyan | Kein Off-Screen-Hinweis oder Distanz; starker Bloom kann die Kontur überstrahlen. |
| Wiederholung | Ergebnisbildschirm und Restart | Kein Personal-Best-Ghost, kein direkter Vergleich mit dem vorherigen Lauf. |
| Wettkampffairness | Variable Simulation, auf 50 ms begrenztes Frame-Delta und daran gekoppelte Rennzeit | Bei niedriger Bildrate kann Spiel- und Rennzeit verlangsamt werden. |
| Kollisionen | Jedes Frame werden alle Gebäude geprüft | Skaliert schlecht bei größeren Kursen; schnelle Bewegungen brauchen robuste Tests. |
| Eingaben | Tastatur und Touch-Buttons | Kein Gamepad, Remapping, Invert-Y, Sensitivität oder Pause. |
| Einstellungen | Mute im laufenden Spiel | Keine Lautstärke-, Grafik- oder Reduced-Motion-Optionen. |
| Persistenz | Ein `localStorage`-Schlüssel | Nicht trennbar nach Kurs, Kursversion oder Physikversion. |
| Qualitätssicherung | Ein Kurs-Happy-Path-Test; Deployment baut nur | Physik, Timer, Kollisionen und UI-Abläufe sind nicht automatisiert abgesichert. |
| Distribution | Spielbarer Link und kurzes README | Kein Gameplay-GIF, Releases oder klar formulierte Roadmap. |

### 2.3 Technische Randnotiz

Der Produktionsbuild enthält aktuell ein ca. **597 kB großes JavaScript-Bundle** (ca. **150 kB gzip**) und Vite meldet die 500-kB-Schwelle. Das ist für ein Three.js-Spiel kein akutes Problem. Erst nach einer Messung optimieren; eine Engine-Migration oder aggressive Code-Aufteilung ist jetzt nicht erforderlich.

---

## 3. Produktleitplanken

### Annahmen

- Entwicklung durch eine Einzelperson oder ein kleines Team.
- Browser-first, GitHub Pages bleibt die primäre Plattform.
- Desktop/Tastatur und Gamepad sind das Hauptziel; Touch bleibt unterstützt.
- Zunächst komplett lokal und ohne Backend spielbar.
- Bestehende Optik und Technologie werden beibehalten.

### Designprinzipien

1. **Sofort spielbar:** Vom Laden bis zum Start wenige Sekunden; Restart ohne Umwege.
2. **Leicht zu lernen, schwer zu meistern:** Wenige Eingaben, aber sichtbar bessere Linien durch Übung.
3. **Präzision vor Ausdauer:** Kurze Läufe, keine Grind-Mechanik.
4. **Faire Vergleichbarkeit:** Bestzeiten gelten nur für eine definierte Kurs- und Physikversion.
5. **Lesbarkeit vor Effekt:** Ringe und Flugweg müssen auch bei Regen, Bloom und hohem Tempo klar erkennbar bleiben.
6. **Local-first:** Der volle Kernspaß funktioniert offline und ohne Registrierung.

### Explizite Nicht-Ziele für Version 1.0

- Kein Echtzeit-Multiplayer.
- Keine offene Welt und kein Kampfsystem.
- Keine Flugzeug-Upgrades mit besseren Fahrwerten.
- Keine Accounts, Abos oder Live-Service-Pflicht.
- Kein Wechsel zu Unity, Unreal oder einem UI-Framework.
- Kein beliebiger Zufallskurs mit global vergleichbaren Zeiten ohne Validierung.

---

## 4. Spielkonzept

### 4.1 Kernloop

```text
Kurs wählen
   ↓
3-Sekunden-Countdown / direkter Neustart
   ↓
60–120 Sekunden fliegen
   ├─ Ringe möglichst mittig treffen
   ├─ Boost für Geraden und riskante Abkürzungen einsetzen
   ├─ Sektoren gegen persönliche Bestzeit vergleichen
   └─ Kollisionen vermeiden
   ↓
Ergebnis: Zeit + Medaille + Delta + verbesserte Sektoren
   ↓
[sofort wiederholen] oder [nächsten Kurs fliegen]
```

**Wichtig:** Die Rennzeit bleibt die einzige zentrale Wertung. Ein zusätzliches, konkurrierendes Punktesystem würde das Ziel verwässern. Präzision und Combos beeinflussen zunächst nur Boost und Feedback.

### 4.2 Fluggefühl

Das jetzige Arcade-Modell bleibt erhalten; es wird nicht zu einer Flugsimulation ausgebaut.

Geplante Verbesserungen:

- Gleichmäßige, framerateunabhängige Simulation.
- Fein abgestimmte Eingabekurven und analoge Gamepad-Sticks.
- Optionen für Y-Invertierung, Sensitivität und Roll-Stärke.
- Optionaler Anfänger-Assist für sanfte Kursstabilisierung; in Bestzeiten als eigener Modus kenntlich gemacht oder für Ranglisten deaktiviert.
- Leichte Geschwindigkeitslinien und Triebwerksreaktionen, aber reduzierbares Camera Shake.
- Kamera-Kollisionsprüfung, damit Gebäude die Sicht nicht vollständig verdecken.

**Abnahmekriterium:** Ein erfahrener Spieler kann anhand von Aufzeichnungen erklären, warum eine Linie schneller war – nicht nur, dass er mehr Boost verwendet hat.

### 4.3 Ringe, Präzision und Boost

Der aktive Ring bleibt das Hauptziel. Zusätzlich:

- Distanz und Off-Screen-Pfeil zum nächsten Ring.
- Der übernächste Ring wird schwächer sichtbar gemacht, damit Spieler die Linie vorausplanen können.
- Ringpassage erhält eine Auswertung wie `PERFECT`, `CLEAN` oder `EDGE`.
- Präzise Treffer geben etwas Boost oder verkürzen die Boost-Abklingzeit.
- Passive Boost-Regeneration wird reduziert, damit Boost eine Entscheidung bleibt.
- Checkpoints garantieren eine festgelegte Mindestladung, statt jede taktische Entscheidung mit einer Vollaufladung zu überschreiben.

Die genauen Zahlen gehören in Playtests, nicht vorab in eine komplizierte Balance-Tabelle. Für den ersten Prototyp genügen drei Stufen und eine einzige Boost-Ressource.

**Wettkampfregel:** Eine Ringpassage muss hinsichtlich Richtung, tatsächlichem Schnittpunkt mit der Ringebene und zulässigem Radius eindeutig definiert sein. Rückwärts- oder Nähe-Pässe dürfen nicht zufällig von der Frame-Rate abhängen.

### 4.4 Kollisionen und Strafen

Aktuell setzt ein Respawn den Jet zurück und füllt durch das allgemeine Reset auch den Boost wieder auf. Für faire Runs sollte getrennt werden:

- **Respawn:** Position, Orientierung und Mindestgeschwindigkeit.
- **Strafe:** beispielsweise +2 Sekunden und Verlust eines kleinen Boost-Anteils.
- **Kein Vorteil:** Crash darf weder Boost noch eine bessere Linie schenken.
- **Keine Frustrationsspirale:** kurze, reduzierbare Crash-Sequenz und schneller Checkpoint-Neustart.

Crash-Anzahl und Zeitstrafe erscheinen im Ergebnis. Ein `CLEAN RUN` ist ein zusätzliches Qualitätsziel, aber kein zweiter Ranglistenwert.

### 4.5 Medaillen, Delta und Ghost

Jeder Kurs erhält feste, manuell getestete Zielzeiten:

- **Bronze:** Kurs zuverlässig abschließen.
- **Silber:** saubere Linie mit wenigen Fehlern.
- **Gold:** optimierte Linie und sinnvoller Boost-Einsatz.
- **Neon:** anspruchsvolles Expertenziel; nicht für den Fortschritt erforderlich.

Während des Laufs:

- Sektoren alle fünf oder sechs Ringe.
- Delta zur persönlichen Bestzeit, z. B. `−0,42 s` beziehungsweise `+0,18 s`.
- Kleine, nicht blockierende Hinweise auf beste oder verlorene Sektoren.

Nach dem Laufs:

- Gesamtzeit, bisherige Bestzeit und Delta.
- Medaille und nächste erreichbare Zielzeit.
- Beste Sektoren und Crash-Strafen.
- Primärer Button: **RETRY**; sekundär: **NEXT COURSE**.

Als nächster Motivationsschritt kommt ein **lokaler Personal-Best-Ghost**. Er zeigt nur den eigenen besten Lauf, standardmäßig dezent und abschaltbar. Für den Anfang werden Position und Orientierung mit fester Sampling-Frequenz gespeichert und interpoliert. Das ist robuster gegenüber späteren Physikänderungen als ein reiner Input-Replay.

### 4.6 Kursinhalte

Statt sofort unendlich viele Zufallskurse zu erzeugen: **drei kuratierte Kurse mit jeweils eigenem Fluggefühl.**

| Arbeitstitel | Dauer | Charakter | Lernziel |
|---|---:|---|---|
| **Downtown Dash** | 60–75 s | Breite Ringe, niedrige Gebäude, klare Sichtachsen | Grundlagen und erster Erfolg |
| **Storm Circuit** | 75–100 s | Engere Kurven, mehr Höhenwechsel, markante Türme | Vorausplanen und kontrolliertes Rollen |
| **Skyline Rush** | 90–120 s | Hohe Geschwindigkeit, lange Geraden, riskante Abkürzungen | Boost-Management und optimale Linie |

Der jetzige Kurs kann nach einem Navigationstest als `Downtown Dash` übernommen werden. Neue Kurse entstehen aus kuratierten Seeds plus Parametern oder aus explizit gespeicherten Wegpunkten. Jeder veröffentlichte Kurs erhält:

- `courseId`, `courseVersion` und Anzeigename,
- Seed beziehungsweise Wegpunkte,
- Schwierigkeit und geschätzte Dauer,
- Medaillenzeiten,
- Grafik-/Wetterprofil,
- freigegebene Physikversion.

**Später:** täglicher Seed als separater Modus. Seine Zeiten werden nie mit denen kuratierter Kurse vermischt.

### 4.7 Fortschritt ohne Grind

- Bronze/Silber schalten weitere Kurse oder deren Herausforderungsvarianten frei.
- Medaillen schalten nur Trails, Neonfarben und Jet-Designs frei.
- Keine besseren Triebwerke oder Handling-Werte durch Freischaltungen.
- Nach einem kurzen Onboarding dürfen erfahrene Spieler alle Basiskurse direkt wählen; Freischaltungen sind Motivation, keine Zugangssperre.

---

## 5. UX, Eingabe und Zugänglichkeit

### 5.1 Startmenü

- `QUICK RACE` als primäre Aktion.
- Kursauswahl mit Bestzeit und bisher erreichter Medaille.
- Deutlich sichtbare Einstellungen.
- Steuerung kontextabhängig: Tastatur, Gamepad oder Touch – nicht alle gleichzeitig.
- Beim ersten Start höchstens drei kurze Lernschritte im Kurs statt einer langen Textwand.

### 5.2 Pause und Sichtbarkeit

- `Escape` pausiert; Buttons für Fortsetzen, Neustart, Einstellungen und Kurswahl.
- Bei `visibilitychange` beziehungsweise Verlust des Browserfokus automatisch pausieren.
- Rennzeit zählt nur aktive, nicht pausierte Zeit.
- Nach Rückkehr kurzer Countdown, damit kein unfairer Crash entsteht.

### 5.3 Einstellungen

**Minimum:**

- Musik- und Effektlautstärke getrennt, Mute dauerhaft gespeichert.
- Y-Invertierung, Sensitivität und Tastenbelegung.
- Grafikstufen `Low / Medium / High / Auto`.
- Camera Shake, Blitze/Flash und Scanlines reduzierbar.
- Ghost an/aus.

**Gamepad:** linker Stick für Pitch/Roll, Trigger oder Schultertasten für Schub/Boost, Menü-Navigation und sofortiger Restart.

**Touch:** erst nach Desktop-Validierung auf einen virtuellen Stick und Auto-/Slider-Schub umstellen. Die vorhandenen Buttons bleiben bis dahin als Fallback.

### 5.4 Visuelle Lesbarkeit

- Ringkern und Richtungspfeile müssen auch ohne Bloom erkennbar sein.
- Nicht nur Cyan/Magenta zur Zustandsunterscheidung verwenden; Form und Helligkeit ergänzen.
- Aktiver Ring, Folgering und Checkpoint erhalten unterschiedliche Silhouetten.
- `prefers-reduced-motion` berücksichtigen.
- WebGL-Fehler oder nicht unterstützte Geräte erhalten eine verständliche Fallback-Meldung.

---

## 6. Technisches Umsetzungskonzept

### 6.1 Architektur: evolutionär statt Rewrite

JavaScript, Three.js und Vite bleiben. Vor neuen Spielmodi werden die vorhandenen Verantwortlichkeiten etwas klarer getrennt:

```text
src/
  core/
    game.js           # Zustände: menu/countdown/running/paused/finished
    race.js           # Rennzeit, Sektoren, Strafen, Ergebnis
  content/
    courses.js        # versionierte Kursdefinitionen
  replay/
    ghost.js          # Sampling, Wiedergabe, Versionierung
  storage/
    profile.js        # Settings, PBs, Medaillen, Migrationen
  render/
    quality.js        # Grafikprofile und Performance-Anpassung
  physics.js
  course.js
  main.js             # Composition Root, nicht jede Fachregel
```

Die Namen sind ein Zielbild, kein Grund für einen großen Refactoring-Commit. Module werden dann ausgelagert, wenn das jeweilige Feature sie benötigt.

### 6.2 Simulation und faire Zeitmessung

- Physik mit festem Zeitschritt, beispielsweise 60 Hz, und Akkumulator.
- Rendering kann mit variabler Frequenz laufen und interpolieren.
- Rennzeit aus monotoner aktiver Zeit oder exakt gezählten Simulationsticks; kein gekürztes Frame-Delta als stiller Zeitrabatt.
- Tab-Wechsel pausiert explizit, statt große Zeitdeltas zu verarbeiten.
- Kurs-, Physik- und Assist-Version werden mit jeder Bestzeit gespeichert.
- Tests vergleichen identische Eingabesequenzen bei simulierten 30, 60 und 120 fps.

### 6.3 Ring- und Gebäudekollisionen

- Beim Ring den Schnittpunkt der Bewegungsstrecke mit der Ringebene berechnen, nicht nur die radiale Position am Frame-Ende prüfen.
- Richtungsregel und Toleranzen explizit festlegen.
- Gebäude in einem statischen Spatial Hash oder Uniform Grid ablegen.
- Pro Simulationsschritt nur nahe Zellen prüfen.
- Bewegungsstrecke gegen erweiterte Gebäude-AABBs prüfen, damit hohes Tempo keine Kollisionen überspringt.
- Wiederkehrende temporäre Vektoren wiederverwenden, sofern Profiling die aktuellen Allokationen als relevant bestätigt.

### 6.4 Versionierter Speicher

Ein einziges Profil ersetzt schrittweise den einzelnen Bestzeit-Schlüssel:

```text
settings
progress
records[courseId][courseVersion][physicsVersion]
ghosts[recordId]
```

- Bestehende Bestzeit beim ersten Laden migrieren.
- Ungültige oder alte Daten dürfen das Spiel nicht am Start hindern.
- Speicherfehler und Private Mode bleiben nichtfatal.
- Ein `RESET LOCAL DATA`-Button ist Teil der Einstellungen.

### 6.5 Performance

Zuerst messen, dann optimieren:

- Debug-Overlay für FPS, Framezeit, Draw Calls, Dreiecke und Physikzeit.
- `renderer.info` als Ausgangspunkt.
- Ziel: 60 fps auf einem typischen Desktop bei 1080p, mindestens stabile 30 fps auf unterstützten Mobilgeräten.
- Automatische Qualität regelt Pixel Ratio, Bloom, Regendichte und Effektauflösung.
- Keine dauerhafte Pixel Ratio von 2 auf leistungsschwachen Geräten.
- Stadt-Culling und weitere Instancing-Arbeiten erst nach Profiling.
- Grafikänderungen dürfen die Simulation und Bestzeiten nicht beeinflussen.

### 6.6 Tests und CI

Der vorhandene Kurs-Test wird erweitert oder schrittweise auf `node:test` überführt. Keine große Test-Infrastruktur voraussetzen.

**Unit-/Simulationstests:**

- Ring vorwärts/rückwärts, Randtreffer, verfehlter Ring, große Schrittweite.
- Checkpoint, Reset und Ziel.
- Boost-Verbrauch, Regeneration und Crash-Regeln.
- Timer während Lauf, Pause, Tab-Wechsel und Restart.
- Spatial Hash gegen die bisherige einfache Kollisionsprüfung.
- Speicher-Migration und beschädigte Daten.
- Ghost-Sampling und Interpolation.

**Browser-Smoke-Tests, sobald Playwright eingeführt wird:**

- Menü → Start → Pause → Fortsetzen → Restart.
- Ergebnis → Retry.
- Einstellungen bleiben nach Reload erhalten.
- Keine Konsolenfehler beim Start.

**GitHub Actions:** Bei Pull Requests und Pushes `npm ci`, `npm test` und `npm run build`; Deployment erst nach erfolgreichen Prüfungen.

---

## 7. Priorisierte Roadmap

Die Aufwände sind grobe **Personentage (PT)** für eine Person, die das Projekt bereits kennt. Sie sind keine Terminzusage und schließen Playtest-Wartezeiten nicht ein.

| Phase | Ergebnis | Umfang | Aufwand |
|---|---|---|---:|
| **0 – Baseline** | Mess- und testbarer Ausgangspunkt | 5 Spieltests, Performance-Werte, Issues, Timer-/Kollisionstests, CI | 2–3 PT |
| **0.2 – Fair & Fluid** | Technisch faire und bedienbare Basis | Fixed Step, Pause, aktive Rennzeit, Spatial Hash, Grafikprofile, zentrale Einstellungen | 5–8 PT |
| **0.3 – One More Run** | Deutlich besserer Kernloop | Countdown, Ringnavigation, Sektoren/Delta, Medaillen, besseres Ergebnis, Retry, Crash-Regeln | 8–12 PT |
| **0.4 – Mastery & Content** | Nachhaltiger Spielreiz ohne Backend | Drei kuratierte Kurse, versionierte PBs, lokaler Ghost, Gamepad, Feintuning von Boost/Handling | 12–18 PT |
| **0.5 – Share** | Öffentlich vorzeigbare Version | Gameplay-GIF, Releases/Changelog, Ergebnis-Sharing, Touch-Polish, optionale Offline-Installation | 5–8 PT |
| **1.0 – Polish** | Stabile kleine Gesamtversion | 3–6 Kurse, Balancing, Accessibility-QA, Browser-/Gerätetests, Dokumentation | 5–10 PT |
| **Optional – Online** | Sozialer Vergleich | Freundesranglisten, Daily Seed, validierte Replays, Moderation | separat planen |

**Empfohlener Umfang für ein Portfolio-Projekt:** Phase 0 bis 0.5.  
**Empfohlener Umfang für eine dauerhafte Spielergemeinschaft:** erst nach den Playtest-Signalen die Online-Phase angehen.

### Release-Gates

**0.2 ist fertig, wenn …**

- 30/60/120-fps-Tests keine nennenswerten Timer- oder Simulationsabweichungen zeigen.
- Pause und Tab-Wechsel keine Rennzeit verändern.
- nahe und schnelle Kollisionen zuverlässig erkannt werden.
- Tests und Build automatisch laufen.

**0.3 ist fertig, wenn …**

- neue Spieler ohne externe Erklärung den nächsten Ring finden.
- ein Lauf mit zwei Eingaben oder weniger neu gestartet werden kann.
- Spieler nach dem Lauf erkennen, wo sie Zeit gewonnen oder verloren haben.
- ein Crash keinen Boost- oder Zeitvorteil erzeugt.

**0.4 ist fertig, wenn …**

- drei Kurse im Blindtest unterscheidbar sind.
- persönliche Bestzeiten nach Reload und Versionsmigration korrekt bleiben.
- der Ghost die beste Runde nachvollziehbar darstellt und abschaltbar ist.
- Gamepad einen kompletten Lauf einschließlich Menüs bedienen kann.

---

## 8. Konkrete erste Arbeitspakete

Diese Reihenfolge kann direkt als GitHub-Issue-Liste verwendet werden:

1. **CI um Tests ergänzen**  
   `npm ci`, `npm test`, `npm run build` für Pull Requests und `main`.

2. **Timer und Physik von der Bildrate entkoppeln**  
   Fixed-Step-Simulation, explizite aktive Rennzeit und Tests mit mehreren Frame-Raten.

3. **Ringpassagen als Regelmodul testen**  
   Vorwärtsrichtung, exakter Ebenen-Schnittpunkt, Randtoleranz, schnelle Bewegung und Reset.

4. **Game-State und Pause einführen**  
   `menu`, `countdown`, `running`, `paused`, `finished`; automatische Pause bei Tab-Wechsel.

5. **Gebäudekollision räumlich begrenzen**  
   Static Grid/Spatial Hash plus Tests gegen die bisherige Implementierung.

6. **Grafik- und Komfortoptionen hinzufügen**  
   Auto/Low/Medium/High, Lautstärke, Reduced Motion und persistente Einstellungen.

7. **Nächsten Ring eindeutig führen**  
   Distanz, Off-Screen-Pfeil, Folgering und Bloom-Lesbarkeit mit neuen Spielern testen.

8. **Ergebnis und Fortschritt verbessern**  
   Sektoren, PB-Delta, Medaillen, Crash-Strafen und schneller Retry.

9. **Kursdaten und Speicher versionieren**  
   Bestehende PB migrieren; Kurs-, Physik- und Assist-Version berücksichtigen.

10. **Zwei zusätzliche Kurse kuratieren**  
    `Storm Circuit` und `Skyline Rush` mit getesteten Medaillenzeiten.

11. **Boost- und Crash-Wirtschaft prototypisch balancieren**  
    Präzisionsbonus, begrenzte passive Regeneration und kein Vorteil durch Respawn.

12. **Lokalen PB-Ghost implementieren**  
    Transform-Sampling, Interpolation, Versionierung und abschaltbare Darstellung.

---

## 9. Validierung und Erfolgskriterien

Vor dem Ausbau werden fünf bis acht Personen getestet, die das Spiel nicht kennen. Keine Erklärung durch den Entwickler während des ersten Laufs.

### Frühe Produktziele

- Mindestens **4 von 5** Testpersonen schließen den Einstiegskurs ab.
- Mindestens **4 von 5** finden den nächsten Ring ohne externe Hilfe.
- Mindestens **3 von 5** starten freiwillig einen weiteren Lauf.
- Nach dem Ergebnis kann jede Testperson sagen, ob sie schneller oder langsamer als zuvor war.
- Bei erfahrenen Spielern entstehen erkennbar unterschiedliche Linien und Boost-Entscheidungen.
- Keine schwerwiegenden Konsolenfehler; Performance-Ziele aus Abschnitt 6.5 werden eingehalten.

Diese Werte sind anfängliche Playtest-Hypothesen, keine erfundenen Nutzungsstatistiken. Nach echten Messungen anpassen.

### Sinnvolle Kennzahlen nach Veröffentlichung

- Anteil gestarteter und abgeschlossener Läufe.
- Direkt-Restarts nach Ergebnis oder Crash.
- Läufe pro Sitzung.
- Anteil der Spieler mit mindestens einer PB-Verbesserung.
- Kursabbrüche nach Ring/Sektor, besonders beim Onboarding.

Analytik ist optional, datensparsam und transparent. Für die ersten Iterationen reichen beobachtete Playtests vollständig aus.

---

## 10. Online-Funktionen erst später

Eine öffentliche Rangliste ist technisch und organisatorisch aufwendiger als sie zunächst wirkt: Client-Zeiten sind manipulierbar, Kursversionen müssen übereinstimmen und Einträge benötigen Moderation.

Empfohlene Reihenfolge:

1. Lokale PBs und Ghost.
2. Ergebnis als teilbares Bild oder Text.
3. Optional teilbarer Ghost/Challenge-Link für Freunde.
4. Erst bei nachgewiesener wiederkehrender Nutzung ein Backend.
5. Für ernsthafte globale Ranglisten serverseitige Replay-Validierung, Kurs-/Physikversion, Rate Limits und Moderation.

Ein Daily-Seed ist erst sinnvoll, wenn der Generator nachweislich schaffbare, interessante und fair vergleichbare Strecken erzeugt.

---

## 11. Empfohlener unmittelbarer nächster Schritt

**Kein neuer Spielmodus und kein Grafik-Rewrite.** Zuerst ein kleiner Sprint aus:

1. Fixed-Step-Physik und fairer Rennzeit,
2. Pause und schnellem Retry,
3. Ringnavigation und besserer Bloom-Lesbarkeit,
4. Sektoren/PB-Delta und Medaillen,
5. fünf dokumentierten Spieltests.

Damit wird die vorhandene Stärke – ein attraktiver, sofort spielbarer Run – in einen wiederholbaren Spielspaß übersetzt. Erst danach lohnen sich weitere Kurse, Ghost, Mobile-Polish und schließlich Online-Funktionen.

---

## 12. Umsetzungsstand

**Umgesetzt am 4. November 2026:**

- Fixed-Step-Simulation mit 120 Hz und framerateunabhängiger Rennzeit.
- Explizite Zustände für Laufen, Pause und Ergebnis; automatische Pause bei Tab-Wechsel/Fokusverlust.
- Pause über `Escape`/`P`, Pause-Button und Pause-Overlay.
- Crash-Strafe von zwei Sekunden ohne Boost-Auffüllung.
- Robuste Vorwärts-Ringpassage über den tatsächlichen Ebenen-Schnittpunkt.
- Verpasste Ringe blockieren den Lauf nicht mehr: Der nächste Ring wird aktiviert,
  Checkpoints bleiben erreichbar und das Ergebnis zählt die Fehlpassagen.
- Spatial-Hash-Broadphase und Swept-AABB-Tests für Gebäude.
- Versioniertes lokales Profil inklusive Migration der bisherigen Bestzeit.
- Sektorenzeiten am Checkpoint mit Delta zur besten Sektorzeit.
- Bronze-, Silber-, Gold- und Neon-Medaillen sowie überarbeiteter Ergebnisbildschirm.
- Nächster Ring farblich hervorgehoben; Off-Screen-Pfeil und Distanzanzeige.
- Deutlich stärkere S-Kurven, Steig- und Sinkflüge sowie variable Ringgrößen.
- Einstellungen für Musik, Effekte, Bloom und Blitzintensität.
- Standardmäßig reduziertes Blitzen: kein Stroboskop, weniger Bloom und ein
  gedimmter Crash-Flash.
- Drei auswählbare Kurse mit eigener Streckencharakteristik, Tuning und
  Medaillenzielen.
- Versionierte Bestzeiten und Ghostdaten pro Kurs.
- Lokaler Personal-Best-Ghost mit Interpolation und Abschaltoption.
- Gamepad-Unterstützung für Steuerung, Boost, Schub und Pause.
- 31 automatisierte Tests für Kurs, Kollision, Rennzeit, Ghost und Speicher.
- CI-Workflow für Tests und Produktionsbuild.

**Noch offen:** dokumentierte Fremd-Playtests, Mobile-Polish, Daily Seed,
Freundes-Challenges und optionale Online-Ranglisten.
