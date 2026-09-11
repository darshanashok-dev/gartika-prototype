# Gartika Verification & Test Suite Guide

Gartika maintains a comprehensive, deterministic test suite covering unit tests, sensor fusion logic, API endpoints, WebSocket streams, and end-to-end simulation pipelines.

---

## 1. Running Test Suite

```bash
# Run all unit and integration tests
pytest -v

# Run with test coverage report
pytest --cov=backend/app --cov=ai tests/

# Run benchmark evaluation
python3 scripts/evaluate_metrics.py

# Run cellular bandwidth savings audit
python3 scripts/calculate_bandwidth.py
```

---

## 2. Test Coverage Overview
- `tests/test_ai_pipeline.py`: IoU tracking, track persistence, OpenCV heuristic defect scoring, spatial deduplication.
- `tests/test_api_endpoints.py`: Bus registration, defect CRUD, work order lifecycle, WebSocket client broadcasts.
- `tests/test_e2e.py`: System health, stats generation, telemetry batch ingestion, GIS static routes.
- `tests/test_fusion_and_repair.py`: Sensor buffer isolation, privacy filter blurring, multi-bus corroboration, closed-loop repair verification, missing GPS handling, role-based auth.
