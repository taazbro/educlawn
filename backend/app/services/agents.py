from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from typing import Any

from app.api.schemas import LearnerProfile
from app.services.feature_engineering import build_feature_row
from app.services.knowledge import LocalKnowledgeService
from app.services.ml import LearningIntelligenceService
from app.services.warehouse import WarehouseService


AGENT_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "name": "mentor",
        "display_name": "Mentor Agent",
        "role": "Learner support strategist",
        "description": "Builds coaching actions from support need, resilience, memory, and intervention signals.",
        "requires_admin": False,
    },
    {
        "name": "strategist",
        "display_name": "Strategist Agent",
        "role": "Mission sequencing planner",
        "description": "Turns model predictions, memory, and scene retrieval into next-mission plans.",
        "requires_admin": False,
    },
    {
        "name": "historian",
        "display_name": "Historian Agent",
        "role": "Context and source guide",
        "description": "Connects the suggested scene to local historical themes and retrieved teaching documents.",
        "requires_admin": False,
    },
    {
        "name": "operations",
        "display_name": "Operations Agent",
        "role": "Platform health analyst",
        "description": "Reads snapshots, scheduler state, and workflow history to suggest operational actions.",
        "requires_admin": True,
    },
    {
        "name": "planner",
        "display_name": "Planner Agent",
        "role": "Mission planner",
        "description": "Chains agent outputs, temporal state, graph context, and policies into multi-step missions.",
        "requires_admin": False,
    },
)


