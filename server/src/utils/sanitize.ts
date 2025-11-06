/**
 * Sanitization utilities for logging
 * Prevents sensitive data exposure in request/response logs
 */

/**
 * Sanitize sensitive data before logging
 * Redacts passwords, API keys, tokens, and limits result size
 */
export function sanitizeForLogging(data: any, maxLength: number = 10000): any {
  if (!data) return data;

  try {
    // Clone the data to avoid modifying the original
    const sanitized = JSON.parse(JSON.stringify(data));

    // List of sensitive field names to redact
    const sensitiveKeys = [
      'password',
      'apiKey',
      'api_key',
      'token',
      'key',
      'secret',
      'authorization',
      'auth',
      'currentPassword',
      'newPassword',
      'confirmPassword',
      'password_hash',
      'encrypted',
      'iv',
      'authTag',
    ];

    // Recursively redact sensitive fields
    function redactSensitive(obj: any, depth: number = 0): any {
      // Prevent deep recursion
      if (depth > 10) return '[MAX_DEPTH]';

      if (Array.isArray(obj)) {
        // Limit array size in logs
        if (obj.length > 100) {
          return [...obj.slice(0, 100).map(item => redactSensitive(item, depth + 1)), `[...${obj.length - 100} more items]`];
        }
        return obj.map(item => redactSensitive(item, depth + 1));
      } else if (obj && typeof obj === 'object') {
        const redacted: any = {};
        for (const key in obj) {
          // Check if key name contains sensitive terms
          const isSensitive = sensitiveKeys.some(sk =>
            key.toLowerCase().includes(sk.toLowerCase())
          );

          if (isSensitive) {
            redacted[key] = '[REDACTED]';
          } else if (typeof obj[key] === 'string' && obj[key].length > 1000) {
            // Truncate long strings
            redacted[key] = obj[key].substring(0, 1000) + '... [TRUNCATED]';
          } else if (typeof obj[key] === 'object') {
            redacted[key] = redactSensitive(obj[key], depth + 1);
          } else {
            redacted[key] = obj[key];
          }
        }
        return redacted;
      }
      return obj;
    }

    const redacted = redactSensitive(sanitized);

    // Convert to string and limit total size
    let result = JSON.stringify(redacted);
    if (result.length > maxLength) {
      result = result.substring(0, maxLength) + '... [TRUNCATED]';
      // Try to parse back to keep it as valid JSON-ish
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }

    return redacted;
  } catch (error) {
    // If sanitization fails, return a safe placeholder
    return { error: 'Failed to sanitize data for logging' };
  }
}
