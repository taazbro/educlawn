from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer


KNOWLEDGE_DOCUMENTS: tuple[dict[str, Any], ...] = (
    {
        "document_id": "montgomery-carpool-network",
        "title": "Montgomery's carpool network",
        "era": "1955-1956",
        "theme": "logistics and disciplined collective action",
        "scene_focuses": ("Montgomery Bus Boycott",),
        "paths": ("movement_builder",),
        "risk_bands": ("high", "moderate", "low"),
        "tags": ("coordination", "nonviolence", "discipline", "transport"),
        "summary": "Local churches, volunteer drivers, and coordinated pickup routes sustained the boycott when the formal transit system could not be used.",
        "teaching_use": "Use this when the learner needs to see how organizing depends on patient logistics, not only speeches or protest moments.",
    },
    {
        "document_id": "montgomery-legal-pressure",
        "title": "Legal pressure during Montgomery",
        "era": "1955-1956",
        "theme": "court strategy amplified sustained protest",
        "scene_focuses": ("Montgomery Bus Boycott",),
        "paths": ("policy_strategist", "movement_builder"),
        "risk_bands": ("moderate", "low"),
        "tags": ("litigation", "policy", "boycott", "courts"),
        "summary": "Grassroots organizing and legal strategy moved in parallel, showing that direct action and institutional pressure can reinforce one another.",
        "teaching_use": "Use this to connect moral witness with legal leverage and policy timing.",
    },
    {
        "document_id": "selma-local-organizing",
        "title": "Local organizing before Selma",
        "era": "1963-1965",
        "theme": "policy pressure built from local risk and persistence",
        "scene_focuses": ("Selma and Voting Rights",),
        "paths": ("policy_strategist", "movement_builder"),
        "risk_bands": ("moderate", "low"),
        "tags": ("voting", "policy", "grassroots", "testimony"),
        "summary": "National policy change followed years of local organizing, testimony, and direct confrontation with exclusion at the county level.",
        "teaching_use": "Use this to connect civic structure, local testimony, and the strategic timing of federal action.",
    },
    {
        "document_id": "selma-federal-decision-window",
        "title": "Federal decision windows after Selma",
        "era": "1965",
        "theme": "movement pressure can open narrow policy windows",
        "scene_focuses": ("Selma and Voting Rights",),
        "paths": ("policy_strategist",),
        "risk_bands": ("low", "moderate"),
        "tags": ("federal-action", "legislation", "timing", "governance"),
        "summary": "The Voting Rights Act moved when public attention, organized pressure, and executive calculations briefly aligned.",
        "teaching_use": "Use this when the learner is ready to reason about policy sequencing and moments of institutional opportunity.",
    },
    {
        "document_id": "march-rhetoric-coalition",
        "title": "Narrative framing at the March on Washington",
        "era": "1963",
        "theme": "shared narrative can align a broad coalition",
        "scene_focuses": ("March on Washington",),
        "paths": ("speech_architect", "movement_builder"),
        "risk_bands": ("low", "moderate"),
        "tags": ("speech", "coalition", "message", "audience"),
        "summary": "Speakers aligned labor, civil-rights, and faith voices into one public-facing moral argument that could travel nationally.",
        "teaching_use": "Use this when the learner needs to practice speech craft, audience framing, or coalition messaging.",
    },
    {
        "document_id": "march-message-discipline",
        "title": "Message discipline across the March coalition",
        "era": "1963",
        "theme": "public narrative must stay coherent across many voices",
        "scene_focuses": ("March on Washington",),
        "paths": ("speech_architect",),
        "risk_bands": ("moderate", "low"),
        "tags": ("rhetoric", "framing", "discipline", "coalition"),
        "summary": "Coalition messaging worked because speakers shared a strategic frame while still speaking from distinct communities.",
        "teaching_use": "Use this to teach how narrative consistency supports trust without flattening coalition differences.",
    },
    {
        "document_id": "poor-peoples-campaign-coalition",
        "title": "Coalition design in the Poor People's Campaign",
        "era": "1967-1968",
        "theme": "economic justice required a multi-issue coalition",
        "scene_focuses": ("Poor People's Campaign",),
        "paths": ("movement_builder", "policy_strategist"),
        "risk_bands": ("moderate", "low"),
        "tags": ("economic-justice", "coalition", "strategy", "poverty"),
        "summary": "The campaign widened the movement's frame from one issue to structural poverty, requiring new partnerships and stronger coalition management.",
        "teaching_use": "Use this when the learner is ready to connect organizing skill with structural analysis and multi-issue planning.",
    },
    {
        "document_id": "poor-peoples-logistics",
        "title": "Logistics and governance in the Poor People's Campaign",
        "era": "1968",
        "theme": "large coalitions need operating systems, not only ideals",
        "scene_focuses": ("Poor People's Campaign",),
        "paths": ("movement_builder",),
        "risk_bands": ("high", "moderate"),
        "tags": ("logistics", "governance", "encampment", "coalition"),
        "summary": "Campaign planners had to manage food, shelter, communication, and negotiation at scale while maintaining strategic coherence.",
        "teaching_use": "Use this to connect movement imagination with operational discipline and shared governance.",
    },
    {
        "document_id": "nonviolence-training-discipline",
        "title": "Nonviolence training and strategic discipline",
        "era": "movement-wide",
        "theme": "discipline is a practiced strategy",
        "scene_focuses": ("Montgomery Bus Boycott", "Selma and Voting Rights", "March on Washington"),
        "paths": ("movement_builder", "speech_architect", "policy_strategist"),
        "risk_bands": ("high", "moderate"),
        "tags": ("nonviolence", "training", "reflection", "discipline"),
        "summary": "Nonviolence was trained, rehearsed, and reinforced so participants could stay strategic under pressure rather than relying on instinct alone.",
        "teaching_use": "Use this when a learner needs coaching around difficult decisions, reflective checkpoints, or value alignment.",
    },
    {
        "document_id": "student-activism-escalation",
        "title": "Escalation patterns in student activism",
        "era": "1960-1964",
        "theme": "small actions scale when each step creates new participants",
        "scene_focuses": ("March on Washington", "Selma and Voting Rights"),
        "paths": ("movement_builder", "speech_architect"),
        "risk_bands": ("moderate", "low"),
        "tags": ("students", "escalation", "participation", "capacity"),
        "summary": "Sit-ins, freedom rides, and campus activism created a repeating pattern where each action trained more people to join the next stage.",
        "teaching_use": "Use this to show how movement capacity grows over repeated, learnable actions rather than isolated heroic moments.",
    },
    {
        "document_id": "birmingham-campaign-visibility",
        "title": "Birmingham and national visibility",
        "era": "1963",
        "theme": "local confrontation can reshape national attention",
        "scene_focuses": ("March on Washington", "Selma and Voting Rights"),
        "paths": ("speech_architect", "policy_strategist"),
        "risk_bands": ("moderate", "low"),
        "tags": ("media", "visibility", "strategy", "public-pressure"),
        "summary": "Local campaigns altered national perception by making injustice visible, which changed the rhetorical and political terrain for later actions.",
        "teaching_use": "Use this when the learner needs to connect media visibility, moral language, and policy pressure.",
    },
)


