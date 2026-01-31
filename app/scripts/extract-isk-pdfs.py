#!/usr/bin/env python3
"""
ISK PDF Extraktor - BW-Bank Tagesauszüge
Extrahiert Transaktionen aus BW-Bank ISK PDFs und speichert sie als JSON.

Verwendung:
    python3 scripts/extract-isk-pdfs.py
"""

import os
import re
import json
from datetime import datetime
from pathlib import Path
import pdfplumber

# Pfade
CASES_ROOT = Path("/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases")
CASE_DIR = CASES_ROOT / "Hausärztliche Versorgung PLUS eG"
RAW_DIR = CASE_DIR / "01-raw/Hausärztliche Versorgung PLUS eG - DR/02 Hausärztliche Versorgung PLUS eG - Buchhaltung"
OUTPUT_DIR = CASE_DIR / "02-extracted"

# ISK Konten
ISK_ACCOUNTS = {
    "400080156": {
        "name": "ISK Uckerath",
        "iban": "DE91 6005 0101 0400 0801 56",
        "folder": "BW-Bank #400080156 (ISK) Uckerath"
    },
    "400080228": {
        "name": "ISK Velbert",
        "iban": "DE87 6005 0101 0400 0802 28",
        "folder": "BW-Bank #400080228 (ISK) Velbert"
    }
}

# LANR → Arzt Mapping
LANR_MAPPING = {
    "3892462": {"name": "Dr. van Suntum", "haevgid": "055425", "standort": "Velbert"},
    "8836735": {"name": "Dr. Beyer", "haevgid": "067026", "standort": "Velbert"},
    "7729639": {"name": "Dr. Kamler", "haevgid": "083974", "standort": "Velbert"},
    "8898288": {"name": "Dr. Rösing", "haevgid": "036131", "standort": "Eitorf"},
    "1445587": {"name": "Dr. Binas", "haevgid": "132025", "standort": "Uckerath"},
    "1203618": {"name": "Dr. Schweitzer", "haevgid": "132049", "standort": "Uckerath"},
    "3243603": {"name": "Anja Fischer", "haevgid": "132052", "standort": "Uckerath"},
    "4652451": {"name": "Verena Ludwig", "haevgid": "132064", "standort": "Uckerath"},
}


def parse_german_amount(amount_str):
    """Parse German number format (1.234,56) to float"""
    if not amount_str:
        return 0.0
    # Remove thousands separator and convert decimal comma
    cleaned = amount_str.replace(".", "").replace(",", ".").strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def extract_lanr(description):
    """Extract LANR and HAEVGID from HZV payment description"""
    # Pattern: HAEVGID 132052 LANR 3243603
    match = re.search(r'HAEVGID\s*(\d+)\s*LANR\s*(\d+)', description, re.IGNORECASE)
    if match:
        haevgid = match.group(1)
        lanr = match.group(2)
        arzt_info = LANR_MAPPING.get(lanr)
        return {
            "haevgid": haevgid,
            "lanr": lanr,
            "arzt": arzt_info["name"] if arzt_info else None,
            "standort": arzt_info["standort"] if arzt_info else None
        }
    return None


def categorize_transaction(description, counterparty, amount):
    """Kategorisiere Transaktion basierend auf Beschreibung"""
    desc_lower = description.lower()
    cp_lower = (counterparty or "").lower()

    # HZV
    if "hzv" in desc_lower or "havg" in cp_lower or "havg" in desc_lower:
        return "HZV"

    # KV
    if "kassenärztliche" in cp_lower or "kvno" in cp_lower or ("rate" in desc_lower and "/20" in desc_lower):
        return "KV"

    # PVS
    if "pvs" in cp_lower or "pvs" in desc_lower or "privatabrechnung" in desc_lower or "igel" in desc_lower:
        return "PVS"

    # DRV/Gutachten
    if "drv" in cp_lower or "drv" in desc_lower or "rentenversicherung" in desc_lower or "befundberichtsko" in desc_lower:
        return "GUTACHTEN"

    # Kreis/Amt
    if "kreis" in cp_lower or "landesoberkasse" in cp_lower:
        return "GUTACHTEN"

    # Sammelüberweisung (Auszahlung)
    if "sammelüberweisung" in desc_lower or "echtzeit-sammelüberweisung" in desc_lower:
        return "SAMMELUEBERWEISUNG"

    # Auskehrung Sparkasse
    if "auskehrung" in desc_lower or "massekreditvereinbarung" in desc_lower:
        return "AUSKEHRUNG_SPK"

    # Interne Umbuchung
    if "umbuchung" in desc_lower:
        return "INTERN"

    # Sonstige
    return "SONSTIGE"


