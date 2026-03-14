from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.api.schemas import LearnerProfile
from app.services.agents import LocalAgentService
from app.services.experimentation import ExperimentationService
from app.services.graph import KnowledgeGraphService
from app.services.temporal import TemporalLearnerModel
from app.services.warehouse import WarehouseService


class MissionPlannerService:
    def __init__(
        self,
        warehouse: WarehouseService,
        agent_service: LocalAgentService,
        temporal_model: TemporalLearnerModel,
        graph_service: KnowledgeGraphService,
        experimentation_service: ExperimentationService,
    ) -> None:
        self.warehouse = warehouse
        self.agent_service = agent_service
        self.temporal_model = temporal_model
        self.graph_service = graph_service
        self.experimentation_service = experimentation_service

    def generate_plan(self, profile: LearnerProfile) -> dict[str, Any]:
        agent_run = self.agent_service.run_profile_agents(profile)
        evaluation = agent_run["evaluation"]
        temporal_state = self.temporal_model.build_state(profile.learner_id, evaluation, profile.model_dump())
        graph_context = self.graph_service.get_context(
            scene_focus=str(evaluation["suggested_scene_focus"]),
            predicted_path=str(evaluation["predicted_path"]),
        )
        experiment_policy = self.experimentation_service.recommend(
            learner_id=profile.learner_id,
            evaluation=evaluation,
            temporal_state=temporal_state,
        )

        planner_agent = self._planner_agent(agent_run, temporal_state, experiment_policy)
        steps = self._build_steps(agent_run, temporal_state, experiment_policy)
        checkpoints = self._build_checkpoints(temporal_state, experiment_policy)
        branches = self._build_branches(temporal_state)
        completion_criteria = self._completion_criteria(evaluation, temporal_state)

        payload = {
            "learner_id": profile.learner_id,
            "generated_at": datetime.now(UTC).isoformat(),
            "mission_title": f"{str(evaluation['suggested_scene_focus'])} Mission Sequence",
            "objective": (
                f"Advance {profile.learner_id.replace('-', ' ').title()} toward "
                f"{str(evaluation['predicted_path']).replace('_', ' ')} through a structured local-agent plan."
            ),
            "target_path": str(evaluation["predicted_path"]),
            "target_scene": str(evaluation["suggested_scene_focus"]),
            "planner_agent": planner_agent,
            "supporting_agents": agent_run["agents"],
            "temporal_state": temporal_state,
            "experiment_policy": experiment_policy,
            "knowledge_matches": agent_run["knowledge_matches"],
            "graph_context": graph_context,
            "steps": steps,
            "checkpoints": checkpoints,
            "branches": branches,
            "completion_criteria": completion_criteria,
        }

        plan_id = self.warehouse.record_mission_plan(profile.learner_id, payload)
        return {
            "plan_id": plan_id,
            **payload,
        }

    def get_latest_plan(self, learner_id: str) -> dict[str, Any] | None:
        return self.warehouse.get_latest_mission_plan(learner_id)

    def _planner_agent(
        self,
        agent_run: dict[str, Any],
        temporal_state: dict[str, Any],
        experiment_policy: dict[str, Any],
    ) -> dict[str, Any]:
        evaluation = agent_run["evaluation"]
        summary = (
            f"Plan a {temporal_state['recommended_intensity']} mission around {evaluation['suggested_scene_focus']} "
            f"using {experiment_policy['policy_label']} as the experimental policy."
        )
        return {
            "agent_name": "planner",
            "display_name": "Planner Agent",
            "role": "Mission planner",
            "summary": summary,
            "confidence": round(
                min(
                    97.0,
                    float(evaluation["confidence"]) * 0.7 + float(experiment_policy["estimated_lift"]) * 0.3,
                ),
                1,
            ),
            "priority": "high" if temporal_state["recommended_intensity"] == "stabilize" else "medium",
            "signals": [
                f"Momentum: {temporal_state['momentum_label']}",
                f"Recommended intensity: {temporal_state['recommended_intensity']}",
                f"Experiment policy: {experiment_policy['policy_name']}",
                f"Target scene: {evaluation['suggested_scene_focus']}",
            ],
            "actions": [
                "Sequence the mission so the first step matches current momentum and risk.",
                "Use retrieved documents and graph context to keep the plan historically grounded.",
                "Track checkpoint performance before escalating difficulty.",
            ],
        }

    def _build_steps(
        self,
        agent_run: dict[str, Any],
        temporal_state: dict[str, Any],
        experiment_policy: dict[str, Any],
    ) -> list[dict[str, Any]]:
        evaluation = agent_run["evaluation"]
        lead_doc = agent_run["knowledge_matches"][0]
        duration_base = 12 if temporal_state["recommended_intensity"] == "stabilize" else 18

        return [
            {
                "step_number": 1,
                "title": "Anchor The Scene",
                "purpose": f"Open with {lead_doc['title']} to establish context for {evaluation['suggested_scene_focus']}.",
                "recommended_agent": "historian",
                "duration_minutes": duration_base,
                "success_signal": "Learner explains the scene's strategic significance in one clear claim.",
                "resources": [lead_doc["document_id"], evaluation["suggested_scene_focus"]],
            },
            {
                "step_number": 2,
                "title": "Stabilize Or Stretch",
                "purpose": f"Apply the {experiment_policy['policy_label']} intervention to match current momentum.",
                "recommended_agent": "mentor",
                "duration_minutes": duration_base,
                "success_signal": "Learner completes the prompt sequence without a drop in confidence or alignment.",
                "resources": [experiment_policy["policy_name"], temporal_state["recommended_intensity"]],
            },
            {
                "step_number": 3,
                "title": "Strategic Choice",
                "purpose": f"Move the learner toward {evaluation['predicted_path'].replace('_', ' ')} through a branching mission.",
                "recommended_agent": "strategist",
                "duration_minutes": duration_base + 4,
                "success_signal": "Learner justifies a decision with both movement values and practical tradeoffs.",
                "resources": [evaluation["predicted_path"], evaluation["cohort_label"]],
            },
            {
                "step_number": 4,
                "title": "Mission Synthesis",
                "purpose": "Close with a planner-led reflection that converts the scene into a repeatable civic strategy.",
                "recommended_agent": "planner",
                "duration_minutes": max(10, duration_base - 2),
                "success_signal": "Learner articulates what to repeat, what to adapt, and what evidence mattered most.",
                "resources": [evaluation["suggested_scene_focus"], experiment_policy["policy_label"]],
            },
        ]

    def _build_checkpoints(self, temporal_state: dict[str, Any], experiment_policy: dict[str, Any]) -> list[dict[str, Any]]:
        return [
            {
                "name": "Momentum Check",
                "description": f"Verify that {temporal_state['momentum_label']} momentum did not degrade after step 2.",
                "metric": "confidence_and_completion",
            },
            {
                "name": "Policy Check",
                "description": f"Measure whether {experiment_policy['policy_label']} improved task completion quality.",
                "metric": "policy_effectiveness_proxy",
            },
            {
                "name": "Historical Check",
                "description": "Confirm the learner can connect tactical choices to historical context.",
                "metric": "historical_alignment_response",
            },
        ]

    def _build_branches(self, temporal_state: dict[str, Any]) -> list[dict[str, Any]]:
        branches = [
            {
                "condition": "If the learner struggles to explain the scene's strategy, repeat step 1 with a smaller evidence set.",
                "fallback_step": "Anchor The Scene",
            },
            {
                "condition": "If support need remains high after step 2, insert another reflective scaffold before the strategic branch.",
                "fallback_step": "Stabilize Or Stretch",
            },
        ]
        if temporal_state["recommended_intensity"] == "advance":
            branches.append(
                {
                    "condition": "If the learner clears checkpoints quickly, escalate into a comparison across two campaigns.",
                    "fallback_step": "Mission Synthesis",
                }
            )
        return branches

    def _completion_criteria(self, evaluation: dict[str, Any], temporal_state: dict[str, Any]) -> list[str]:
        return [
            f"Learner maintains or improves {evaluation['risk_band']} risk posture through the mission.",
            "Learner produces one historically grounded explanation of why the chosen tactic mattered.",
            f"Learner demonstrates the target pathway: {evaluation['predicted_path'].replace('_', ' ')}.",
            f"Mission intensity stays aligned with {temporal_state['recommended_intensity']} pacing.",
        ]
