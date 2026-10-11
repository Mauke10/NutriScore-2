"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { usePersonData } from "./usePersonData";
import Competition from "./Competition";
import PersonColumn from "./PersonColumn";
import BottomNav from "./BottomNav";
import SnackSection from "./SnackSection";
import TrainingSection from "./TrainingSection";
import WeeklySection from "./WeeklySection";
import BloodworkSection from "./BloodworkSection";
import TopMenu from "./TopMenu";
import GoalsPanel from "./GoalsPanel";
import SettingsPanel from "./SettingsPanel";
import RecipesPanel from "./RecipesPanel";
import ColourPanel from "./ColourPanel";
import Whiteboard from "./Whiteboard";
import TodayPlanStrip from "./TodayPlanStrip";
import TrainingPlanCalendar from "./TrainingPlanCalendar";
import CompareColumns from "./CompareColumns";

const DEFAULT_COLOR = { martin: "#7c3aed", laura: "#db2777" };
const THEME_KEY = "nutriscore-theme";

export default function DashboardClient({ me }) {
  const router = useRouter();
  const martin = usePersonData("martin");
  const laura = usePersonData("laura");
  const [activeTab, setActiveTab] = useState("today");
  const [openPanel, setOpenPanel] = useState(null); // null | 'goals' | 'settings' | 'recipes' | 'colour'
  const cameraTriggerRef = useRef(null);
  const [theme, setTheme] = useState({ mode: null, night: "dark" }); // mode: null (match device) | 'light' | 'dark' | 'green'

  // Pick up any theme choice already saved on this device, then keep <html>'s
  // data-theme in sync with it (and persist future changes back to it).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(THEME_KEY) || "null");
      if (saved && typeof saved === "object") setTheme({ mode: saved.mode ?? null, night: saved.night || "dark" });
    } catch {
      // ignore malformed/unavailable storage
    }
  }, []);

  useEffect(() => {
    if (theme.mode) document.documentElement.setAttribute("data-theme", theme.mode);
    else document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    } catch {
      // ignore unavailable storage
    }
    // Keep the status bar / task-switcher chrome (theme-color meta tag,
    // set up in layout.js) matching whatever's actually on screen.
    window.__nutriscoreApplyThemeColor?.(theme.mode);
  }, [theme]);

  // "Match my device" (theme.mode === null) needs to keep tracking the OS
  // setting live, not just at the moment it was picked — e.g. the phone
  // flips into dark mode at sunset while the app is already open.
  useEffect(() => {
    if (theme.mode) return;
    let mql;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = () => window.__nutriscoreApplyThemeColor?.(null);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [theme.mode]);

  function handleThemeChange(next) {
    setTheme(next || { mode: null, night: theme.night });
  }

  function openQuickCamera() {
    // Fire the file picker synchronously (within the click's user-activation window),
    // then switch to "today" so the photo preview/estimate flow is visible once picked.
    cameraTriggerRef.current?.();
    setActiveTab("today");
  }

  const myData = me === "martin" ? martin : laura;

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const loading = martin.loading || laura.loading;
  const martinColor = martin.accentColor || DEFAULT_COLOR.martin;
  const lauraColor = laura.accentColor || DEFAULT_COLOR.laura;

  return (
    <div className="wrap" style={{ "--series-martin": martinColor, "--series-laura": lauraColor }}>
      <div className="top-bar">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <TopMenu
            onOpenGoals={() => setOpenPanel("goals")}
            onOpenSettings={() => setOpenPanel("settings")}
            onOpenRecipes={() => setOpenPanel("recipes")}
            onOpenColour={() => setOpenPanel("colour")}
          />
          <div>
            <h1>Nutriscore</h1>
            <TodayPlanStrip />
          </div>
        </div>
        <div className="whoami">
          Signed in as <strong style={{ color: "var(--text-primary)" }}>{me === "martin" ? "Martin" : "Laura"}</strong>
          <button type="button" className="ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      {openPanel === "goals" && (
        <GoalsPanel
          personId={me}
          calorieTarget={myData.calorieTarget}
          proteinTarget={myData.proteinTarget}
          swimGoalKm={myData.swimGoalKm}
          bikeGoalKm={myData.bikeGoalKm}
          runGoalKm={myData.runGoalKm}
          refreshTarget={myData.refreshTarget}
          onClose={() => setOpenPanel(null)}
        />
      )}
      {openPanel === "settings" && (
        <SettingsPanel
          personId={me}
          stravaStatus={myData.stravaStatus}
          refreshStravaStatus={myData.refreshStravaStatus}
          refreshTraining={myData.refreshTraining}
          onClose={() => setOpenPanel(null)}
        />
      )}
      {openPanel === "recipes" && <RecipesPanel onClose={() => setOpenPanel(null)} />}
      {openPanel === "colour" && (
        <ColourPanel
          personId={me}
          myColor={myData.accentColor}
          refreshAccentColor={myData.refreshAccentColor}
          theme={theme}
          onThemeChange={handleThemeChange}
          onClose={() => setOpenPanel(null)}
        />
      )}

      <div className="protocol-strip">
        <div className="protocol-card">
          <div className="k">Iron / ferritin</div>
          <div className="v">Watch</div>
          <div className="sub">Laura's sports doctor flagged low ferritin — recheck each panel.</div>
        </div>
        <div className="protocol-card">
          <div className="k">B12 & folate</div>
          <div className="v">Watch</div>
          <div className="sub">Supplement adherence tracked weekly below.</div>
        </div>
        <div className="protocol-card">
          <div className="k">Vitamin D</div>
          <div className="v">Watch</div>
          <div className="sub">Deficiency flagged — log doses in the bloodwork notes.</div>
        </div>
        <div className="protocol-card">
          <div className="k">HR zones & sleep</div>
          <div className="v">Base 128–160 · Hard 172–183</div>
          <div className="sub">Target 8–9h sleep during build weeks.</div>
        </div>
      </div>

      {!loading && <Competition martinWeekly={martin.weekly} lauraWeekly={laura.weekly} />}

      {/* Desktop: both columns side by side, always visible above 880px */}
      <div className="dashboard desktop-dashboard">
        <PersonColumn personId="martin" displayName="Martin" seriesVar="--series-martin" isMe={me === "martin"} data={martin} />
        <PersonColumn personId="laura" displayName="Laura" seriesVar="--series-laura" isMe={me === "laura"} data={laura} />
        <div style={{ gridColumn: "1 / -1" }}>
          <Whiteboard me={me} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <TrainingPlanCalendar me={me} />
        </div>
      </div>

      {/* Mobile: one tab of "your" data at a time, switched via the bottom nav */}
      <div className="mobile-dashboard" data-person={me}>
        <div hidden={activeTab !== "today"}>
          <SnackSection
            personId={me}
            isMe
            calorieTarget={myData.calorieTarget}
            proteinTarget={myData.proteinTarget}
            snacks={myData.snacks}
            refreshSnacks={myData.refreshSnacks}
            refreshTarget={myData.refreshTarget}
            registerCameraTrigger={(fn) => (cameraTriggerRef.current = fn)}
          />
        </div>
        <div hidden={activeTab !== "training"}>
          <TrainingSection
            personId={me}
            isMe
            training={myData.training}
            refreshTraining={myData.refreshTraining}
            sessions={myData.sessions}
            refreshSessions={myData.refreshSessions}
            swimGoalKm={myData.swimGoalKm}
            bikeGoalKm={myData.bikeGoalKm}
            runGoalKm={myData.runGoalKm}
            stravaStatus={myData.stravaStatus}
            refreshStravaStatus={myData.refreshStravaStatus}
          />
        </div>
        <div hidden={activeTab !== "calendar"}>
          <TrainingPlanCalendar me={me} />
        </div>
        <div hidden={activeTab !== "body"}>
          <WeeklySection personId={me} isMe weekly={myData.weekly} refreshWeekly={myData.refreshWeekly} />
          <BloodworkSection personId={me} isMe bloodwork={myData.bloodwork} refreshBloodwork={myData.refreshBloodwork} />
        </div>
        <div hidden={activeTab !== "compete"}>
          <Whiteboard me={me} />
          {!loading && <CompareColumns martin={martin} laura={laura} />}
        </div>

        <button type="button" className="fab-camera" hidden={activeTab !== "today"} onClick={openQuickCamera} aria-label="Log a photo">
          <Camera strokeWidth={2} />
        </button>
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
