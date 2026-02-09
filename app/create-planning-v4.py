#!/usr/bin/env python3
"""
Erstellt Liquiditätsplanung V4.0 - IV-tauglich
Timeline:
- Nov 2025 - Mär 2026: Alle Standorte (Velbert, Uckerath, Eitorf)
- Apr 2026: Nur Velbert (Schließung Uckerath/Eitorf Anfang April)
- Mai-Jul 2026: Nachzahlungsphase
- Aug 2026: Ende Planungshorizont
"""

import json

# Basis-Struktur laden
with open('/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases/Hausärztliche Versorgung PLUS eG/06-review/PLANUNG-V4.0-IV-TAUGLICH.json', 'r') as f:
    planning = json.load(f)

# Monatsdaten definieren
monate = [
    # NOVEMBER 2025 - Alle Standorte
    {
        "monat": "2025-11",
        "monat_name": "November 2025",
        "phase": "Insolvenzgeld-Phase",
        "standorte": "Velbert, Uckerath, Eitorf",
        "einnahmen": {
            "umsatz": {
                "kv_velbert": 26066.67,
                "kv_uckerath": 0,
                "hzv_velbert": 0,
                "hzv_uckerath": 0,
                "pvs_velbert": 0,
                "gesamt": 26066.67
            },
            "altforderungen": 22566.67,
            "insolvenzspezifisch": 0,
            "gesamt": 48633.34
        },
        "ausgaben": {
            "personal": {
                "betrag": 0,
                "erläuterung": "Durch Insolvenzgeld gedeckt (Netto-Sicht gemäß A3)"
            },
            "betrieblich": {
                "velbert": -8800,
                "uckerath": -6822.22,
                "eitorf": -4627.78,
                "gesamt": -20250
            },
            "insolvenzspezifisch": 0,
            "gesamt": -20250
        },
        "saldo": 28383.34,
        "anmerkungen": []
    },

    # DEZEMBER 2025 - Alle Standorte
    {
        "monat": "2025-12",
        "monat_name": "Dezember 2025",
        "phase": "Insolvenzgeld-Phase",
        "standorte": "Velbert, Uckerath, Eitorf",
        "einnahmen": {
            "umsatz": {
                "kv_velbert": 0,
                "kv_uckerath": 9533.33,
                "hzv_velbert": 100000,  # Quartalsabschluss!
                "hzv_uckerath": 110000,  # Quartalsabschluss!
                "pvs_velbert": 0,
                "gesamt": 229066.67
            },
            "altforderungen": 168186.43,
            "insolvenzspezifisch": 0,
            "gesamt": 397253.10
        },
        "ausgaben": {
            "personal": {
                "betrag": 0,
                "erläuterung": "Durch Insolvenzgeld gedeckt (Netto-Sicht gemäß A3)"
            },
            "betrieblich": {
                "velbert": -14000,
                "uckerath": -13500,
                "eitorf": -7250,
                "gesamt": -34750
            },
            "insolvenzspezifisch": 0,
            "gesamt": -34750
        },
        "saldo": 362503.10,
        "anmerkungen": ["Quartalsabschlüsse HZV Q4/2025 (+170k EUR)"]
    },

    # JANUAR 2026 - Alle Standorte
    {
        "monat": "2026-01",
        "monat_name": "Januar 2026",
        "phase": "Insolvenzgeld-Phase",
        "standorte": "Velbert, Uckerath, Eitorf",
        "einnahmen": {
            "umsatz": {
                "kv_velbert": 39100,
                "kv_uckerath": 14300,
                "hzv_velbert": 30000,
                "hzv_uckerath": 40000,
                "pvs_velbert": 5000,
                "pvs_uckerath": 5000,
                "gesamt": 147700
            },
            "altforderungen": 30000,
            "insolvenzspezifisch": 0,
            "gesamt": 177700
        },
        "ausgaben": {
            "personal": {
                "betrag": 0,
                "erläuterung": "Durch Insolvenzgeld gedeckt (Netto-Sicht gemäß A3). Oktober-Gehälter vorfinanziert durch Bankhaus Bauer."
            },
            "betrieblich": {
                "velbert": -14000,
                "uckerath": -13500,
                "eitorf": -7250,
                "gesamt": -34750
            },
            "insolvenzspezifisch": {
                "rückzahlung_vorfinanzierung": -88052.96,
                "sachaufnahme": -2000,
                "gesamt": -90052.96,
                "erläuterung": "Rückzahlung an Bankhaus Bauer: 70.553 EUR Oktober-Gehälter + 17.500 EUR Gebühren (5% von 350k). Verifiziert aus ISK-Kontoauszug 08.01.2026 (siehe A4)."
            },
            "gesamt": -124802.96
        },
        "saldo": 52897.04,
        "anmerkungen": []
    },

    # FEBRUAR 2026 - Erste Masse-Zahlung, alle Standorte
    {
        "monat": "2026-02",
        "monat_name": "Februar 2026",
        "phase": "Normalbetrieb",
        "standorte": "Velbert, Uckerath, Eitorf",
        "einnahmen": {
            "umsatz": {
                "kv_velbert": 39100,
                "kv_uckerath": 14300,
                "hzv_velbert": 30000,
                "hzv_uckerath": 40000,
                "pvs_velbert": 5000,
                "pvs_uckerath": 5000,
                "gesamt": 147700
            },
            "altforderungen": 0,
            "insolvenzspezifisch": {
                "steuererstattung": 11000,
                "gesamt": 11000
            },
            "gesamt": 158700
        },
        "ausgaben": {
            "personal": {
                "velbert": -79744.20,
                "uckerath": -96600,
                "eitorf": 0,
                "zentrale": -28800,
                "vertreter": -5000,
                "lohnbuchhaltung": -785,
                "gesamt": -210929.20,
                "erläuterung": "Erste Gehaltszahlung durch Masse nach Ende der Insolvenzgeld-Phase (siehe A2)."
            },
            "betrieblich": {
                "velbert": -14000,
                "uckerath": -13500,
                "eitorf": -7250,
                "gesamt": -34750
            },
            "insolvenzspezifisch": 0,
            "gesamt": -245679.20
        },
        "saldo": -86979.20,
        "anmerkungen": ["Liquiditätsdefizit wird durch Dezember-Puffer (362k EUR) gedeckt"]
    },

    # MÄRZ 2026 - Alle Standorte, Quartalsabschluss
    {
        "monat": "2026-03",
        "monat_name": "März 2026",
        "phase": "Normalbetrieb",
        "standorte": "Velbert, Uckerath, Eitorf",
        "einnahmen": {
            "umsatz": {
                "kv_velbert": 26066.67,
                "kv_uckerath": 9533.33,
                "hzv_velbert": 100000,  # Quartalsabschluss!
                "hzv_uckerath": 110000,  # Quartalsabschluss!
                "pvs_velbert": 5000,
                "pvs_uckerath": 5000,
                "gesamt": 265133.33
            },
            "altforderungen": 22566.67,
            "insolvenzspezifisch": 0,
            "gesamt": 287700
        },
        "ausgaben": {
            "personal": {
                "velbert": -79744.20,
                "uckerath": -96600,
                "eitorf": 0,
                "zentrale": -28800,
                "vertreter": -5000,
                "lohnbuchhaltung": -785,
                "gesamt": -210929.20,
                "erläuterung": "Letzte Gehaltszahlung für alle Standorte vor Schließung Uckerath/Eitorf."
            },
            "betrieblich": {
                "velbert": -14000,
                "uckerath": -13500,
                "eitorf": -7250,
                "gesamt": -34750
            },
            "insolvenzspezifisch": 0,
            "gesamt": -245679.20
        },
        "saldo": 42020.80,
        "anmerkungen": ["Quartalsabschlüsse HZV Q1/2026 (+170k EUR)", "Letzte Woche Q1 - Uckerath/Eitorf schließen Anfang April"]
    },

    # APRIL 2026 - NUR VELBERT
    {
        "monat": "2026-04",
        "monat_name": "April 2026",
        "phase": "Normalbetrieb (nur Velbert)",
        "standorte": "Velbert",
        "einnahmen": {
            "umsatz": {
                "kv_velbert": 40000,
                "hzv_velbert": 30000,
                "pvs_velbert": 10000,
                "gesamt": 90000
            },
            "altforderungen": 10000,  # Restforderungen Uckerath/Eitorf
            "insolvenzspezifisch": 0,
            "gesamt": 100000
        },
        "ausgaben": {
            "personal": {
                "velbert": -79744.20,
                "erläuterung": "Nur noch Velbert-Personal nach Schließung Uckerath/Eitorf Anfang April (siehe A1)."
            },
            "betrieblich": {
                "velbert": -14000
            },
            "insolvenzspezifisch": 0,
            "gesamt": -93744.20
        },
        "saldo": 6255.80,
        "anmerkungen": ["Schließung Uckerath und Eitorf Anfang April", "Personalkosten sinken von 211k auf 80k EUR"]
    },

    # MAI 2026 - Velbert läuft noch (letzte Leistungserbringung)
    {
        "monat": "2026-05",
        "monat_name": "Mai 2026",
        "phase": "Auslaufphase Velbert",
        "standorte": "Velbert (Betrieb läuft aus)",
        "einnahmen": {
            "umsatz": {
                "kv_velbert": 40000,  # KV-Zahlung für April-Leistungen
                "hzv_velbert": 30000,  # HZV-Zahlung für April-Leistungen
                "pvs_velbert": 10000,
                "gesamt": 80000
            },
            "altforderungen": 0,
            "insolvenzspezifisch": 0,
            "gesamt": 80000
        },
        "ausgaben": {
            "personal": {
                "velbert": -79744.20,
                "erläuterung": "Letzte Gehaltszahlung Velbert vor Schließung Ende Mai."
            },
            "betrieblich": {
                "velbert": -14000
            },
            "insolvenzspezifisch": 0,
            "gesamt": -93744.20
        },
        "saldo": -13744.20,
        "anmerkungen": ["Velbert: Letzte Leistungserbringung", "Schließung Ende Mai geplant"]
    },

    # JUNI 2026 - Nachzahlungen
    {
        "monat": "2026-06",
        "monat_name": "Juni 2026",
        "phase": "Nachzahlungsphase",
        "standorte": "Keine aktiven Standorte",
        "einnahmen": {
            "umsatz": {
                "kv_velbert": 19300,  # Nachzahlung Mai-Leistungen (halber Monat)
                "pvs_velbert": 19300,  # PVS-Nachzahlungen
                "gesamt": 38600
            },
            "altforderungen": 0,
            "insolvenzspezifisch": 0,
            "gesamt": 38600
        },
        "ausgaben": {
            "personal": 0,
            "betrieblich": 0,
            "insolvenzspezifisch": 0,
            "gesamt": 0
        },
        "saldo": 38600,
        "anmerkungen": ["Nachzahlungen für bereits erbrachte Leistungen"]
    },

    # JULI 2026 - Quartalsabschluss + Nachzahlungen
    {
        "monat": "2026-07",
        "monat_name": "Juli 2026",
        "phase": "Nachzahlungsphase",
        "standorte": "Keine aktiven Standorte",
        "einnahmen": {
            "umsatz": {
                "kv_velbert": 59100,  # Quartalsabschluss Q2 + Restzahlungen
                "gesamt": 59100
            },
            "altforderungen": 0,
            "insolvenzspezifisch": 0,
            "gesamt": 59100
        },
        "ausgaben": {
            "personal": 0,
            "betrieblich": 0,
            "insolvenzspezifisch": 0,
            "gesamt": 0
        },
        "saldo": 59100,
        "anmerkungen": ["Quartalsabschluss Q2/2026", "Letzte erwartete Nachzahlungen"]
    },

    # AUGUST 2026 - Ende
    {
        "monat": "2026-08",
        "monat_name": "August 2026",
        "phase": "Ende Planungshorizont",
        "standorte": "Keine",
        "einnahmen": {
            "umsatz": 0,
            "altforderungen": 0,
            "insolvenzspezifisch": 0,
            "gesamt": 0
        },
        "ausgaben": {
            "personal": 0,
            "betrieblich": 0,
            "insolvenzspezifisch": 0,
            "gesamt": 0
        },
        "saldo": 0,
        "anmerkungen": ["Ende des Planungshorizonts"]
    }
]

