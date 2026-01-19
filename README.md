# LOTS - LexOffice Time Scheduling

Eine moderne, cloudbasierte Zeiterfassungs-App für Teams und Freelancer mit interaktiven Charts, intelligenten Workflows und umfangreichen Export-Funktionen.

## Highlights

✨ **Quick Access** - Schnellzugriff auf zuletzt verwendete Projekte
📊 **Interaktive Charts** - Klickbare Diagramme mit automatischer Filterung
🎨 **Dark Mode** - Dunkles Design für angenehmeres Arbeiten
📅 **Kalender-Ansichten** - Timeline und Monatsübersicht für besseren Überblick
🏷️ **Smart Tags** - Autocomplete für wiederkehrende Stichwörter
💰 **Kostenaufstellung** - Automatische Berechnung mit Stundensätzen
👥 **Multi-User** - Team-Zusammenarbeit mit individuellen Farben
☁️ **Cloud-Sync** - Echtzeit-Synchronisation über Firebase

## Funktionen

### Zeiterfassung
- **Timer-Funktion**: Starte und stoppe die Zeit für deine Aufgaben mit Live-Anzeige
- **Quick Access**: Schnellzugriff auf die letzten 3 verwendeten Projekte mit Ein-Klick-Vorauswahl
- **Manuelle Eingabe**: Erfasse Zeiten auch nachträglich mit intelligentem Formular
- **Auto-Formatierung**: Zeiteingaben werden automatisch formatiert (z.B. 1245 → 12:45)
- **Projektbasiert**: Erfasse Zeit für spezifische Kunden und Projekte
- **Tags/Stichwörter**: Kategorisiere Einträge mit Tags und Autocomplete-Funktion
- **Kompakte Ansicht**: Timer, Quick Access und heutige Einträge in einer übersichtlichen Sektion
- **Bearbeiten & Löschen**: Nachträgliche Bearbeitung aller Zeiteinträge möglich
- **Toast-Benachrichtigungen**: Sofortiges Feedback zu allen Aktionen

### Verwaltung
- **Kundenverwaltung**: Verwalte deine Kunden mit Kontaktdaten und Stundensätzen
- **Projektverwaltung**: Organisiere Projekte nach Kunden
  - Budget-Tracking (Stunden)
  - Projekt-Status (Aktiv/Pausiert/Abgeschlossen)
  - Projekt-spezifische Stundensätze (überschreiben Kundensätze)
  - Mindestintervalle (15/30/60 Minuten) mit automatischer Aufrundung
  - Deadlines
  - Bearbeiten & Löschen von Projekten
- **Multi-User**: Zusammenarbeit im Team mit Organisation und Einladungscodes
- **Benutzer-Farben**: Individuelle Farben pro Benutzer für Charts und Visualisierungen
- **Dark Mode**: Dunkles Design für angenehmeres Arbeiten

### Auswertungen
- **Interaktive Charts**: Visualisiere deine Arbeitszeiten mit anklickbaren Diagrammen
  - Stunden pro Kunde (Doughnut-Chart)
  - Stunden pro Projekt (Bar-Chart)
  - Wochenübersicht (Tagesverteilung)
  - Monatlicher Verlauf (Line-Chart)
  - Tag-Verteilung (Pie-Chart)
  - Stunden pro Benutzer (Bar-Chart mit individuellen Farben)
- **Click-to-Filter**: Klicke auf Chart-Segmente zum automatischen Filtern
- **Flexible Filter**:
  - Zeitraum (Aktueller/Letzter Monat, Benutzerdefiniert)
  - Kunde, Projekt, Tag, Benutzer
  - "Alle Filter löschen"-Button zum schnellen Zurücksetzen
- **Multiple Ansichten**:
  - Tabellen-Ansicht mit Bearbeiten/Löschen-Funktionen
  - Monats-Kalender mit Stunden pro Tag
  - Wochen-Timeline (6:00-22:00 Uhr) mit visueller Zeitblockdarstellung
