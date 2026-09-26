# Chris walk cycle: numbers the finished art is checked against

Frame 192x200, body centre x=71.6, ground y=197. Step length S=64px (foot separation at contact), cycle C=128px, each foot planted 56% of the cycle. Positions are ankle x relative to the body centre (+ is ahead) and foot lift above the ground line.

| Frame | Phase | Near foot | x | lift | Far foot | x | lift | Hip height |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.000 | planted | +32 | 0 | planted | -32 | 0 | 82 |
| 2 | 0.083 | planted | +21 | 0 | swing | -39 | 3 | 86 |
| 3 | 0.167 | planted | +11 | 0 | swing | -30 | 11 | 88 |
| 4 | 0.250 | planted | +0 | 0 | swing | -11 | 16 | 89 |
| 5 | 0.333 | planted | -11 | 0 | swing | +9 | 15 | 88 |
| 6 | 0.417 | planted | -21 | 0 | swing | +26 | 9 | 86 |
| 7 | 0.500 | planted | -32 | 0 | planted | +32 | 0 | 82 |
| 8 | 0.583 | swing | -39 | 3 | planted | +21 | 0 | 86 |
| 9 | 0.667 | swing | -30 | 11 | planted | +11 | 0 | 88 |
| 10 | 0.750 | swing | -11 | 16 | planted | +0 | 0 | 89 |
| 11 | 0.833 | swing | +9 | 15 | planted | -11 | 0 | 88 |
| 12 | 0.917 | swing | +26 | 9 | planted | -21 | 0 | 86 |

Rules the validator enforces: a planted foot never moves forward relative to the ground; each foot is planted in about 5 of the 8 frames; both contacts have the same foot separation; the near leg is the front leg at frame 1 and the rear leg at frame 5.