def extract_pdf_text(pdf_path):
    """Extrahiere Transaktionen aus einem BW-Bank PDF mit Text-Parsing"""

    transactions = []
    metadata = {
        "sourceFile": pdf_path.name,
        "extractedAt": datetime.now().isoformat(),
        "account": {},
        "balances": {},
        "summary": {}
    }

    with pdfplumber.open(pdf_path) as pdf:
        full_text = ""
        for page in pdf.pages:
            text = page.extract_text() or ""
            full_text += text + "\n"

        # Extract metadata from header
        konto_match = re.search(r'Kontonummer\s+(\d+)', full_text)
        if konto_match:
            metadata["account"]["kontonummer"] = konto_match.group(1)

        iban_match = re.search(r'IBAN\s+(DE\d{2}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{2})', full_text)
        if iban_match:
            metadata["account"]["iban"] = iban_match.group(1)

        auszug_match = re.search(r'Auszug Nr\.\s*(\d+)', full_text)
        if auszug_match:
            metadata["statementNumber"] = int(auszug_match.group(1))

        datum_match = re.search(r'Kontoauszugsdatum\s+(\d{2}\.\d{2}\.\d{4})', full_text)
        if datum_match:
            metadata["statementDate"] = datum_match.group(1)

        anfang_match = re.search(r'Anfangssaldo\s+([\d.,]+)\s*EUR', full_text)
        if anfang_match:
            metadata["balances"]["opening"] = parse_german_amount(anfang_match.group(1))

        end_match = re.search(r'Endsaldo\s+([\d.,]+)\s*EUR', full_text)
        if end_match:
            metadata["balances"]["closing"] = parse_german_amount(end_match.group(1))

        # Parse transactions line by line
        # Pattern: DD.MM.YYYY DD.MM.YYYY description amount
        # The amount is at the end of the line
        lines = full_text.split('\n')

        current_tx = None
        description_lines = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Skip header/footer lines
            if any(skip in line for skip in ['Anfangsaldo (in EUR)', 'Endsaldo (in EUR)', 'Datum', 'Valuta',
                                               'Buchungsinformationen', 'Umsatz EUR', 'Seite', 'UC eBanking',
                                               'Version', 'UniCredit', 'Gedruckt', 'Erzeugt', 'Auszug Nr']):
                continue

            # Check if line starts with a date (DD.MM.YYYY)
            date_match = re.match(r'^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}\.\d{2}\.\d{4})\s+(.+)', line)

            if date_match:
                # Save previous transaction if exists
                if current_tx:
                    current_tx["description"] = " ".join(description_lines).strip()
                    transactions.append(current_tx)

                # Start new transaction
                datum = date_match.group(1)
                valuta = date_match.group(2)
                rest = date_match.group(3)

                # Try to extract amount from the end of the line
                # Amount pattern: -?1.234,56 or -?1234,56
                amount_match = re.search(r'(-?[\d.]+,\d{2})$', rest)
                if amount_match:
                    amount_str = amount_match.group(1)
                    description_part = rest[:rest.rfind(amount_str)].strip()
                    amount = parse_german_amount(amount_str)
                else:
                    description_part = rest
                    amount = 0.0

                current_tx = {
                    "date": datum,
                    "valueDate": valuta,
                    "amount": amount,
                    "counterparty": None
                }
                description_lines = [description_part] if description_part else []

            elif current_tx is not None:
                # Check if this line has an amount at the end (continuation with amount)
                amount_match = re.search(r'(-?[\d.]+,\d{2})$', line)
                if amount_match and current_tx["amount"] == 0.0:
                    amount_str = amount_match.group(1)
                    line_text = line[:line.rfind(amount_str)].strip()
                    current_tx["amount"] = parse_german_amount(amount_str)
                    if line_text:
                        description_lines.append(line_text)
                else:
                    # Add to description
                    description_lines.append(line)

        # Don't forget the last transaction
        if current_tx:
            current_tx["description"] = " ".join(description_lines).strip()
            transactions.append(current_tx)

    # Post-process transactions
    processed = []
    for tx in transactions:
        if tx["amount"] == 0.0:
            continue

        desc = tx["description"]

        # Extract counterparty - usually after IBAN pattern or specific names
        counterparty = None

        # Common counterparties
        if "HAVG" in desc:
            counterparty = "HAVG Hausärztliche Vertragsgemeinschaft AG"
        elif "PVS rhein-ruhr" in desc:
            counterparty = "PVS rhein-ruhr GmbH"
        elif "DRV" in desc or "Rentenversicherung" in desc:
            counterparty = "Deutsche Rentenversicherung"
        elif "Kreis Mettmann" in desc:
            counterparty = "Kreis Mettmann"
        elif "Landesoberkasse" in desc:
            counterparty = "Landesoberkasse"
        elif "Sparkasse" in desc or "WELADED1VEL" in desc:
            counterparty = "Sparkasse Hilden-Ratingen-Velbert"

        tx["counterparty"] = counterparty
        tx["category"] = categorize_transaction(desc, counterparty, tx["amount"])

        # Extract LANR for HZV
        lanr_info = extract_lanr(desc)
        if lanr_info:
            tx["lanr"] = lanr_info["lanr"]
            tx["haevgid"] = lanr_info["haevgid"]
            tx["arzt"] = lanr_info["arzt"]
            tx["standort"] = lanr_info["standort"]

        processed.append(tx)

    metadata["transactions"] = processed
    metadata["summary"]["transactionCount"] = len(processed)

    return metadata


