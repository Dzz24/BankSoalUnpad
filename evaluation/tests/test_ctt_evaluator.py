import tempfile
import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ctt_evaluator import EvaluationError, load_ctt, initial_review, compare, load_pairs

BASE = Path(__file__).resolve().parents[1]

class EvaluatorTests(unittest.TestCase):
    def test_load_dummy_ctt(self):
        ctt = load_ctt(BASE / 'sample_data' / 'ctt1_dummy.csv')
        self.assertEqual(len(ctt), 3)
        self.assertAlmostEqual(ctt['Q001']['difficulty_index'], 0.20)

    def test_zero_use_distractor_flagged(self):
        review = initial_review(load_ctt(BASE / 'sample_data' / 'ctt1_dummy.csv'))
        q2 = next(r for r in review if r['question_id'] == 'Q002')
        self.assertIn('A', q2['observations'])

    def test_ctt_delta(self):
        a = load_ctt(BASE / 'sample_data' / 'ctt1_dummy.csv')
        b = load_ctt(BASE / 'sample_data' / 'ctt2_dummy.csv')
        pairs, _ = load_pairs(a, b, BASE / 'sample_data' / 'mapping_dummy.csv')
        result = compare(a, b, pairs)
        q1 = next(r for r in result if r['ctt1_question_id'] == 'Q001')
        self.assertAlmostEqual(q1['difficulty_delta_ctt2_minus_ctt1'], 0.43)
        self.assertAlmostEqual(q1['discrimination_delta_ctt2_minus_ctt1'], 0.27)

    def test_percentage_scale_rejected(self):
        content = ('question_id,item_version,total_responses,difficulty_index,discrimination_index,correct_option,'
                   'option_A_count,option_B_count,option_C_count,option_D_count\n'
                   'Q1,1,10,65,0.2,A,5,2,2,1\n')
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'bad.csv'
            path.write_text(content, encoding='utf-8')
            with self.assertRaises(EvaluationError):
                load_ctt(path)

if __name__ == '__main__':
    unittest.main()
