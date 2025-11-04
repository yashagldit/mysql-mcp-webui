import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<div className="p-8 text-center">
          <h1 className="text-4xl font-bold text-primary-600">MySQL MCP WebUI</h1>
          <p className="mt-4 text-gray-600">Configuration coming soon...</p>
        </div>} />
      </Routes>
    </div>
  );
}

export default App;
