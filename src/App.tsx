import { useAppStore } from "./stores/app-store";
import { AppShell } from "./components/layout/AppShell";
import { SetupPage } from "./pages/SetupPage";

export default function App() {
  const setupComplete = useAppStore((s) => s.setupComplete);

  if (!setupComplete) {
    return <SetupPage />;
  }

  return <AppShell />;
}
