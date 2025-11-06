/**
 * Environment configuration module
 * Centralizes and validates all environment variables
 */

import crypto from 'crypto';

// Cache for environment config to prevent regenerating JWT secret
let cachedConfig: EnvironmentConfig | null = null;

export interface EnvironmentConfig {
  // Transport
  transport: 'stdio' | 'http';

  // HTTP Server
  httpPort: number;

  // Security
  enableHttps: boolean;
  sslCertPath?: string;
  sslKeyPath?: string;

  // Rate Limiting
  rateLimitEnabled: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;

  // Environment
  nodeEnv: 'development' | 'production';

  // Authentication (stdio mode)
  authToken?: string;

  // JWT Authentication (for user login)
  jwtSecret: string;
  jwtExpiresIn: string;
}

/**
 * Load and validate environment configuration
 */
export function loadEnvironment(): EnvironmentConfig {
  // Return cached config if already loaded (prevents JWT regeneration)
  if (cachedConfig) {
    return cachedConfig;
  }

  const nodeEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const transport = (process.env.TRANSPORT || 'http') as 'stdio' | 'http';

  // Validate transport
  if (transport !== 'stdio' && transport !== 'http') {
    throw new Error(`Invalid TRANSPORT value: ${transport}. Must be 'stdio' or 'http'`);
  }

  // HTTP configuration
  const httpPort = parseInt(process.env.HTTP_PORT || '9274', 10);
  if (isNaN(httpPort) || httpPort < 1 || httpPort > 65535) {
    throw new Error(`Invalid HTTP_PORT value: ${process.env.HTTP_PORT}. Must be a number between 1 and 65535`);
  }

  // HTTPS configuration
  const enableHttps = process.env.ENABLE_HTTPS === 'true';
  let sslCertPath: string | undefined;
  let sslKeyPath: string | undefined;

  if (enableHttps) {
    sslCertPath = process.env.SSL_CERT_PATH;
    sslKeyPath = process.env.SSL_KEY_PATH;

    if (!sslCertPath || !sslKeyPath) {
      if (nodeEnv === 'production') {
        throw new Error('SSL_CERT_PATH and SSL_KEY_PATH are required when ENABLE_HTTPS is true in production');
      } else {
        console.warn('Warning: HTTPS enabled but SSL_CERT_PATH or SSL_KEY_PATH not provided. HTTPS will be disabled.');
      }
    }
  }

  // Rate limiting configuration
  const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false'; // enabled by default
  const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
  const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

  if (isNaN(rateLimitWindowMs) || rateLimitWindowMs < 1000) {
    throw new Error(`Invalid RATE_LIMIT_WINDOW_MS value: ${process.env.RATE_LIMIT_WINDOW_MS}. Must be at least 1000ms`);
  }

  if (isNaN(rateLimitMaxRequests) || rateLimitMaxRequests < 1) {
    throw new Error(`Invalid RATE_LIMIT_MAX_REQUESTS value: ${process.env.RATE_LIMIT_MAX_REQUESTS}. Must be at least 1`);
  }

  // Authentication token (required for stdio mode)
  const authToken = process.env.AUTH_TOKEN;

  if (transport === 'stdio' && !authToken) {
    throw new Error('AUTH_TOKEN environment variable is required for stdio mode');
  }

  // JWT configuration (required for user authentication in HTTP mode only)
  // Default development secret (32+ characters) - NOT FOR PRODUCTION
  const DEFAULT_DEV_JWT_SECRET = '4DCbCP6qf/KAj3av7Q1vywjOuqZtK862HsOwrP6w0Go=';

  let jwtSecret: string = process.env.JWT_SECRET || '';
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

  // JWT is only needed for HTTP mode (WebUI authentication)
  // stdio mode uses AUTH_TOKEN (API key) for authentication
  if (transport === 'http' && !jwtSecret) {
    if (nodeEnv === 'production') {
      // Auto-generate a secure random JWT secret for production
      // Note: This will be different each time the server restarts
      jwtSecret = crypto.randomBytes(32).toString('base64');
      console.warn('⚠️  Warning: No JWT_SECRET provided. Auto-generated a random secret.');
      console.warn('   This secret will change on server restart, logging out all users.');
      console.warn('   For persistent sessions, set JWT_SECRET environment variable.');
      console.warn(`   Generated secret: ${jwtSecret}`);
    } else {
      console.warn('⚠️  Warning: Using default JWT_SECRET for development. DO NOT use this in production!');
      console.warn('   Set JWT_SECRET environment variable to a secure random string.');
      jwtSecret = DEFAULT_DEV_JWT_SECRET;
    }
  }

  // Use default for stdio mode (not used, but required by interface)
  if (transport === 'stdio' && !jwtSecret) {
    jwtSecret = DEFAULT_DEV_JWT_SECRET;
  }

  if (jwtSecret.length > 0 && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }

  // Cache the config to prevent regenerating JWT secret on subsequent calls
  cachedConfig = {
    transport,
    httpPort,
    enableHttps: enableHttps && !!sslCertPath && !!sslKeyPath,
    sslCertPath,
    sslKeyPath,
    rateLimitEnabled,
    rateLimitWindowMs,
    rateLimitMaxRequests,
    nodeEnv,
    authToken,
    jwtSecret,
    jwtExpiresIn,
  };

  return cachedConfig;
}

/**
 * Get a summary of the current configuration (for logging)
 */
export function getConfigSummary(config: EnvironmentConfig): string {
  const lines = [
    '='.repeat(50),
    'Environment Configuration',
    '='.repeat(50),
    `Environment: ${config.nodeEnv}`,
    `Transport: ${config.transport}`,
  ];

  if (config.transport === 'http') {
    lines.push(`HTTP Port: ${config.httpPort}`);
    lines.push(`HTTPS Enabled: ${config.enableHttps}`);
    if (config.enableHttps) {
      lines.push(`SSL Cert: ${config.sslCertPath}`);
      lines.push(`SSL Key: ${config.sslKeyPath}`);
    }
    lines.push(`Rate Limiting: ${config.rateLimitEnabled ? 'Enabled' : 'Disabled'}`);
    if (config.rateLimitEnabled) {
      lines.push(`  Window: ${config.rateLimitWindowMs}ms (${config.rateLimitWindowMs / 1000}s)`);
      lines.push(`  Max Requests: ${config.rateLimitMaxRequests}`);
    }
  } else {
    lines.push(`Auth Token: ${config.authToken ? '***' + config.authToken.slice(-4) : 'Not set'}`);
  }

  lines.push(`JWT Enabled: Yes`);
  lines.push(`JWT Secret: ***${config.jwtSecret.slice(-4)}`);
  lines.push(`JWT Expires In: ${config.jwtExpiresIn}`);
  lines.push('='.repeat(50));

  return lines.join('\n');
}