class LocalAgentService:
    def __init__(
        self,
        warehouse: WarehouseService,
        intelligence: LearningIntelligenceService,
        knowledge_service: LocalKnowledgeService,
    ) -> None:
        self.warehouse = warehouse
        self.intelligence = intelligence
        self.knowledge_service = knowledge_service

    def get_catalog(self) -> list[dict[str, Any]]:
        return [dict(entry) for entry in AGENT_CATALOG]

    def run_profile_agents(
        self,
        profile: LearnerProfile,
        agent_names: list[str] | None = None,
    ) -> dict[str, Any]:
        evaluation = self.intelligence.evaluate_profile(profile)
        features = build_feature_row(profile.model_dump())
        prior_memory = self.get_agent_memory(profile.learner_id)
        knowledge_matches = self.knowledge_service.search(
            scene_focus=str(evaluation["suggested_scene_focus"]),
            predicted_path=str(evaluation["predicted_path"]),
            risk_band=str(evaluation["risk_band"]),
        )
        recent_sessions = self.warehouse.fetch_recent_learner_sessions(profile.learner_id, limit=4)
        selected_agents = agent_names or ["mentor", "strategist", "historian"]

        agent_builders = {
            "mentor": self._mentor_agent,
            "strategist": self._strategist_agent,
            "historian": self._historian_agent,
        }

        try:
            agents = [
                agent_builders[agent_name](
                    evaluation=evaluation,
                    features=features,
                    prior_memory=prior_memory,
                    knowledge_matches=knowledge_matches,
                    recent_sessions=recent_sessions,
                )
                for agent_name in selected_agents
            ]
        except KeyError as error:
            raise ValueError(f"Unsupported agent: {error.args[0]}") from error

        self.warehouse.record_agent_memories(
            learner_id=profile.learner_id,
            evaluation=evaluation,
            agents=agents,
            knowledge_matches=knowledge_matches,
        )
        memory = self.get_agent_memory(profile.learner_id)

        return {
            "generated_at": datetime.now(UTC).isoformat(),
            "evaluation": {
                "predicted_path": str(evaluation["predicted_path"]),
                "risk_band": str(evaluation["risk_band"]),
                "confidence": float(evaluation["confidence"]),
                "cohort_label": str(evaluation["cohort_label"]),
                "suggested_scene_focus": str(evaluation["suggested_scene_focus"]),
            },
            "agents": agents,
            "knowledge_matches": knowledge_matches,
            "memory": memory,
        }

    def get_agent_memory(self, learner_id: str, limit: int = 12) -> dict[str, Any]:
        timeline = self.warehouse.fetch_agent_memory(learner_id, limit=limit)
        summary = self._build_memory_summary(learner_id, timeline)
        return {
            "summary": summary,
            "timeline": timeline,
        }

    def build_admin_briefing(
        self,
        latest_snapshot: dict[str, Any] | None,
        workflow_runs: list[dict[str, Any]],
        scheduler_status: dict[str, Any],
        model_summary: dict[str, Any],
    ) -> dict[str, Any]:
        high_risk_share = float((latest_snapshot or {}).get("high_risk_share", 0.0))
        learner_count = int((latest_snapshot or {}).get("learner_count", 0))
        average_mastery = float((latest_snapshot or {}).get("average_mastery", 0.0))
        top_feature = "n/a"
        if model_summary.get("top_features"):
            top_feature = str(model_summary["top_features"][0]["feature"]).replace("_", " ")

        latest_run = workflow_runs[0] if workflow_runs else None
        scheduler_enabled = bool(scheduler_status["enabled"])
        active_tasks = int(scheduler_status["active_tasks"])

        if high_risk_share >= 20:
            priority = "high"
            summary = (
                f"Risk pressure is elevated across {learner_count} learners. "
                f"The latest snapshot shows {high_risk_share:.1f}% in the high-risk band."
            )
        elif not scheduler_enabled:
            priority = "high"
            summary = "Automated orchestration is disabled, so snapshot and retraining freshness now depend on manual actions."
        else:
            priority = "medium"
            summary = (
                f"The platform is stable with average mastery at {average_mastery:.1f}%. "
                f"Use the workflow ledger to keep retraining aligned with new sessions."
            )

        actions = []
        if not scheduler_enabled:
            actions.append("Enable the scheduler or establish a regular manual cadence for snapshots and retraining.")
        if high_risk_share >= 20:
            actions.append("Run a fresh ETL snapshot and review intervention patterns for the highest-risk cohort.")
        else:
            actions.append("Keep the ETL snapshot current so agent recommendations reflect the latest learner sessions.")
        actions.append("Use the secure retrain path after meaningful warehouse growth to refresh local model weights.")

        if latest_run and str(latest_run["status"]) != "success":
            actions.append("Investigate the most recent failed workflow before scheduling the next retrain window.")
        else:
            actions.append("Review the workflow ledger for drift between model training volume and current warehouse size.")

        signals = [
            f"Scheduler enabled: {scheduler_enabled}",
            f"Active tasks: {active_tasks}",
            f"Latest snapshot learners: {learner_count}",
            f"Top model feature: {top_feature}",
        ]
        if latest_run:
            signals.append(
                "Latest workflow: "
                f"{latest_run['workflow_name']} ({latest_run['status']}) at {latest_run['started_at']}"
            )

        return {
            "generated_at": datetime.now(UTC).isoformat(),
            "operations_agent": {
                "agent_name": "operations",
                "display_name": "Operations Agent",
                "role": "Platform health analyst",
                "summary": summary,
                "confidence": 88.0 if scheduler_enabled else 92.0,
                "priority": priority,
                "signals": signals,
                "actions": actions[:4],
            },
        }

    def _build_memory_summary(self, learner_id: str, timeline: list[dict[str, Any]]) -> dict[str, Any]:
        if not timeline:
            return {
                "learner_id": learner_id,
                "run_count": 0,
                "last_path": None,
                "last_risk": None,
                "dominant_agent": None,
                "last_run_at": None,
            }

        counts = Counter(str(entry["agent_name"]) for entry in timeline)
        latest = timeline[0]
        return {
            "learner_id": learner_id,
            "run_count": len(timeline),
            "last_path": str(latest["predicted_path"]),
            "last_risk": str(latest["risk_band"]),
            "dominant_agent": counts.most_common(1)[0][0],
            "last_run_at": str(latest["created_at"]),
        }

    def _mentor_agent(
        self,
        evaluation: dict[str, Any],
        features: dict[str, float | int | str],
        prior_memory: dict[str, Any],
        knowledge_matches: list[dict[str, Any]],
        recent_sessions: list[dict[str, Any]],
    ) -> dict[str, Any]:
        support_need = float(features["support_need_index"])
        resilience = float(features["resilience_index"])
        efficiency = float(features["efficiency_score"])
        risk_band = str(evaluation["risk_band"])
        prior_risk = prior_memory["summary"]["last_risk"]

        if risk_band == "high":
            summary = "Momentum is fragile. Reduce complexity, reinforce nonviolent decision-making, and stabilize confidence quickly."
            priority = "high"
        elif risk_band == "moderate":
            summary = "The learner can progress, but they need scaffolded challenge and tighter feedback loops."
            priority = "medium"
        else:
            summary = "The learner is stable enough for stretch work, but guided reflection should preserve momentum."
            priority = "low"

        actions = list(evaluation["intervention_plan"][:3])
        if efficiency < 2.5:
            actions.append("Shorten the next mission into smaller milestones so pace does not suppress understanding.")
        if resilience < 68:
            actions.append("Add a short reflection checkpoint before the next branching decision.")
        if prior_risk == risk_band and risk_band in {"high", "moderate"}:
            actions.append("Memory shows the same risk band on the last run, so avoid escalating challenge until recovery signals appear.")

        signals = [
            f"Risk band: {risk_band}",
            f"Support need index: {support_need:.1f}",
            f"Resilience index: {resilience:.1f}",
            f"Efficiency score: {efficiency:.1f}",
        ]
        if prior_risk:
            signals.append(f"Previous memory risk: {prior_risk}")
        if recent_sessions:
            signals.append(f"Stored learner sessions: {len(recent_sessions)}")
        if knowledge_matches:
            signals.append(f"Support source: {knowledge_matches[0]['title']}")

        return {
            "agent_name": "mentor",
            "display_name": "Mentor Agent",
            "role": "Learner support strategist",
            "summary": summary,
            "confidence": round(max(58.0, float(evaluation["confidence"]) - support_need * 0.12), 1),
            "priority": priority,
            "signals": signals[:5],
            "actions": actions[:4],
        }

    def _strategist_agent(
        self,
        evaluation: dict[str, Any],
        features: dict[str, float | int | str],
        prior_memory: dict[str, Any],
        knowledge_matches: list[dict[str, Any]],
        recent_sessions: list[dict[str, Any]],
    ) -> dict[str, Any]:
        predicted_path = str(evaluation["predicted_path"])
        cohort_label = str(evaluation["cohort_label"])
        coalition_index = float(features["coalition_index"])
        previous_path = prior_memory["summary"]["last_path"]

        if predicted_path == "movement_builder":
            summary = "Sequence the learner into coalition-heavy missions that reward organizing judgment and social coordination."
            actions = [
                "Queue a coalition-building mission with cross-community tradeoffs.",
                "Prioritize the Poor People's Campaign or another organizing-focused scene arc.",
                "Ask for one written reflection on how nonviolence scales across a broader movement.",
            ]
        elif predicted_path == "policy_strategist":
            summary = "Lean into analytical missions that convert historical evidence into policy argument and civic decision-making."
            actions = [
                "Route the learner into Selma and Voting Rights with policy tradeoff prompts.",
                "Add one evidence-ranking challenge before the next scene unlock.",
                "Assign a short memo that compares moral urgency to legislative timing.",
            ]
        else:
            summary = "Use rhetoric and framing missions to sharpen persuasive clarity and public-facing leadership."
            actions = [
                "Queue a March on Washington narrative lab with speech analysis.",
                "Ask the learner to rewrite a message for multiple audiences.",
                "Follow with a reflection on how moral language shapes coalition trust.",
            ]

        if coalition_index < 65:
            actions.append("Include one collaborative decision point so strategy remains connected to coalition building.")
        if previous_path == predicted_path and prior_memory["summary"]["run_count"] >= 3:
            actions.append("Memory shows the same path repeating, so add one adjacent challenge to prevent plateauing.")

        signals = [
            f"Predicted path: {predicted_path.replace('_', ' ')}",
            f"Cohort label: {cohort_label}",
            f"Coalition index: {coalition_index:.1f}",
            f"Suggested scene: {evaluation['suggested_scene_focus']}",
        ]
        if previous_path:
            signals.append(f"Previous memory path: {previous_path.replace('_', ' ')}")
        if recent_sessions:
            signals.append(f"Learner warehouse sessions: {len(recent_sessions)}")

        return {
            "agent_name": "strategist",
            "display_name": "Strategist Agent",
            "role": "Mission sequencing planner",
            "summary": summary,
            "confidence": round(float(evaluation["confidence"]), 1),
            "priority": "medium" if float(evaluation["confidence"]) >= 70 else "high",
            "signals": signals[:5],
            "actions": actions[:4],
        }

    def _historian_agent(
        self,
        evaluation: dict[str, Any],
        features: dict[str, float | int | str],
        prior_memory: dict[str, Any],
        knowledge_matches: list[dict[str, Any]],
        recent_sessions: list[dict[str, Any]],
    ) -> dict[str, Any]:
        scene_focus = str(evaluation["suggested_scene_focus"])
        mastery = float(features["mastery_index"])
        lead_document = knowledge_matches[0] if knowledge_matches else None
        prior_run_count = int(prior_memory["summary"]["run_count"])

        summary = f"Frame the next activity around {scene_focus} using retrieved local context, not just the raw model prediction."
        if lead_document:
            summary += f" Start with {lead_document['title']} as the anchor source."

        actions = []
        if lead_document:
            actions.append(lead_document["teaching_use"])
            actions.append(f"Use {lead_document['title']} to ground the learner's next reflection prompt.")
        actions.append(f"Ask the learner to explain how {scene_focus} changes the movement's tactical picture.")
        if prior_run_count >= 3:
            actions.append("Compare this scene to one from the learner's earlier memory timeline to surface continuity and change.")

        signals = [
            f"Scene focus: {scene_focus}",
            f"Mastery index: {mastery:.1f}",
            f"Historical alignment: {float(features['historical_alignment']):.1f}",
        ]
        if lead_document:
            signals.append(f"Lead source: {lead_document['document_id']}")
        signals.append(f"Memory run count: {prior_run_count}")

        return {
            "agent_name": "historian",
            "display_name": "Historian Agent",
            "role": "Context and source guide",
            "summary": summary,
            "confidence": 84.0 if mastery >= 70 else 79.0,
            "priority": "medium",
            "signals": signals[:5],
            "actions": actions[:4],
        }
