import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./global.css";
import './i18n';
import { initializeTheme } from "./stores/appearance-store";

// Apply saved theme before first render to prevent flash
initializeTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
