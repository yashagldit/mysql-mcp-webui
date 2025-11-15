/**
 * Converts query results to TOON (Token-Oriented Object Notation) format v2.0
 * Spec: https://github.com/toon-format/spec
 *
 * Uses the official @toon-format/toon library for proper handling of:
 * - Nested objects with indentation-based encoding
 * - Dotted-key folding for single-key chains
 * - Arrays with TOON array notation
 * - Recursive depth-based formatting
 */

import { encode } from '@toon-format/toon';

/**
 * Converts data to TOON format using the official library
 */
export function toToonFormat(data: any): string {
  return encode(data);
}

/**
 * Formats query execution results in TOON format
 */
export function formatQueryResultAsToon(result: {
  rows: any[];
  rowsAffected: number;
  fields?: any[];
}): string {
  if (result.rows.length === 0) {
    return `Query executed successfully.\nRows affected: ${result.rowsAffected}\n\nNo rows returned.`;
  }

  const toonData = toToonFormat(result.rows);

  return `Query executed successfully.\nRows affected: ${result.rowsAffected}\n\n${toonData}`;
}
