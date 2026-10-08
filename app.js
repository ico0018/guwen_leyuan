(async function () {
  "use strict";
  if (window.XbbCloudReady) await window.XbbCloudReady;

  const grades = [
    { id: "grade1", name: "一年级", phrase: "认识古文的第一颗小星星", color: "coral" },
    { id: "grade2", name: "二年级", phrase: "把熟悉的文字读得更有趣", color: "gold" },
    { id: "grade3", name: "三年级", phrase: "在故事里发现古人的智慧", color: "moss" },
    { id: "grade4", name: "四年级", phrase: "读懂句子背后的画面", color: "blue" },
    { id: "grade5", name: "五年级", phrase: "和古人来一场思想漫游", color: "purple" },
    { id: "grade6", name: "六年级", phrase: "积累表达，准备新的出发", color: "green" }
  ];
  const learningKey = "guwen-leyuan-learning-v2";
  const state = {
    manifest: null, curriculum: null, lessons: [], toastTimer: null, learning: loadLearning(),
    activeLessonId: "", orderBanks: {}, orderPlaced: {}, orderFeedback: {}, choiceFeedback: {}, orderItemIndexes: {}, characterAudio: null,
    activeCharacter: "", writer: null, writerQuizStarted: false, writerPracticeMode: null, writerSession: 0, modalPreviouslyFocused: null
  };
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const els = {
    modal: document.getElementById("character-modal"), modalClose: document.getElementById("modal-close"),
    modalTitle: document.getElementById("modal-title"), modalCharacter: document.getElementById("modal-character"),
    modalPinyin: document.getElementById("modal-pinyin"), modalMeaning: document.getElementById("modal-meaning"),
    fallbackCharacter: document.getElementById("fallback-character"), writerTarget: document.getElementById("writer-target"),
    writerFallback: document.getElementById("writer-fallback"), writerStatus: document.getElementById("writer-status"),
    animateButton: document.getElementById("animate-button"), speakCharacter: document.getElementById("speak-character"), practiceButton: document.getElementById("practice-button"),
    practiceOptions: document.getElementById("practice-options"), practiceTrace: document.getElementById("practice-trace"), practiceBlank: document.getElementById("practice-blank"),
    modalDone: document.getElementById("modal-done"), celebration: document.getElementById("celebration")
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function gradeOf(id) { return grades.find((grade) => grade.id === id) || grades[0]; }
  function lessonsFor(gradeId) { return state.lessons.filter((lesson) => lesson.gradeId === gradeId).sort((a, b) => (Number(a.curriculumIndex) || Number(a.lessonNo) || 0) - (Number(b.curriculumIndex) || Number(b.lessonNo) || 0)); }
  function normalizeCatalogText(value) {
    return String(value || "").replace(/[《》〈〉\s]/g, "").replace(/【/g, "[").replace(/】/g, "]");
  }
  function lessonHasOriginal(lesson) {
    return Boolean(String((lesson && (lesson.original || (lesson.sections && lesson.sections.original))) || "").trim());
  }
  function mergeCurriculumLessons(manifestLessons, curriculum) {
    if (!curriculum || !Array.isArray(curriculum.grades)) return Array.isArray(manifestLessons) ? manifestLessons : [];
    const source = (Array.isArray(manifestLessons) ? manifestLessons : []).map((lesson, index) => ({ ...lesson, _catalogSourceIndex: index }));
    const usedForExtra = new Set();
    const output = [];
    curriculum.grades.forEach((gradeEntry) => {
      let gradeIndex = 0;
      (gradeEntry.semesters || []).forEach((semester) => {
        (semester.items || []).forEach((item, itemIndex) => {
          gradeIndex += 1;
          const titleKey = normalizeCatalogText(item.title);
          const authorKey = normalizeCatalogText(item.author);
          let best = null;
          let bestScore = -1;
          source.forEach((lesson, sourceIndex) => {
            if (item.workId ? lesson.workId !== item.workId : normalizeCatalogText(lesson.title) !== titleKey) return;
            if (authorKey && normalizeCatalogText(lesson.author) !== authorKey) return;
            const original = String(lesson.original || (lesson.sections && lesson.sections.original) || "");
            if (item.distinguishing && original && !original.includes(item.distinguishing)) return;
            let score = lesson.gradeId === gradeEntry.gradeId ? 100 : 0;
            if (item.distinguishing && original.includes(item.distinguishing)) score += 80;
            if (lessonHasOriginal(lesson)) score += 10;
            if (score > bestScore) { best = { lesson, sourceIndex }; bestScore = score; }
          });
          const base = best ? best.lesson : {};
          if (best) usedForExtra.add(best.sourceIndex);
          const id = `${gradeEntry.gradeId}-${semester.id}-${String(itemIndex + 1).padStart(2, "0")}`;
          output.push({
            ...base,
            id,
            placementId: item.placementId || id,
            workId: item.workId || base.workId || "",
            gradeId: gradeEntry.gradeId,
            gradeName: gradeEntry.name || gradeOf(gradeEntry.gradeId).name,
            lessonNo: gradeIndex,
            curriculumIndex: gradeIndex,
            semester: semester.name,
            semesterId: semester.id,
            semesterOrder: itemIndex + 1,
            title: item.title,
            author: item.author,
            distinguishing: item.distinguishing || "",
            preview: base.preview || (item.distinguishing ? `${item.distinguishing}……` : "已收录课内目录，正文讲解正在整理中。"),
            curriculum: true,
            catalogOnly: !lessonHasOriginal(base),
            sourceLessonId: base.id || ""
          });
        });
      });
    });
    source.forEach((lesson, index) => {
      if (usedForExtra.has(index)) return;
      output.push({
        ...lesson,
        semester: "补充",
        semesterId: "extra",
        semesterOrder: Number(lesson.lessonNo) || index + 1,
        curriculumIndex: 9000 + (Number(lesson.lessonNo) || index + 1),
        supplementary: true
      });
    });
    return output;
  }
  function route() {
    const raw = window.location.hash.replace(/^#\/?/, "") || "welcome";
    const parts = raw.split("/").filter(Boolean);
    if (parts[0] === "grades") return { name: "grades" };
    if (parts[0] === "grade" && parts[1]) return { name: "grade", gradeId: parts[1] };
    if (parts[0] === "lesson" && parts[1]) return { name: "lesson", lessonId: parts[1] };
    return { name: "welcome" };
  }
  function loadLearning() {
    try {
      const saved = JSON.parse((window.XbbStorage || window.localStorage).getItem(learningKey) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (error) { return {}; }
  }
  function saveLearning() {
    try { (window.XbbStorage || window.localStorage).setItem(learningKey, JSON.stringify(state.learning)); } catch (error) { /* storage may be unavailable */ }
  }
  function progressTotal() {
    try { const saved = JSON.parse((window.XbbStorage || window.localStorage).getItem("guwen-leyuan-read-v1") || "[]"); return Array.isArray(saved) ? saved.length : 0; }
    catch (error) { return 0; }
  }
  function markRead(lessonId) {
    try {
      const saved = JSON.parse((window.XbbStorage || window.localStorage).getItem("guwen-leyuan-read-v1") || "[]");
      const ids = Array.isArray(saved) ? saved : [];
      if (!ids.includes(lessonId)) { ids.push(lessonId); (window.XbbStorage || window.localStorage).setItem("guwen-leyuan-read-v1", JSON.stringify(ids)); }
    } catch (error) { /* localStorage may be unavailable */ }
  }
  function header() {
    const count = progressTotal();
    return `<header class="topbar"><a class="brand" href="#/welcome" aria-label="回到古文乐园首页"><span class="brand-mark" aria-hidden="true">墨</span><span><span class="brand-kicker">每天一点古韵</span><span class="brand-name">古文乐园</span></span></a><div class="topbar-progress" aria-label="阅读进度"><span class="progress-sparkle" aria-hidden="true">✦</span><span><strong>${count}</strong> 篇已读</span><span class="progress-track" aria-hidden="true"><span style="width:${Math.min(100, count * 10)}%"></span></span></div></header>`;
  }
  function breadcrumb(label) { return `<nav class="breadcrumb" aria-label="当前位置"><a href="#/welcome">首页</a><span aria-hidden="true">›</span><span>${escapeHtml(label)}</span></nav>`; }
  function gradeCard(grade) {
    const items = lessonsFor(grade.id);
    const curriculumItems = items.filter((item) => item.curriculum);
    const count = curriculumItems.length || items.length;
    return `<a class="grade-card grade-card--${grade.color}" href="#/grade/${grade.id}"><span class="grade-number" aria-hidden="true">${grade.id.replace("grade", "")}</span><span class="grade-card-content"><span class="grade-label">${escapeHtml(grade.name)}</span><strong>${count ? `${count} 首课内古诗` : "暂时没有课文"}</strong><span>${escapeHtml(grade.phrase)}</span></span><span class="card-arrow" aria-hidden="true">→</span></a>`;
  }
  function welcomeView() {
    const first = state.lessons[0];
    const target = first ? `grade/${first.gradeId}` : "grades";
    return `${header()}<main><section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>小小读书人的每日一课</p><h1 id="hero-title">古文古诗，<br /><em>写在心里</em></h1><p class="hero-description">小学 1～6 年级课内古诗。<br class="desktop-break" />读一读、想一想，每次发现都值得收藏。</p><div class="hero-actions"><a class="button button--primary button--large" href="#/${target}">开始今天的探索 <span class="button-arrow" aria-hidden="true">→</span></a><span class="hero-note"><span aria-hidden="true">⌁</span> 轻松读一篇</span></div></div><div class="hero-art" aria-label="一轮明月和书卷插画" role="img"><div class="moon" aria-hidden="true"></div><div class="hero-cloud hero-cloud--one" aria-hidden="true"></div><div class="hero-cloud hero-cloud--two" aria-hidden="true"></div><div class="hero-mountain hero-mountain--back" aria-hidden="true"></div><div class="hero-mountain hero-mountain--front" aria-hidden="true"></div><div class="hero-book" aria-hidden="true"><span>一</span><span>页</span><span>诗</span></div><span class="hero-star hero-star--one" aria-hidden="true">✦</span><span class="hero-star hero-star--two" aria-hidden="true">·</span><span class="hero-star hero-star--three" aria-hidden="true">✧</span></div></section><section class="section-block welcome-grades" aria-labelledby="grades-preview-title"><div class="section-heading"><div><p class="section-kicker">六个成长书架</p><h2 id="grades-preview-title">从哪个年级开始？</h2></div><a class="text-button" href="#/grades">查看全部年级 <span aria-hidden="true">→</span></a></div><div class="grade-grid">${grades.map(gradeCard).join("")}</div></section></main>`;
  }
  function gradesView() { return `${header()}<main class="page-main">${breadcrumb("选择年级")}<section class="page-intro"><p class="section-kicker">准备好了吗？</p><h1>选择你的年级</h1><p>按上册、下册读古诗，逐行理解、排字、默写。</p></section><section class="grade-grid grade-grid--large" aria-label="六个年级">${grades.map(gradeCard).join("")}</section></main>`; }
  function lessonCard(lesson) {
    const preview = lesson.preview || lesson.original || "这篇课文正在整理中。";
    const label = lesson.curriculum ? `${lesson.semester} · 第 ${lesson.semesterOrder} 首` : `补充 · 第 ${lesson.lessonNo} 篇`;
    return `<a class="lesson-card ${lesson.catalogOnly ? "lesson-card--catalog" : ""}" href="#/lesson/${escapeHtml(lesson.id)}"><div class="lesson-card-top"><span class="lesson-no">${escapeHtml(label)}</span><span class="card-arrow" aria-hidden="true">→</span></div><h2>${escapeHtml(lesson.title)}</h2><p class="lesson-author">${escapeHtml(lesson.author || "未署名")}</p><p class="lesson-preview">${escapeHtml(preview)}</p><span class="lesson-link">${lesson.catalogOnly ? "查看目录信息" : "打开课文"} <span aria-hidden="true">✦</span></span></a>`;
  }
  function semesterSection(name, items) {
    if (!items.length) return "";
    const label = name === "补充" ? "已有的补充古文内容" : `${name}课内古诗`;
    return `<section class="semester-section" aria-labelledby="semester-${escapeHtml(name)}"><div class="semester-heading"><div><p class="section-kicker">${name === "补充" ? "继续保留" : "按课本册次整理"}</p><h2 id="semester-${escapeHtml(name)}">${escapeHtml(label)}</h2></div><span class="semester-count">${items.length} 篇</span></div><div class="lesson-grid">${items.map(lessonCard).join("")}</div></section>`;
  }
  function gradeView(gradeId) {
    const grade = gradeOf(gradeId); const items = lessonsFor(grade.id);
    const curriculumItems = items.filter((item) => item.curriculum);
    const count = curriculumItems.length || items.length;
    const groups = ["上册", "下册", "补充"].map((name) => [name, items.filter((item) => (item.semester || "补充") === name)]).filter((entry) => entry[1].length);
    return `${header()}<main class="page-main">${breadcrumb(grade.name)}<section class="page-intro page-intro--row"><div><p class="section-kicker">${escapeHtml(grade.name)} · 古诗书架</p><h1>${escapeHtml(grade.name)}的课内古诗</h1><p>按上册、下册整理，每首都可以听读、逐行理解、选字排序和全文默写。</p></div><span class="lesson-count">${count} 首</span></section>${groups.length ? groups.map(([name, groupItems]) => semesterSection(name, groupItems)).join("") : `<section class="empty-state"><span class="empty-icon" aria-hidden="true">☼</span><h2>这个书架还在长大</h2><p>暂时没有收录课文，先去看看其他年级吧。</p><a class="button button--soft" href="#/grades">换个年级看看 <span aria-hidden="true">→</span></a></section>`}</main>`;
  }
  function block(label, content, className) { return content ? `<section class="lesson-block ${className || ""}"><h2>${label}</h2><div class="lesson-block-body">${escapeHtml(content).replace(/\n/g, "<br />")}</div></section>` : ""; }
  function knowledgeBlock(points) {
    if (!Array.isArray(points) || !points.length) return "";
    return `<section class="knowledge-card"><div class="knowledge-title"><span class="knowledge-icon" aria-hidden="true">✦</span><div><p class="section-kicker">读完想一想</p><h2>知识小锦囊</h2></div></div><ol>${points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ol></section>`;
  }
  function getCharacters(text) { return Array.from(String(text || "")).filter((char) => /[\u3400-\u9fff]/.test(char)); }
  function shuffle(items) {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    if (result.length > 1 && result.every((item, index) => item.id === items[index].id)) [result[0], result[1]] = [result[1], result[0]];
    return result;
  }
  function renderLineCharacters(text) {
    return Array.from(String(text || "")).map((char) => {
      if (/[\u3400-\u9fff]/.test(char)) return `<button class="poem-char original-char" type="button" data-character="${escapeHtml(char)}" aria-label="学习汉字${escapeHtml(char)}">${escapeHtml(char)}</button>`;
      if (char === "\n") return "<br />";
      return `<span class="poem-punctuation" aria-hidden="true">${escapeHtml(char)}</span>`;
    }).join("");
  }
  function renderOriginalContent(lesson, original) {
    const lines = lessonLines(lesson);
    const hasLineTranslations = lines.some((line) => line.translation) || (Array.isArray(lesson.lineTranslations) && lesson.lineTranslations.some(Boolean));
    if (!hasLineTranslations) return renderLineCharacters(original);
    return lines.map((line) => `<div class="poem-line"><div class="poem-line-text">${renderLineCharacters(line.text)}</div>${line.translation ? `<div class="line-translation">${escapeHtml(line.translation)}</div>` : ""}</div>`).join("");
  }
  function lessonLines(lesson) {
    if (Array.isArray(lesson.lines) && lesson.lines.length) return lesson.lines;
    return String(lesson.original || "").split(/\n+/).filter(Boolean).map((text, index) => ({ id: `line-${index + 1}`, text, note: "" }));
  }
  function characterTokens(text, prefix) { return getCharacters(text).map((char, index) => ({ id: `${prefix}-${index}`, text: char })); }
  function normalizeExercises(lesson) {
    const source = Array.isArray(lesson.exercises) ? lesson.exercises : [];
    return source.filter((exercise) => exercise && (exercise.type === "order" || exercise.type === "choice")).map((exercise, index) => {
      const normalized = { ...exercise, id: exercise.id || `${exercise.type}-${index + 1}` };
      if (normalized.type === "order") {
        normalized.items = (Array.isArray(normalized.items) ? normalized.items : []).map((item, itemIndex) => {
          const text = typeof item === "string" ? item : String(item.text || "");
          return { ...item, id: item.id || `item-${itemIndex + 1}`, text, tokens: Array.isArray(item.tokens) && item.tokens.length ? item.tokens.map((token, tokenIndex) => ({ ...token, id: token.id || `${normalized.id}-${itemIndex}-${tokenIndex}`, text: token.text || token.char || "" })) : characterTokens(text, `${normalized.id}-${itemIndex}`) };
        });
      } else {
        normalized.options = (Array.isArray(normalized.options) ? normalized.options : []).map((option, optionIndex) => typeof option === "string" ? { id: String.fromCharCode(65 + optionIndex), text: option } : { ...option, id: option.id || String.fromCharCode(65 + optionIndex), text: String(option.text || "") });
      }
      return normalized;
    });
  }
  function defaultCharacterOrder(lesson, exerciseId = "default-order") {
    const items = lessonLines(lesson).filter((line) => getCharacters(line.text).length).map((line, index) => ({ id: `default-item-${index + 1}`, text: line.text, tokens: characterTokens(line.text, `default-item-${index + 1}`) }));
    return items.length ? [{ id: exerciseId, type: "order", mode: "characters", title: "把短句排回去", prompt: "读一读原文，从字块中拼出完整短句。", items }] : [];
  }
  function getLessonExercises(lesson) {
    const explicit = normalizeExercises(lesson);
    if (!explicit.length) return defaultCharacterOrder(lesson);
    if (explicit.some((exercise) => exercise.type === "order" && exercise.mode === "characters")) return explicit;
    return explicit.concat(defaultCharacterOrder(lesson, "default-character-order"));
  }
  function lessonRecord(lessonId) { if (!state.learning[lessonId]) state.learning[lessonId] = { exercises: {}, characters: {} }; return state.learning[lessonId]; }
  function savedExercise(lessonId, exerciseId) { return lessonRecord(lessonId).exercises[exerciseId] || {}; }
  function isOrderComplete(lessonId, exerciseId, itemId, sentenceMode) { const saved = savedExercise(lessonId, exerciseId); return sentenceMode ? Boolean(saved.completed) : Boolean(saved.items && saved.items[itemId]); }
  function setOrderComplete(lessonId, exerciseId, itemId, sentenceMode) {
    const lesson = lessonRecord(lessonId); const saved = lesson.exercises[exerciseId] || { items: {} };
    saved.items = saved.items || {};
    if (sentenceMode) saved.completed = true; else saved.items[itemId] = true;
    lesson.exercises[exerciseId] = saved; saveLearning();
  }
  function allExercisesComplete(lesson) {
    const exercises = getLessonExercises(lesson);
    return exercises.length > 0 && exercises.every((exercise) => exercise.type === "choice" ? Boolean(savedExercise(lesson.id, exercise.id).completed) : exercise.mode === "sentences" ? isOrderComplete(lesson.id, exercise.id, "", true) : exercise.items.every((item) => isOrderComplete(lesson.id, exercise.id, item.id, false)));
  }
  function progressSummary(lesson) {
    const exercises = getLessonExercises(lesson); let completed = 0; let total = 0;
    exercises.forEach((exercise) => { if (exercise.type === "choice" || exercise.mode === "sentences") { total += 1; completed += (exercise.type === "choice" ? Boolean(savedExercise(lesson.id, exercise.id).completed) : isOrderComplete(lesson.id, exercise.id, "", true)) ? 1 : 0; } else { total += exercise.items.length; completed += exercise.items.filter((item) => isOrderComplete(lesson.id, exercise.id, item.id, false)).length; } });
    return { completed, total };
  }
  function getPlaced(key) { return state.orderPlaced[key] || []; }
  function bankFor(key, tokens) { if (!state.orderBanks[key] || state.orderBanks[key].length !== tokens.length) state.orderBanks[key] = shuffle(tokens); return state.orderBanks[key]; }
  function orderExerciseMarkup(lesson, exercise) {
    const sentenceMode = exercise.mode === "sentences";
    const itemIndex = state.orderItemIndexes && state.orderItemIndexes[exercise.id] || 0;
    const item = exercise.items[itemIndex] || exercise.items[0];
    if (!item) return "";
    const key = sentenceMode ? exercise.id : `${exercise.id}:${item.id}`;
    const expected = sentenceMode ? exercise.items.map((entry) => ({ id: entry.id, text: entry.text })) : item.tokens;
    const placed = getPlaced(key); const bank = bankFor(key, expected); const complete = isOrderComplete(lesson.id, exercise.id, sentenceMode ? "" : item.id, sentenceMode);
    const feedback = state.orderFeedback[key];
    const message = complete ? "太棒了！这一题已经完成。" : feedback === "wrong" ? "顺序还差一点，点上面的内容撤回后再试试。" : (sentenceMode ? "想一想故事发生的先后顺序。" : "按原文顺序点击字块，组成完整的一行。");
    const slots = placed.map((token, index) => `<button type="button" class="answer-slot answer-slot--${sentenceMode ? "sentence" : "char"} is-filled" data-remove-index="${index}" data-order-key="${escapeHtml(key)}" aria-label="撤回${escapeHtml(token.text)}">${escapeHtml(token.text)}</button>`).join("");
    const emptySlots = Array(Math.max(0, expected.length - placed.length)).fill(0).map((_, index) => `<span class="answer-slot" aria-label="第 ${placed.length + index + 1} 个位置，空"></span>`).join("");
    const itemsPicker = !sentenceMode && exercise.items.length > 1 ? `<div class="order-item-picker" aria-label="选择练习短句">${exercise.items.map((entry, index) => `<button type="button" class="${index === itemIndex ? "is-active" : ""} ${isOrderComplete(lesson.id, exercise.id, entry.id, false) ? "is-complete" : ""}" data-order-item="${escapeHtml(exercise.id)}" data-item-index="${index}">${index + 1}</button>`).join("")}</div>` : "";
    return `<article class="order-exercise" data-exercise-id="${escapeHtml(exercise.id)}"><div class="exercise-card-heading"><div><p class="exercise-kicker">字块排序</p><h3>${escapeHtml(exercise.title || "把内容排回去")}</h3></div>${complete ? `<span class="exercise-done">已完成 ✦</span>` : ""}</div><p class="exercise-instruction">${escapeHtml(exercise.prompt || "想一想正确的顺序。")}</p>${itemsPicker}${!sentenceMode ? `<p class="exercise-instruction">第 ${itemIndex + 1} 行 / 共 ${exercise.items.length} 行</p>` : ""}<div class="answer-slots" aria-label="已排列内容">${slots}${emptySlots}</div><p class="scramble-label">${sentenceMode ? "打乱的句子：" : "找到下一个字："}</p><div class="scramble-bank" aria-label="打乱的字块或句子">${bank.map((token) => `<button class="scramble-chip ${sentenceMode ? "scramble-chip--sentence" : ""}" type="button" data-order-token="${escapeHtml(token.id)}" data-order-key="${escapeHtml(key)}" ${placed.some((entry) => entry.id === token.id) || complete ? "disabled" : ""}>${escapeHtml(token.text)}</button>`).join("")}</div><div class="exercise-message ${feedback === "wrong" ? "is-wrong" : complete ? "is-success" : ""}" role="status">${message}</div><div class="exercise-actions"><button class="button button--outline" type="button" data-order-reset="${escapeHtml(key)}">重新打乱</button>${complete ? "<span class=\"exercise-complete-label\">完成本行 ✓</span>" : ""}</div></article>`;
  }
  function choiceExerciseMarkup(lesson, exercise) {
    const saved = savedExercise(lesson.id, exercise.id); const feedback = state.choiceFeedback[exercise.id];
    const message = feedback === "wrong" ? `再想一想。${exercise.explanation ? ` ${escapeHtml(exercise.explanation)}` : ""}` : saved.completed ? `答对啦！${exercise.explanation ? ` ${escapeHtml(exercise.explanation)}` : ""}` : "选出你认为正确的答案。";
    return `<article class="choice-exercise" data-exercise-id="${escapeHtml(exercise.id)}"><div class="exercise-card-heading"><div><p class="exercise-kicker">小小选择题</p><h3>${escapeHtml(exercise.title || "读文选择")}</h3></div>${saved.completed ? `<span class="exercise-done">已完成 ✦</span>` : ""}</div><p class="choice-prompt">${escapeHtml(exercise.prompt || "读一读原文再选择。")}</p><div class="choice-options" role="group" aria-label="选择答案">${exercise.options.map((option) => `<button type="button" class="choice-option ${saved.answer === option.id ? "is-selected" : ""}" data-choice-id="${escapeHtml(option.id)}" ${saved.completed ? "disabled" : ""}><span>${escapeHtml(option.id)}</span>${escapeHtml(option.text)}</button>`).join("")}</div><div class="exercise-message ${feedback === "wrong" ? "is-wrong" : saved.completed ? "is-success" : ""}" role="status">${message}</div></article>`;
  }
  function exercisesMarkup(lesson) {
    const exercises = getLessonExercises(lesson); if (!exercises.length) return "";
    const summary = progressSummary(lesson); const complete = allExercisesComplete(lesson);
    return `<section class="lesson-exercises" id="lesson-exercises" aria-labelledby="exercise-section-title"><div class="exercises-heading"><div><p class="section-kicker">读一读，想一想</p><h2 id="exercise-section-title">课文小练习</h2></div><span class="exercise-count">${summary.completed}/${summary.total} 已完成</span></div>${complete ? `<div class="lesson-complete" role="status">本篇完成！你把古人的故事读懂了 ✦</div>` : ""}${exercises.map((exercise) => exercise.type === "choice" ? choiceExerciseMarkup(lesson, exercise) : orderExerciseMarkup(lesson, exercise)).join("")}</section>`;
  }
  function lessonView(lessonId) {
    const lesson = state.lessons.find((item) => item.id === lessonId) || state.lessons.find((item) => item.sourceLessonId === lessonId);
    if (!lesson) return `${header()}<main class="page-main">${breadcrumb("课文未找到")}<section class="empty-state"><span class="empty-icon" aria-hidden="true">?</span><h2>这篇课文还没有找到</h2><p>回到书架，再挑一篇看看吧。</p><a class="button button--primary" href="#/grades">回到年级选择</a></section></main>`;
    state.activeLessonId = lesson.id; markRead(lesson.id);
    const gradeItems = lessonsFor(lesson.gradeId); const index = gradeItems.findIndex((item) => item.id === lesson.id); const previous = gradeItems[index - 1]; const next = gradeItems[index + 1];
    const original = lesson.original || (lesson.sections && lesson.sections.original) || "";
    const hasOriginal = Boolean(String(original).trim());
    const lessonLabel = lesson.curriculum ? `${gradeOf(lesson.gradeId).name} · ${lesson.semester} · 第 ${lesson.semesterOrder} 首` : `${gradeOf(lesson.gradeId).name} · 补充内容`;
    const originalMarkup = hasOriginal
      ? `<div class="original-card"><div class="original-label"><span aria-hidden="true">⌁</span> 原文</div><div class="original-text">${renderOriginalContent(lesson, original)}</div><button class="inline-speak" type="button" data-speak="${escapeHtml(original)}">朗读原文 <span aria-hidden="true">◖</span></button></div>`
      : `<section class="catalog-pending"><p class="section-kicker">目录已收录</p><h2>原文与讲解正在整理</h2><p>这首诗已经放到正确的年级和册次中。后续补充对应 TXT 内容后，逐句讲解、选字排序和全文默写会自动启用。</p>${lesson.distinguishing ? `<p class="catalog-hint">识别句：${escapeHtml(lesson.distinguishing)}</p>` : ""}</section>`;
    return `${header()}<main class="page-main lesson-page">${breadcrumb(`${gradeOf(lesson.gradeId).name} · ${lesson.title}`)}<article class="lesson-detail"><div class="lesson-detail-heading"><div><span class="lesson-no">${escapeHtml(lessonLabel)}</span><h1 class="lesson-title--study">${renderLineCharacters(lesson.title)}</h1><p class="lesson-author lesson-author--study">${renderLineCharacters(lesson.author || "未署名")}${lesson.source ? ` <span class="dot-divider">·</span> ${escapeHtml(lesson.source)}` : ""}</p></div>${hasOriginal ? `<button class="read-button" type="button" data-speak="${escapeHtml(`${lesson.title}。${original}`)}"><span aria-hidden="true">◖</span> 听一听</button>` : `<span class="catalog-badge">课内目录</span>`}</div>${lesson.notes ? `<p class="lesson-note">${escapeHtml(lesson.notes)}</p>` : ""}${originalMarkup}${hasOriginal ? exercisesMarkup(lesson) : ""}${hasOriginal ? knowledgeBlock(lesson.knowledgePoints) : ""}${hasOriginal && lesson.appreciation ? block("小小赏析", lesson.appreciation, "appreciation-block") : ""}</article><nav class="lesson-nav" aria-label="课文导航"><a class="button button--soft" href="#/grade/${escapeHtml(lesson.gradeId)}">← 返回列表</a><div class="lesson-nav-next">${previous ? `<a class="text-button" href="#/lesson/${escapeHtml(previous.id)}">← 上一篇</a>` : ""}${next ? `<a class="button button--primary" href="#/lesson/${escapeHtml(next.id)}">下一篇 <span aria-hidden="true">→</span></a>` : ""}</div></nav></main>`;
  }
  function render() {
    stopAllSpeech();
    closeCharacterModal();
    const current = route();
    if (current.name === "grades") app.innerHTML = gradesView(); else if (current.name === "grade") app.innerHTML = gradeView(current.gradeId); else if (current.name === "lesson") app.innerHTML = lessonView(current.lessonId); else app.innerHTML = welcomeView();
    bindActions(); window.scrollTo({ top: 0, behavior: "auto" });
  }
  function bindActions() {
    app.querySelectorAll("[data-speak]").forEach((button) => button.addEventListener("click", () => state.speechActive ? stopAllSpeech() : readLessonAloud(state.lessons.find((item) => item.id === state.activeLessonId))));
    app.querySelectorAll("[data-character]").forEach((button) => button.addEventListener("click", () => openCharacterModal(button.dataset.character)));
    const lesson = state.lessons.find((item) => item.id === state.activeLessonId); if (lesson) bindExerciseActions(lesson);
    const originalCard = app.querySelector(".original-card");
    if (lesson && originalCard && lessonHasOriginal(lesson) && window.GuwenDictation) window.GuwenDictation.mount(originalCard, lesson);
  }
  function refreshExercises(lesson) { const container = document.getElementById("lesson-exercises"); if (!container) return; container.outerHTML = exercisesMarkup(lesson); bindExerciseActions(lesson); }
  function bindExerciseActions(lesson) {
    const container = document.getElementById("lesson-exercises"); if (!container) return;
    container.querySelectorAll("[data-order-token]").forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.orderKey; const token = (state.orderBanks[key] || []).find((entry) => entry.id === button.dataset.orderToken); if (!token || getPlaced(key).some((entry) => entry.id === token.id)) return;
      state.orderPlaced[key] = getPlaced(key).concat(token); checkPuzzleResult(lesson, key);
    }));
    container.querySelectorAll("[data-remove-index]").forEach((button) => button.addEventListener("click", () => { const key = button.dataset.orderKey; const placed = getPlaced(key).slice(); placed.splice(Number(button.dataset.removeIndex), 1); state.orderPlaced[key] = placed; state.orderFeedback[key] = ""; refreshExercises(lesson); }));
    container.querySelectorAll("[data-order-reset]").forEach((button) => button.addEventListener("click", () => { const key = button.dataset.orderReset; delete state.orderPlaced[key]; state.orderFeedback[key] = ""; const tokens = state.orderBanks[key] || []; state.orderBanks[key] = shuffle(tokens); refreshExercises(lesson); }));
    container.querySelectorAll("[data-order-item]").forEach((button) => button.addEventListener("click", () => { state.orderItemIndexes = state.orderItemIndexes || {}; state.orderItemIndexes[button.dataset.orderItem] = Number(button.dataset.itemIndex); refreshExercises(lesson); }));
    container.querySelectorAll("[data-choice-id]").forEach((button) => button.addEventListener("click", () => checkChoiceResult(lesson, button.closest("[data-exercise-id]").dataset.exerciseId, button.dataset.choiceId)));
  }
  function checkPuzzleResult(lesson, key) {
    const exercise = getLessonExercises(lesson).find((item) => item.id === key || key.startsWith(`${item.id}:`)); if (!exercise) return;
    const sentenceMode = exercise.mode === "sentences"; const itemIndex = state.orderItemIndexes[exercise.id] || 0; const itemId = sentenceMode ? "" : key.split(":").slice(1).join(":"); const item = sentenceMode ? null : exercise.items.find((entry) => entry.id === itemId); const expected = sentenceMode ? exercise.items : (item ? item.tokens : []); const placed = getPlaced(key);
    if (placed.length !== expected.length) { refreshExercises(lesson); return; }
    if (placed.every((token, index) => token.text === expected[index].text)) {
      setOrderComplete(lesson.id, exercise.id, itemId, sentenceMode); state.orderFeedback[key] = "success"; delete state.orderPlaced[key];
      if (!sentenceMode) {
        const nextIndex = exercise.items.findIndex((entry, index) => index > itemIndex && !isOrderComplete(lesson.id, exercise.id, entry.id, false));
        if (nextIndex >= 0) state.orderItemIndexes[exercise.id] = nextIndex;
      }
      refreshExercises(lesson); celebrate(); showToast(sentenceMode ? "故事顺序排对啦 ✦" : (state.orderItemIndexes[exercise.id] > itemIndex ? "这一行完成啦，继续下一行 ✦" : "选字排序全部完成啦 ✦"));
    } else { state.orderFeedback[key] = "wrong"; refreshExercises(lesson); }
  }
  function checkChoiceResult(lesson, exerciseId, answer) {
    const exercise = getLessonExercises(lesson).find((item) => item.id === exerciseId); if (!exercise) return;
    const saved = savedExercise(lesson.id, exerciseId); saved.answer = answer;
    if (String(answer).toUpperCase() === String(exercise.answer).trim().toUpperCase()) { saved.completed = true; state.choiceFeedback[exerciseId] = "success"; saveLearning(); refreshExercises(lesson); celebrate(); showToast("回答正确，真会读故事 ✦"); }
    else { state.choiceFeedback[exerciseId] = "wrong"; state.learning[lesson.id].exercises[exerciseId] = saved; saveLearning(); refreshExercises(lesson); }
  }
  const speechController = window.GuwenSpeech.createSpeechController(window, (status) => {
    state.speechActive = status === "speaking" || status === "recording";
    app.querySelectorAll("[data-speak]").forEach((button) => {
      button.textContent = state.speechActive ? "■ 停止" : "▶ 听一听";
      button.setAttribute("aria-pressed", String(state.speechActive));
    });
    if (status === "unavailable") showToast("这台设备暂时无法朗读");
    else if (status === "recording") showToast("录音朗读……");
    else if (status === "speaking") showToast("正在朗读……");
  });
  function stopAllSpeech() { speechController.stop(); }
  function showToast(message) { window.clearTimeout(state.toastTimer); toast.textContent = message; toast.classList.add("is-visible"); state.toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800); }
  function celebrate() { if (!els.celebration) return; els.celebration.classList.remove("is-active"); void els.celebration.offsetWidth; els.celebration.classList.add("is-active"); window.setTimeout(() => els.celebration.classList.remove("is-active"), 1000); }
  function characterInfo(lesson, character) {
    const source = lesson && (lesson.characterInfo || lesson.characters); const value = source && source[character];
    if (Array.isArray(value)) return { pinyin: value[0], meaning: value[1], audio: value[2] || "" };
    return value && typeof value === "object" ? { pinyin: value.pinyin || "", meaning: value.meaning || "", audio: value.audio || "" } : { pinyin: "", meaning: "结合课文读一读这个字", audio: "" };
  }
  function getAutomaticPinyin(character) {
    try {
      const converter = window.pinyinPro && window.pinyinPro.pinyin;
      const result = typeof converter === "function" ? converter(character, { type: "array", toneType: "symbol" }) : [];
      return Array.isArray(result) && result[0] ? result[0] : "拼音加载中";
    } catch (error) { return "拼音加载中"; }
  }
  function openCharacterModal(character) {
    stopAllSpeech();
    const lesson = state.lessons.find((item) => item.id === state.activeLessonId) || {}; const info = characterInfo(lesson, character);
    state.writer?.cancelQuiz(); state.writerSession += 1;
    state.activeCharacter = character; state.writerQuizStarted = false; state.writerPracticeMode = null; state.modalPreviouslyFocused = document.activeElement;
    els.practiceOptions.hidden = true; els.practiceButton.setAttribute("aria-expanded", "false");
    els.practiceTrace.setAttribute("aria-pressed", "false"); els.practiceBlank.setAttribute("aria-pressed", "false"); els.fallbackCharacter.hidden = false;
    els.modalCharacter.textContent = character; els.modalPinyin.textContent = info.pinyin || getAutomaticPinyin(character); els.modalMeaning.textContent = info.meaning || "结合课文读一读这个字"; els.speakCharacter.setAttribute("aria-label", `听汉字${character}的读音`); els.fallbackCharacter.textContent = character; els.writerTarget.innerHTML = ""; els.writerFallback.classList.add("is-hidden"); els.writerStatus.textContent = "先看笔顺，再点击“我来试一试”选择练习方式。"; els.practiceButton.textContent = "✎ 我来试一试"; els.modal.classList.remove("is-hidden"); document.body.style.overflow = "hidden"; window.setTimeout(() => els.modalClose.focus(), 0); initWriter(character);
  }
  function resolveAudioPath(path) {
    if (!path) return "";
    try { return new URL(path, document.baseURI).href; } catch (error) { return path; }
  }
  function readCharacterAloud(character) {
    const lesson = state.lessons.find((item) => item.id === state.activeLessonId) || {};
    const info = characterInfo(lesson, character);
    return speechController.read(character, resolveAudioPath(info.audio));
  }
  function readLessonAloud(lesson) {
    if (!lesson) return;
    const text = lesson.title + "。\n" + lessonLines(lesson).map((line) => line.text).join("\n");
    return speechController.read(text, resolveAudioPath(lesson.audio));
  }
  function initWriter(character) {
    state.writer = null;
    if (!window.HanziWriter) { els.writerFallback.classList.remove("is-hidden"); els.writerStatus.textContent = "笔顺动画暂时不可用，先观察田字格，再试着写一遍。"; return; }
    try {
      state.writer = window.HanziWriter.create(els.writerTarget, character, { width: 260, height: 260, padding: 12, showCharacter: true, showOutline: true, strokeAnimationSpeed: 1.05, delayBetweenStrokes: 280, highlightOnComplete: true, characterColor: "#24332f", outlineColor: "#d9ded6", mainColor: "#24332f", highlightColor: "#e7ac56", drawingColor: "#e9826f", drawingWidth: 5 });
      state.writer.animateCharacter();
    } catch (error) { els.writerFallback.classList.remove("is-hidden"); els.writerStatus.textContent = "这个字的动画暂时没准备好，但仍可以在田字格中练习。"; }
  }
  function showWriterPracticeOptions() {
    els.practiceOptions.hidden = false;
    els.practiceButton.setAttribute("aria-expanded", "true");
    (state.writerPracticeMode === "blank" ? els.practiceBlank : els.practiceTrace).focus();
  }
  function startWriterQuiz(mode) {
    const writer = state.writer;
    const token = ++state.writerSession;
    const tracing = mode === "trace";
    state.writerPracticeMode = mode;
    state.writerQuizStarted = true;
    els.practiceTrace.setAttribute("aria-pressed", String(tracing));
    els.practiceBlank.setAttribute("aria-pressed", String(!tracing));
    els.fallbackCharacter.hidden = !tracing;
    if (!writer || typeof writer.quiz !== "function") { els.writerStatus.textContent = "笔顺练习暂时不可用，请稍后重新打开这个字再试。"; return; }
    writer.cancelQuiz();
    if (tracing) writer.showOutline({ duration: 0 });
    else writer.hideOutline({ duration: 0 });
    els.writerStatus.textContent = tracing ? "跟着淡淡的字形轮廓，一笔一画来。" : "在空白田字格里按笔顺写。写错两次，会提示这一笔。";
    writer.quiz({
      leniency: 1.18, strokeFadeDuration: 0, showHintAfterMisses: 2, highlightOnComplete: true,
      onMistake: () => { if (token === state.writerSession) els.writerStatus.textContent = "这一笔再观察一下方向，慢慢来。"; },
      onCorrectStroke: (strokeData) => { if (token === state.writerSession) els.writerStatus.textContent = `第 ${strokeData.strokeNum + 1} 笔完成，继续加油！`; },
      onComplete: () => {
        if (token !== state.writerSession) return;
        writer.showCharacter({ duration: 0 });
        state.writerQuizStarted = false;
        els.writerStatus.textContent = "太棒了，笔顺完成！可以再练一次，或继续探索下一字。";
        showToast("汉字写得真认真 ✦");
      }
    });
  }
  function closeCharacterModal() { if (!els.modal) return; state.writerSession += 1; state.writer?.cancelQuiz(); state.writerQuizStarted = false; stopAllSpeech(); els.modal.classList.add("is-hidden"); document.body.style.overflow = ""; if (state.modalPreviouslyFocused && typeof state.modalPreviouslyFocused.focus === "function") state.modalPreviouslyFocused.focus(); }
  function markCharacterLearned() { if (!state.activeLessonId || !state.activeCharacter) return; const lesson = lessonRecord(state.activeLessonId); lesson.characters = lesson.characters || {}; lesson.characters[state.activeCharacter] = true; saveLearning(); }
  function renderLoadError() { app.innerHTML = `${header()}<main class="page-main"><section class="empty-state"><span class="empty-icon" aria-hidden="true">!</span><h1>小书架暂时打不开</h1><p>请确认已经运行静态服务器，并且先执行内容扫描。</p><button class="button button--primary" id="retry-button" type="button">再试一次</button></section></main>`; document.getElementById("retry-button").addEventListener("click", loadManifest); }
  async function loadManifest() {
    app.innerHTML = '<div class="loading-state"><span class="loading-mark" aria-hidden="true">墨</span><p>正在打开古文小书架……</p></div>';
    try {
      const response = await fetch("content/manifest.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`manifest ${response.status}`);
      const manifest = await response.json();
      if (!manifest || !Array.isArray(manifest.lessons)) throw new Error("invalid manifest");
      let curriculum = null;
      try {
        const curriculumResponse = await fetch("content/curriculum.json", { cache: "no-store" });
        if (curriculumResponse.ok) curriculum = await curriculumResponse.json();
      } catch (catalogError) {
        console.warn("Unable to load curriculum catalog", catalogError);
      }
      state.manifest = manifest;
      state.curriculum = curriculum;
      state.lessons = mergeCurriculumLessons(manifest.lessons, curriculum).sort((a, b) => a.gradeId.localeCompare(b.gradeId, undefined, { numeric: true }) || (Number(a.curriculumIndex) || Number(a.lessonNo) || 0) - (Number(b.curriculumIndex) || Number(b.lessonNo) || 0));
      render();
    }
    catch (error) { console.error("Unable to load content manifest", error); renderLoadError(); }
  }
  function bindModalActions() {
    if (!els.modal) return;
    els.modalClose.addEventListener("click", closeCharacterModal); els.modalDone.addEventListener("click", () => { markCharacterLearned(); closeCharacterModal(); }); els.speakCharacter.addEventListener("click", () => readCharacterAloud(state.activeCharacter));
    els.animateButton.addEventListener("click", () => { if (state.writer && typeof state.writer.animateCharacter === "function") { state.writerSession += 1; state.writerQuizStarted = false; state.writerPracticeMode = null; els.practiceTrace.setAttribute("aria-pressed", "false"); els.practiceBlank.setAttribute("aria-pressed", "false"); state.writer.animateCharacter(); els.writerStatus.textContent = "看清楚了吗？选择描红或空白田字格，再来写一遍。"; } else els.writerStatus.textContent = "请按汉字的结构，从上到下、从左到右观察。"; });
    els.practiceButton.addEventListener("click", showWriterPracticeOptions);
    els.practiceTrace.addEventListener("click", () => startWriterQuiz("trace")); els.practiceBlank.addEventListener("click", () => startWriterQuiz("blank"));
    els.modal.addEventListener("click", (event) => { if (event.target === els.modal) closeCharacterModal(); }); document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !els.modal.classList.contains("is-hidden")) closeCharacterModal(); });
  }
  window.addEventListener("hashchange", () => { if (state.manifest) render(); });
  window.addEventListener("pagehide", stopAllSpeech);
  bindModalActions(); loadManifest();
})();
