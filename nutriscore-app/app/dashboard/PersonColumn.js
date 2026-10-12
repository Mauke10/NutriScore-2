"use client";

import SnackSection from "./SnackSection";
import WeeklySection from "./WeeklySection";
import TrainingSection from "./TrainingSection";
import BloodworkSection from "./BloodworkSection";

export default function PersonColumn({ personId, displayName, seriesVar, isMe, data }) {
  const {
    weekly,
    bloodwork,
    snacks,
    training,
    sessions,
    calorieTarget,
    proteinTarget,
    swimGoalKm,
    bikeGoalKm,
    runGoalKm,
    stravaStatus,
    refreshWeekly,
    refreshBloodwork,
    refreshSnacks,
    refreshTraining,
    refreshSessions,
    refreshTarget,
    refreshStravaStatus
  } = data;

  return (
    <div data-person={personId}>
      <div className="person-head">
        <h2>
          <span className="dot" style={{ background: "var(" + seriesVar + ")" }} />
          {displayName}
        </h2>
        {isMe && <span className="you-tag">(you)</span>}
      </div>

      <SnackSection
        personId={personId}
        isMe={isMe}
        snacks={snacks}
        refreshSnacks={refreshSnacks}
        calorieTarget={calorieTarget}
        proteinTarget={proteinTarget}
        refreshTarget={refreshTarget}
      />
      <WeeklySection personId={personId} isMe={isMe} weekly={weekly} refreshWeekly={refreshWeekly} snacks={snacks} />
      <TrainingSection
        personId={personId}
        isMe={isMe}
        training={training}
        refreshTraining={refreshTraining}
        sessions={sessions}
        refreshSessions={refreshSessions}
        swimGoalKm={swimGoalKm}
        bikeGoalKm={bikeGoalKm}
        runGoalKm={runGoalKm}
        stravaStatus={stravaStatus}
        refreshStravaStatus={refreshStravaStatus}
      />
      <BloodworkSection personId={personId} isMe={isMe} bloodwork={bloodwork} refreshBloodwork={refreshBloodwork} />
    </div>
  );
}
