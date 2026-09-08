#!/usr/bin/env python3
"""Scan lesson TXT files and build the browser-friendly content manifest.

The parser deliberately stays forgiving: existing Chinese/Markdown lesson
files continue to work, while the optional 小练习 blocks add structured data
for the browser exercises.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

FIELD_ALIASES = {
    "标题": "title", "title": "title", "作者": "author", "author": "author",
    "出处": "source", "来源": "source", "source": "source",
    "故事": "story", "story": "story", "简介": "intro", "intro": "intro",
    "类型": "type", "type": "type", "汉字": "characterInfo", "hanzi": "characterInfo",
    "原文": "original", "正文": "original", "original": "original",
    "译文": "translation", "translation": "translation",
    "朗读音频": "audio", "朗读地址": "audio", "audio": "audio",
    "逐句译文": "lineTranslations", "逐句翻译": "lineTranslations", "句意": "lineTranslations", "line translations": "lineTranslations",
    "知识点": "knowledgePoints", "知识点（重点）": "knowledgePoints", "knowledgepoints": "knowledgePoints",
    "注释": "notes", "notes": "notes", "赏析": "appreciation", "鉴赏": "appreciation", "appreciation": "appreciation",
    "小练习": "exercises", "练习": "exercises", "exercises": "exercises",
}
FIELD_PATTERN = re.compile(r"^\s*(?:#{1,3}\s*)?([^：:#]+?)\s*(?:(?::|：)\s*(.*))?$", re.IGNORECASE)
FILE_PATTERN = re.compile(r"^grade(?P<grade>\d+)[/\\]lesson(?P<lesson>\d+)\.txt$", re.IGNORECASE)
GRADE_DIGITS = "一二三四五六七八九"
GRADE_NAMES = {str(index): f"{GRADE_DIGITS[index - 1]}年级" for index in range(1, 7)}
CJK_PATTERN = re.compile(r"[\u3400-\u9fff]")


def normalize_field(raw: str) -> str | None:
    return FIELD_ALIASES.get(raw.strip().lower())


def clean_lines(lines: Iterable[str]) -> str:
    values = list(lines)
    while values and not values[0].strip():
        values.pop(0)
    while values and not values[-1].strip():
        values.pop()
    return "\n".join(values)


def parse_knowledge_points(value: str) -> List[str]:
    points: List[str] = []
    for line in value.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        stripped = re.sub(r"^(?:[-*•]|\d+\s*[.)、．.]?)\s*", "", stripped)
        if stripped:
            points.append(stripped)
    return points


def _first_cjk(value: str) -> str:
    match = CJK_PATTERN.search(value)
    return match.group(0) if match else ""


def parse_character_info(value: str) -> Dict[str, Dict[str, str]]:
    """Parse optional 汉字 lines such as ``明：míng｜明亮｜audio/ming.mp3``."""
    result: Dict[str, Dict[str, str]] = {}
    for line in value.splitlines():
        stripped = re.sub(r"^(?:[-*•]|\d+\s*[.)、．.]?)\s*", "", line.strip())
        if not stripped:
            continue
        match = re.match(r"^([^：:|｜]+?)\s*(?:：|:|\||｜)\s*(.*)$", stripped)
        if not match:
            continue
        character = _first_cjk(match.group(1))
        if not character:
            continue
        details = [part.strip() for part in re.split(r"[|｜]", match.group(2), maxsplit=2)]
        if len(details) == 1:
            details = [part.strip() for part in re.split(r"[，,；;]\s*", details[0], maxsplit=1)]
        info = {
            "pinyin": details[0] if details else "",
            "meaning": details[1] if len(details) > 1 else "",
        }
        if len(details) > 2 and details[2]:
            info["audio"] = details[2]
        result[character] = info
    return result


def _character_tokens(text: str, prefix: str) -> List[Dict[str, str]]:
    return [{"id": f"{prefix}-{index}", "text": char} for index, char in enumerate(CJK_PATTERN.findall(text))]


def split_original_lines(original: str) -> List[str]:
    """Turn paragraphs into short lines suitable for child-sized exercises."""
    lines: List[str] = []
    for raw_line in original.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        pieces = [piece.strip() for piece in re.split(r"(?<=[。！？；;])", line) if piece.strip()]
        if not pieces:
            pieces = [line]
        for piece in pieces:
            if len(CJK_PATTERN.findall(piece)) <= 20:
                lines.append(piece)
                continue
            chars = list(piece)
            for start in range(0, len(chars), 16):
                chunk = "".join(chars[start:start + 16]).strip()
                if chunk:
                    lines.append(chunk)
    return lines


def build_default_exercises(original: str, exercise_id: str = "default-order") -> List[Dict[str, object]]:
    candidates = [line for line in split_original_lines(original) if CJK_PATTERN.search(line)]
    candidates = candidates[:8]
    items = [{
        "id": f"default-item-{index + 1}",
        "text": line,
        "tokens": _character_tokens(line, f"default-item-{index + 1}"),
    } for index, line in enumerate(candidates)]
    if not items:
        return []
    return [{
        "id": exercise_id,
        "type": "order",
        "mode": "characters",
        "title": "把短句排回去",
        "prompt": "读一读原文，从字块中拼出完整短句。",
        "items": items,
    }]


def _parse_block_line(block: Dict[str, object], line: str) -> None:
    match = FIELD_PATTERN.match(line)
    if not match:
        return
    label, value = match.group(1).strip(), (match.group(2) or "").strip()
    if block["type"] == "order":
        if label == "提示":
            block["prompt"] = value
        elif label == "句子":
            items = block.setdefault("items", [])
            assert isinstance(items, list)
            text = value
            item_id = f"item-{len(items) + 1}"
            items.append({"id": item_id, "text": text, "tokens": _character_tokens(text, item_id)})
    elif block["type"] == "choice":
        if label in ("题目", "问题"):
            block["prompt"] = value
        elif label == "选项":
            options = block.setdefault("options", [])
            assert isinstance(options, list)
            parts = re.split(r"[|｜]", value, maxsplit=1)
            option_id = parts[0].strip() if len(parts) > 1 else chr(65 + len(options))
            option_text = parts[1].strip() if len(parts) > 1 else value
            options.append({"id": option_id, "text": option_text})
        elif label == "答案":
            block["answer"] = value
        elif label in ("解析", "说明"):
            block["explanation"] = value


def _finalize_exercise(block: Dict[str, object], warnings: List[str]) -> Dict[str, object] | None:
    exercise = dict(block)
    exercise.pop("_raw", None)
    if exercise["type"] == "order":
        items = exercise.get("items", [])
        if not items:
            warnings.append("排序练习缺少句子，已忽略")
            return None
        exercise.setdefault("mode", "sentences")
        exercise.setdefault("prompt", "想一想句子的先后顺序。")
    else:
        if not exercise.get("prompt") or not exercise.get("options") or not exercise.get("answer"):
            warnings.append("选择练习缺少题目、选项或答案，已忽略")
            return None
        exercise.setdefault("explanation", "再读一读原文，找找答案吧。")
    return exercise


def parse_lesson(text: str, *, file_path: str = "") -> Tuple[Dict[str, object], List[str]]:
    """Parse Chinese-label fields, Markdown headings, and optional exercises."""
    text = text.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    values: Dict[str, List[str]] = {}
    unknown: Dict[str, List[str]] = {}
    warnings: List[str] = []
    explicit_exercises: List[Dict[str, object]] = []
    current: str | None = None
    current_block: Dict[str, object] | None = None
    raw_exercise_lines: List[str] = []

    for line in text.split("\n"):
        marker = line.strip()
        open_match = re.fullmatch(r"\[(排序|选择)\]", marker)
        close_match = re.fullmatch(r"\[/((?:排序|选择))\]", marker)
        if open_match:
            if current_block is not None:
                warnings.append("练习区块未闭合，已自动结束")
                finalized = _finalize_exercise(current_block, warnings)
                if finalized:
                    explicit_exercises.append(finalized)
            current_block = {"type": "order" if open_match.group(1) == "排序" else "choice", "_raw": []}
            raw_exercise_lines.append(marker)
            continue
        if close_match:
            raw_exercise_lines.append(marker)
            if current_block is None:
                warnings.append(f"发现没有开始标记的练习区块：{marker}")
            else:
                finalized = _finalize_exercise(current_block, warnings)
                if finalized:
                    explicit_exercises.append(finalized)
                current_block = None
            continue
        if current_block is not None:
            raw_exercise_lines.append(line)
            raw = current_block.setdefault("_raw", [])
            assert isinstance(raw, list)
            raw.append(line)
            _parse_block_line(current_block, line)
            continue

        match = FIELD_PATTERN.match(line)
        candidate = normalize_field(match.group(1)) if match else None
        # A known word without a colon may be perfectly valid lesson content
        # (for example a story whose answer is simply “故事”), so only a
        # Markdown heading or a label carrying a colon starts a new field.
        is_heading = bool(match and (line.lstrip().startswith("#") or match.group(2) is not None))
        if is_heading and match and candidate:
            current = candidate
            values.setdefault(current, [])
            if match.group(2):
                values[current].append(match.group(2))
            continue
        if is_heading and match and line.lstrip().startswith("#"):
            label = match.group(1).strip()
            current = f"unknown:{label}"
            unknown.setdefault(current, [])
            warnings.append(f"未知区块：{label}")
            if match.group(2):
                unknown[current].append(match.group(2))
            continue
        if current:
            target = unknown if current.startswith("unknown:") else values
            target.setdefault(current, []).append(line)
        elif line.strip():
            warnings.append("发现未标记文本，已忽略")

    if current_block is not None:
        warnings.append("练习区块未闭合，已自动结束")
        finalized = _finalize_exercise(current_block, warnings)
        if finalized:
            explicit_exercises.append(finalized)

    fields = {key: clean_lines(lines) for key, lines in values.items()}
    sections: Dict[str, str] = dict(fields)
    sections.update({key: clean_lines(lines) for key, lines in unknown.items()})
    if raw_exercise_lines:
        sections["exercises"] = clean_lines(raw_exercise_lines)
    for required in ("title", "author", "original", "translation", "knowledgePoints"):
        if not fields.get(required):
            warnings.append(f"缺少字段：{required}")

    original = fields.get("original", "")
    line_translation_values = [line.strip() for line in fields.get("lineTranslations", "").splitlines() if line.strip()]
    lines = [{
        "id": f"line-{index + 1}",
        "text": line,
        "translation": line_translation_values[index] if index < len(line_translation_values) else "",
        "note": "",
    } for index, line in enumerate(split_original_lines(original))]
    default_exercises = build_default_exercises(original)
    if explicit_exercises:
        has_character_order = any(
            exercise.get("type") == "order" and exercise.get("mode") == "characters"
            for exercise in explicit_exercises
        )
        exercises = explicit_exercises if has_character_order else explicit_exercises + build_default_exercises(original, "default-character-order")
    else:
        exercises = default_exercises
    for index, exercise in enumerate(exercises, start=1):
        exercise.setdefault("id", f"{exercise['type']}-{index}")

    character_info = parse_character_info(fields.get("characterInfo", ""))
    lesson: Dict[str, object] = {
        "title": fields.get("title") or Path(file_path).stem or "未命名课文",
        "author": fields.get("author", ""), "source": fields.get("source", ""),
        "story": fields.get("story", ""), "intro": fields.get("intro", ""), "type": fields.get("type", ""),
        "audio": fields.get("audio", ""),
        "characterInfo": character_info, "characters": character_info,
        "sections": sections, "original": original, "translation": fields.get("translation", ""),
        "lineTranslations": line_translation_values,
        "knowledgePoints": parse_knowledge_points(fields.get("knowledgePoints", "")),
        "notes": fields.get("notes", ""), "appreciation": fields.get("appreciation", ""),
        "lines": lines, "exercises": exercises,
        "preview": next((line["text"].strip() for line in lines if line["text"].strip()), ""),
        "parseWarnings": warnings,
    }
    return lesson, warnings


def scan_content(root: Path) -> Dict[str, object]:
    content_dir = root / "content"
    lessons: List[Dict[str, object]] = []
    warnings: List[str] = []
    errors: List[str] = []
    if not content_dir.exists():
        warnings.append("content 目录不存在，已生成空清单")
    else:
        for path in sorted(content_dir.rglob("*.txt")):
            relative = path.relative_to(content_dir).as_posix()
            match = FILE_PATTERN.match(relative)
            if not match:
                warnings.append(f"跳过不符合命名规则的文件：content/{relative}")
                continue
            grade_no, lesson_no = int(match.group("grade")), int(match.group("lesson"))
            try:
                lesson, parse_warnings = parse_lesson(path.read_text(encoding="utf-8-sig"), file_path=relative)
                lesson.update({"id": f"grade{grade_no}-lesson{lesson_no}", "gradeId": f"grade{grade_no}", "gradeName": GRADE_NAMES.get(str(grade_no), f"{grade_no}年级"), "lessonNo": lesson_no, "filePath": f"content/{relative}"})
                lessons.append(lesson)
                warnings.extend(f"content/{relative}：{item}" for item in parse_warnings)
            except (OSError, UnicodeError, ValueError) as error:
                errors.append(f"content/{relative}：{error}")
    lessons.sort(key=lambda item: (int(str(item["gradeId"])[5:]), int(item["lessonNo"])))
    grades = [{"id": f"grade{index}", "name": GRADE_NAMES[str(index)], "lessonCount": sum(1 for lesson in lessons if lesson["gradeId"] == f"grade{index}")} for index in range(1, 7)]
    return {"version": 2, "grades": grades, "lessons": lessons, "warnings": warnings, "errors": errors}


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="扫描 content/gradeN/lessonN.txt 并生成 content/manifest.json")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1], help="项目根目录")
    parser.add_argument("--output", type=Path, default=None, help="manifest 输出路径，默认 root/content/manifest.json")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    output = (args.output or root / "content" / "manifest.json").resolve()
    manifest = scan_content(root)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"扫描完成：{len(manifest['lessons'])} 篇课文")
    for warning in manifest["warnings"]:
        print(f"WARNING: {warning}", file=sys.stderr)
    for error in manifest["errors"]:
        print(f"ERROR: {error}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
