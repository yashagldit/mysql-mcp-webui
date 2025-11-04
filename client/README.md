# MySQL MCP WebUI - Frontend

A modern React-based web interface for managing MySQL MCP server configuration.

## 🎉 Features

### ✅ **Core Features**
- **Dashboard**: Overview of connections, databases, and server status
- **Connection Management**: Full CRUD operations for MySQL connections
- **Database Management**: View and manage databases with permission controls
- **Query Tester**: Execute SQL queries with Monaco Editor
- **API Keys Management** (v2.0): Create and manage multiple authentication keys
- **Request Logs** (v2.0): View and analyze API request history with statistics
- **Settings**: Server configuration and MCP client setup instructions

### 🎨 **UI Components**
- 10 reusable common components (Button, Input, Modal, Card, Table, etc.)
- Responsive layout with header and sidebar navigation
- Modern design with TailwindCSS
- Loading states, error handling, and success notifications
- Dark mode ready (coming soon)

### 🔧 **Technical Features**
- TypeScript for type safety
- React Query for efficient data fetching and caching
- Axios-based API client with interceptors
- Protected routes with authentication
- Real-time active state updates
- Form validation and error handling

## 📁 Project Structure

```
client/
├── src/
│   ├── api/
│   │   └── client.ts              # Axios API client (30+ endpoints)
│   ├── components/
│   │   ├── Auth/                  # Authentication (4 files)
│   │   ├── Common/                # Reusable UI (11 files)
│   │   ├── Layout/                # Layout components (4 files)
│   │   ├── Connections/           # Connection management (5 files)
│   │   ├── Databases/             # Database management (4 files)
│   │   ├── Query/                 # SQL query tester (4 files)
│   │   ├── ApiKeys/               # API key management (5 files)
│   │   ├── Logs/                  # Request logs viewer (5 files)
│   │   └── Settings/              # Settings & config (3 files)
│   ├── hooks/                     # React Query hooks (6 files)
│   ├── lib/
│   │   └── utils.ts               # Helper functions
│   ├── pages/                     # Page components (7 files)
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   ├── App.tsx                    # Main app with routing
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Global styles
├── public/                        # Built assets (production)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── package.json
```

**Total Files**: 64 TypeScript files

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development

The development server runs on [http://localhost:5173](http://localhost:5173) with hot module replacement.

API requests are proxied to `http://localhost:3000` (backend server).

### Building

```bash
npm run build
```

This command:
1. Compiles TypeScript (`tsc`)
2. Builds production assets with Vite
3. Outputs to `../server/public/` for serving

**Production Build Size**:
- JavaScript: ~343 KB (106 KB gzipped)
- CSS: ~23 KB (4.6 KB gzipped)

## 🎯 Page Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Dashboard | Overview & stats |
| `/auth` | AuthPage | Authentication |
| `/connections` | ConnectionsPage | Manage MySQL connections |
| `/databases` | DatabasesPage | View & manage databases |
| `/permissions` | DatabasesPage | Configure permissions (alias) |
| `/query` | QueryPage | Execute SQL queries |
| `/api-keys` | ApiKeysPage | Manage API keys (v2.0) |
| `/logs` | LogsPage | View request logs (v2.0) |
| `/settings` | SettingsPage | Server settings & MCP config |

## 🔑 Authentication

The app uses API key authentication with the following flow:

1. User enters API key on `/auth` page
2. Key is validated against backend
3. On success, key is stored in localStorage
4. All subsequent API requests include the key in the `Authorization` header
5. Protected routes redirect to `/auth` if not authenticated

## 📡 API Integration

The API client ([src/api/client.ts](src/api/client.ts)) provides methods for all backend endpoints:

### Connection Endpoints
- `getConnections()`, `createConnection()`, `updateConnection()`
- `deleteConnection()`, `testConnection()`, `activateConnection()`
- `discoverDatabases()`

### Database Endpoints
- `getDatabases()`, `activateDatabase()`, `updatePermissions()`

### Query Endpoints
- `executeQuery()`

### Settings Endpoints
- `getSettings()`, `getActiveState()`, `getHealth()`

### API Key Endpoints (v2.0)
- `getApiKeys()`, `createApiKey()`, `updateApiKey()`
- `revokeApiKey()`, `getApiKeyLogs()`

### Logs Endpoints (v2.0)
- `getLogs()`, `getLogsStats()`, `clearOldLogs()`

## 🎨 Component Library

### Common Components

| Component | Purpose |
|-----------|---------|
| Button | Styled button with variants and loading states |
| Input | Form input with label, error, and helper text |
| Modal | Responsive modal dialog |
| Toggle | Switch/toggle component |
| Badge | Status badge with color variants |
| Card | Container card with padding options |
| Table | Generic data table with sorting |
| CodeBlock | Syntax-highlighted code display with copy |
| Alert | Alert/notification with types |
| Spinner | Loading spinner |

### Usage Example

```tsx
import { Button, Modal, Input, Alert } from '@/components/Common';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="primary">
        Open Modal
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="My Modal">
        <Alert type="info">This is an alert!</Alert>
        <Input label="Name" placeholder="Enter name" />
      </Modal>
    </>
  );
}
```

## 🔄 State Management

Using **React Query** for server state:
- Automatic caching and background refetching
- Optimistic updates
- Query invalidation on mutations
- Loading and error states

### Example Hook Usage

```tsx
import { useConnections, useCreateConnection } from '@/hooks/useConnections';

function ConnectionList() {
  const { data: connections, isLoading } = useConnections();
  const createMutation = useCreateConnection();

  const handleCreate = async (data) => {
    await createMutation.mutateAsync(data);
    // Query automatically refetches
  };

  return (
    // ...
  );
}
```

## 🎭 Styling

Using **TailwindCSS** for styling:
- Utility-first CSS framework
- Responsive design with breakpoints
- Custom color palette
- Consistent spacing and typography

Theme colors configured in `tailwind.config.js`.

## 📦 Dependencies

### Production
- **react** ^18.3.1 - UI library
- **react-router-dom** ^7.1.1 - Routing
- **@tanstack/react-query** ^5.62.8 - Data fetching
- **axios** ^1.7.9 - HTTP client
- **lucide-react** ^0.468.0 - Icons
- **@monaco-editor/react** ^4.6.0 - SQL editor

### Development
- **vite** ^6.0.5 - Build tool
- **typescript** ^5.7.2 - Type checking
- **tailwindcss** ^3.4.17 - Styling
- **eslint** ^9.17.0 - Linting
- **prettier** ^3.4.2 - Code formatting

## 🧪 Testing

(Coming soon)

```bash
npm run test
npm run test:coverage
```

## 📝 Environment Variables

Development mode uses proxy configuration in `vite.config.ts`.

Production mode expects the backend at the same origin.

## 🚢 Deployment

The production build is served from the backend server at `/Users/yash/Codes/MySQLMCP/server/public/`.

To deploy:

```bash
# Build frontend
npm run build

# Start backend server (serves frontend automatically)
cd ../server
npm start
```

The app will be available at `http://localhost:3000`.

## 🤝 Contributing

(Add contribution guidelines)

## 📄 License

(Add license information)

## 🎓 Learning Resources

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [TailwindCSS Documentation](https://tailwindcss.com)
- [React Query Documentation](https://tanstack.com/query)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

---

**Built with ❤️ using React, TypeScript, and Vite**
