from __future__ import annotations

from typing import Any


GRAPH_NODES: tuple[dict[str, str], ...] = (
    {"id": "scene-montgomery", "label": "Montgomery Bus Boycott", "node_type": "scene"},
    {"id": "scene-selma", "label": "Selma and Voting Rights", "node_type": "scene"},
    {"id": "scene-march", "label": "March on Washington", "node_type": "scene"},
    {"id": "scene-poor-people", "label": "Poor People's Campaign", "node_type": "scene"},
    {"id": "person-king", "label": "Martin Luther King Jr.", "node_type": "person"},
    {"id": "person-abernathy", "label": "Ralph Abernathy", "node_type": "person"},
    {"id": "person-john-lewis", "label": "John Lewis", "node_type": "person"},
    {"id": "law-voting-rights", "label": "Voting Rights Act", "node_type": "law"},
    {"id": "theme-nonviolence", "label": "Nonviolence", "node_type": "theme"},
    {"id": "theme-coalition", "label": "Coalition Building", "node_type": "theme"},
    {"id": "theme-rhetoric", "label": "Public Narrative", "node_type": "theme"},
    {"id": "theme-policy", "label": "Policy Change", "node_type": "theme"},
)

GRAPH_EDGES: tuple[dict[str, str], ...] = (
    {"source": "person-king", "target": "scene-montgomery", "relationship": "helped_lead"},
    {"source": "person-abernathy", "target": "scene-montgomery", "relationship": "organized_with"},
    {"source": "scene-montgomery", "target": "theme-nonviolence", "relationship": "demonstrated"},
    {"source": "scene-poor-people", "target": "theme-coalition", "relationship": "expanded"},
    {"source": "scene-march", "target": "theme-rhetoric", "relationship": "amplified"},
    {"source": "scene-selma", "target": "theme-policy", "relationship": "accelerated"},
    {"source": "scene-selma", "target": "law-voting-rights", "relationship": "contributed_to"},
    {"source": "person-john-lewis", "target": "scene-selma", "relationship": "mobilized"},
    {"source": "theme-coalition", "target": "theme-policy", "relationship": "supports"},
    {"source": "theme-nonviolence", "target": "theme-coalition", "relationship": "stabilizes"},
)

SCENE_NODE_MAP = {
    "Montgomery Bus Boycott": "scene-montgomery",
    "Selma and Voting Rights": "scene-selma",
    "March on Washington": "scene-march",
    "Poor People's Campaign": "scene-poor-people",
}

PATH_THEME_MAP = {
    "movement_builder": {"theme-coalition", "theme-nonviolence"},
    "speech_architect": {"theme-rhetoric", "theme-coalition"},
    "policy_strategist": {"theme-policy", "theme-coalition"},
}


class KnowledgeGraphService:
    def get_context(self, scene_focus: str, predicted_path: str) -> dict[str, Any]:
        root_scene = SCENE_NODE_MAP.get(scene_focus, "scene-march")
        target_themes = PATH_THEME_MAP.get(predicted_path, {"theme-coalition"})
        selected_node_ids = {root_scene, *target_themes, "person-king"}

        relevant_edges = [
            edge
            for edge in GRAPH_EDGES
            if edge["source"] in selected_node_ids or edge["target"] in selected_node_ids
        ]

        for edge in relevant_edges:
            selected_node_ids.add(edge["source"])
            selected_node_ids.add(edge["target"])

        nodes = [node for node in GRAPH_NODES if node["id"] in selected_node_ids]
        highlights = [
            f"{scene_focus} is linked to {next(node['label'] for node in GRAPH_NODES if node['id'] == theme_id)}."
            for theme_id in target_themes
        ]

        return {
            "scene_focus": scene_focus,
            "predicted_path": predicted_path,
            "nodes": nodes,
            "edges": relevant_edges,
            "highlights": highlights[:3],
        }
