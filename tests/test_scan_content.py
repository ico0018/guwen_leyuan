import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from scan_content import parse_lesson, scan_content  # noqa: E402


class ScanContentTests(unittest.TestCase):
    def test_metadata_and_explicit_exercises(self):
        lesson, warnings = parse_lesson("""标题：
小故事
作者：
小明
故事：
孩子们在院子里玩耍。
简介：
一个勇敢的故事。
类型：
故事
朗读音频：
audio/story.mp3
汉字：
庭：tíng｜庭院
光：guāng｜光亮｜audio/guang.mp3
原文：
群儿戏于庭。
译文：
孩子们在院子里玩。
知识点：
1. 庭：庭院。
小练习：
[排序]
提示：按故事顺序排列。
句子：先发生
句子：后发生
[/排序]
[选择]
题目：谁很勇敢？
选项：A｜小明
选项：B｜小红
答案：A
解析：因为小明帮助了朋友。
[/选择]
""")
        self.assertEqual(warnings, [])
        self.assertEqual(lesson["story"], "孩子们在院子里玩耍。")
        self.assertEqual(lesson["intro"], "一个勇敢的故事。")
        self.assertEqual(lesson["type"], "故事")
        self.assertEqual(lesson["audio"], "audio/story.mp3")
        self.assertEqual(lesson["characterInfo"]["庭"]["pinyin"], "tíng")
        self.assertEqual(lesson["characterInfo"]["光"]["audio"], "audio/guang.mp3")
        self.assertEqual([exercise["type"] for exercise in lesson["exercises"]], ["order", "choice", "order"])
        self.assertEqual(lesson["exercises"][0]["items"][1]["text"], "后发生")
        self.assertEqual(lesson["exercises"][1]["options"][0], {"id": "A", "text": "小明"})
        self.assertEqual(lesson["exercises"][2]["mode"], "characters")

    def test_default_order_exercise_and_duplicate_tokens_are_independent(self):
        lesson, warnings = parse_lesson("标题：\n短句\n作者：\n\n原文：\n人人爱我。\n译文：\n大家喜欢我。\n知识点：\n")
        self.assertIn("缺少字段：author", warnings)
        exercise = lesson["exercises"][0]
        self.assertEqual(exercise["type"], "order")
        tokens = exercise["items"][0]["tokens"]
        self.assertEqual([token["text"] for token in tokens], list("人人爱我"))
        self.assertEqual(len({token["id"] for token in tokens}), len(tokens))

    def test_chinese_format_preserves_multiline_fields(self):
        lesson, warnings = parse_lesson("\ufeff标题：\r\n危险<标题>\r\n作者：\r\n小明\r\n原文：\r\n第一行\r\n第二行\r\n译文：\r\n白话\r\n逐句译文：\r\n第一行白话\r\n第二行白话\r\n知识点：\r\n1. 第一点\r\n2. 第二点\r\n")
        self.assertEqual(lesson["title"], "危险<标题>")
        self.assertEqual(lesson["original"], "第一行\n第二行")
        self.assertEqual(lesson["lineTranslations"], ["第一行白话", "第二行白话"])
        self.assertEqual(lesson["lines"][1]["translation"], "第二行白话")
        self.assertEqual(lesson["knowledgePoints"], ["第一点", "第二点"])
        self.assertEqual(warnings, [])

    def test_markdown_format_and_unknown_section(self):
        lesson, warnings = parse_lesson("# title: Markdown 课\n# author: 作者\n## 原文\n原文一\n## 译文\n译文\n## 知识点\n- 重点\n## 彩蛋\n内容")
        self.assertEqual(lesson["title"], "Markdown 课")
        self.assertEqual(lesson["knowledgePoints"], ["重点"])
        self.assertIn("unknown:彩蛋", lesson["sections"])
        self.assertIn("未知区块：彩蛋", warnings)

    def test_numeric_sorting_and_bad_file_do_not_stop_scan(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "content/grade10").mkdir(parents=True)
            (root / "content/grade2").mkdir(parents=True)
            (root / "content/grade10/lesson2.txt").write_text("标题：\n十\n原文：\n十\n", encoding="utf-8")
            (root / "content/grade2/lesson10.txt").write_text("标题：\n二十\n原文：\n二十\n", encoding="utf-8")
            (root / "content/grade2/lesson2.txt").write_text("标题：\n二\n原文：\n二\n", encoding="utf-8")
            (root / "content/grade2/lesson3.txt").write_bytes(b"\xff\xfe\xff")
            manifest = scan_content(root)
            self.assertEqual([item["id"] for item in manifest["lessons"]], ["grade2-lesson2", "grade2-lesson10", "grade10-lesson2"])
            self.assertEqual(len(manifest["errors"]), 1)
            self.assertEqual([grade["id"] for grade in manifest["grades"]], [f"grade{i}" for i in range(1, 7)])
            self.assertEqual([grade["name"] for grade in manifest["grades"]], ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"])

    def test_generated_manifest_is_json_safe(self):
        manifest = scan_content(ROOT)
        encoded = json.dumps(manifest, ensure_ascii=False)
        self.assertIn("危险", json.dumps(parse_lesson("标题：\n危险\n")[0], ensure_ascii=False))
        self.assertIsInstance(encoded, str)
        self.assertEqual(len([item for item in manifest["lessons"] if item["gradeId"] == "grade3"]), 13)
        self.assertNotIn("grade3-lesson6", {item["id"] for item in manifest["lessons"]})
        self.assertNotIn("grade3-lesson13", {item["id"] for item in manifest["lessons"]})


if __name__ == "__main__":
    unittest.main()
