/**
 * Converts query results to TOON (Token-Oriented Object Notation) format v2.0
 * Spec: https://github.com/toon-format/spec
 *
 * TOON Format for tabular arrays:
 * [count]{field1,field2,field3}:
 *  value1,value2,value3
 *  value4,value5,value6
 */

const RESERVED_WORDS = new Set(['true', 'false', 'null']);

/**
 * Checks if a string needs to be quoted per TOON spec
 */
function needsQuoting(value: string, delimiter: string = ','): boolean {
  // Empty string needs quotes
  if (value.length === 0) return true;

  // Contains the active delimiter
  if (value.includes(delimiter)) return true;

  // Matches reserved words
  if (RESERVED_WORDS.has(value.toLowerCase())) return true;

  // Matches numeric pattern (simple check for numbers)
  if (/^-?\d+(\.\d+)?$/.test(value)) return true;

  // Contains newlines or carriage returns
  if (value.includes('\n') || value.includes('\r')) return true;

  // Starts or ends with whitespace
  if (value.trimStart() !== value || value.trimEnd() !== value) return true;

  // Contains characters that need escaping
  if (value.includes('"') || value.includes('\\')) return true;

  return false;
}

/**
 * Escapes a string value per TOON spec
 * Valid escapes: \\, \", \n, \r, \t
 */
function escapeString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')   // Backslash
    .replace(/"/g, '\\"')      // Double quote
    .replace(/\n/g, '\\n')     // Newline
    .replace(/\r/g, '\\r')     // Carriage return
    .replace(/\t/g, '\\t');    // Tab
}

/**
 * Normalizes a number to canonical form per TOON spec
 * - No exponent notation (1e6 → 1000000)
 * - No leading zeros except "0"
 * - No trailing fractional zeros (1.5000 → 1.5)
 * - -0 normalizes to 0
 */
function normalizeNumber(num: number): string {
  // Handle -0
  if (Object.is(num, -0)) return '0';

  // Handle integers
  if (Number.isInteger(num)) {
    return num.toString();
  }

  // For decimals, use toString() which provides reasonable precision
  // then remove trailing zeros
  let str = num.toString();

  // If toString() used exponential notation, convert it
  if (str.includes('e')) {
    // Use toPrecision to get full number without exponent
    // JavaScript numbers have ~15-17 digits of precision
    str = num.toPrecision(15);
  }

  // Remove trailing zeros after decimal point
  if (str.includes('.')) {
    str = str.replace(/\.?0+$/, '');
  }

  return str;
}

/**
 * Formats a value for TOON output
 */
function formatValue(value: any, delimiter: string = ','): string {
  // Handle null
  if (value === null || value === undefined) {
    return 'null';
  }

  // Handle boolean
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  // Handle number
  if (typeof value === 'number') {
    return normalizeNumber(value);
  }

  // Handle string
  const str = String(value);

  if (needsQuoting(str, delimiter)) {
    return `"${escapeString(str)}"`;
  }

  return str;
}

/**
 * Converts an array of objects to TOON tabular format
 * Returns root-level array format: [count]{field1,field2}:
 */
export function toToonFormat(data: any[], delimiter: string = ','): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '[0]{}:';
  }

  // Get field names from first object
  const fields = Object.keys(data[0]);
  const count = data.length;

  // Build header: [count]{field1,field2,field3}:
  const header = `[${count}]{${fields.join(',')}}:`;

  // Build rows (each row indented with one space)
  const rows = data.map(row => {
    const values = fields.map(field => formatValue(row[field], delimiter));
    return ' ' + values.join(delimiter);
  });

  return header + '\n' + rows.join('\n');
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
