# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of MySQL MCP WebUI seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please Do NOT:

- Open a public GitHub issue for security vulnerabilities
- Discuss the vulnerability in public forums, social media, or mailing lists

### Please DO:

1. **Report privately** via one of these methods:
   - Open a [GitHub Security Advisory](https://github.com/yashagldit/mysql-mcp-webui/security/advisories/new)
   - Email the maintainers directly (if email is provided in the repository)

2. **Include the following information:**
   - Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
   - Full paths of source file(s) related to the vulnerability
   - Location of the affected source code (tag/branch/commit or direct URL)
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the issue, including how an attacker might exploit it

3. **Allow time for a fix:**
   - We will acknowledge receipt of your vulnerability report within 48 hours
   - We will provide a more detailed response within 7 days
   - We will work on a fix and aim to release it as soon as possible
   - We will keep you informed of our progress

## Security Best Practices

When using MySQL MCP WebUI, we recommend the following security practices:

### 1. Authentication & Access Control

- **Protect your API keys**: Store API keys securely and never commit them to version control
- **Rotate API keys regularly**: Use the built-in key rotation feature
- **Use HTTPS in production**: Always use HTTPS when deploying the HTTP server
- **Limit network access**: Use firewalls to restrict access to the server

### 2. Database Credentials

- **Master key security**: The `data/master.key` file contains the encryption key for database passwords
  - Keep this file secure and backed up
  - Never commit it to version control
  - Restrict file permissions (chmod 600)
- **Use least privilege**: Configure MySQL users with minimal required permissions
- **Strong passwords**: Use strong, unique passwords for MySQL connections

### 3. Permission Management

- **Principle of least privilege**: Grant only necessary SQL permissions per database
- **Review permissions regularly**: Audit database permissions periodically
- **Separate environments**: Use different connections for development, staging, and production

### 4. Network Security

- **Localhost binding**: In development, bind to localhost (127.0.0.1) only
- **Reverse proxy**: Use a reverse proxy (nginx, Apache) in production for additional security
- **Rate limiting**: Implement rate limiting to prevent abuse
- **CORS configuration**: Configure CORS appropriately for your use case

### 5. Data Protection

- **Backup master key**: Losing the master key means losing access to encrypted passwords
- **Database backups**: Regularly backup the SQLite configuration database
- **Audit logs**: Review request logs regularly for suspicious activity

### 6. Deployment

- **Environment variables**: Use environment variables for sensitive configuration
- **Secure defaults**: Change default ports and tokens in production
- **Update regularly**: Keep dependencies and the application updated
- **Monitor for vulnerabilities**: Subscribe to security advisories

## Known Security Considerations

### SQL Injection Protection

- All queries use parameterized queries via mysql2 to prevent SQL injection
- User-provided SQL is parsed and validated before execution
- Queries run in transactions with automatic rollback on error

### Authentication

- Token-based authentication using constant-time comparison to prevent timing attacks
- API keys stored hashed in the database
- Support for multiple API keys with individual activation

### Encryption

- Database passwords encrypted at rest using AES-256-GCM
- Master encryption key stored in `data/master.key`
- Secure random key generation using Node.js crypto module

### Permission Validation

- SQL queries validated against per-database permissions before execution
- Query type detection using node-sql-parser
- Support for 8 operation types: SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE

## Security Features

- **AES-256-GCM encryption** for database passwords
- **Token-based authentication** for all API and MCP requests
- **Permission validation** before query execution
- **Transaction support** with automatic rollback
- **SQL injection prevention** via parameterized queries
- **Constant-time comparison** for token verification
- **Request/response logging** for audit trails
- **Multi-API key system** for better access control

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find similar problems
3. Prepare fixes for all supported versions
4. Release new versions and publish security advisory
5. Credit the reporter (unless they prefer to remain anonymous)

## Comments on this Policy

If you have suggestions on how this process could be improved, please submit a pull request or open an issue.

---

Thank you for helping keep MySQL MCP WebUI and its users safe!
