"use client";

import { useEffect, useRef, useState } from "react";
import {
  Menu,
  X,
  Target,
  BookOpen,
  Apple,
  Eye,
  Activity,
  Settings as SettingsIcon,
  ChevronRight,
  ChevronLeft,
  Flag,
  Clock,
  Leaf,
  RefreshCw,
  Unlink,
  Palette,
  Lock,
  Download,
  LogOut
} from "lucide-react";
import { todayStr, dayMonthLabel } from "./utils";
import { agoLabel, lastStravaSync, syncStrava } from "./strava";

const OPEN_MS = 240; // matches .drawer transition in globals.css

const ICON_COLORS = {
  goals: "#7c3aed",
  recipes: "#d97706",
  foods: "#16a34a",
  strava: "#ea580c",
  settings: "#64748b",
  race: "#7c3aed",
  dayEnd: "#d97706",
  colour: "#0891b2",
  pin: "#64748b",
  export: "#2563eb",
  logout: "#dc2626"
};

// The ☰ menu: a drawer sliding in from the left with your profile, the race
// countdown, food shortcuts, the other person's day, Strava, a quick
// Bright/Night/Auto switch and Settings (its own page inside the drawer).
// Popups it opens (Goals, Recipes, …) are owned by DashboardClient.
export default function SideDrawer({
  me,
  myData,
  partnerData,
  prefs,
  onPrefsChange,
  theme,
  onThemeChange,
  onOpen, // (panelKey) => open a popup: goals | recipes | myFoods | partner | colour | pin | export
  onLogout
}) {
  const [phase, setPhase] = useState("closed"); // closed | open | closing
  const [page, setPage] = useState("main"); // main | settings
  const timerRef = useRef(null);
  const panelRef = useRef(null);

  function open() {
    clearTimeout(timerRef.current);
    setPage("main");
    setPhase("opening");
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase("open")));
  }

  function close(then) {
    if (phase === "closed") return;
    setPhase("closing");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPhase("closed");
      then?.();
    }, OPEN_MS);
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (phase !== "open") return;
    panelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Close first, then open the popup, so they don't stack.
  const go = (panel) => close(() => onOpen(panel));

  return (
    <>
      <button type="button" className="top-menu-btn" aria-label="Menu" aria-expanded={phase === "open"} onClick={open}>
        <Menu strokeWidth={2} />
      </button>
      {phase !== "closed" && (
        <div className={phase === "open" ? "drawer-root is-open" : "drawer-root"}>
          <div className="drawer-scrim" onClick={() => close()} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Menu" ref={panelRef} tabIndex={-1} data-person={me}>
            {page === "main" ? (
              <MainPage
                me={me}
                myData={myData}
                partnerData={partnerData}
                prefs={prefs}
                theme={theme}
                onThemeChange={onThemeChange}
                go={go}
                onClose={() => close()}
                onSettings={() => setPage("settings")}
              />
            ) : (
              <SettingsPage
                me={me}
                myData={myData}
                prefs={prefs}
                onPrefsChange={onPrefsChange}
                go={go}
                onBack={() => setPage("main")}
                onLogout={() => close(onLogout)}
              />
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function MainPage({ me, myData, partnerData, prefs, theme, onThemeChange, go, onClose, onSettings }) {
  const partner = me === "martin" ? "laura" : "martin";
  const partnerName = partner === "laura" ? "Laura" : "Martin";
  const myName = me === "martin" ? "Martin" : "Laura";

  const today = todayStr();
  const pToday = (partnerData.snacks || []).filter((s) => s.log_date === today);
  const pKcal = pToday.reduce((sum, s) => sum + (Number(s.calories) || 0), 0);
  const pProtein = pToday.reduce((sum, s) => sum + (Number(s.protein_g) || 0), 0);
  const pTarget = partnerData.calorieTarget;

  const goalsSub =
    myData.calorieTarget != null
      ? Math.round(myData.calorieTarget).toLocaleString("en-US") + " kcal" + (myData.proteinTarget != null ? " · " + Math.round(myData.proteinTarget) + " g protein" : "")
      : "Set your calorie and protein goals";

  return (
    <>
      <div className="drawer-top">
        <div className="drawer-profile">
          <span className="drawer-avatar">{myName[0]}</span>
          <span>
            <span className="drawer-name">{myName}</span>
            <span className="drawer-sub">Signed in on this device</span>
          </span>
        </div>
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close menu">
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <RaceCard prefs={prefs} onSet={onSettings} />

      <div className="drawer-label">Food</div>
      <div className="group-list">
        <Row icon={Target} color={ICON_COLORS.goals} title="Goals" sub={goalsSub} onClick={() => go("goals")} />
        <Row icon={BookOpen} color={ICON_COLORS.recipes} title="Recipes" sub="Saved meals" onClick={() => go("recipes")} />
        <Row icon={Apple} color={ICON_COLORS.foods} title="My foods" sub="Edit foods you added" onClick={() => go("myFoods")} />
      </div>

      <div className="drawer-label">Together</div>
      <div className="group-list" data-person={partner}>
        <Row
          icon={Eye}
          color={"var(--series-" + partner + ")"}
          title={partnerName + "'s day"}
          sub={
            pToday.length
              ? Math.round(pKcal).toLocaleString("en-US") + (pTarget != null ? " / " + Math.round(pTarget).toLocaleString("en-US") : "") + " kcal · " + Math.round(pProtein) + " g protein"
              : "Nothing logged yet today"
          }
          right={<MiniRing pct={pTarget ? pKcal / pTarget : 0} over={pTarget != null && pKcal > pTarget} />}
          onClick={() => go("partner")}
        />
      </div>

      <div className="drawer-label">Training</div>
      <div className="group-list">
        <StravaRow me={me} myData={myData} />
      </div>

      <div className="drawer-label">Look</div>
      <div className="segmented drawer-mode" role="radiogroup" aria-label="Bright, night or auto">
        {[
          ["day", "Bright"],
          ["night", "Night"],
          [null, "Auto"]
        ].map(([m, label]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={theme.mode === m}
            className={theme.mode === m ? "seg-btn selected" : "seg-btn"}
            onClick={() => onThemeChange({ ...theme, mode: m })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="group-list drawer-settings-row">
        <Row icon={SettingsIcon} color={ICON_COLORS.settings} title="Settings" sub="Race date, PIN, export and more" onClick={onSettings} />
      </div>
    </>
  );
}

function SettingsPage({ me, myData, prefs, onPrefsChange, go, onBack, onLogout }) {
  const partnerName = me === "martin" ? "Laura" : "Martin";
  const [raceOpen, setRaceOpen] = useState(!prefs.raceDate);
  const [race, setRace] = useState({ name: prefs.raceName, date: prefs.raceDate || "" });
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const connected = myData.stravaStatus?.connected;

  async function saveRace() {
    setBusy("race");
    const ok = await onPrefsChange({ raceName: race.name, raceDate: race.date || null });
    setBusy("");
    if (ok) setRaceOpen(false);
  }

  async function disconnect() {
    setBusy("strava");
    setMsg("");
    try {
      const res = await fetch("/api/strava/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't disconnect");
      await myData.refreshStravaStatus();
      setConfirmDisconnect(false);
      setMsg("Strava disconnected.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="drawer-top">
        <button type="button" className="drawer-close" onClick={onBack} aria-label="Back to menu">
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <span className="drawer-title">Settings</span>
      </div>

      <div className="drawer-label">Race</div>
      <div className="group-list">
        <Row
          icon={Flag}
          color={ICON_COLORS.race}
          title={prefs.raceName}
          right={<span className="drawer-value">{prefs.raceDate ? dayMonthLabel(prefs.raceDate) : "Set date"}</span>}
          onClick={() => setRaceOpen((o) => !o)}
        />
        {raceOpen && (
          <div className="drawer-inline-form">
            <label className="recipe-num">
              <span>Race</span>
              <input value={race.name} onChange={(e) => setRace({ ...race, name: e.target.value })} maxLength={60} />
            </label>
            <label className="recipe-num">
              <span>Date</span>
              <input type="date" value={race.date} min={todayStr()} onChange={(e) => setRace({ ...race, date: e.target.value })} />
            </label>
            <button type="button" className="primary" onClick={saveRace} disabled={busy === "race"}>
              {busy === "race" ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      <div className="drawer-label">Food</div>
      <div className="group-list">
        <Row
          icon={Clock}
          color={ICON_COLORS.dayEnd}
          title="Day ends at"
          sub="Late snacks stay on the evening"
          right={
            <select
              className="drawer-select"
              value={prefs.dayEndHour}
              onChange={(e) => onPrefsChange({ dayEndHour: Number(e.target.value) })}
              aria-label="Day ends at"
            >
              <option value={0}>Midnight</option>
              <option value={1}>01:00</option>
              <option value={2}>02:00</option>
              <option value={3}>03:00</option>
              <option value={4}>04:00</option>
            </select>
          }
        />
        <Row
          icon={Eye}
          color={"var(--series-" + (me === "martin" ? "laura" : "martin") + ")"}
          title={partnerName + " sees my meals"}
          sub={prefs.shareMeals ? "What you ate and the numbers" : "Off: only your totals"}
          right={<Switch on={prefs.shareMeals} label={partnerName + " sees my meals"} onChange={(v) => onPrefsChange({ shareMeals: v })} />}
        />
        <Row
          icon={Leaf}
          color={ICON_COLORS.foods}
          title="Show fiber"
          right={<Switch on={prefs.showFiber} label="Show fiber" onChange={(v) => onPrefsChange({ showFiber: v })} />}
        />
      </div>

      <div className="drawer-label">Training</div>
      <div className="group-list">
        <Row
          icon={RefreshCw}
          color={ICON_COLORS.strava}
          title="Sync Strava on open"
          sub={connected ? "Pulls in new workouts" : "Connect Strava first"}
          right={<Switch on={prefs.stravaAutosync} label="Sync Strava on open" onChange={(v) => onPrefsChange({ stravaAutosync: v })} />}
        />
        {connected && (
          <Row
            icon={Unlink}
            color={ICON_COLORS.strava}
            title={confirmDisconnect ? "Disconnect Strava?" : "Disconnect Strava"}
            sub={confirmDisconnect ? "Synced workouts stay. You can connect again any time." : null}
            right={
              confirmDisconnect ? (
                <span className="drawer-confirm">
                  <button type="button" className="danger sm" onClick={disconnect} disabled={busy === "strava"}>
                    {busy === "strava" ? "…" : "Yes"}
                  </button>
                  <button type="button" className="ghost sm" onClick={() => setConfirmDisconnect(false)}>
                    No
                  </button>
                </span>
              ) : null
            }
            onClick={confirmDisconnect ? undefined : () => setConfirmDisconnect(true)}
          />
        )}
      </div>
      {msg && <p className="status-text small drawer-msg">{msg}</p>}

      <div className="drawer-label">Look</div>
      <div className="group-list">
        <Row icon={Palette} color={ICON_COLORS.colour} title="Colour & schemes" sub="Your colour, bright and night schemes" onClick={() => go("colour")} />
      </div>

      <div className="drawer-label">Account & data</div>
      <div className="group-list">
        <Row icon={Lock} color={ICON_COLORS.pin} title="Change PIN" onClick={() => go("pin")} />
        <Row icon={Download} color={ICON_COLORS.export} title="Export my data" sub="Spreadsheet files of everything" onClick={() => go("export")} />
        <Row icon={LogOut} color={ICON_COLORS.logout} title="Log out" danger onClick={onLogout} />
      </div>
    </>
  );
}

function RaceCard({ prefs, onSet }) {
  if (!prefs.raceDate) {
    return (
      <button type="button" className="race-card is-empty" onClick={onSet}>
        <span>
          <span className="race-card-label">{prefs.raceName}</span>
          <span className="race-card-big">Set your race date</span>
        </span>
        <Flag size={28} strokeWidth={2} />
      </button>
    );
  }
  const days = daysBetween(todayStr(), prefs.raceDate);
  // Bar = how far through the final year before the race you are.
  const pct = Math.max(0, Math.min(1, (365 - days) / 365));
  return (
    <div className="race-card">
      <span>
        <span className="race-card-label">{prefs.raceName}</span>
        <span className="race-card-big">{days > 1 ? days + " days" : days === 1 ? "Tomorrow!" : days === 0 ? "Race day!" : "Done 🎉"}</span>
        {days > 0 && (
          <span className="race-card-bar">
            <i style={{ width: pct * 100 + "%" }} />
          </span>
        )}
      </span>
      <Flag size={28} strokeWidth={2} />
    </div>
  );
}

function StravaRow({ me, myData }) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  const [, rerender] = useState(0);
  const connected = myData.stravaStatus?.connected;

  if (!connected) {
    return (
      <Row
        icon={Activity}
        color={ICON_COLORS.strava}
        title="Strava"
        sub="Not connected"
        right={
          <a className="drawer-pill" href="/api/strava/connect">
            Connect
          </a>
        }
      />
    );
  }

  async function sync() {
    setSyncing(true);
    setMsg("");
    try {
      const data = await syncStrava(me);
      await Promise.all([myData.refreshTraining(), myData.refreshStravaStatus()]);
      setMsg(data.activityCount + " activities");
      rerender((n) => n + 1);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSyncing(false);
    }
  }

  const ago = agoLabel(lastStravaSync());
  return (
    <Row
      icon={Activity}
      color={ICON_COLORS.strava}
      title="Strava"
      sub={msg || (ago ? "Synced " + ago : "Connected")}
      subGood={!msg}
      right={
        <button type="button" className="drawer-pill" onClick={sync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync"}
        </button>
      }
    />
  );
}

function Row({ icon: Icon, color, title, sub, subGood, right, onClick, danger }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={"group-row drawer-row" + (danger ? " is-danger" : "")} onClick={onClick}>
      <span className="drawer-ico" style={{ "--c": color }}>
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="group-row-main">
        <span className="group-row-title">{title}</span>
        {sub && <span className={"group-row-value" + (subGood ? " is-good" : "")}>{sub}</span>}
      </span>
      {right}
      {onClick && !right && !danger && <ChevronRight className="group-row-chevron" size={16} strokeWidth={2} />}
    </Tag>
  );
}

function Switch({ on, label, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      className={on ? "switch on" : "switch"}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
    />
  );
}

function MiniRing({ pct, over }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct || 0));
  return (
    <svg className="drawer-ring" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r={r} fill="none" stroke="var(--gridline)" strokeWidth="4" />
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke={over ? "var(--over)" : "var(--accent)"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - p)}
        transform="rotate(-90 16 16)"
      />
    </svg>
  );
}

function daysBetween(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}
