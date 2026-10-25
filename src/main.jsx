import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './lib/firebase.js';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
