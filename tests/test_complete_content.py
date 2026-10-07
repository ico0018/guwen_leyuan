import json
import sys
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from scan_content import parse_lesson, scan_content, split_original_lines


class CompleteContentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = scan_content(ROOT)
        cls.catalog = json.loads((ROOT/'content/curriculum.json').read_text(encoding='utf8'))
        cls.works = {l['workId']: l for l in cls.manifest['lessons'] if l['workId']}
        cls.items = [item for g in cls.catalog['grades'] for s in g['semesters'] for item in s['items']]

    def test_all_116_placements_have_complete_canonical_content(self):
        self.assertEqual(len(self.items), 116)
        self.assertEqual(len(self.works), 114)
        self.assertEqual(len({i['placementId'] for i in self.items}), 116)
        for item in self.items:
            with self.subTest(placement=item['placementId']):
                work = self.works[item['workId']]
                for key in ('title', 'author', 'dynasty', 'source', 'type', 'original', 'translation', 'characterInfo'):
                    self.assertTrue(work[key], key)
                self.assertEqual(work['author'], item['author'])
                self.assertTrue(2 <= len(work['knowledgePoints']) <= 5)
                if item.get('distinguishing'):
                    self.assertIn(item['distinguishing'], work['original'])

    def test_scanning_has_no_warnings_or_errors(self):
        self.assertEqual(self.manifest['warnings'], [])
        self.assertEqual(self.manifest['errors'], [])

    def test_each_canonical_source_lists_its_grade_and_semester(self):
        for grade in self.catalog['grades']:
            for semester in grade['semesters']:
                for item in semester['items']:
                    self.assertIn(grade['name'] + semester['name'], self.works[item['workId']]['source'])

    def test_poetry_translation_and_ordering_cover_every_source_line(self):
        for work in self.manifest['lessons']:
            if work['type'] not in ('古诗', '诗', '词', '曲'):
                continue
            with self.subTest(title=work['title']):
                source, warnings = parse_lesson((ROOT/work['filePath']).read_text(encoding='utf8'))
                lines = [l.strip() for l in source['original'].splitlines() if l.strip()]
                self.assertEqual([l['text'] for l in work['lines']], lines)
                self.assertEqual(len(lines), len(work['lineTranslations']))
                self.assertEqual([l['translation'] for l in work['lines']], work['lineTranslations'])
                order = next(e for e in work['exercises'] if e['type'] == 'order' and e['mode'] == 'characters')
                self.assertEqual([i['text'] for i in order['items']], lines)
                self.assertEqual(warnings, [])

    def test_yong_e_four_independent_rows_and_repeated_tokens(self):
        work = next(w for w in self.works.values() if '咏鹅' in w['title'])
        self.assertEqual([l['text'] for l in work['lines']], ['鹅，鹅，鹅，', '曲项向天歌。', '白毛浮绿水，', '红掌拨清波。'])
        items = work['exercises'][0]['items']
        self.assertEqual([''.join(t['text'] for t in i['tokens']) for i in items], ['鹅鹅鹅', '曲项向天歌', '白毛浮绿水', '红掌拨清波'])
        self.assertEqual(len({t['id'] for t in items[0]['tokens']}), 3)

    def test_homonymous_jueju_and_liangzhouci_are_distinct(self):
        self.assertTrue(self.works['dufu-jueju-huangli']['original'].startswith('两个黄鹂鸣翠柳，'))
        self.assertTrue(self.works['dufu-jueju-chiri']['original'].startswith('迟日江山丽，'))
        self.assertTrue(self.works['liangzhouci-wanghan']['original'].startswith('葡萄美酒'))
        self.assertTrue(self.works['liangzhouci-wangzhihuan']['original'].startswith('黄河远上'))

    def test_repeated_works_have_two_placements_and_one_txt(self):
        counts = Counter(i['workId'] for i in self.items)
        repeats = [w for w, count in counts.items() if count > 1]
        self.assertEqual({self.works[w]['title'] for w in repeats}, {'鹿柴', '江上渔者'})
        for work_id in repeats:
            self.assertEqual(counts[work_id], 2)
            self.assertEqual(sum(w['workId'] == work_id for w in self.manifest['lessons']), 1)

    def test_textbook_excerpt_boundaries_and_long_poems(self):
        by_title = {w['title'].strip('《》'): w for w in self.works.values()}
        self.assertEqual([l['text'] for l in by_title['静夜思']['lines']], ['床前明月光，', '疑是地上霜。', '举头望明月，', '低头思故乡。'])
        self.assertEqual(len(by_title['画']['lines']), 4)
        self.assertEqual(len(by_title['古朗月行']['lines']), 4)
        self.assertEqual(len(by_title['赋得古原草送别']['lines']), 4)
        self.assertEqual(len(by_title['采薇']['lines']), 8)
        self.assertEqual(len(by_title['长歌行']['lines']), 10)
        self.assertEqual(len(by_title['七律·长征']['lines']), 8)
        for title in ('西江月·夜行黄沙道中', '清平乐·村居', '卜算子·咏梅', '长相思'):
            self.assertEqual(by_title[title]['type'], '词')

    def test_newlines_override_punctuation_and_length_splitting(self):
        self.assertEqual(split_original_lines('甲。乙；\n' + '长'*30), ['甲。乙；', '长'*30])
        self.assertEqual(split_original_lines('甲。乙；', '词'), ['甲。乙；'])
        self.assertEqual(split_original_lines('甲。乙；', '故事'), ['甲。', '乙；'])

    def test_translation_mismatch_warns_without_losing_content(self):
        lesson, warnings = parse_lesson('标题：诗\n作者：作者\n类型：古诗\n原文：\n甲，\n乙。\n译文：译文\n逐句译文：\n甲义\n知识点：重点')
        self.assertIn('原文有 2 行，但逐句译文有 1 行', warnings)
        self.assertEqual(lesson['lines'][1]['text'], '乙。')

    def test_all_original_supplementary_files_remain(self):
        ids = {l['id'] for l in self.manifest['lessons']}
        self.assertTrue({'grade3-lesson3', 'grade3-lesson5', 'grade3-lesson7', 'grade3-lesson8', 'grade3-lesson15'} <= ids)
