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
import { DEFAULT_COLOR, dayViewLabel } from "./utils";

const THEME_KEY = "nutriscore-theme";
// Mobile shows the current tab's name as the page title (desktop shows
// everything at once, so it keeps the app name). Keep in sync with BottomNav.
const TAB_TITLES = { today: "Today", training: "Training", calendar: "Calendar", body: "Body", compete: "Compete" };

export default function DashboardClient({ me }) {
  const router = useRouter();
  const martin = usePersonData("martin");
  const laura = usePersonData("laura");
  const [activeTab, setActiveTab] = useState("today");
  const [dayOffset, setDayOffset] = useState(0); // food tab: 0 = today, 1 = yesterday … 6 (swiped on the calorie ring)
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
    setDayOffset(0); // a fresh photo is today's food
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
    <div className="wrap" data-person={me} style={{ "--series-martin": martinColor, "--series-laura": lauraColor }}>
      <div className="top-bar">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2-5)" }}>
          <TopMenu
            onOpenGoals={() => setOpenPanel("goals")}
            onOpenSettings={() => setOpenPanel("settings")}
            onOpenRecipes={() => setOpenPanel("recipes")}
            onOpenColour={() => setOpenPanel("colour")}
            onLogout={logout}
          />
          <div>
            <h1>
              <span className="only-desktop">Nutriscore</span>
              <span className="only-mobile">{activeTab === "today" ? dayViewLabel(dayOffset) : TAB_TITLES[activeTab]}</span>
            </h1>
            <TodayPlanStrip />
          </div>
        </div>
        <div className="whoami">
          Signed in as <strong className="whoami-name">{me === "martin" ? "Martin" : "Laura"}</strong>
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

      {/* Desktop: both columns side by side, always visible above 880px */}
      <div className="dashboard desktop-dashboard">
        {!loading && (
          <div style={{ gridColumn: "1 / -1" }}>
            <Competition martinWeekly={martin.weekly} lauraWeekly={laura.weekly} />
          </div>
        )}
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
            dayOffset={dayOffset}
            onDayOffsetChange={setDayOffset}
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
          <WeeklySection personId={me} isMe weekly={myData.weekly} refreshWeekly={myData.refreshWeekly} snacks={myData.snacks} />
          <BloodworkSection personId={me} isMe bloodwork={myData.bloodwork} refreshBloodwork={myData.refreshBloodwork} />
        </div>
        <div hidden={activeTab !== "compete"}>
          {/* The head-to-head lives here on a phone rather than above every
              tab, where it pushed each tab's own content below the fold. */}
          {!loading && <Competition martinWeekly={martin.weekly} lauraWeekly={laura.weekly} />}
          <Whiteboard me={me} />
          {!loading && <CompareColumns martin={martin} laura={laura} />}
        </div>

        <button type="button" className="fab-camera" hidden={activeTab !== "today"} onClick={openQuickCamera} aria-label="Log a photo">
          <Camera strokeWidth={2} />
        </button>
      </div>

      <BottomNav
        active={activeTab}
        todayLabel={dayViewLabel(dayOffset)}
        onChange={(key) => {
          // Tapping the food tab again while it's on a past day jumps back to today.
          if (key === "today" && activeTab === "today") setDayOffset(0);
          setActiveTab(key);
        }}
      />
    </div>
  );
}
