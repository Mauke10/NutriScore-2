"use client";

import { useEffect, useRef, useState } from "react";
import { PenLine } from "lucide-react";
import { todayStr, otherOf } from "./utils";

const DISPLAY_NAME = { martin: "Martin", laura: "Laura" };
const SERIES_VAR = { martin: "--series-martin", laura: "--series-laura" };

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function Whiteboard({ me }) {
  const partnerId = otherOf(me);
  const today = todayStr();
  const [notes, setNotes] = useState({ martin: null, laura: null });
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const initialisedDraft = useRef(false);
  const saveTimer = useRef(null);

  async function refresh() {
    const res = await fetch("/api/notes?date=" + today);
    const data = await res.json();
    setNotes(data.notes || { martin: null, laura: null });
    setLoaded(true);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  useEffect(() => {
    if (loaded && !initialisedDraft.current) {
      setDraft((notes[me] && notes[me].message) || "");
      initialisedDraft.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  async function saveNote(message) {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, noteDate: today })
      });
      await refresh();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function onDraftChange(v) {
    setDraft(v);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNote(v), 900);
  }

  function onBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveNote(draft);
  }

  const partnerNote = notes[partnerId];

  return (
    <div className="whiteboard-card">
      <div className="whiteboard-head">
        <PenLine size={15} strokeWidth={2.2} />
        <h3>Morning whiteboard</h3>
        <span className="muted">— resets tomorrow</span>
      </div>
      <div className="whiteboard-notes">
        <div className="whiteboard-note">
          <div className="whiteboard-note-head">
            <span className="dot" style={{ background: "var(" + SERIES_VAR[me] + ")" }} />
            {DISPLAY_NAME[me]} <span className="whiteboard-you">(you)</span>
          </div>
          <textarea
            className="whiteboard-textarea"
            style={{ color: "var(" + SERIES_VAR[me] + ")" }}
            value={draft}
            maxLength={500}
            placeholder={"Leave " + DISPLAY_NAME[partnerId] + " a note for the day…"}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onBlur}
          />
          <div className="whiteboard-meta">
            {saving ? "Saving…" : saved ? "Saved" : notes[me]?.updatedAt ? "Last written " + formatTime(notes[me].updatedAt) : "Not written yet today"}
          </div>
        </div>

        <div className="whiteboard-note">
          <div className="whiteboard-note-head">
            <span className="dot" style={{ background: "var(" + SERIES_VAR[partnerId] + ")" }} />
            {DISPLAY_NAME[partnerId]}
          </div>
          <div className="whiteboard-textarea whiteboard-readonly" style={{ color: "var(" + SERIES_VAR[partnerId] + ")" }}>
            {partnerNote && partnerNote.message ? partnerNote.message : <span className="whiteboard-empty">No note yet today.</span>}
          </div>
          <div className="whiteboard-meta">{partnerNote && partnerNote.updatedAt ? "Left " + formatTime(partnerNote.updatedAt) : ""}</div>
        </div>
      </div>
    </div>
  );
}