- **Heutige Einträge**: Umschaltbar zwischen Listen- und Kalender-Ansicht
- **Stats-Bar**: Live-Übersicht (Heute, Monat, Projekte, Kunden) immer sichtbar

### Export
- **CSV-Export**: Für Excel, Google Sheets, etc. mit Filter nach Kunde/Projekt
- **PDF-Bericht**: Professionelle interne Berichte mit Kostenaufstellung
  - Gruppierung nach Projekten
  - Stundensätze und Gesamtkosten pro Zeile
  - Zwischensummen pro Projekt
  - Gesamtsumme am Ende
- **Kunden-PDF**: Aufbereitete Stundennachweise für Kunden
  - Automatische Berechnung der Gesamtkosten
  - Optionale Detailansicht
  - Monatliche Abrechnungen

### Cloud-Sync
- **Firebase Integration**: Alle Daten werden sicher in der Cloud gespeichert
- **Echtzeit-Synchronisation**: Änderungen sind sofort für alle Team-Mitglieder sichtbar
- **Google Sign-In**: Sichere Authentifizierung
- **Offline-fähig**: Arbeitet auch bei Verbindungsproblemen

### Design & UX
- **Modern & Minimalistisch**: Klares, aufgeräumtes Interface
- **Dark Mode**: Dunkles Design für angenehmeres Arbeiten
- **Responsive**: Funktioniert auf Desktop und Tablet
- **Schnelle Navigation**: Sticky Header mit direkten Sprunglinks
- **Live-Feedback**: Toast-Benachrichtigungen für alle Aktionen
- **Kompakte Layouts**: Optimierte Raumnutzung mit Grid-basierten Layouts
- **Farbcodierung**: Visuelle Unterscheidung durch Benutzer-Farben

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Firebase (Authentication + Firestore)
- **Charts**: Chart.js
- **PDF**: jsPDF mit AutoTable
- **Hosting**: GitHub Pages

## Setup

