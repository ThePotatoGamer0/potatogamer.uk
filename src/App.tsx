import { Link, Route, Routes } from "react-router-dom";
import { Atmosphere } from "./components/Atmosphere";
import { MaterialSquiggle } from "./components/MaterialSquiggle";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { AppProviders } from "./context/AppProviders";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";

export function App() {
  return (
    <AppProviders>
      <Atmosphere />
      <MaterialSquiggle />
      <div className="app">
        <a className="skip" href="#content">
          Skip to content
        </a>
        <header className="topbar">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              P
            </span>
            <span>potatogamer.uk</span>
          </Link>
          <ThemeSwitcher />
        </header>
        <main id="content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
        <footer className="footer">
          <span>ThePotatoGamer</span>
          <Link to="/admin">Admin</Link>
        </footer>
      </div>
    </AppProviders>
  );
}