class LocalKnowledgeService:
    def __init__(self) -> None:
        self._documents = [dict(document) for document in KNOWLEDGE_DOCUMENTS]
        self._vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        self._projection: TruncatedSVD | None = None
        self._document_embeddings = np.zeros((0, 0), dtype=float)
        self._index_status = self.refresh_index()

    def refresh_index(self) -> dict[str, int | str]:
        corpus = [self._document_corpus(document) for document in self._documents]
        tfidf_matrix = self._vectorizer.fit_transform(corpus)

        max_components = min(48, tfidf_matrix.shape[0] - 1, tfidf_matrix.shape[1] - 1)
        if max_components >= 2:
            self._projection = TruncatedSVD(n_components=max_components, random_state=1968)
            embeddings = self._projection.fit_transform(tfidf_matrix)
        else:
            self._projection = None
            embeddings = tfidf_matrix.toarray()

        self._document_embeddings = self._normalize_rows(embeddings)
        self._index_status = {
            "retrieval_mode": "hybrid_vector",
            "documents_indexed": len(self._documents),
            "embedding_dimensions": int(self._document_embeddings.shape[1]) if self._document_embeddings.size else 0,
        }
        return dict(self._index_status)

    def get_index_status(self) -> dict[str, int | str]:
        return dict(self._index_status)

    def search(
        self,
        scene_focus: str,
        predicted_path: str,
        risk_band: str,
        limit: int = 3,
    ) -> list[dict[str, Any]]:
        query_vector = self._encode_query(scene_focus, predicted_path, risk_band)
        vector_scores = self._document_embeddings @ query_vector if self._document_embeddings.size else np.zeros(len(self._documents))

        scored: list[tuple[float, dict[str, Any]]] = []
        for index, document in enumerate(self._documents):
            vector_score = float(max(0.0, vector_scores[index])) * 100.0
            metadata_score = self._metadata_alignment(document, scene_focus, predicted_path, risk_band)
            lexical_score = self._lexical_alignment(document, scene_focus, predicted_path, risk_band)
            score = min(100.0, vector_score * 0.62 + metadata_score * 0.26 + lexical_score * 0.12)

            scored.append(
                (
                    score,
                    {
                        "document_id": document["document_id"],
                        "title": document["title"],
                        "era": document["era"],
                        "theme": document["theme"],
                        "summary": document["summary"],
                        "teaching_use": document["teaching_use"],
                        "vector_score": round(vector_score, 1),
                        "metadata_score": round(metadata_score, 1),
                    },
                )
            )

        ranked = sorted(scored, key=lambda item: item[0], reverse=True)[:limit]
        return [
            {
                **document,
                "relevance": round(score, 1),
            }
            for score, document in ranked
        ]

    def _encode_query(self, scene_focus: str, predicted_path: str, risk_band: str) -> np.ndarray:
        query_text = self._query_text(scene_focus, predicted_path, risk_band)
        query_matrix = self._vectorizer.transform([query_text])
        if self._projection is not None:
            query_embedding = self._projection.transform(query_matrix)
        else:
            query_embedding = query_matrix.toarray()
        return self._normalize_rows(query_embedding)[0]

    def _query_text(self, scene_focus: str, predicted_path: str, risk_band: str) -> str:
        path_phrase = predicted_path.replace("_", " ")
        risk_phrase = {
            "high": "stabilize reflection discipline nonviolence support",
            "moderate": "guided practice feedback persistence",
            "low": "advanced strategy coalition policy rhetoric",
        }.get(risk_band, risk_band)

        return " ".join(
            [
                scene_focus,
                path_phrase,
                risk_phrase,
                f"scene {scene_focus}",
                f"path {path_phrase}",
                "civil rights strategy coalition policy rhetoric organizing",
            ]
        )

    def _document_corpus(self, document: dict[str, Any]) -> str:
        fields = [
            document["title"],
            document["theme"],
            document["summary"],
            document["teaching_use"],
            " ".join(document["scene_focuses"]),
            " ".join(path.replace("_", " ") for path in document["paths"]),
            " ".join(document["risk_bands"]),
            " ".join(document["tags"]),
        ]
        return " ".join(fields)

    def _metadata_alignment(
        self,
        document: dict[str, Any],
        scene_focus: str,
        predicted_path: str,
        risk_band: str,
    ) -> float:
        score = 18.0
        if scene_focus in document["scene_focuses"]:
            score += 42.0
        if predicted_path in document["paths"]:
            score += 24.0
        if risk_band in document["risk_bands"]:
            score += 12.0
        return min(score, 100.0)

    def _lexical_alignment(
        self,
        document: dict[str, Any],
        scene_focus: str,
        predicted_path: str,
        risk_band: str,
    ) -> float:
        query_tokens = set(self._query_text(scene_focus, predicted_path, risk_band).lower().replace("-", " ").split())
        document_tokens = set(self._document_corpus(document).lower().replace("-", " ").split())
        overlap = query_tokens.intersection(document_tokens)
        if not overlap:
            return 0.0
        return min(100.0, len(overlap) * 6.0)

    def _normalize_rows(self, matrix: np.ndarray) -> np.ndarray:
        if matrix.size == 0:
            return matrix

        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms = np.where(norms == 0.0, 1.0, norms)
        return matrix / norms
