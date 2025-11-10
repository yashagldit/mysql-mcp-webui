/**
 * Alias validation utility for database aliases
 */

export interface AliasValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates an alias string against the following rules:
 * - Min length: 1 character
 * - Max length: 64 characters
 * - Allowed chars: alphanumeric, underscore, hyphen
 * - Cannot start with a number
 * - Case-insensitive uniqueness (handled by caller)
 */
export function validateAlias(alias: string): AliasValidationResult {
  // Check if alias is empty or only whitespace
  if (!alias || alias.trim().length === 0) {
    return {
      valid: false,
      error: 'Alias cannot be empty',
    };
  }

  // Trim the alias
  const trimmed = alias.trim();

  // Check minimum length
  if (trimmed.length < 1) {
    return {
      valid: false,
      error: 'Alias must be at least 1 character long',
    };
  }

  // Check maximum length
  if (trimmed.length > 64) {
    return {
      valid: false,
      error: 'Alias must be at most 64 characters long',
    };
  }

  // Check if starts with a number
  if (/^\d/.test(trimmed)) {
    return {
      valid: false,
      error: 'Alias cannot start with a number',
    };
  }

  // Check allowed characters (alphanumeric, underscore, hyphen)
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Alias can only contain letters, numbers, underscores, and hyphens',
    };
  }

  return {
    valid: true,
  };
}

/**
 * Generate a unique alias from a base name
 * @param baseName The base name to generate alias from (e.g., database name)
 * @param existingAliases Set of existing aliases to check uniqueness against
 * @returns A unique alias
 */
export function generateUniqueAlias(baseName: string, existingAliases: Set<string>): string {
  // Start with the base name (converted to lowercase for case-insensitive check)
  let alias = baseName;
  let counter = 2;

  // Keep incrementing counter until we find a unique alias
  while (existingAliases.has(alias.toLowerCase())) {
    alias = `${baseName}_${counter}`;
    counter++;
  }

  return alias;
}

/**
 * Normalize alias for case-insensitive comparison
 */
export function normalizeAlias(alias: string): string {
  return alias.toLowerCase().trim();
}
