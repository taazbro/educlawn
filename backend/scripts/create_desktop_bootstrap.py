from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.ml import LearningIntelligenceService
from app.services.warehouse import WarehouseService


def main(output_root: str) -> None:
    target_root = Path(output_root).resolve()
    if target_root.exists():
        shutil.rmtree(target_root)
    target_root.mkdir(parents=True, exist_ok=True)

    database_path = target_root / "educlawn.sqlite3"
    model_cache_dir = target_root / "model-cache"
    warehouse = WarehouseService(f"sqlite:///{database_path}")
    warehouse.initialize()
    warehouse.seed_demo_data()
    snapshot = warehouse.create_warehouse_snapshot()

    intelligence = LearningIntelligenceService(warehouse, cache_dir=model_cache_dir)
    model_summary = intelligence.train_models()

    metadata = {
        "database_path": str(database_path),
        "model_cache_dir": str(model_cache_dir),
        "snapshot": snapshot,
        "model_summary": model_summary,
    }
    (target_root / "bootstrap-metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")


if __name__ == "__main__":
    output_arg = sys.argv[1] if len(sys.argv) > 1 else "../desktop/bootstrap"
    main(output_arg)
