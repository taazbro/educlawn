from __future__ import annotations

from collections.abc import Mapping

import numpy as np
import pandas as pd


BASE_COLUMNS = [
    "hope",
    "courage",
    "wisdom",
    "leadership",
    "questions_answered",
    "accuracy_rate",
    "historical_alignment",
    "minutes_spent",
    "achievement_count",
    "nonviolent_choices",
    "total_choices",
]

FEATURE_COLUMNS = [
    "hope",
    "courage",
    "wisdom",
    "leadership",
    "questions_answered",
    "accuracy_rate",
    "historical_alignment",
    "minutes_spent",
    "achievement_count",
    "nonviolent_ratio",
    "total_score",
    "mastery_index",
    "resilience_index",
    "efficiency_score",
    "coalition_index",
    "support_need_index",
]


def _clip(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return float(np.clip(value, minimum, maximum))


def build_feature_row(payload: Mapping[str, float | int | str]) -> dict[str, float | int | str]:
    row = {column: payload[column] for column in BASE_COLUMNS}

    total_choices = max(int(row["total_choices"]), 1)
    average_stat = (row["hope"] + row["courage"] + row["wisdom"] + row["leadership"]) / 4
    nonviolent_ratio = _clip((row["nonviolent_choices"] / total_choices) * 100)
    total_score = int(row["hope"] + row["courage"] + row["wisdom"] + row["leadership"])

    mastery_index = _clip(
        0.42 * float(row["accuracy_rate"])
        + 0.24 * float(row["historical_alignment"])
        + 0.18 * min(int(row["achievement_count"]) * 8, 100)
        + 0.16 * average_stat
    )
    resilience_index = _clip(
        0.35 * float(row["courage"])
        + 0.25 * float(row["hope"])
        + 0.25 * float(row["leadership"])
        + 0.15 * average_stat
    )
    efficiency_score = _clip((float(row["questions_answered"]) / max(float(row["minutes_spent"]), 1.0)) * 6)
    coalition_index = _clip(
        0.45 * float(row["leadership"])
        + 0.35 * float(row["wisdom"])
        + 0.20 * nonviolent_ratio
    )
    support_need_index = _clip(
        100
        - (
            0.50 * float(row["accuracy_rate"])
            + 0.20 * average_stat
            + 0.20 * nonviolent_ratio
            + 0.10 * float(row["historical_alignment"])
        )
    )

    return {
        **row,
        "nonviolent_ratio": round(nonviolent_ratio, 2),
        "total_score": total_score,
        "mastery_index": round(mastery_index, 2),
        "resilience_index": round(resilience_index, 2),
        "efficiency_score": round(efficiency_score, 2),
        "coalition_index": round(coalition_index, 2),
        "support_need_index": round(support_need_index, 2),
    }


def build_feature_frame(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return frame.copy()

    engineered = frame.apply(lambda row: pd.Series(build_feature_row(row.to_dict())), axis=1)
    passthrough_columns = [column for column in frame.columns if column not in engineered.columns]
    return pd.concat([engineered, frame[passthrough_columns]], axis=1)
