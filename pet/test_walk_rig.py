"""Geometry and asset preservation checks; run after walk-rig.py from the repo root."""
import math
import runpy
import unittest
import numpy as np
from PIL import Image

rig = runpy.run_path('pet/walk-rig.py')

class WalkTests(unittest.TestCase):
    def test_support_extends_without_overstretch(self):
        lengths = rig['leg_lengths']()
        best_support = [0, 0]
        for phase in np.arange(0, 1, 1 / 256):
            feet, dy = rig['walk_pose'](phase)
            for i, (x, lift, pitch, planted) in enumerate(feet):
                hip_offset = rig['FAR_HIP_OFFSET'] if i else 0
                foot_offset = rig['FAR_FOOT_OFFSET'] if i else 0
                hip = rig['HIP'] + np.array([hip_offset, dy])
                ankle = rig['ankle_position'](x, lift, pitch) + np.array([foot_offset, 0])
                distance = np.linalg.norm(ankle - hip)
                self.assertLessEqual(distance, sum(lengths) + 1e-6)
                knee = rig['two_bone'](hip, ankle, *lengths)
                u, v = hip-knee, ankle-knee
                angle = math.degrees(math.acos(np.clip(np.dot(u, v) / np.linalg.norm(u) / np.linalg.norm(v), -1, 1)))
                if planted:
                    best_support[i] = max(best_support[i], angle)
        self.assertTrue(all(angle >= 170 for angle in best_support), best_support)

    def test_loop_and_ground_tracking(self):
        heights = [rig['walk_pose'](f / 16)[1] for f in range(16)]
        changes = [abs(heights[(f+1) % 16] - heights[f]) for f in range(16)]
        self.assertLess(max(heights) - min(heights), 5.1)
        self.assertLess(max(changes), 2.2, changes)
        self.assertEqual(rig['walk_pose'](0), rig['walk_pose'](1))
        for phase in np.arange(0, .5, .01):
            x = rig['foot_track'](phase)[0]
            nx = rig['foot_track'](phase + .01)[0]
            self.assertAlmostEqual(nx - x, -2 * rig['STEP'] * .01)

    def test_only_walk_cells_change(self):
        before = np.asarray(Image.open(rig['BASE_SHEET']).convert('RGBA'))
        after = np.asarray(Image.open(rig['OUT']).convert('RGBA'))
        self.assertEqual(after.shape, (200, 58*192, 4))
        walks = set(range(12, 28)) | set(range(29, 45))
        for cell in range(58):
            a, b = before[:, cell*192:(cell+1)*192], after[:, cell*192:(cell+1)*192]
            if cell not in walks:
                np.testing.assert_array_equal(a, b, err_msg=f'Nonwalk frame {cell}')
            else:
                self.assertFalse(np.array_equal(a, b))
                rows, cols = np.where(b[..., 3] > 0)
                self.assertEqual(rows.max(), 197, cell)
                self.assertGreater(rows.min(), 0, cell)
                self.assertGreater(cols.min(), 0, cell)
                self.assertLess(cols.max(), 191, cell)

if __name__ == '__main__':
    unittest.main()
