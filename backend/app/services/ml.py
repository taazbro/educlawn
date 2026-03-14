from __future__ import annotations

from datetime import UTC, datetime

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.api.schemas import LearnerProfile
from app.services.feature_engineering import FEATURE_COLUMNS, build_feature_frame, build_feature_row
from app.services.warehouse import WarehouseService


class LearningIntelligenceService:
    def __init__(self, warehouse: WarehouseService) -> None:
        self.warehouse = warehouse
        self.path_pipeline: Pipeline | None = None
        self.risk_pipeline: Pipeline | None = None
        self.cluster_scaler: StandardScaler | None = None
        self.cluster_model: KMeans | None = None
        self.cluster_labels: dict[int, str] = {}
        self.training_rows = 0
        self.trained_at = ""

    def train_models(self) -> dict[str, object]:
        sessions = build_feature_frame(self.warehouse.fetch_sessions_frame())
        if sessions.empty:
            raise RuntimeError("No learner sessions available for model training.")

        features = sessions[FEATURE_COLUMNS]
        self.path_pipeline = Pipeline(
            steps=[
                ("scale", StandardScaler()),
                ("model", LogisticRegression(max_iter=1500)),
            ]
        )
        self.risk_pipeline = Pipeline(
            steps=[
                ("scale", StandardScaler()),
                ("model", LogisticRegression(max_iter=1500)),
            ]
        )

        self.path_pipeline.fit(features, sessions["recommended_path"])
        self.risk_pipeline.fit(features, sessions["engagement_risk"])

        self.cluster_scaler = StandardScaler()
        scaled_features = self.cluster_scaler.fit_transform(features)
        self.cluster_model = KMeans(n_clusters=3, random_state=42, n_init=20)
        self.cluster_model.fit(scaled_features)
        self.cluster_labels = self._name_clusters(sessions, self.cluster_model.labels_)

        self.training_rows = len(sessions)
        self.trained_at = datetime.now(UTC).isoformat()
        return self.get_model_summary()

    def _name_clusters(self, sessions: pd.DataFrame, labels: np.ndarray) -> dict[int, str]:
        summary = sessions.assign(cluster=labels).groupby("cluster", as_index=False).agg(
            mastery=("mastery_index", "mean"),
            coalition=("coalition_index", "mean"),
            support_need=("support_need_index", "mean"),
        )

        mapping: dict[int, str] = {}
        for row in summary.to_dict(orient="records"):
            if row["support_need"] >= 40:
                mapping[int(row["cluster"])] = "Momentum Recovery"
            elif row["coalition"] >= row["mastery"]:
                mapping[int(row["cluster"])] = "Movement Catalysts"
            else:
                mapping[int(row["cluster"])] = "Vision Architects"
        return mapping

    def get_model_summary(self) -> dict[str, object]:
        if self.path_pipeline is None or self.risk_pipeline is None:
            return {"trained": False}

        path_model = self.path_pipeline.named_steps["model"]
        coefficients = np.abs(path_model.coef_).mean(axis=0)
        top_features = sorted(
            (
                {
                    "feature": feature,
                    "importance": round(float(score), 4),
                }
                for feature, score in zip(FEATURE_COLUMNS, coefficients, strict=True)
            ),
            key=lambda item: item["importance"],
            reverse=True,
        )[:6]

        return {
            "trained": True,
            "trained_at": self.trained_at,
            "training_rows": self.training_rows,
            "path_classes": [str(label) for label in path_model.classes_],
            "risk_classes": [str(label) for label in self.risk_pipeline.named_steps["model"].classes_],
            "top_features": top_features,
        }

    def evaluate_profile(self, profile: LearnerProfile) -> dict[str, object]:
        if self.path_pipeline is None or self.risk_pipeline is None or self.cluster_model is None or self.cluster_scaler is None:
            self.train_models()

        feature_row = build_feature_row(profile.model_dump())
        feature_frame = pd.DataFrame([feature_row])[FEATURE_COLUMNS]

        predicted_path = str(self.path_pipeline.predict(feature_frame)[0])
        predicted_risk = str(self.risk_pipeline.predict(feature_frame)[0])
        path_probabilities = self.path_pipeline.predict_proba(feature_frame)[0]
        risk_probabilities = self.risk_pipeline.predict_proba(feature_frame)[0]

        scaled_for_cluster = self.cluster_scaler.transform(feature_frame)
        cluster_id = int(self.cluster_model.predict(scaled_for_cluster)[0])
        cluster_label = self.cluster_labels.get(cluster_id, "Emergent Leaders")

        explanation = self._explain_path_prediction(feature_frame, predicted_path)
        scene_focus = self._suggest_scene_focus(predicted_path, predicted_risk, feature_row)

        return {
            "predicted_path": predicted_path,
            "risk_band": predicted_risk,
            "cohort_label": cluster_label,
            "confidence": round(float(path_probabilities.max() * 100), 1),
            "path_probabilities": [
                {
                    "label": label.replace("_", " ").title(),
                    "score": round(float(score * 100), 1),
                }
                for label, score in zip(self.path_pipeline.named_steps["model"].classes_, path_probabilities, strict=True)
            ],
            "risk_probabilities": [
                {
                    "label": label.title(),
                    "score": round(float(score * 100), 1),
                }
                for label, score in zip(self.risk_pipeline.named_steps["model"].classes_, risk_probabilities, strict=True)
            ],
            "top_drivers": explanation,
            "intervention_plan": self._build_intervention_plan(predicted_path, predicted_risk, feature_row),
            "suggested_scene_focus": scene_focus,
            "feature_snapshot": {
                key: feature_row[key]
                for key in (
                    "mastery_index",
                    "resilience_index",
                    "coalition_index",
                    "support_need_index",
                    "efficiency_score",
                    "nonviolent_ratio",
                )
            },
            "training_rows": self.training_rows,
        }

    def _explain_path_prediction(self, feature_frame: pd.DataFrame, predicted_path: str) -> list[dict[str, object]]:
        scaler = self.path_pipeline.named_steps["scale"]
        model = self.path_pipeline.named_steps["model"]
        transformed = scaler.transform(feature_frame)[0]
        class_index = list(model.classes_).index(predicted_path)
        coefficients = model.coef_[class_index]

        drivers = []
        for feature, value in zip(FEATURE_COLUMNS, transformed * coefficients, strict=True):
            drivers.append(
                {
                    "feature": feature.replace("_", " ").title(),
                    "impact": round(float(value), 3),
                    "direction": "positive" if value >= 0 else "negative",
                }
            )

        drivers.sort(key=lambda item: abs(item["impact"]), reverse=True)
        return drivers[:5]

    def _build_intervention_plan(
        self,
        predicted_path: str,
        predicted_risk: str,
        features: dict[str, float | int | str],
    ) -> list[str]:
        plan = []

        if predicted_path == "movement_builder":
            plan.append("Lean into coalition-building missions with cross-community organizing prompts.")
        elif predicted_path == "speech_architect":
            plan.append("Assign speechwriting and narrative-framing challenges to amplify persuasive confidence.")
        else:
            plan.append("Route this learner into policy and historical analysis missions with legislation tradeoff prompts.")

        if predicted_risk == "high":
            plan.append("Reduce session complexity for the next scene and add a reflective checkpoint within 15 minutes.")
        elif predicted_risk == "moderate":
            plan.append("Offer a scaffolded branching path with one advanced choice and one guided recovery choice.")
        else:
            plan.append("Increase challenge density with deeper context and fewer hints to preserve momentum.")

        if float(features["nonviolent_ratio"]) < 70:
            plan.append("Surface nonviolence-focused scenarios to reinforce alignment with the movement's strategy.")
        if float(features["support_need_index"]) > 35:
            plan.append("Inject micro-feedback after each major choice and surface one recommended next step.")

        return plan

    def _suggest_scene_focus(
        self,
        predicted_path: str,
        predicted_risk: str,
        features: dict[str, float | int | str],
    ) -> str:
        if predicted_risk == "high":
            return "Montgomery Bus Boycott"
        if predicted_path == "policy_strategist":
            return "Selma and Voting Rights"
        if predicted_path == "movement_builder" and float(features["coalition_index"]) > 75:
            return "Poor People's Campaign"
        return "March on Washington"
