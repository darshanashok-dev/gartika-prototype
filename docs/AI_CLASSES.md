# Gartika — AI Detection Classes & Annotation Taxonomy

## 1. Supported Detection Classes

Gartika maintains a strictly grounded annotation taxonomy. We do not define synthetic classes without sufficient real-world training data and operational municipal utility.

| Class ID | Class Name | Operational Definition | Minimum Samples Required | Ambiguity / Edge Cases |
| :--- | :--- | :--- | :--- | :--- |
| `0` | **`pothole`** | Depressions, cavities, or structural loss in the asphalt surface deep enough to cause vehicle tire deflection or structural road degradation. | 1,000+ annotations | Often confused with dark asphalt patches, tree shadows, oil stains, and shallow surface discoloration. |
| `1` | **`speed_breaker`** | Raised asphalt or concrete transverse ridges intended to enforce speed reduction, including marked rumble strips and yellow/white chevron humps. | 500+ annotations | Often confused with pedestrian zebra crossings, transverse road paint, and construction expansion joints. |
| `2` | **`road_crack`** | Longitudinal, transverse, or alligator/block fatigue fractures exceeding 1.0 cm in width indicating impending surface structural failure. | 500+ annotations | Often confused with tar sealant lines, expansion joints, and wet tire tracks. |

---

## 2. Strict Annotation Guidelines

1. **Tight Bounding Boxes:** Bounding boxes must tightly enclose the defect boundary without encompassing excessive undamaged asphalt or surrounding traffic.
2. **Edge Truncation:** Defects partially clipped by frame boundaries must have coordinates clamped to image limits `[0, 1]`.
3. **No Overlapping Same-Class Boxes:** A single physical pothole must be bounded by exactly one bounding box per frame. Multiple disjoint potholes in close proximity must each receive separate distinct boxes.
4. **Minimum Pixel Dimensions:** Bounding boxes with width or height $< 12 \text{ pixels}$ at $1280 \times 720$ resolution are discarded as noise.

---

## 3. Disallowed / Unsupported Classes (Honest Scoping)

The following classes are **explicitly excluded** from the current edge vision model due to high ambiguity or lack of municipal actionability:
- *Road Debris / Litter:* Too variable; low actionable value for road resurfacing teams.
- *Water Puddles (Isolated):* Puddles without road depression are treated as hard negatives, not defect classes.
- *Faded Lane Markings:* Tracked via dedicated road-marking heuristic rather than defect object detection.
