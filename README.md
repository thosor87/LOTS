# LOTS - LexOffice Time Scheduling

Eine moderne, cloudbasierte Zeiterfassungs-App für Teams und Freelancer.

## Funktionen

### Zeiterfassung
- **Timer-Funktion**: Starte und stoppe die Zeit für deine Aufgaben
- **Manuelle Eingabe**: Erfasse Zeiten auch nachträglich
- **Auto-Formatierung**: Zeiteingaben werden automatisch formatiert (z.B. 1245 → 12:45)
- **Projektbasiert**: Erfasse Zeit für spezifische Kunden und Projekte

### Verwaltung
- **Kundenverwaltung**: Verwalte deine Kunden mit Kontaktdaten und Stundensätzen
- **Projektverwaltung**: Organisiere Projekte nach Kunden
  - Budget-Tracking (Stunden)
  - Projekt-Status (Aktiv/Pausiert/Abgeschlossen)
  - Projekt-spezifische Stundensätze (überschreiben Kundensätze)
  - Deadlines
- **Multi-User**: Zusammenarbeit im Team mit Organisation und Einladungscodes

### Auswertungen
- **Interaktive Charts**: Visualisiere deine Arbeitszeiten
  - Stunden pro Kunde
  - Stunden pro Projekt
  - Wochenübersicht
  - Monatlicher Verlauf
  - Tag-Verteilung
  - Stunden pro Benutzer
- **Zeitraum-Filter**:
  - Aktueller Monat
  - Letzter Monat
  - Benutzerdefiniert
- **Detaillierte Tabellen**: Filtere und analysiere Zeiteinträge

### Export
- **CSV-Export**: Für Excel, Google Sheets, etc.
- **PDF-Bericht**: Professionelle interne Berichte
- **Kunden-PDF**: Aufbereitete Stundennachweise für Kunden
  - Automatische Berechnung der Gesamtkosten
  - Optionale Detailansicht

### Cloud-Sync
- **Firebase Integration**: Alle Daten werden sicher in der Cloud gespeichert
- **Echtzeit-Synchronisation**: Änderungen sind sofort für alle Team-Mitglieder sichtbar
- **Google Sign-In**: Sichere Authentifizierung

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Firebase (Authentication + Firestore)
- **Charts**: Chart.js
- **PDF**: jsPDF mit AutoTable
- **Hosting**: GitHub Pages

## Setup

### Voraussetzungen
- Firebase-Projekt ([Firebase Console](https://console.firebase.google.com/))
- GitHub Pages aktiviert

### Firebase Konfiguration

1. Erstelle ein Firebase-Projekt
2. Aktiviere Authentication (Google Sign-In)
3. Erstelle eine Firestore-Datenbank
4. Füge deine Domain zu den autorisierten Domains hinzu
5. Kopiere die Firebase-Config in `app.js`

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
      allow read, update: if request.auth != null &&
                             request.auth.uid in resource.data.members &&
                             isWhitelisted();

      // Sub-collections
      match /{collection}/{doc} {
        allow read, write: if request.auth != null &&
                              request.auth.uid in get(/databases/$(database)/documents/organizations/$(orgId)).data.members &&
                              isWhitelisted();
      }
    }

    // Users
    match /users/{userId} {
      allow read, write: if request.auth != null &&
                            request.auth.uid == userId &&
                            isWhitelisted();
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
3. **Kunden anlegen**: Lege deine ersten Kunden an
4. **Projekte erstellen**: Erstelle Projekte für deine Kunden
5. **Zeit erfassen**: Starte den Timer oder trage Zeiten manuell ein

### Team-Zusammenarbeit

1. **Einladungscode teilen**: Finde deinen Einladungscode in den Einstellungen
2. **Kollegen einladen**: Teile den Code mit deinen Team-Mitgliedern
3. **Gemeinsam arbeiten**: Alle Zeiteinträge und Projekte sind für das Team sichtbar

## Geplante Features

- **LexOffice Integration**: Automatischer Export zu LexOffice (in Entwicklung)
- **Rechnungserstellung**: Direkte Rechnungsgenerierung aus Zeiteinträgen
- **Mehr Export-Optionen**: Zusätzliche Formate und Vorlagen

## Lizenz

Self-Made with 🤍 and AI

## Support

Bei Fragen oder Problemen erstelle bitte ein Issue im GitHub Repository.
