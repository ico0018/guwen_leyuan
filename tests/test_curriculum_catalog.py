import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "content" / "curriculum.json"


class CurriculumCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_catalog_has_all_six_grades(self):
        grades = self.catalog["grades"]
        self.assertEqual([grade["gradeId"] for grade in grades], [f"grade{i}" for i in range(1, 7)])

    def test_catalog_counts_match_source_directory(self):
        expected = {
            "grade1": {"上册": 6, "下册": 7},
            "grade2": {"上册": 7, "下册": 7},
            "grade3": {"上册": 10, "下册": 9},
            "grade4": {"上册": 10, "下册": 10},
            "grade5": {"上册": 11, "下册": 11},
            "grade6": {"上册": 11, "下册": 17},
        }
        actual_total = 0
        for grade in self.catalog["grades"]:
            actual = {semester["name"]: len(semester["items"]) for semester in grade["semesters"]}
            self.assertEqual(actual, expected[grade["gradeId"]])
            actual_total += sum(actual.values())
        self.assertEqual(actual_total, 116)
        self.assertEqual(self.catalog["placementCount"], 116)

    def test_each_catalog_item_has_title_and_author(self):
        for grade in self.catalog["grades"]:
            for semester in grade["semesters"]:
                for item in semester["items"]:
                    self.assertTrue(item["title"].strip())
                    self.assertTrue(item["author"].strip())


if __name__ == "__main__":
    unittest.main()
