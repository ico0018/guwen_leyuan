(function (root) {
  "use strict";

  const normalize = (text) => String(text || "").normalize("NFC").replace(/[\s\p{P}]/gu, "");
  const charactersForLine = (text) => Array.from(normalize(text));

  function linesFor(lesson) {
    // 默写保留全文，不能使用选字排序练习的短句数量限制。
    return String(lesson.original || "")
      .split(/\n|(?<=[。！？；])/u)
      .map((line) => line.trim())
      .filter((line) => normalize(line));
  }

  // 保留给内容测试使用；屏幕默写本身由 HanziWriter 逐字检查笔顺。
  function compare(answer, expected) {
    const actual = Array.from(normalize(answer));
    const target = Array.from(normalize(expected));
    return {
      correct: actual.join("") === target.join(""),
      positions: target.flatMap((char, index) => actual[index] === char ? [] : [index + 1]),
      extra: Math.max(0, actual.length - target.length),
    };
  }

  const escape = (text) => String(text ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));

  function mount(anchor, lesson) {
    const lines = linesFor(lesson);
    if (!lines.length) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button--primary dictation-entry";
    button.textContent = "✎ 全文默写 · 屏幕写字";
    anchor.after(button);
    button.addEventListener("click", () => open(lesson, lines, button));
  }

  function open(lesson, lines, trigger) {
    const key = `guwen-dictation-handwriting-v1:${lesson.id}`;
    const signature = JSON.stringify(lines);
    const fresh = () => ({ version: 1, signature, lineIndex: 0, charIndex: 0, hints: [], completedLines: [], done: false });
    let record = fresh();
    let storageWorks = true;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (
        saved?.signature === signature &&
        Number.isInteger(saved.lineIndex) && saved.lineIndex >= 0 && saved.lineIndex < lines.length &&
        Number.isInteger(saved.charIndex) && saved.charIndex >= 0 &&
        Array.isArray(saved.hints) && Array.isArray(saved.completedLines)
      ) record = { ...fresh(), ...saved };
    } catch (_) { storageWorks = false; }

    let stage = "prepare";
    let hintLevel = 0;
    let writerStatus = "用手指在田字格里一笔一画写。写对后会自动进入下一个字。";
    let activeWriter = null;
    let writerToken = 0;
    const dialog = document.createElement("dialog");
    dialog.className = "dictation-dialog";
    dialog.setAttribute("aria-labelledby", "dictation-title");
    document.body.append(dialog);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function save() {
      try { localStorage.setItem(key, JSON.stringify(record)); }
      catch (_) { storageWorks = false; }
    }
    function close() { save(); if (dialog.open) dialog.close(); }
    dialog.addEventListener("close", () => {
      writerToken += 1;
      activeWriter = null;
      document.body.style.overflow = previousOverflow;
      dialog.remove();
      window.removeEventListener("hashchange", close);
      if (trigger.isConnected) trigger.focus();
    });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
    window.addEventListener("hashchange", close);
    function action(id, handler) { dialog.querySelector(`[data-do="${id}"]`)?.addEventListener("click", handler); }
    function currentCharacters() { return charactersForLine(lines[record.lineIndex] || ""); }
    function currentHintLevel() { return Number(record.hints?.[record.lineIndex]?.[record.charIndex] || 0); }
    function setHintLevel(level) {
      if (!Array.isArray(record.hints[record.lineIndex])) record.hints[record.lineIndex] = [];
      record.hints[record.lineIndex][record.charIndex] = Math.max(Number(record.hints[record.lineIndex][record.charIndex] || 0), level);
      hintLevel = currentHintLevel();
      writerStatus = hintLevel >= 2 ? `这是“${currentCharacters()[record.charIndex]}”，看清后再写一遍。` : "先看淡淡的笔顺轮廓，再用手指写一遍。";
      save();
      draw();
    }
    function finishCharacter() {
      const chars = currentCharacters();
      if (record.charIndex + 1 < chars.length) {
        record.charIndex += 1;
        hintLevel = currentHintLevel();
        writerStatus = "写对啦！继续写下一个字。";
        save();
        draw();
        return;
      }
      record.completedLines[record.lineIndex] = true;
      record.charIndex = 0;
      stage = "lineSuccess";
      writerStatus = "这一句写完啦，休息一下再继续。";
      save();
      draw();
    }
    function finishLine() {
      if (record.lineIndex + 1 >= lines.length) {
        record.done = true;
        stage = "done";
      } else {
        record.lineIndex += 1;
        record.charIndex = 0;
        stage = "write";
      }
      hintLevel = currentHintLevel();
      writerStatus = "用手指在田字格里一笔一画写。写对后会自动进入下一个字。";
      save();
      draw();
    }
    function reset() {
      record = fresh();
      stage = "write";
      hintLevel = 0;
      writerStatus = "用手指在田字格里一笔一画写。写对后会自动进入下一个字。";
      save();
      draw();
    }
    const button = (id, label, primary = false) => `<button type="button" class="button ${primary ? "button--primary" : "button--soft"}" data-do="${id}">${label}</button>`;

    function setupTouchFallback(target, character) {
      target.innerHTML = `<canvas id="dictation-touch-canvas" width="236" height="236" aria-label="请在田字格里写字"></canvas>${hintLevel >= 2 ? `<span class="dictation-fallback-character">${escape(character)}</span>` : ""}`;
      const canvas = target.querySelector("canvas");
      const context = canvas.getContext("2d");
      let drawing = false;
      context.strokeStyle = "#283f33"; context.lineWidth = 7; context.lineCap = "round"; context.lineJoin = "round";
      const point = (event) => {
        const rect = canvas.getBoundingClientRect();
        return [(event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height];
      };
      canvas.addEventListener("pointerdown", (event) => { drawing = true; canvas.setPointerCapture(event.pointerId); const [x, y] = point(event); context.beginPath(); context.moveTo(x, y); });
      canvas.addEventListener("pointermove", (event) => { if (!drawing) return; const [x, y] = point(event); context.lineTo(x, y); context.stroke(); });
      canvas.addEventListener("pointerup", () => { drawing = false; });
      canvas.addEventListener("pointercancel", () => { drawing = false; });
      const fallbackButton = dialog.querySelector('[data-do="fallback-complete"]');
      if (fallbackButton) fallbackButton.hidden = false;
      const status = dialog.querySelector("#dictation-status");
      if (status) status.textContent = "笔顺动画暂时不可用，也可以直接在格子里写好，再点完成本字。";
    }

    function setupWriter(character) {
      const target = dialog.querySelector("#dictation-writer-target");
      if (!target) return;
      const token = ++writerToken;
      activeWriter = null;
      if (root && root.HanziWriter) {
        try {
          const writer = root.HanziWriter.create(target, character, {
            width: 260, height: 260, padding: 12,
            showCharacter: hintLevel >= 2, showOutline: hintLevel >= 1, showHintAfterMisses: 2,
            strokeAnimationSpeed: 1.05, delayBetweenStrokes: 220, highlightOnComplete: true,
            characterColor: "#283f33", outlineColor: "#b9cbb3", mainColor: "#283f33",
            highlightColor: "#e6b85d", drawingColor: "#dc806e", drawingWidth: 5,
          });
          activeWriter = writer;
          writer.quiz({
            leniency: 1.2, showHintAfterMisses: 2, highlightOnComplete: true,
            onMistake: () => { writerStatus = "这一笔再观察一下方向，慢慢来。"; const status = dialog.querySelector("#dictation-status"); if (status) status.textContent = writerStatus; },
            onCorrectStroke: (strokeData) => { const status = dialog.querySelector("#dictation-status"); if (status) status.textContent = `第 ${strokeData.strokeNum + 1} 笔完成，继续加油！`; },
            onComplete: () => { if (token === writerToken) finishCharacter(); },
          });
          if (hintLevel >= 2 && typeof writer.animateCharacter === "function") window.setTimeout(() => { if (token === writerToken) writer.animateCharacter(); }, 100);
          return;
        } catch (_) { /* 使用下面的触摸画板 */ }
      }
      setupTouchFallback(target, character);
    }

    function draw() {
      const index = record.lineIndex;
      const current = lines[index] || "";
      const chars = currentCharacters();
      const character = chars[record.charIndex] || chars[0] || "字";
      const completed = Math.min(record.charIndex, chars.length);
      let body = "";
      if (stage === "prepare") {
        const continueLabel = record.done ? "看看上次的成果" : record.lineIndex || record.charIndex ? "继续屏幕默写" : "开始屏幕默写";
        body = `<p class="dictation-guide">先轻声读一遍，想象诗里的画面。开始后原文会藏起来，孩子用手指在田字格里逐字写。</p><div class="dictation-poem">${lines.map((line) => `<p>${escape(line)}</p>`).join("")}</div><p>共 ${lines.length} 句，不用键盘、不计时。写对一个字，就会自动进入下一个字。</p><div class="dictation-actions">${button("start", continueLabel, true)}${button("restart", "从第一句重新练")}</div>`;
      } else if (stage === "done") {
        body = `<div class="dictation-award">🌟</div><h2>你完成了全文默写！</h2><p>每一句都已经用手指写过了，真认真！</p><div class="dictation-poem">${lines.map((line) => `<p>${escape(line)}<small>✓ 完成</small></p>`).join("")}</div><div class="dictation-actions">${button("restart", "再挑战一次", true)}${button("close", "完成，回到课文")}</div>`;
      } else if (stage === "lineSuccess") {
        body = `<div class="dictation-award">✦</div><h2>这一句写完啦！</h2><p class="dictation-answer">${escape(current)}</p><p>停一下，轻轻背一遍，再往下走。</p>${button("next-line", index + 1 === lines.length ? "收集全文完成星星" : "继续下一句 →", true)}`;
      } else {
        const progressValue = index + completed / Math.max(1, chars.length);
        const hintText = hintLevel >= 2 ? `本字是“${escape(character)}”，看清后再写一遍。` : hintLevel === 1 ? "先看淡淡的笔顺轮廓，再用手指写一遍。" : "想不起来也没关系，可以先看笔顺提示。";
        const slots = chars.map((char, charIndex) => charIndex < record.charIndex ? `<span class="dictation-slot is-complete" aria-label="第 ${charIndex + 1} 个字已完成">✓</span>` : charIndex === record.charIndex ? `<span class="dictation-slot is-current" aria-label="正在写第 ${charIndex + 1} 个字">写</span>` : `<span class="dictation-slot" aria-label="第 ${charIndex + 1} 个字，空白">□</span>`).join("");
        body = `<p class="dictation-guide">第 ${index + 1} / ${lines.length} 句 · 正在写第 ${record.charIndex + 1} 个字，共 ${chars.length} 个字</p><progress max="${lines.length}" value="${progressValue}" aria-label="全文默写进度"></progress><div class="dictation-slots" aria-label="这句诗的默写进度">${slots}</div><div class="dictation-writer-card"><div id="dictation-writer-target" class="dictation-writer-target" aria-label="请在田字格里写字"></div></div><p class="dictation-status" id="dictation-status" role="status">${escape(writerStatus)}</p><div class="dictation-actions">${button("hint", hintLevel >= 2 ? "再演示一次笔顺" : hintLevel === 1 ? "显示这个字" : "看笔顺提示")}${button("fallback-complete", "写好了，完成本字", true)}</div><p class="dictation-hint" role="status">${hintText}</p>`;
      }
      dialog.innerHTML = `<div class="dictation-shell"><header><div><p class="section-kicker">小小默写家 · ${stage === "prepare" ? "读一读" : stage === "done" ? "收获星星" : "想一想，写一写"}</p><h1 id="dictation-title">${escape(lesson.title)}</h1><p>${escape(lesson.author || "")}</p></div>${button("exit", "保存并退出")}</header>${body}<p class="dictation-saving">${storageWorks ? "进度保存在这台设备，随时可以回来继续。" : "这台设备暂时不能保存进度，请尽量在本次完成。"}</p></div>`;
      action("exit", close); action("close", close); action("start", () => { stage = record.done ? "done" : "write"; hintLevel = currentHintLevel(); save(); draw(); }); action("restart", reset); action("next-line", finishLine);
      action("hint", () => { if (hintLevel < 2) setHintLevel(hintLevel + 1); else if (activeWriter && typeof activeWriter.animateCharacter === "function") activeWriter.animateCharacter(); });
      action("fallback-complete", finishCharacter);
      if (stage === "write") {
        setupWriter(character);
        if (!dialog.querySelector("#dictation-touch-canvas")) dialog.querySelector('[data-do="fallback-complete"]')?.setAttribute("hidden", "hidden");
        dialog.querySelector('[data-do="hint"]')?.focus();
      } else dialog.querySelector('[data-do="next-line"], [data-do="close"], [data-do="start"], [data-do="restart"]')?.focus();
    }

    draw();
    dialog.showModal();
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { normalize, linesFor, charactersForLine, compare };
  if (root) root.GuwenDictation = { mount };
})(typeof window === "undefined" ? null : window);
