import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class StaticFilesTests(unittest.TestCase):
    def test_index_references_existing_local_assets(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        for reference in re.findall(r'(?:href|src)="([^"#]+)"', html):
            if reference.startswith(("http://", "https://")):
                continue
            self.assertTrue((ROOT / reference).is_file(), reference)

    def test_frontend_uses_manifest_and_no_directory_listing(self):
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn('fetch("content/manifest.json"', app)
        self.assertNotRegex(app, r"(?:readdir|listdir)")
        self.assertIn("HanziWriter", app)
        self.assertIn("openCharacterModal", app)
        self.assertIn("renderOriginalContent", app)
        self.assertIn("getAutomaticPinyin", app)
        self.assertIn("playRecordedAudio", app)
        self.assertIn("playHumanAudio", app)
        self.assertIn("readTextAloud", app)
        self.assertIn("HUMAN_AUDIO_BASE_URL", app)
        self.assertIn("readCharacterAloud", app)
        self.assertIn("readTextAloud", app)
        self.assertIn("lesson-title--study", app)
        self.assertNotIn("translation-panel", app)
        self.assertNotIn("line-translation-label", app)
        self.assertIn("speakCharacter", app)
        self.assertIn("checkPuzzleResult", app)
        self.assertIn("order-exercise", app)
        self.assertIn("choice-exercise", app)

    def test_index_contains_writer_modal_and_celebration_outside_app(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("hanzi-writer@2.0.2", html)
        self.assertIn("pinyin-pro@3.18.2", html)
        self.assertIn('id="character-modal"', html)
        self.assertIn('id="writer-target"', html)
        self.assertIn('id="speak-character"', html)
        self.assertNotIn("学写", html)
        self.assertNotIn("汉字「", html)
        self.assertIn('id="celebration"', html)
        self.assertLess(html.index('id="app"'), html.index('id="character-modal"'))

    def test_dictation_uses_screen_handwriting(self):
        dictation = (ROOT / "dictation.js").read_text(encoding="utf-8")
        self.assertIn("HanziWriter", dictation)
        self.assertIn("dictation-writer-target", dictation)
        self.assertIn("请在田字格里写字", dictation)
        self.assertNotIn("<textarea", dictation)

    def test_manifest_file_paths_exist(self):
        manifest = ROOT / "content/manifest.json"
        self.assertTrue(manifest.is_file())
        data = json.loads(manifest.read_text(encoding="utf-8"))
        self.assertEqual(len(data["grades"]), 6)
        for lesson in data["lessons"]:
            self.assertTrue((ROOT / lesson["filePath"]).is_file(), lesson["filePath"])

    def test_grade3_shanxing_keeps_single_character_xie_for_writing(self):
        data = json.loads((ROOT / "content/manifest.json").read_text(encoding="utf-8"))
        lesson = next(item for item in data["lessons"] if item["id"] == "grade3-lesson2")
        self.assertEqual(lesson["characterInfo"]["斜"]["pinyin"], "xié")
        self.assertEqual(lesson["characterInfo"]["斜"]["meaning"], "不正，倾斜。")


if __name__ == "__main__":
    unittest.main()
