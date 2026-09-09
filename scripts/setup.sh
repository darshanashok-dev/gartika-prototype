#!/usr/bin/env bash
# Gartika AI Training & Inference Pipeline Setup Script
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "================================================="
echo "   GARTIKA AI PIPELINE — ENVIRONMENT SETUP"
echo "================================================="

echo "[1/3] Installing core Python dependencies..."
pip install -r requirements.txt 2>/dev/null || pip install ultralytics torch torchvision opencv-python numpy pyyaml onnx onnxruntime

echo "[2/3] Creating directory structure..."
mkdir -p dataset/raw dataset/images/train dataset/images/val dataset/images/test
mkdir -p dataset/labels/train dataset/labels/val dataset/labels/test
mkdir -p training inference models results/training results/evaluation results/predictions

echo "[3/3] Validating dataset..."
python3 training/validate_dataset.py

echo ""
echo "✓ Setup complete! You are ready to train, evaluate, and run inference."
echo "Commands:"
echo "  Train Model    : python3 training/train.py --epochs 30"
echo "  Evaluate Model : python3 training/evaluate.py"
echo "  Image Predict  : python3 inference/predict_image.py --image dataset/images/test/seq11_frame01.jpg"
echo "  Video Ingest   : python3 inference/predict_video.py --video data/videos/road_demo.mp4"
echo "  Run Full Demo  : ./scripts/run_demo.sh"
echo "================================================="
