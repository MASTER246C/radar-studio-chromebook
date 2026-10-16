# Mounting geometry

This is the single reference for mounting height, antenna height and their
uncertainty. Other documents link here instead of repeating it.

**Mount height is configurable.** Radar Studio pre-fills editable starting values
of 1219 mm and 0° tilt, but nothing is configured until you enter your own measured
values and explicitly confirm them. The starting values are not a default
calibration; other users must enter their own measurements.

**Historical project reference (not a default or calibration): 4 feet (1.2192 m)
from the floor to the flat TOP of the bracket, excluding screws.**

The chip center is above that reference in the photographed arrangement. Its signed vertical offset is **estimated at +0.003175 to +0.00635 m**, giving an **estimated antenna-height interval of 1.222375–1.22555 m**. The midpoint is about **1.224 m**; it is not a calibrated measurement. **Actual downward tilt is unconfirmed.** Measure the final geometry after setting the physical tilt, and preserve the uncertainty in capture metadata.

**Antenna-center height = measured mount-top reference height + measured signed vertical chip-center offset after final tilt.** The mount reference is not the chip height. Do not guess the offset, replace it with zero, or apply an extra cosine to an already vertical offset. Verify point and track coordinate conventions separately before applying a transform; do not infer a firmware `sensorPosition` or claim calibrated angles from these estimates.

The earlier **2.00 m / 15-degree** arrangement was a planned experimental reference and remains in historical examples and frozen releases. It is **not the current setup, a mandatory height, a universal optimum or a proven most-accurate setting**. Earlier underside-to-board-bottom measurements are not used for the chip-center offset. Physical calibration remains unverified.

Record the measured values, the measurement method and their uncertainty with every
capture. Exports carry the declared values as `mount_input` (bracket-top height in
mm, downward tilt in millidegrees, optional signed antenna offset in mm).
