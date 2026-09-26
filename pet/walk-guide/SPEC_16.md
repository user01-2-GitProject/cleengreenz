# Chris walk cycle: numbers the finished art is checked against

Frame 192x200, body centre x=71.6, ground y=197. Step length S=64px (foot separation at contact), cycle C=128px, each foot planted 56% of the cycle. Positions are ankle x relative to the body centre (+ is ahead) and foot lift above the ground line.

| Frame | Phase | Near foot | x | lift | Far foot | x | lift | Hip height |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.000 | planted | +32 | 0 | planted | -32 | 0 | 82 |
| 2 | 0.062 | planted | +24 | 0 | swing | -40 | 0 | 85 |
| 3 | 0.125 | planted | +16 | 0 | swing | -36 | 7 | 87 |
| 4 | 0.188 | planted | +8 | 0 | swing | -26 | 13 | 89 |
| 5 | 0.250 | planted | +0 | 0 | swing | -11 | 16 | 89 |
| 6 | 0.312 | planted | -8 | 0 | swing | +4 | 16 | 89 |
| 7 | 0.375 | planted | -16 | 0 | swing | +19 | 12 | 87 |
| 8 | 0.438 | planted | -24 | 0 | swing | +28 | 7 | 85 |
| 9 | 0.500 | planted | -32 | 0 | planted | +32 | 0 | 82 |
| 10 | 0.562 | swing | -40 | 0 | planted | +24 | 0 | 85 |
| 11 | 0.625 | swing | -36 | 7 | planted | +16 | 0 | 87 |
| 12 | 0.688 | swing | -26 | 13 | planted | +8 | 0 | 89 |
| 13 | 0.750 | swing | -11 | 16 | planted | +0 | 0 | 89 |
| 14 | 0.812 | swing | +4 | 16 | planted | -8 | 0 | 89 |
| 15 | 0.875 | swing | +19 | 12 | planted | -16 | 0 | 87 |
| 16 | 0.938 | swing | +28 | 7 | planted | -24 | 0 | 85 |

Rules the validator enforces: a planted foot never moves forward relative to the ground; each foot is planted in about 5 of the 8 frames; both contacts have the same foot separation; the near leg is the front leg at frame 1 and the rear leg at frame 5.
