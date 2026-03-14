from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.services.warehouse import WarehouseService


POLICIES: tuple[dict[str, str], ...] = (
    {
        "policy_name": "reflective_scaffold",
        "policy_label": "Reflective Scaffold",
        "description": "Lower intensity with frequent reflection and checkpoint prompts.",
    },
    {
        "policy_name": "coalition_sprint",
        "policy_label": "Coalition Sprint",
        "description": "Social coordination challenges and movement-building missions.",
    },
    {
        "policy_name": "evidence_lab",
        "policy_label": "Evidence Lab",
        "description": "Policy and historical analysis with explicit evidence ranking.",
    },
    {
        "policy_name": "rhetoric_studio",
        "policy_label": "Rhetoric Studio",
        "description": "Narrative framing, speechcraft, and audience adaptation.",
    },
)


class ExperimentationService:
    def __init__(self, warehouse: WarehouseService) -> None:
        self.warehouse = warehouse

    def recommend(
        self,
        learner_id: str,
        evaluation: dict[str, Any],
        temporal_state: dict[str, Any],
    ) -> dict[str, Any]:
        metrics = self.warehouse.fetch_experiment_metrics()
        counts = {item["policy_name"]: int(item["assignment_count"]) for item in metrics["policies"]}

        scored_policies: list[dict[str, Any]] = []
        for policy in POLICIES:
            exploitation = self._policy_fit(policy["policy_name"], evaluation, temporal_state)
            exploration = max(0.0, 12.0 - counts.get(policy["policy_name"], 0) * 1.5)
            estimated_lift = round(min(99.0, exploitation * 0.75 + exploration * 0.25), 1)
            scored_policies.append(
                {
                    **policy,
                    "exploitation_score": round(exploitation, 1),
                    "exploration_score": round(exploration, 1),
                    "estimated_lift": estimated_lift,
                }
            )

        selected = max(scored_policies, key=lambda item: item["estimated_lift"])
        rationale = self._rationale(selected["policy_name"], evaluation, temporal_state)
        assigned_at = datetime.now(UTC).isoformat()
        assignment_id = self.warehouse.record_experiment_assignment(
            learner_id=learner_id,
            policy_name=selected["policy_name"],
            policy_label=selected["policy_label"],
            rationale=rationale,
            exploitation_score=float(selected["exploitation_score"]),
            exploration_score=float(selected["exploration_score"]),
            estimated_lift=float(selected["estimated_lift"]),
            assigned_at=assigned_at,
            context={
                "predicted_path": evaluation["predicted_path"],
                "risk_band": evaluation["risk_band"],
                "momentum_label": temporal_state["momentum_label"],
            },
        )

        return {
            "assignment_id": assignment_id,
            "learner_id": learner_id,
            "policy_name": selected["policy_name"],
            "policy_label": selected["policy_label"],
            "rationale": rationale,
            "estimated_lift": float(selected["estimated_lift"]),
            "exploration_score": float(selected["exploration_score"]),
            "exploitation_score": float(selected["exploitation_score"]),
            "assigned_at": assigned_at,
        }

    def get_metrics(self) -> dict[str, Any]:
        metrics = self.warehouse.fetch_experiment_metrics()
        policy_metrics = {
            str(item["policy_name"]): item
            for item in metrics["policies"]
        }

        hydrated = []
        for policy in POLICIES:
            existing = policy_metrics.get(policy["policy_name"])
            if existing is None:
                hydrated.append(
                    {
                        "policy_name": policy["policy_name"],
                        "policy_label": policy["policy_label"],
                        "assignment_count": 0,
                        "average_estimated_lift": 0.0,
                    }
                )
                continue

            hydrated.append(existing)

        return {
            "total_assignments": int(metrics["total_assignments"]),
            "policies": hydrated,
        }

    def _policy_fit(self, policy_name: str, evaluation: dict[str, Any], temporal_state: dict[str, Any]) -> float:
        risk = str(evaluation["risk_band"])
        path = str(evaluation["predicted_path"])
        momentum = str(temporal_state["momentum_label"])

        score = 40.0
        if policy_name == "reflective_scaffold":
            if risk == "high":
                score += 34.0
            if momentum == "fragile":
                score += 18.0
        elif policy_name == "coalition_sprint":
            if path == "movement_builder":
                score += 30.0
            if momentum == "accelerating":
                score += 12.0
        elif policy_name == "evidence_lab":
            if path == "policy_strategist":
                score += 32.0
            if risk != "high":
                score += 10.0
        elif policy_name == "rhetoric_studio":
            if path == "speech_architect":
                score += 32.0
            if momentum != "fragile":
                score += 8.0
        return min(score, 95.0)

    def _rationale(self, policy_name: str, evaluation: dict[str, Any], temporal_state: dict[str, Any]) -> str:
        if policy_name == "reflective_scaffold":
            return (
                f"{evaluation['risk_band'].title()} risk and {temporal_state['momentum_label']} momentum suggest "
                "reflection-heavy scaffolding before increasing challenge."
            )
        if policy_name == "coalition_sprint":
            return "Movement-building potential is high, so a coalition-first intervention is the best next experiment."
        if policy_name == "evidence_lab":
            return "Policy-oriented reasoning is emerging strongly enough to test a deeper evidence-ranking sequence."
        return "Narrative and public-facing leadership are strong enough to test a rhetoric-focused intervention."
