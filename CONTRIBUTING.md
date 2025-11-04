# Contributing to MySQL MCP WebUI

Thank you for your interest in contributing to MySQL MCP WebUI! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Project Architecture](#project-architecture)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mysql-mcp-webui.git
   cd mysql-mcp-webui
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/yashagldit/mysql-mcp-webui.git
   ```

## Development Setup

### Prerequisites

- Node.js 20.0.0 or higher
- npm (comes with Node.js)
- MySQL server for testing (optional but recommended)

### Installation

```bash
# Install all dependencies (server + client)
npm install

# Build the project
npm run build
```

### Running in Development Mode

```bash
# Run both server and client in watch mode
npm run dev

# Or run separately:
npm run dev:server  # Backend on port 3000
npm run dev:client  # Frontend on port 5173
```

### Environment Setup

Create a `.env` file in the server directory if needed:

```env
TRANSPORT=http
HTTP_PORT=3000
NODE_ENV=development
```

## Making Changes

### Creating a Branch

Always create a new branch for your changes:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests

### Commit Messages

Write clear, descriptive commit messages:

```
type(scope): brief description

Longer description if needed...

Fixes #123
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(api): add endpoint for bulk database operations
fix(query-executor): handle connection timeout gracefully
docs(readme): update installation instructions
```

## Pull Request Process

1. **Update your branch** with the latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure all tests pass** and code builds successfully:
   ```bash
   npm run build
   # npm test (when tests are available)
   ```

3. **Update documentation** if you've changed APIs or added features

4. **Create a pull request** with:
   - Clear title describing the change
   - Description of what changed and why
   - Reference to any related issues
   - Screenshots/demos for UI changes

5. **Respond to review feedback** promptly and professionally

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues
Fixes #(issue number)

## Testing
Describe how you tested your changes

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Use explicit types, avoid `any` when possible
- Use type-only imports: `import type { Type } from 'module'`

### Backend (Node.js)

- Use async/await instead of callbacks
- Use Zod for request validation
- Always use try-catch blocks for error handling
- Access data through singleton managers (DatabaseManager, ConnectionManager)
- Use descriptive error messages
- Follow existing patterns for route handlers and middleware

Example:
```typescript
export async function handler(req: Request, res: Response) {
  try {
    const dbManager = getDatabaseManager();
    const result = await dbManager.getSomething();

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

### Frontend (React)

- Use functional components with hooks
- Use React Query for server state management
- Use Context API for client state
- Use TailwindCSS utility classes for styling
- Keep components small and focused
- Extract reusable logic into custom hooks

Example:
```typescript
export function MyComponent() {
  const { data, isLoading } = useConnections();

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-4">
      {data?.map(item => (
        <Item key={item.id} data={item} />
      ))}
    </div>
  );
}
```

### Code Formatting

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Max line length: 100 characters
- Add trailing commas in multi-line objects/arrays

## Project Architecture

Please read [CLAUDE.md](CLAUDE.md) for detailed architectural information including:

- Singleton database managers pattern
- Dual transport MCP server
- Query execution flow
- Security architecture
- Key files and their purposes

### Key Principles

1. **Singleton Managers**: Always use `getDatabaseManager()` and `getConnectionManager()`
2. **Transaction-Based Queries**: All queries execute in transactions
3. **Permission Validation**: Validate permissions before query execution
4. **Encrypted Passwords**: All MySQL passwords encrypted at rest
5. **Token Authentication**: All API/MCP requests require authentication

## Testing

### Running Tests

```bash
# Run all tests (when available)
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Writing Tests

- Write unit tests for utility functions
- Write integration tests for API endpoints
- Write E2E tests for critical user flows
- Mock external dependencies (MySQL, etc.)
- Use descriptive test names

Example:
```typescript
describe('QueryExecutor', () => {
  it('should execute SELECT query successfully', async () => {
    const executor = new QueryExecutor(mockConnection);
    const result = await executor.executeQuery('SELECT 1');
    expect(result.success).toBe(true);
  });

  it('should rollback on query error', async () => {
    // Test implementation
  });
});
```

## Documentation

### Code Documentation

- Add JSDoc comments for functions, classes, and complex logic
- Explain "why" not "what" in comments
- Keep comments up-to-date with code changes

Example:
```typescript
/**
 * Executes a SQL query within a transaction context.
 * Automatically rolls back on error to maintain data integrity.
 *
 * @param sql - The SQL query to execute
 * @param params - Optional query parameters
 * @returns Query results with metadata
 * @throws {QueryExecutionError} If query validation or execution fails
 */
async executeQuery(sql: string, params?: any[]): Promise<QueryResult> {
  // Implementation
}
```

### README and Guides

- Update README.md if you change features or setup process
- Add examples for new features
- Update API documentation for new endpoints
- Keep CLAUDE.md updated with architectural changes

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Check existing issues and discussions first

## Recognition

Contributors will be recognized in the project README and release notes.

Thank you for contributing to MySQL MCP WebUI!
