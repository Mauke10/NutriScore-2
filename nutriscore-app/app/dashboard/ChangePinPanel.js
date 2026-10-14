"use client";

import { useState } from "react";
import Modal from "./Modal";

const emptyPinForm = { currentPin: "", newPin: "", confirmPin: "" };

// Drawer → Settings → Change PIN. Only ever changes the signed-in person's
// own PIN (see app/api/change-pin/route.js).
export default function ChangePinPanel({ personId, onClose }) {
  const [pinForm, setPinForm] = useState(emptyPinForm);
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMsg, setPinMsg] = useState("");
  const [pinError, setPinError] = useState("");

  function setPinField(key, value) {
    setPinForm((f) => ({ ...f, [key]: value }));
  }

  async function changePin(e) {
    e.preventDefault();
    setPinError("");
    setPinMsg("");
    if (!pinForm.currentPin || !pinForm.newPin) {
      setPinError("Fill in your current PIN and a new one.");
      return;
    }
    if (pinForm.newPin !== pinForm.confirmPin) {
      setPinError("New PIN and confirmation don't match.");
      return;
    }
    setPinSaving(true);
    try {
      const res = await fetch("/api/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin: pinForm.currentPin, newPin: pinForm.newPin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't change your PIN.");
      setPinForm(emptyPinForm);
      setPinMsg("PIN changed.");
    } catch (err) {
      setPinError(err.message);
    } finally {
      setPinSaving(false);
    }
  }

  return (
    <Modal title="Change your PIN" onClose={onClose}>
      <p className="panel-desc">
        This only changes your own login PIN — {personId === "laura" ? "Martin's" : "Laura's"} stays whatever it is now.
      </p>
      <form onSubmit={changePin}>
        <div className="field wide">
          <label htmlFor="pin-current">Current PIN</label>
          <input
            id="pin-current"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pinForm.currentPin}
            onChange={(e) => setPinField("currentPin", e.target.value)}
            placeholder="••••"
          />
        </div>
        <div className="field">
          <label htmlFor="pin-new">New PIN</label>
          <input
            id="pin-new"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pinForm.newPin}
            onChange={(e) => setPinField("newPin", e.target.value)}
            placeholder="••••"
          />
        </div>
        <div className="field">
          <label htmlFor="pin-confirm">Confirm new PIN</label>
          <input
            id="pin-confirm"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pinForm.confirmPin}
            onChange={(e) => setPinField("confirmPin", e.target.value)}
            placeholder="••••"
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="primary" disabled={pinSaving}>
            {pinSaving ? "Saving…" : "Change PIN"}
          </button>
          {pinError && <span className="error-text inline">{pinError}</span>}
          {!pinError && pinMsg && <span className="success-text">{pinMsg}</span>}
        </div>
      </form>
    </Modal>
  );
}
