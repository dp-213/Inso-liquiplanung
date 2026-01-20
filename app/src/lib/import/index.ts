/**
 * Import Module
 *
 * ARCHITEKTUR:
 * Excel/CSV → ImportContext.raw → ImportContext.normalized → Rule Engine → LedgerEntry
 *
 * - raw: Original Excel/CSV Spalten (variabel)
 * - normalized: Stabile fachliche Keys (standort, counterpartyHint, etc.)
 * - Rules arbeiten NUR auf normalized
 * - LedgerEntry erhält nur Ergebnisse (IDs), keine Rohdaten
 */

export * from './normalized-schema';
export * from './rule-engine';