def find_pdfs(account_folder):
    """Find all PDF files in the account folder structure"""
    pdfs = []
    if not account_folder.exists():
        print(f"Folder not found: {account_folder}")
        return pdfs

    for pdf_file in account_folder.rglob("*.pdf"):
        # Skip payment receipts (Zahlbeleg) and emails
        if "Zahlbeleg" in pdf_file.name or "eMail" in pdf_file.name:
            continue
        # Skip other non-statement PDFs
        if "Massekreditvertrag" in pdf_file.name or "Abrechnung" in pdf_file.name:
            continue
        # Only include statement PDFs (contain #number)
        if "#" in pdf_file.name and pdf_file.name.endswith(".pdf"):
            pdfs.append(pdf_file)

    return sorted(pdfs)


def main():
    print("=" * 60)
    print("ISK PDF Extraktor - BW-Bank Tagesauszüge")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    all_results = {}

    for account_id, account_info in ISK_ACCOUNTS.items():
        print(f"\n--- {account_info['name']} ({account_id}) ---")

        account_folder = RAW_DIR / account_info["folder"] / "Kontoauszüge"
        pdfs = find_pdfs(account_folder)

        print(f"Gefunden: {len(pdfs)} PDFs")

        account_transactions = []

        for pdf_path in pdfs:
            try:
                result = extract_pdf_text(pdf_path)
                tx_count = len(result.get('transactions', []))
                print(f"  {pdf_path.name}: {tx_count} Transaktionen")

                # Add account info to each transaction
                for tx in result.get("transactions", []):
                    tx["iskAccount"] = account_id
                    tx["iskName"] = account_info["name"]
                    tx["sourceFile"] = pdf_path.name
                    account_transactions.append(tx)

            except Exception as e:
                print(f"  FEHLER bei {pdf_path.name}: {e}")
                import traceback
                traceback.print_exc()

        all_results[account_id] = {
            "account": account_info,
            "pdfCount": len(pdfs),
            "transactions": account_transactions
        }

    # Group by month and save
    for account_id, data in all_results.items():
        by_month = {}
        for tx in data["transactions"]:
            date_str = tx.get("date", "")
            if date_str:
                try:
                    dt = datetime.strptime(date_str, "%d.%m.%Y")
                    month_key = dt.strftime("%Y-%m")
                    if month_key not in by_month:
                        by_month[month_key] = []
                    by_month[month_key].append(tx)
                except:
                    pass

        account_name = "Uckerath" if account_id == "400080156" else "Velbert"

        for month, txs in sorted(by_month.items()):
            # Calculate totals
            total_in = sum(t["amount"] for t in txs if t["amount"] > 0)
            total_out = sum(t["amount"] for t in txs if t["amount"] < 0)

            output = {
                "sourceFile": f"ISK_{account_name}_{month}.json",
                "extractedAt": datetime.now().isoformat(),
                "extractionMethod": "pdfplumber text extraction",
                "account": {
                    "name": data["account"]["name"],
                    "kontonummer": account_id,
                    "iban": data["account"]["iban"],
                    "bank": "BW Bank"
                },
                "period": {
                    "month": month,
                    "from": f"{month}-01",
                    "to": f"{month}-31"
                },
                "summary": {
                    "transactionCount": len(txs),
                    "totalInflows": round(total_in, 2),
                    "totalOutflows": round(total_out, 2),
                    "netChange": round(total_in + total_out, 2)
                },
                "transactions": sorted(txs, key=lambda x: x.get("date", ""))
            }

            # Save JSON
            output_file = OUTPUT_DIR / f"ISK_{account_name}_{month}.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(output, f, ensure_ascii=False, indent=2)

            print(f"\nGespeichert: {output_file.name}")
            print(f"  Transaktionen: {len(txs)}")
            print(f"  Einnahmen: {total_in:,.2f} EUR")
            print(f"  Ausgaben: {total_out:,.2f} EUR")

    print("\n" + "=" * 60)
    print("Extraktion abgeschlossen!")
    print("=" * 60)


if __name__ == "__main__":
    main()
