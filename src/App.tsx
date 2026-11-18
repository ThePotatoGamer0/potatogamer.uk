import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { OWNER_DISCORD_ID } from "../shared/site";
import { Atmosphere } from "./components/Atmosphere";
import { MaterialSquiggle } from "./components/MaterialSquiggle";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { AppProviders, useDiscordProfiles, usePresence } from "./context/AppProviders";
import { avatarUrl, defaultAvatarUrl } from "./lib/discord";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";

function BrandMark() {
  const { owner } = usePresence();
  const { users } = useDiscordProfiles();
  const user = owner?.discord_user ?? users[OWNER_DISCORD_ID] ?? null;
  const photo = user ? avatarUrl(user, 128) : "";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  const src = photo ? (failed ? defaultAvatarUrl(user?.id ?? OWNER_DISCORD_ID) : photo) : "";

  return (
    <span className="brand-mark" aria-hidden="true">
      {src ? (
        <img
          src={src}
          alt=""
          width={36}
          height={36}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}

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
            <BrandMark />
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
