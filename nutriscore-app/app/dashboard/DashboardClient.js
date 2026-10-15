"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePersonData } from "./usePersonData";
import Competition from "./Competition";
import PersonColumn from "./PersonColumn";
import BottomNav from "./BottomNav";
import SnackSection from "./SnackSection";
import TrainingSection from "./TrainingSection";
import WeeklySection from "./WeeklySection";
import BloodworkSection from "./BloodworkSection";
import MeasurementsSection from "./MeasurementsSection";
import SideDrawer from "./SideDrawer";
import GoalsPanel from "./GoalsPanel";
import RecipesPanel from "./RecipesPanel";
import MyFoodsPanel from "./MyFoodsPanel";
import PartnerDayPanel from "./PartnerDayPanel";
import ChangePinPanel from "./ChangePinPanel";
import ExportPanel from "./ExportPanel";
import ColourPanel from "./ColourPanel";
import Whiteboard from "./Whiteboard";
import TodayPlanStrip from "./TodayPlanStrip";
import TrainingPlanCalendar from "./TrainingPlanCalendar";
import CompareColumns from "./CompareColumns";
import { DEFAULT_COLOR, dayViewLabel } from "./utils";
import { usePrefs } from "./usePrefs";
import { lastStravaSync, syncStrava } from "./strava";
import { DEFAULT_THEME, THEME_KEY, normalizeTheme, resolveTheme } from "../../lib/theme";

// Mobile shows the current tab's name as the page title (desktop shows
// everything at once, so it keeps the app name). Keep in sync with BottomNav.
const TAB_TITLES = { today: "Today", training: "Training", calendar: "Calendar", body: "Body", compete: "Compete" };

export default function DashboardClient({ me }) {
  const router = useRouter();
  const martin = usePersonData("martin");
  const laura = usePersonData("laura");
  const [activeTab, setActiveTab] = useState("today");
  const [dayOffset, setDayOffset] = useState(0); // food tab: 0 = today, 1 = yesterday … 6 (swiped on the calorie ring)
  const [openPanel, setOpenPanel] = useState(null); // null | goals | recipes | colour | myFoods | partner | pin | export (opened from the drawer)
  // Colour scheme for this device: { mode: 'day' | 'night' | null (follow
  // the device), day, night } — see lib/theme.js. Read straight from storage
  // on first render (the pre-paint script in layout.js already applied it),
  // so there's no default-then-saved flicker. Nothing about it is in the
  // server-rendered markup, so this can't cause a hydration mismatch.
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    try {
      return normalizeTheme(JSON.parse(localStorage.getItem(THEME_KEY) || "null"));
    } catch {
      return DEFAULT_THEME;
    }
  });

  // Put the resolved scheme on <html>, remember the choice, and repaint the
  // status bar. When following the device, keep listening: the phone flips
  // to dark at sunset while the app is already open.
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    } catch {
      // ignore unavailable storage
    }
    let mql = null;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      // very old browser: treat the device as bright
    }
    const apply = () => {
      const key = resolveTheme(theme, !!mql?.matches);
      document.documentElement.setAttribute("data-theme", key);
      window.__nutriscoreApplyThemeColor?.(key);
    };
    apply();
    if (theme.mode !== null || !mql) return;
    mql.addEventListener?.("change", apply);
    return () => mql.removeEventListener?.("change", apply);
  }, [theme]);

  function handleThemeChange(next) {
    setTheme(normalizeTheme(next));
  }

  const myData = me === "martin" ? martin : laura;
  const partnerId = me === "martin" ? "laura" : "martin";
  const partnerData = me === "martin" ? laura : martin;
  const { prefs, loaded: prefsLoaded, update: updatePrefs } = usePrefs();

  // "Sync Strava on open": once per app open, at most hourly, quietly.
  useEffect(() => {
    if (!prefsLoaded || !prefs.stravaAutosync || !myData.stravaStatus?.connected) return;
    const last = lastStravaSync();
    if (last && Date.now() - last < 60 * 60 * 1000) return;
    syncStrava(me)
      .then(() => myData.refreshTraining())
      .catch(() => {}); // a failed background sync shouldn't nag; the drawer's Sync button shows errors
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded, prefs.stravaAutosync, myData.stravaStatus?.connected]);

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
          <SideDrawer
            me={me}
            myData={myData}
            partnerData={partnerData}
            prefs={prefs}
            onPrefsChange={updatePrefs}
            theme={theme}
            onThemeChange={handleThemeChange}
            onOpen={setOpenPanel}
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
      {openPanel === "myFoods" && <MyFoodsPanel onClose={() => setOpenPanel(null)} />}
      {openPanel === "partner" && <PartnerDayPanel partnerId={partnerId} data={partnerData} onClose={() => setOpenPanel(null)} />}
      {openPanel === "pin" && <ChangePinPanel personId={me} onClose={() => setOpenPanel(null)} />}
      {openPanel === "export" && <ExportPanel onClose={() => setOpenPanel(null)} />}
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
        <PersonColumn personId="martin" displayName="Martin" seriesVar="--series-martin" isMe={me === "martin"} data={martin} showFiber={me !== "martin" || prefs.showFiber} />
        <PersonColumn personId="laura" displayName="Laura" seriesVar="--series-laura" isMe={me === "laura"} data={laura} showFiber={me !== "laura" || prefs.showFiber} />
        <div style={{ gridColumn: "1 / -1" }}>
          <Whiteboard me={me} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <TrainingPlanCalendar me={me} raceDate={prefs.raceDate} sessionsVersion={myData.sessions} />
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
            dayOffset={dayOffset}
            onDayOffsetChange={setDayOffset}
            showFiber={prefs.showFiber}
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
          <TrainingPlanCalendar me={me} raceDate={prefs.raceDate} sessionsVersion={myData.sessions} />
        </div>
        <div hidden={activeTab !== "body"}>
          <WeeklySection personId={me} isMe weekly={myData.weekly} refreshWeekly={myData.refreshWeekly} snacks={myData.snacks} />
          <MeasurementsSection personId={me} isMe />
          <BloodworkSection personId={me} isMe bloodwork={myData.bloodwork} refreshBloodwork={myData.refreshBloodwork} />
        </div>
        <div hidden={activeTab !== "compete"}>
          {/* The head-to-head lives here on a phone rather than above every
              tab, where it pushed each tab's own content below the fold. */}
          {!loading && <Competition martinWeekly={martin.weekly} lauraWeekly={laura.weekly} />}
          <Whiteboard me={me} />
          {!loading && <CompareColumns martin={martin} laura={laura} />}
        </div>

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
