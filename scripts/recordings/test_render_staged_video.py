"""Validate native drag provenance in staged capture eligibility, without encoding."""
import copy
import importlib.util
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location('staged_renderer', Path(__file__).with_name('render-staged-video.py'))
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)


class NativeDragEligibilityTest(unittest.TestCase):
    def setUp(self):
        # Actual recorded Formative arrow gesture, in CSS viewport coordinates.
        self.drag = {
            'at': 2783586, 'actualActionEndAt': 2784378, 'stepEndedAt': 2784420,
            'kind': 'drag', 'inputSource': 'native-cdp-mouse-input',
            'nativeHitTestPassed': True,
            'from': {'x': 425, 'y': 190}, 'to': {'x': 520, 'y': 190},
        }
        self.capture = {
            'sourceViewport': {'width': 1280, 'height': 720}, 'durationMs': 2789501,
            'startedAt': '2026-11-08T13:00:00Z', 'book': {'sha256': 'book'},
        }
        self.inventory = {'createdAt': '2026-11-07T12:00:00Z', 'sourceBook': {'sha256': 'book'}}

    def eligibility(self, drag):
        actions = [{'kind': 'click', 'click': {'x': 25, 'y': 125}}, drag]
        return renderer.derive_production_checks(
            self.capture, self.inventory, False, 'Formative', [{'sourceAt': 1}],
            {'actions': actions})['realClickCoordinates']

    def test_actual_native_arrow_is_eligible_and_creates_no_click_marker(self):
        self.assertTrue(self.eligibility(self.drag))
        self.assertEqual(renderer.observed_click_markers({'frames': [], 'actions': [self.drag]}, []), [])

    def test_outside_or_nonfinite_endpoints_are_rejected(self):
        for endpoint, coordinate, value in [('from', 'x', -1), ('to', 'x', 1280),
                                             ('to', 'y', 720), ('to', 'x', float('nan'))]:
            with self.subTest(endpoint=endpoint, coordinate=coordinate, value=value):
                drag = copy.deepcopy(self.drag)
                drag[endpoint][coordinate] = value
                self.assertFalse(self.eligibility(drag))

    def test_unverified_or_other_input_source_is_rejected(self):
        for field, value in [('nativeHitTestPassed', False), ('nativeHitTestPassed', 1),
                             ('inputSource', 'unverified')]:
            with self.subTest(field=field, value=value):
                drag = {**self.drag, field: value}
                self.assertFalse(self.eligibility(drag))

    def test_incoherent_native_event_times_are_rejected(self):
        for field, value in [('actualActionEndAt', 2783585), ('stepEndedAt', 2784000),
                             ('actualActionEndAt', 2789502), ('at', False)]:
            with self.subTest(field=field, value=value):
                self.assertFalse(self.eligibility({**self.drag, field: value}))

    def test_drag_cannot_smuggle_in_a_synthetic_click_marker(self):
        self.assertFalse(self.eligibility({**self.drag, 'click': {'x': 425, 'y': 190}}))


if __name__ == '__main__':
    unittest.main()
