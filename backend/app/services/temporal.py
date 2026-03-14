from __future__ import annotations

from typing import Any

import pandas as pd

from app.services.feature_engineering import build_feature_frame, build_feature_row
from app.services.warehouse import WarehouseService


class TemporalLearnerModel:
    def __init__(self, warehouse: WarehouseService) -> None:
        self.warehouse = warehouse

    def build_state(
        self,
        learner_id: str,
        current_evaluation: dict[str, Any],
        current_profile: dict[str, Any],
    ) -> dict[str, Any]:
        recent_sessions = self.warehouse.fetch_recent_learner_sessions(learner_id, limit=8)
        history_frame = build_feature_frame(pd.DataFrame(recent_sessions)) if recent_sessions else pd.DataFrame()

        current_feature_row = build_feature_row(current_profile)
        current_mastery = float(current_feature_row["mastery_index"])
        current_accuracy = float(current_feature_row["accuracy_rate"])

        if history_frame.empty:
            average_mastery = current_mastery
            average_accuracy = current_accuracy
            mastery_velocity = 0.0
            accuracy_velocity = 0.0
            risk_stability = 50.0
            path_consistency = 50.0
            intervention_effectiveness = max(35.0, 100.0 - float(current_feature_row["support_need_index"]))
            session_count = 1
        else:
            mastery_series = history_frame["mastery_index"].astype(float)
            accuracy_series = history_frame["accuracy_rate"].astype(float)
            risk_series = history_frame["engagement_risk"].astype(str)
            path_series = history_frame["recommended_path"].astype(str)

            average_mastery = round(float((mastery_series.sum() + current_mastery) / (len(mastery_series) + 1)), 1)
            average_accuracy = round(float((accuracy_series.sum() + current_accuracy) / (len(accuracy_series) + 1)), 1)
            mastery_velocity = round(current_mastery - float(mastery_series.tail(3).mean()), 1)
            accuracy_velocity = round(current_accuracy - float(accuracy_series.tail(3).mean()), 1)
            path_consistency = round(float((path_series == str(current_evaluation["predicted_path"])).mean() * 100), 1)

            recent_risks = risk_series.tail(4).tolist() + [str(current_evaluation["risk_band"])]
            changes = sum(
                1
                for left, right in zip(recent_risks, recent_risks[1:], strict=False)
                if left != right
            )
            risk_stability = round(max(0.0, 100.0 - changes * 20.0), 1)

            recent_support = history_frame["support_need_index"].astype(float).tail(3)
            intervention_effectiveness = round(
                max(
                    0.0,
                    min(
                        100.0,
                        60.0 + (float(recent_support.mean()) - float(current_feature_row["support_need_index"])) * 1.5,
                    ),
                ),
                1,
            )
            session_count = int(len(history_frame) + 1)

        if mastery_velocity >= 4 and str(current_evaluation["risk_band"]) == "low":
            momentum_label = "accelerating"
            recommended_intensity = "advance"
        elif mastery_velocity <= -2 or str(current_evaluation["risk_band"]) == "high":
            momentum_label = "fragile"
            recommended_intensity = "stabilize"
        else:
            momentum_label = "steady"
            recommended_intensity = "guide"

        narrative = (
            f"{learner_id.replace('-', ' ').title()} shows {momentum_label} momentum with "
            f"mastery velocity at {mastery_velocity:+.1f} and risk stability at {risk_stability:.1f}."
        )

        return {
            "learner_id": learner_id,
            "session_count": session_count,
            "average_mastery": average_mastery,
            "average_accuracy": average_accuracy,
            "mastery_velocity": mastery_velocity,
            "accuracy_velocity": accuracy_velocity,
            "risk_stability": risk_stability,
            "path_consistency": path_consistency,
            "intervention_effectiveness": intervention_effectiveness,
            "momentum_label": momentum_label,
            "recommended_intensity": recommended_intensity,
            "current_path": str(current_evaluation["predicted_path"]),
            "current_risk": str(current_evaluation["risk_band"]),
            "narrative": narrative,
        }
