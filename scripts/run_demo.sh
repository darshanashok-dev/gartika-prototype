#!/usr/bin/env bash
# Gartika AI Road Defect End-to-End Demonstration Script
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "================================================="
echo "   GARTIKA AI ROAD DEFECT PIPELINE DEMO"
echo "================================================="

# Step 1: Validate Dataset
echo ""
echo "[STEP 1/4] Running Dataset Validation Auditor..."
python3 training/validate_dataset.py

# Step 2: Evaluate Model
echo ""
echo "[STEP 2/4] Running Validation & Test Set Evaluation..."
python3 training/evaluate.py

# Step 3: Run Inference on Test Image
echo ""
echo "[STEP 3/4] Running Single-Image Defect Inference..."
TEST_IMG=$(find dataset/images/test/ -name "*.jpg" | head -n 1)
if [ -n "$TEST_IMG" ]; then
    python3 inference/predict_image.py --image "$TEST_IMG"
else
    echo "No test image found, skipping image demo."
fi

# Step 4: Run Inference on Road Video
echo ""
echo "[STEP 4/4] Running Road Video Ingestion & Deduplication..."
if [ -f "data/videos/road_demo.mp4" ]; then
    python3 inference/predict_video.py --video data/videos/road_demo.mp4
else
    echo "Road demo video not found at data/videos/road_demo.mp4."
fi

echo ""
echo "================================================="
echo "✓ DEMO COMPLETED SUCCESSFULLY!"
echo "Model Weights : models/gartika_road_defect.pt"
echo "Predictions   : results/predictions/"
echo "Evaluation    : results/evaluation/"
echo "Training Rep  : results/training/TRAINING_REPORT.md"
echo "================================================="
