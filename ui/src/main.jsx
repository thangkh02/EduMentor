import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from 'react-router-dom'; // Import Router
import { AuthProvider } from './contexts/AuthContext'; // Import AuthProvider
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router> {/* Wrap with Router */}
      <AuthProvider> {/* Wrap with AuthProvider */}
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>
);
