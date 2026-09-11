# Gartika — Hard Negative Mining & False Positive Mitigation Strategy

## 1. The Hard Negative Problem in Edge Road Sensing

In urban bus-mounted computer vision, models trained solely on positive defect crops suffer from unacceptably high false alarm rates. A system that triggers 50 false alarms per kilometer quickly causes alert fatigue among municipal engineers.

To achieve reliable precision ($>90\%$), Gartika implements a dedicated **Hard Negative Dataset & Mining Strategy**.

---

## 2. Hard Negative Categories

The training and evaluation pipelines incorporate extensive negative samples (images containing zero defect bounding boxes) across nine critical urban edge conditions:

| Category | Visual Characteristics | Why Standard Models Fail | Gartika Mitigation Rule |
| :--- | :--- | :--- | :--- |
| **Fresh Asphalt Patches** | Dark, rectangular or irregular dark patches of bitumen. | Dark intensity gradient resembles deep shadow inside a pothole. | Negative annotations; spatial gradient continuity loss check. |
| **Manhole Covers & Utility Grates** | Circular or rectangular metal plates flush with or slightly below road surface. | Distinct edges and contrasting metallic/dark texture. | Trained as background negatives; geometric circle/radial feature suppression. |
| **Tree & Building Shadows** | High-contrast dappled or linear shadows moving across asphalt. | Strong localized brightness gradients mimicking pothole edges. | Color-space shadow normalization + Multi-modal IMU check (no z-shock). |
| **Water Puddles & Reflections** | Surface reflections of sky, buildings, or vehicle headlights. | Specular reflection alters local pixel variance. | Multi-spectral ratio filtering; requires physical axle deflection. |
| **Oil Stains & Exhaust Carbon** | Irregular dark stains in center of bus lanes. | Low reflectance resembles asphalt cavitation. | Lack of 3D depth disparity + zero IMU accelerometer excitation. |
| **Expansion Joints & Tar Lines** | Dark linear crack sealant lines across concrete bridges or asphalt joints. | High aspect ratio dark lines resemble road cracks. | Aspect ratio thresholding and negative sample mining. |
| **Zebra Crossings & Road Paint** | White/yellow high-reflectance paint strips. | Step changes in brightness resemble speed breaker chevrons. | Transverse line periodicity checks. |
| **Bridge Scuppers & Drain Slots** | Narrow slotted drainage grates near curbs. | Dark rectangular slots. | Spatial offset filtering from lane center. |
| **Construction Steel Plates** | Large rectangular steel plates covering trenches. | Raised edges cause metallic reflections. | Flat surface texture classification. |

---

## 3. Dataset Integration & Training Rules

1. **Background Ratio:** At least $15\%$ of all images in the training dataset are pure hard negatives containing zero bounding boxes.
2. **Loss Weighting:** Background frames contribute to the YOLO objectness/focal loss, teaching the model that high-contrast road artifacts are non-defects.
3. **IMU Corroboration Guard:** Even if an optical hard negative produces an edge vision candidate ($\text{conf} \approx 0.65$), the absence of a vertical IMU spike ($|a_z - 9.81| < 4.0\text{ m/s}^2$) prevents the candidate from being auto-elevated to `VERIFIED`.
