"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [personId, setPersonId] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!personId) {
      setError("Pick who you are first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, personId })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setBusy(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — try again.");
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>Nutriscore</h1>
        <p>Shared tracker. Pick who you are, then enter the PIN.</p>
        <form onSubmit={submit} style={{ display: "block" }}>
          <div className="profile-picker">
            <button
              type="button"
              className={"profile-btn" + (personId === "martin" ? " selected" : "")}
              data-person="martin"
              onClick={() => setPersonId("martin")}
            >
              Martin
            </button>
            <button
              type="button"
              className={"profile-btn" + (personId === "laura" ? " selected" : "")}
              data-person="laura"
              onClick={() => setPersonId("laura")}
            >
              Laura
            </button>
          </div>
          <div className="field wide" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor="pin">PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
            />
          </div>
          <div className="error-text">{error}</div>
          <button type="submit" className="primary" disabled={busy} style={{ width: "100%", marginTop: 6 }}>
            {busy ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