### Voraussetzungen
- Firebase-Projekt ([Firebase Console](https://console.firebase.google.com/))
- GitHub Pages aktiviert (für Produktion)
- Lokaler Webserver für Development (Python, Node.js, oder VS Code Live Server)

### Firebase Konfiguration

1. Erstelle ein Firebase-Projekt
2. Aktiviere Authentication (Google Sign-In)
3. Erstelle eine Firestore-Datenbank
4. Füge deine Domain zu den autorisierten Domains hinzu
5. Kopiere die Firebase-Config in `app.js`

### Lokales Testen

Da LOTS Firebase verwendet, muss die App über einen Webserver laufen (nicht über `file://`).

**Option 1: Python**
```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```
Dann öffne: `http://localhost:8000`

**Option 2: Node.js**
```bash
# http-server installieren
npm install -g http-server

# Server starten
http-server -p 8000
```

**Option 3: VS Code Live Server**
- Installiere die "Live Server" Extension
- Rechtsklick auf `index.html` → "Open with Live Server"

**Wichtig**: Vergiss nicht, deine lokale URL (z.B. `http://localhost:8000`) in den Firebase-Einstellungen unter "Authorized domains" hinzuzufügen!

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // E-Mail Whitelist
    function isWhitelisted() {
      return request.auth.token.email in [
        'deine@email.de',
        'kollege@email.de'
      ];
    }

    // Organizations
    match /organizations/{orgId} {
      allow create: if request.auth != null &&
                       isWhitelisted() &&
                       request.auth.uid in request.resource.data.members;
      allow read: if request.auth != null &&
                     request.auth.uid in resource.data.members &&
                     isWhitelisted();
      allow update: if request.auth != null &&
                       isWhitelisted() &&
                       (
                         // Existing member can update
                         request.auth.uid in resource.data.members ||
                         // New member can add themselves (for joining via invite code)
                         (
                           request.auth.uid in request.resource.data.members &&
                           !(request.auth.uid in resource.data.members) &&
                           // Ensure only adding themselves, not removing other members
                           resource.data.members.hasAll(
                             request.resource.data.members.removeAll([request.auth.uid])
                           )
                         )
                       );

      // Sub-collections
      match /{collection}/{doc} {
        allow read, write: if request.auth != null &&
                              request.auth.uid in get(/databases/$(database)/documents/organizations/$(orgId)).data.members &&
                              isWhitelisted();
      }
    }

    // Users
    match /users/{userId} {
      allow write: if request.auth != null &&
                      request.auth.uid == userId &&
                      isWhitelisted();
      allow read: if request.auth != null &&
                     isWhitelisted() &&
                     (
                       // Can always read own document
                       request.auth.uid == userId ||
                       // Can read documents of users in same organization
                       (
                         exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
                         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId ==
                         get(/databases/$(database)/documents/users/$(userId)).data.organizationId
                       )
                     );
    }

    // Invite Codes
    match /inviteCodes/{code} {
      allow read: if request.auth != null && isWhitelisted();
      allow write: if request.auth != null && isWhitelisted();
    }
  }
}
```

## Verwendung

### Erste Schritte

1. **Anmelden**: Melde dich mit deinem Google-Account an
2. **Organisation erstellen**: Erstelle eine neue Organisation oder tritt einer bestehenden bei
3. **Kunden anlegen**: Lege deine ersten Kunden mit Stundensätzen an
4. **Projekte erstellen**: Erstelle Projekte für deine Kunden mit Budgets und Deadlines
5. **Farbe festlegen**: Wähle in den Einstellungen deine persönliche Farbe für Charts
6. **Zeit erfassen**: Starte den Timer oder nutze Quick Access für schnelles Erfassen
7. **Auswerten**: Analysiere deine Zeiten mit interaktiven Charts und Filtern
8. **Exportieren**: Erstelle CSV- oder PDF-Reports für deine Kunden

### Team-Zusammenarbeit

1. **Einladungscode teilen**: Finde deinen Einladungscode in den Einstellungen
2. **Kollegen einladen**: Teile den Code mit deinen Team-Mitgliedern
3. **Gemeinsam arbeiten**: Alle Zeiteinträge und Projekte sind für das Team sichtbar

## Geplante Features

- **LexOffice Integration**: Automatischer Export zu LexOffice (in Planung)
- **Rechnungserstellung**: Direkte Rechnungsgenerierung aus Zeiteinträgen
- **Mehr Export-Optionen**: Zusätzliche Formate und Vorlagen
- **Mobile App**: Native iOS/Android Apps für unterwegs
- **Wiederholende Einträge**: Templates für regelmäßige Aufgaben
- **Erweiterte Berechtigungen**: Rollen und Rechte für Team-Mitglieder

## Lizenz

LOTS ist unter einer **Dual-License** verfügbar:

### 🆓 AGPL v3 (GNU Affero General Public License v3)
- ✅ Kostenlose Nutzung für private und kommerzielle Zwecke
- ✅ Ändern und Weiterverbreiten erlaubt
- ⚠️ **Alle Änderungen müssen unter AGPL v3 veröffentlicht werden**
- ⚠️ **Bei Web/SaaS-Nutzung muss der komplette Quellcode allen Nutzern zur Verfügung gestellt werden**

Dies gilt für **alle Nutzungsarten** - privat wie kommerziell.

### 💼 Kommerzielle Lizenz (Optional - für proprietäre Nutzung)
Wenn Sie die Software nutzen möchten **ohne** den Quellcode zu veröffentlichen:

- Proprietäre Modifikationen erlaubt
- Closed-Source-Nutzung möglich
- Keine Verpflichtung zur Code-Veröffentlichung

**Kontakt für kommerzielle Lizenzierung**: https://www.lilapixel.de

---

**Zusammenfassung**:
- Kostenlos nutzbar (auch kommerziell) mit Code-Veröffentlichung unter AGPL v3
- ODER kostenpflichtige Lizenz für proprietäre Nutzung ohne Code-Veröffentlichung

**Vollständiger Lizenztext**: Siehe [LICENSE](LICENSE) Datei

---

Self-Made with 🤍 and AI

## Support

Bei Fragen oder Problemen erstelle bitte ein Issue im GitHub Repository.
