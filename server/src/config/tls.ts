import fs from 'fs';
import https from 'https';

export interface TlsConfig {
  cert: string | Buffer;
  key: string | Buffer;
}

/**
 * Load TLS configuration from environment variables
 * Returns null if HTTPS is not enabled or certificates are not available
 */
export function loadTlsConfig(certPath?: string, keyPath?: string): TlsConfig | null {
  if (!certPath || !keyPath) {
    return null;
  }

  try {
    // Check if files exist
    if (!fs.existsSync(certPath)) {
      throw new Error(`SSL certificate file not found: ${certPath}`);
    }

    if (!fs.existsSync(keyPath)) {
      throw new Error(`SSL key file not found: ${keyPath}`);
    }

    // Read certificate and key
    const cert = fs.readFileSync(certPath, 'utf8');
    const key = fs.readFileSync(keyPath, 'utf8');

    // Validate they're not empty
    if (!cert || cert.trim().length === 0) {
      throw new Error(`SSL certificate file is empty: ${certPath}`);
    }

    if (!key || key.trim().length === 0) {
      throw new Error(`SSL key file is empty: ${keyPath}`);
    }

    console.log(`Loaded TLS certificate from: ${certPath}`);
    console.log(`Loaded TLS key from: ${keyPath}`);

    return { cert, key };
  } catch (error) {
    console.error('Failed to load TLS configuration:', error);
    throw error;
  }
}

/**
 * Create HTTPS server options from TLS config
 */
export function createHttpsOptions(tlsConfig: TlsConfig): https.ServerOptions {
  return {
    cert: tlsConfig.cert,
    key: tlsConfig.key,
    // Additional security options
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    // Prefer server ciphers
    honorCipherOrder: true,
  };
}

/**
 * Generate self-signed certificate instructions for development
 */
export function getSelfSignedInstructions(): string {
  return `
To generate a self-signed certificate for development:

1. Using OpenSSL:
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

2. Set environment variables:
   export SSL_CERT_PATH=/path/to/cert.pem
   export SSL_KEY_PATH=/path/to/key.pem
   export ENABLE_HTTPS=true

3. For production, use Let's Encrypt:
   sudo certbot certonly --standalone -d yourdomain.com
   export SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
   export SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem

Note: Self-signed certificates will show security warnings in browsers.
For production, always use properly signed certificates from a trusted CA.
`;
}
