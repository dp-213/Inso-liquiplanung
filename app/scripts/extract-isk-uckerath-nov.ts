/**
 * ISK Uckerath November 2025 - Manuelle Extraktion mit Zero-Toleranz
 *
 * Ich (Claude) lese alle 11 PDFs, extrahiere die Daten und
 * erstelle ein verified JSON mit eingebauter Saldoprüfung.
 */
import * as fs from 'fs';
import * as path from 'path';

const CASES_ROOT = '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases';
const PDF_DIR = path.join(
  CASES_ROOT,
  'Hausärztliche Versorgung PLUS eG',
  '01-raw',
  'Hausärztliche Versorgung PLUS eG - DR',
  '02 Hausärztliche Versorgung PLUS eG - Buchhaltung',
  'BW-Bank #400080156 (ISK) Uckerath',
  'Kontoauszüge',
  '2025',
  '11.2025'
);

const OUTPUT_PATH = path.join(
  CASES_ROOT,
  'Hausärztliche Versorgung PLUS eG',
  '02-extracted',
  'ISK_Uckerath_2025-11_VERIFIED.json'
);

console.log('Dieses Script ist ein Template.');
console.log('Ich (Claude) werde die PDFs manuell lesen und die Daten hier eintragen.');
console.log('');
console.log('PDF-Verzeichnis:', PDF_DIR);
console.log('Output:', OUTPUT_PATH);
console.log('');
console.log('Nächster Schritt: Ich lese jetzt alle 11 PDFs einzeln und extrahiere die Daten.');
