"""The ONE display-referred tone curve for web-bound Blender output (COLOUR RULE 2 in m5_preset.py).

The site's post stack writes colour with no transfer function (src/v3/engine/post.ts 23-25), so a baked image or vertex colour has to arrive already
display-referred: scene-linear radiance -> hue-preserving shoulder on the brightest channel (the ratios, so the colour, stay) -> sRGB OETF.
This is the same maths as scripts/hdri-prep.mjs (knee 0.8, roll-off width 1 - knee = 0.2), written once instead of pasted into every bake script.

    shoulder_srgb(rgb, expo=1.0, knee=0.8)   rgb: float array (..., 3) scene-linear -> display 0..1 (..., 3)
    shoulder_peak(m, knee=0.8)               the scalar curve on the peak channel
    srgb_oetf(x)                             linear -> sRGB encode

Callers: crag_ring.py, hold_field.py (knee 0.8). hall_photoreal.py keeps a private copy with knee 0.5 on purpose: the shipped hall is tuned to it
(exposure 1.3, HP_VAULT, grade-check), so it equals shoulder_srgb(rgb, expo, knee=0.5) and must not be switched without re-grading the hall.
Pure numpy; imports nothing from bpy, so `python3 -I` and Blender both run it (tests: scripts/blender/test_display_curve.py).
"""
import numpy as np

KNEE = 0.8  # scripts/hdri-prep.mjs


def srgb_oetf(x):
    x = np.maximum(x, 0)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def shoulder_peak(m, knee=KNEE):
    """peak channel m (linear): unchanged up to the knee, then an exponential roll-off that approaches 1.0"""
    w = 1.0 - knee
    return np.where(m <= knee, m, knee + w * (1 - np.exp(-(m - knee) / w)))


def shoulder_srgb(rgb, expo=1.0, knee=KNEE):
    v = np.asarray(rgb) * expo
    m = np.maximum(v.max(axis=-1), 1e-6)
    t = np.where(m <= knee, 1.0, shoulder_peak(m, knee) / m)
    return srgb_oetf(np.clip(v * t[..., None], 0, 1))
