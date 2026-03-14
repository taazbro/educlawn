from __future__ import annotations

from app.services.ml import LearningIntelligenceService
from app.services.warehouse import WarehouseService


def test_model_cache_restores_trained_bundle(tmp_path):
    database_path = tmp_path / "cache.sqlite3"
    cache_dir = tmp_path / "model-cache"
    warehouse = WarehouseService(f"sqlite:///{database_path}")
    warehouse.initialize()
    warehouse.seed_demo_data()

    intelligence = LearningIntelligenceService(warehouse, cache_dir=cache_dir)
    trained_summary = intelligence.train_models()
    assert (cache_dir / "ml_bundle.pkl").exists()
    assert trained_summary["trained"] is True
    assert trained_summary["loaded_from_cache"] is False

    restored = LearningIntelligenceService(warehouse, cache_dir=cache_dir)
    restored_summary = restored.get_model_summary()
    assert restored.is_trained is True
    assert restored_summary["trained"] is True
    assert restored_summary["loaded_from_cache"] is True
    assert restored_summary["training_rows"] == trained_summary["training_rows"]
