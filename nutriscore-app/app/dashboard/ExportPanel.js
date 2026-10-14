"use client";

import { Download } from "lucide-react";
import Modal from "./Modal";

const EXPORTS = [
  { what: "food", label: "Food log", desc: "Every meal and snack with calories and macros" },
  { what: "weekly", label: "Weekly check-ins", desc: "Weight, waist, sleep, training load…" },
  { what: "measurements", label: "Measurements", desc: "Body measurements by date" },
  { what: "bloodwork", label: "Bloodwork", desc: "Ferritin, B12, folate, vitamin D panels" },
  { what: "training", label: "Training sessions", desc: "Workouts you logged by hand" }
];

// Drawer → Settings → Export my data. Each link downloads a CSV of your own
// data from /api/export — opens in Excel, Numbers or Google Sheets.
export default function ExportPanel({ onClose }) {
  return (
    <Modal title="Export my data" onClose={onClose}>
      <p className="panel-desc">Spreadsheet files (CSV) of everything you've logged. Only your own data.</p>
      <div className="group-list">
        {EXPORTS.map((e) => (
          <a key={e.what} className="group-row export-row" href={"/api/export?what=" + e.what} download>
            <span className="group-row-main">
              <span className="group-row-title">{e.label}</span>
              <span className="group-row-value">{e.desc}</span>
            </span>
            <Download size={17} strokeWidth={2} className="group-row-chevron" />
          </a>
        ))}
      </div>
    </Modal>
  );
}
