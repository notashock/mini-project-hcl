// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';

function App() {
  return (
    <Router>
      <AuthProvider>
        {/* We keep the toaster here as we installed it specifically for this project's UI earlier */}
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          
          {/* The isolated Placement Hub Dashboard */}
          <Route path="/dashboard" element={
            <div className="flex flex-col h-screen items-center justify-center bg-gray-900 text-white">
              <h1 className="text-4xl font-bold text-blue-400 mb-4">Placement Hub Dashboard</h1>
              <p>Welcome! Your real-time files will appear here.</p>
            </div>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;