# Zusammenfassung berechnen
total_einnahmen = sum(m['einnahmen']['gesamt'] for m in monate)
total_ausgaben = sum(m['ausgaben']['gesamt'] for m in monate)
netto_saldo = total_einnahmen + total_ausgaben

planning['monate'] = monate
planning['zusammenfassung'] = {
    "gesamteinnahmen": round(total_einnahmen, 2),
    "gesamtausgaben": round(total_ausgaben, 2),
    "nettosaldo": round(netto_saldo, 2),
    "liquiditätsverlauf": [
        {"monat": "Februar 2026", "saldo": -86979.20, "kumuliert": 356804, "hinweis": "Defizit durch Dezember-Puffer gedeckt"},
        {"monat": "Mai 2026", "saldo": -13744.20, "kumuliert": 385316, "hinweis": "Kleines Defizit in Auslaufphase"}
    ]
}

# Speichern
with open('/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases/Hausärztliche Versorgung PLUS eG/06-review/PLANUNG-V4.0-IV-TAUGLICH.json', 'w') as f:
    json.dump(planning, f, indent=2, ensure_ascii=False)

print("✅ Planung V4.0 erstellt!")
print(f"Gesamteinnahmen: {total_einnahmen:,.2f} EUR")
print(f"Gesamtausgaben: {total_ausgaben:,.2f} EUR")
print(f"Nettosaldo: {netto_saldo:,.2f} EUR")
