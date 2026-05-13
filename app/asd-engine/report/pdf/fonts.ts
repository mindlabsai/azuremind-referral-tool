/**
 * Texlex PDFs use built-in Helvetica families from `styles.ts` (no remote font loading).
 * Previously this file registered Inter from Google Fonts; fontkit subsetting could emit
 * glyph metrics outside pdfkit's ±1e21 numeric range and crash export with "unsupported number".
 */

export {};
