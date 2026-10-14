"use client";

import Modal from "./Modal";
import SnackSection from "./SnackSection";

// Drawer → "Laura's day" / "Martin's day": the other person's food tab,
// read-only — ring, macros, 7-day chart (swipe works) and what they logged.
// If they've turned off "… sees my meals", the server only sends numbers and
// entries read just "Meal" / "Snack".
export default function PartnerDayPanel({ partnerId, data, onClose }) {
  const name = partnerId === "laura" ? "Laura" : "Martin";
  return (
    <Modal title={name + "'s day"} onClose={onClose}>
      <div data-person={partnerId} className="partner-day">
        {data.mealsHidden && <p className="panel-desc">{name} shares totals only, not what was eaten.</p>}
        <SnackSection personId={partnerId} isMe={false} snacks={data.snacks} calorieTarget={data.calorieTarget} proteinTarget={data.proteinTarget} />
      </div>
    </Modal>
  );
}
