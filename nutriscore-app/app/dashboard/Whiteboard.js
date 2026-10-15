"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { PEOPLE, todayStr, otherOf } from "./utils";

// Morning notes on the Compete tab: one note each per day (daily_notes,
// upserted per person per date), shown as two chat bubbles in each person's
// colour and handwriting. Tap your own bubble to change it; the box at the
// bottom writes (or rewrites) your note. Clears itself the next day.

const NAME = Object.fromEntries(PEOPLE.map((p) => [p.key, p.name]));

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function Whiteboard({ me }) {
  const partnerId = otherOf(me);
  const today = todayStr();
  const [notes, setNotes] = useState({ martin: null, laura: null });
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const res = await fetch("/api/notes?date=" + today);
      const data = await res.json();
      setNotes(data.notes || { martin: null, laura: null });
    } catch {
      // keep what's on screen
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  async function send(e) {
    e.preventDefault();
    const message = draft.trim();
    if (!message) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, noteDate: today })
      });
      if (!res.ok) throw new Error("Couldn't send — try again.");
      setDraft("");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Oldest first, like a chat.
  const bubbles = [me, partnerId]
    .map((id) => ({ id, note: notes[id] }))
    .filter((b) => b.note && b.note.message)
    .sort((a, b) => (a.note.updatedAt || "").localeCompare(b.note.updatedAt || ""));

  return (
    <div className="card wb">
      <div className="cp-card-head">
        <h3>Morning notes</h3>
        <span className="cp-meta">clears tomorrow</span>
      </div>
      <div className="wb-thread">
        {bubbles.length === 0 && <p className="wb-empty">No notes yet today. Leave {NAME[partnerId]} one for the day.</p>}
        {bubbles.map(({ id, note }) => {
          const mine = id === me;
          const body = (
            <>
              <span className="wb-text">{note.message}</span>
              <small>
                {mine ? "You" : NAME[id]} · {formatTime(note.updatedAt)}
                {mine ? " · tap to change" : ""}
              </small>
            </>
          );
          return (
            <div key={id} className={"wb-row" + (mine ? " is-mine" : "")} data-person={id}>
              <span className="cp-av is-sm" style={{ background: "var(--series-" + id + ")" }} aria-hidden="true">
                {NAME[id][0]}
              </span>
              {mine ? (
                <button type="button" className="wb-bubble" onClick={() => setDraft(note.message)}>
                  {body}
                </button>
              ) : (
                <div className="wb-bubble">{body}</div>
              )}
            </div>
          );
        })}
      </div>
      <form className="wb-form" onSubmit={send}>
        <input
          type="text"
          value={draft}
          maxLength={500}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={notes[me]?.message ? "Change your note…" : "Write a note…"}
          aria-label="Your note for today"
        />
        <button type="submit" className="wb-send" disabled={saving || !draft.trim()} aria-label="Send note">
          <ArrowUp size={18} strokeWidth={2.6} />
        </button>
      </form>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
