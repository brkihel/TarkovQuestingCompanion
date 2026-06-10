import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { Minimap } from "./components/Minimap";
import { SettingsProvider } from "./settings";

// As duas janelas (main e minimap) carregam o mesmo bundle; decidimos o que
// renderizar pelo label da janela Tauri.
function resolveLabel(): string {
  try {
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
}

const label = resolveLabel();
if (label === "minimap") {
  document.documentElement.classList.add("minimap-window");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      {label === "minimap" ? <Minimap /> : <App />}
    </SettingsProvider>
  </React.StrictMode>,
);
