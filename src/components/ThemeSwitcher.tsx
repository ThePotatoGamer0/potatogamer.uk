import { useTheme } from "../theme/ThemeProvider";

export function ThemeSwitcher() {
  const { mode, setMode } = useTheme();

  return (
    <div className="theme-switcher" role="group" aria-label="Light or dark">
      <div className="theme-modes">
        <button type="button" aria-pressed={mode === "light"} onClick={() => setMode("light")}>
          Light
        </button>
        <button type="button" aria-pressed={mode === "dark"} onClick={() => setMode("dark")}>
          Dark
        </button>
      </div>
    </div>
  );
}
