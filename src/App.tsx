import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { cardFromPath } from "../shared/og";
import { isDiscordId } from "../shared/site";
import { Atmosphere } from "./components/Atmosphere";
import { SiteMenu } from "./components/SiteMenu";
import { MaterialSquiggle } from "./components/MaterialSquiggle";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { AppProviders, useConfig, useDiscordProfiles, usePresence } from "./context/AppProviders";
import { avatarUrl, defaultAvatarUrl } from "./lib/discord";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { SetupPage } from "./pages/SetupPage";

function BrandMark() {
  const { config } = useConfig();
  const ownerId = isDiscordId(config.identity.discordId) ? config.identity.discordId : "";
  const { owner } = usePresence();
  const { users } = useDiscordProfiles();
  const user = ownerId ? (owner?.discord_user ?? users[ownerId] ?? null) : null;
  const photo = user ? avatarUrl(user, 128) : "";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  const src = photo ? (failed ? defaultAvatarUrl(user?.id ?? ownerId) : photo) : "";

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

function CardPage() {
  const { card = "" } = useParams();
  const focus = cardFromPath(`/${card}`);
  if (!focus) return <Navigate to="/" replace />;
  return <HomePage focus={focus} />;
}

function StripSlash() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.pathname.length > 1 && location.pathname.endsWith("/")) {
      navigate(`${location.pathname.slice(0, -1)}${location.search}${location.hash}`, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);
  return null;
}

function SetupRoute() {
  const { needsSetup, loading } = useConfig();
  if (loading) return <section className="card"><p className="muted">Checking…</p></section>;
  if (needsSetup) return <SetupPage />;
  return <HomePage focus="setup" />;
}

function SiteFrame() {
  const { config, needsSetup, loading } = useConfig();
  const location = useLocation();
  const siteName = config.identity.siteName || "Home";
  const showWizard = needsSetup && location.pathname !== "/setup";

  return (
    <>
      <Atmosphere />
      <MaterialSquiggle />
      <StripSlash />
      <SiteMenu>
        <div className="app">
          <a className="skip" href="#content">
            Skip to content
          </a>
          <header className="topbar">
            <Link to="/" className="brand">
              <BrandMark />
              <span>{siteName}</span>
            </Link>
            <ThemeSwitcher />
          </header>
          <main id="content">
            {loading ? (
              <section className="card"><p className="muted">Checking…</p></section>
            ) : showWizard ? (
              <Navigate to="/setup" replace />
            ) : (
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/setup" element={<SetupRoute />} />
                <Route path="/:card" element={<CardPage />} />
              </Routes>
            )}
          </main>
          <footer className="footer">
            <span className="footer-meta">
              <span>{config.identity.name || "Home"}</span>
              {needsSetup ? null : <Link to="/admin">Admin</Link>}
            </span>
            <p className="footer-credit">
              Made by <a href="https://potatogamer.uk">ThePotatoGamer</a>
              <span aria-hidden="true"> · </span>
              Designed to the <a href="https://m3.material.io/">Material 3</a> spec
            </p>
          </footer>
        </div>
      </SiteMenu>
    </>
  );
}

export function App() {
  return (
    <AppProviders>
      <SiteFrame />
    </AppProviders>
  );
}
