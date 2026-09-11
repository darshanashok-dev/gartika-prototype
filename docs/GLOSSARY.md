# Gartika Technical Glossary & Concept Dictionary

| Term | Definition | Role in Gartika |
|---|---|---|
| **Inertial Measurement Unit (IMU)** | 6-axis electronic sensor measuring angular rate and specific acceleration ($a_x, a_y, a_z$). | Detects physical vehicle impacts and vertical shocks caused by road surface distress. |
| **Global Navigation Satellite System (GNSS / GPS)** | Satellite-based positioning system providing latitude, longitude, speed, and heading. | Geocodes defect observations and tracks real-time fleet movement. |
| **Sensor Fusion** | Combining data from multiple disparate sensors (camera + IMU + GPS) to produce intelligence superior to individual sensors. | Eliminates false alarms (e.g. dark shadows vs genuine potholes). |
| **Haversine Formula** | Mathematical equation calculating the great-circle distance between two points on a sphere given their coordinates. | Used for spatial deduplication ($15	ext{m}$ radius) to aggregate repeat observations into a single `RoadDefect`. |
| **Temporal Alignment** | Synchronizing asynchronous sensor data streams by searching within a maximum time window ($\Delta t \le 800	ext{ms}$). | Matches high-speed camera frames with high-frequency IMU accelerometer readings. |
| **Intersection over Union (IoU)** | Evaluation metric measuring overlap between two bounding boxes: $	ext{IoU} = rac{	ext{Area of Overlap}}{	ext{Area of Union}}$. | Powers `IoUTracker` to track unique vehicles across video frames without duplicate counting. |
| **Closed-Loop Repair Verification** | Automated auditing process where returning fleet buses verify whether a reported repair has smoothed the roadway. | Requires configurable consecutive clean passes (`REPAIR_VERIFICATION_CLEAN_COUNT=2`) to close work orders. |
| **Multi-Bus Verification** | Requiring corroboration from distinct transit buses (`unique_bus_count \ge 2`) before elevating defect confidence. | Eliminates single-vehicle sensor faults and suspension anomalies. |
| **Privacy Filter** | Edge image processing applying localized Gaussian blur to license plates and faces. | Ensures compliance with civic privacy and data protection standards before evidence persistence. |
