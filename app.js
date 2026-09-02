(function () {
  "use strict";

  const works = [
    {
      id: "quiet-night",
      type: "poem",
      typeLabel: "古诗",
      title: "静夜思",
      author: "唐 · 李白",
      intro: "一轮明月，照见远方的思念。",
      lines: [
        { text: "床前明月光，", note: "月光洒在床前，像一层银色的霜。" },
        { text: "疑是地上霜。", note: "抬头看看明月，低头想起故乡。" },
        { text: "举头望明月，", note: "诗人抬头望向天上的月亮。" },
        { text: "低头思故乡。", note: "低下头来，思念远方的家乡。" }
      ]
    },
    {
      id: "spring-dawn",
      type: "poem",
      typeLabel: "古诗",
      title: "春晓",
      author: "唐 · 孟浩然",
      intro: "春日清晨，鸟声把美好叫醒。",
      lines: [
        { text: "春眠不觉晓，", note: "春天睡得香甜，不知不觉天亮了。" },
        { text: "处处闻啼鸟。", note: "到处都能听见小鸟清脆的叫声。" },
        { text: "夜来风雨声，", note: "昨夜传来风吹雨打的声音。" },
        { text: "花落知多少。", note: "不知道有多少花瓣被风雨打落。" }
      ]
    },
    {
      id: "sympathy-for-farmers",
      type: "poem",
      typeLabel: "古诗",
      title: "悯农（其二）",
      author: "唐 · 李绅",
      intro: "一粥一饭，都有辛勤的汗水。",
      lines: [
        { text: "锄禾日当午，", note: "农民顶着正午的太阳在田里锄禾。" },
        { text: "汗滴禾下土。", note: "汗水一滴滴落在禾苗下的泥土里。" },
        { text: "谁知盘中餐，", note: "谁知道盘子里的饭食从哪里来呢？" },
        { text: "粒粒皆辛苦。", note: "每一粒粮食都凝结着劳动的辛苦。" }
      ]
    },
    {
      id: "the-analects",
      type: "prose",
      typeLabel: "古文",
      title: "《论语》一则",
      author: "先秦 · 孔子",
      intro: "把学到的知识常常温习，快乐就来了。",
      lines: [
        { text: "学而时习之，", note: "学习知识后，按时温习它。" },
        { text: "不亦说乎？", note: "这不是一件很快乐的事吗？“说”同“悦”。" },
        { text: "有朋自远方来，", note: "有志同道合的朋友从远方来。" },
        { text: "不亦乐乎？", note: "这不是一件令人快乐的事吗？" }
      ]
    }
  ];

  const characterInfo = {
    床: ["chuáng", "睡觉用的地方"], 前: ["qián", "前面、前方"], 明: ["míng", "明亮的"], 月: ["yuè", "夜空中的月亮"], 光: ["guāng", "照亮四周的光"],
    疑: ["yí", "心里不确定"], 是: ["shì", "表示判断"], 地: ["dì", "脚下的土地"], 上: ["shàng", "在高处或上面"], 霜: ["shuāng", "天气冷时结成的白色冰晶"],
    举: ["jǔ", "抬起、举起"], 头: ["tóu", "身体最上面的部分"], 望: ["wàng", "向远处看"], 低: ["dī", "位置低、放低"], 思: ["sī", "想念、思考"], 故: ["gù", "过去的、老的"], 乡: ["xiāng", "家乡"],
    春: ["chūn", "一年中的春天"], 眠: ["mián", "睡觉"], 不: ["bù", "表示否定"], 觉: ["jué", "感觉、察觉"], 晓: ["xiǎo", "天刚亮的时候"], 处: ["chù", "地方；到处"], 闻: ["wén", "听见、听到"], 啼: ["tí", "鸟儿鸣叫"], 鸟: ["niǎo", "会飞的小动物"],
    夜: ["yè", "天黑的时间"], 来: ["lái", "从别处到这里"], 风: ["fēng", "空气流动形成的风"], 雨: ["yǔ", "从云中落下的水滴"], 声: ["shēng", "声音"], 花: ["huā", "植物的花朵"], 落: ["luò", "从高处下来"], 知: ["zhī", "知道、了解"], 多: ["duō", "数量大"], 少: ["shǎo", "数量小"],
    锄: ["chú", "用锄头松土、除草"], 禾: ["hé", "谷类植物"], 日: ["rì", "太阳；一天"], 当: ["dāng", "正值、在"], 午: ["wǔ", "中午"], 汗: ["hàn", "身体排出的水珠"], 滴: ["dī", "一小滴水"], 下: ["xià", "在下面、向下"], 土: ["tǔ", "土地、泥土"], 谁: ["shuí", "问哪一个人"], 盘: ["pán", "盛放食物的扁平器皿"], 中: ["zhōng", "里面、当中"], 餐: ["cān", "吃的饭食"], 粒: ["lì", "小而圆的颗粒"], 皆: ["jiē", "全、都"], 辛: ["xīn", "辛苦、劳累"], 苦: ["kǔ", "艰难、不容易"],
    学: ["xué", "学习知识"], 而: ["ér", "表示连接"], 时: ["shí", "时间；按时"], 习: ["xí", "反复练习"], 之: ["zhī", "它、这件事"], 亦: ["yì", "也"], 说: ["yuè", "同“悦”，快乐"], 乎: ["hū", "句末语气词"], 有: ["yǒu", "拥有、存在"], 朋: ["péng", "朋友"], 自: ["zì", "从、由"], 远: ["yuǎn", "距离很长"], 方: ["fāng", "地方；方向"], 乐: ["lè", "快乐" ]
  };

  const storageKey = "guwen-leyuan-progress-v1";
  const state = {
    category: "all",
    selectedWorkId: "quiet-night",
    lineIndex: 0,
    placed: [],
    tokens: [],
    progress: loadProgress(),
    activeCharacter: "",
    writer: null,
    writerQuizStarted: false,
    modalPreviouslyFocused: null,
    toastTimer: null
  };

  const els = {
    categoryTabs: document.getElementById("category-tabs"),
    resultCount: document.getElementById("result-count"),
    workGrid: document.getElementById("work-grid"),
    poemCard: document.getElementById("poem-card"),
    exerciseCard: document.getElementById("exercise-card"),
    startButton: document.getElementById("start-button"),
    randomButton: document.getElementById("random-button"),
    topProgressCount: document.getElementById("top-progress-count"),
    topProgressBar: document.getElementById("top-progress-bar"),
    toast: document.getElementById("toast"),
    modal: document.getElementById("character-modal"),
    modalClose: document.getElementById("modal-close"),
    modalTitle: document.getElementById("modal-title"),
    modalCharacter: document.getElementById("modal-character"),
    modalPinyin: document.getElementById("modal-pinyin"),
    modalMeaning: document.getElementById("modal-meaning"),
    fallbackCharacter: document.getElementById("fallback-character"),
    writerTarget: document.getElementById("writer-target"),
    writerFallback: document.getElementById("writer-fallback"),
    writerStatus: document.getElementById("writer-status"),
    animateButton: document.getElementById("animate-button"),
    practiceButton: document.getElementById("practice-button"),
    modalDone: document.getElementById("modal-done"),
    celebration: document.getElementById("celebration")
  };

  function loadProgress() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (error) {
      return {};
    }
  }

  function saveProgress() {
    try { window.localStorage.setItem(storageKey, JSON.stringify(state.progress)); } catch (error) { /* private mode */ }
  }

  function getWork() {
    return works.find((work) => work.id === state.selectedWorkId) || works[0];
  }

  function getLine() {
    const work = getWork();
    return work.lines[state.lineIndex] || work.lines[0];
  }

  function getCharacters(text) {
    return Array.from(text).filter((char) => /[\u3400-\u9fff]/.test(char));
  }

  function getWorkProgress(work) {
    const done = state.progress[work.id] && state.progress[work.id].lines;
    return Array.isArray(done) ? done.filter(Boolean).length : 0;
  }

  function isLineComplete(work, index) {
    return Boolean(state.progress[work.id] && state.progress[work.id].lines && state.progress[work.id].lines[index]);
  }

  function totalCompletedLines() {
    return works.reduce((sum, work) => sum + getWorkProgress(work), 0);
  }

  function totalLines() { return works.reduce((sum, work) => sum + work.lines.length, 0); }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function shuffle(items) {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function resetPuzzle() {
    const characters = getCharacters(getLine().text);
    state.placed = [];
    state.tokens = shuffle(characters.map((char, index) => ({ id: `${state.lineIndex}-${index}`, char })));
    if (state.tokens.map((token) => token.char).join("") === characters.join("") && state.tokens.length > 1) {
      [state.tokens[0], state.tokens[1]] = [state.tokens[1], state.tokens[0]];
    }
  }

  function setWork(workId, lineIndex) {
    if (!works.some((work) => work.id === workId)) return;
    state.selectedWorkId = workId;
    state.lineIndex = typeof lineIndex === "number" ? lineIndex : 0;
    resetPuzzle();
    renderAll();
  }

  function setCategory(category) {
    state.category = category;
    els.categoryTabs.querySelectorAll("[data-category]").forEach((tab) => {
      const active = tab.dataset.category === category;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    renderWorkGrid();
  }

  function renderLineCharacters(text) {
    return Array.from(text).map((char) => {
      if (/[\u3400-\u9fff]/.test(char)) {
        return `<button class="poem-char" type="button" data-character="${escapeHtml(char)}" aria-label="练习汉字${escapeHtml(char)}">${escapeHtml(char)}</button>`;
      }
      return `<span class="poem-punctuation" aria-hidden="true">${escapeHtml(char)}</span>`;
    }).join("");
  }

  function renderWorkGrid() {
    const filtered = works.filter((work) => state.category === "all" || work.type === state.category);
    els.resultCount.textContent = `${filtered.length} 篇精选`;
    els.workGrid.innerHTML = filtered.map((work) => {
      const completed = getWorkProgress(work);
      const selected = work.id === state.selectedWorkId;
      return `<article class="work-card ${selected ? "is-selected" : ""}" data-work-id="${work.id}">
        <div class="work-card-header"><span class="work-type ${work.type === "prose" ? "work-type--prose" : ""}">${work.typeLabel}</span>${completed === work.lines.length ? '<span class="work-complete" title="已完成">✦</span>' : ""}</div>
        <h3>${escapeHtml(work.title)}</h3><p class="work-card-author">${escapeHtml(work.author)}</p>
        <p class="work-card-quote">${escapeHtml(work.lines[0].text)}<br />${escapeHtml(work.lines[1].text)}</p>
        <div class="work-card-footer"><span>${completed}/${work.lines.length} 句完成</span><button class="work-card-cta" type="button" data-open-work="${work.id}">开始练习 <span aria-hidden="true">→</span></button></div>
      </article>`;
    }).join("");

    els.workGrid.querySelectorAll("[data-open-work]").forEach((button) => button.addEventListener("click", () => {
      setWork(button.dataset.openWork, 0);
      document.getElementById("practice").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    els.workGrid.querySelectorAll("[data-work-id]").forEach((card) => card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      setWork(card.dataset.workId, 0);
      document.getElementById("practice").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  function renderPoemCard() {
    const work = getWork();
    els.poemCard.innerHTML = `<div class="poem-card-top">
      <div><p class="poem-meta-label">${work.typeLabel} · ${work.lines.length} 句</p><h3 id="poem-title">${escapeHtml(work.title)}</h3><p class="poem-author">${escapeHtml(work.author)}</p><p class="poem-intro">${escapeHtml(work.intro)}</p></div>
      <button class="read-button" type="button" id="read-work-button" aria-label="朗读${escapeHtml(work.title)}"><span aria-hidden="true">◖</span> 听一听</button>
    </div>
    <div class="poem-lines">${work.lines.map((line, index) => `<div class="poem-line ${index === state.lineIndex ? "is-active" : ""}" data-line-index="${index}">
      <span class="line-number">${String(index + 1).padStart(2, "0")}</span>
      <div class="poem-line-text">${renderLineCharacters(line.text)}</div>
      <p class="poem-line-note">${escapeHtml(line.note)}</p>
    </div>`).join("")}</div>
    <p class="poem-helper"><span aria-hidden="true">✎</span><span>点一点诗句里的字，打开书写小课堂。<strong>孩子可以自己探索哦</strong></span></p>`;

    els.poemCard.querySelectorAll(".poem-char").forEach((button) => button.addEventListener("click", () => openCharacterModal(button.dataset.character)));
    els.poemCard.querySelectorAll(".poem-line").forEach((line) => line.addEventListener("click", (event) => {
      if (event.target.closest(".poem-char")) return;
      state.lineIndex = Number(line.dataset.lineIndex);
      resetPuzzle();
      renderPoemCard();
      renderExerciseCard();
    }));
    const readButton = document.getElementById("read-work-button");
    if (readButton) readButton.addEventListener("click", () => speak(`${work.title}。${work.lines.map((line) => line.text).join("，")}`));
  }

  function renderExerciseCard() {
    const work = getWork();
    const line = getLine();
    const characters = getCharacters(line.text);
    const complete = isLineComplete(work, state.lineIndex);
    const placedString = state.placed.map((token) => token.char).join("");
    const answered = state.placed.length === characters.length;
    const correct = answered && placedString === characters.join("");
    let message = "按诗句顺序点击字块，组成完整的一句。";
    let messageClass = "";
    if (complete || correct) { message = "太棒了！这句内容已经回到正确的位置。"; messageClass = "is-success"; }
    else if (answered) { message = "顺序还差一点，点一下上面的字可以退回重排。"; messageClass = "is-wrong"; }

    els.exerciseCard.innerHTML = `<div class="exercise-top"><div><p class="exercise-kicker">小小挑战 · 第 ${state.lineIndex + 1} 句</p><h3 id="exercise-title">把诗句排回去</h3></div><span class="exercise-count">${getWorkProgress(work)}/${work.lines.length} 已完成</span></div>
      <p class="exercise-instruction">${complete ? "想再试一次也可以，或继续下一句。" : "读一读左边的诗句，再从下面的字块开始。"}</p>
      <div class="line-picker" aria-label="选择练习句子">${work.lines.map((item, index) => `<button type="button" class="${index === state.lineIndex ? "is-active" : ""} ${isLineComplete(work, index) ? "is-complete" : ""}" data-line-picker="${index}" aria-label="第 ${index + 1} 句${isLineComplete(work, index) ? "，已完成" : ""}">${index + 1}</button>`).join("")}</div>
      <div class="answer-slots" aria-label="已排列的字，点击字可以退回">${characters.map((char, index) => { const token = state.placed[index]; const label = token ? `aria-label="移除${escapeHtml(token.char)}"` : `aria-label="第 ${index + 1} 个字，空"`; return `<button type="button" class="answer-slot ${token ? "is-filled" : ""}" data-remove-index="${index}" ${label} ${token ? "" : "disabled"}>${token ? escapeHtml(token.char) : ""}</button>`; }).join("")}</div>
      <p class="scramble-label">字块在这里，找到下一个字：</p>
      <div class="scramble-bank" aria-label="打乱的字块">${state.tokens.map((token) => `<button class="scramble-chip" type="button" data-token-id="${escapeHtml(token.id)}" ${state.placed.some((placedToken) => placedToken.id === token.id) ? "disabled" : ""}>${escapeHtml(token.char)}</button>`).join("")}</div>
      <div class="exercise-message ${messageClass}" role="status">${message}</div>
      <div class="exercise-actions"><button class="button button--outline" type="button" id="reset-puzzle-button">重新打乱</button>${state.lineIndex < work.lines.length - 1 ? `<button class="button button--primary next-line-button" type="button" id="next-line-button">${complete || correct ? "下一句" : "跳过这句"} <span aria-hidden="true">→</span></button>` : `<button class="button button--primary next-line-button" type="button" id="finish-work-button">换一篇 <span aria-hidden="true">→</span></button>`}</div>`;

    els.exerciseCard.querySelectorAll("[data-line-picker]").forEach((button) => button.addEventListener("click", () => {
      state.lineIndex = Number(button.dataset.linePicker);
      resetPuzzle();
      renderPoemCard();
      renderExerciseCard();
    }));
    els.exerciseCard.querySelectorAll("[data-token-id]").forEach((button) => button.addEventListener("click", () => {
      const token = state.tokens.find((item) => item.id === button.dataset.tokenId);
      if (!token || state.placed.length >= characters.length) return;
      state.placed.push(token);
      renderExerciseCard();
      checkPuzzleResult();
    }));
    els.exerciseCard.querySelectorAll("[data-remove-index]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.removeIndex);
      if (!state.placed[index]) return;
      state.placed.splice(index, 1);
      renderExerciseCard();
    }));
    const resetButton = document.getElementById("reset-puzzle-button");
    if (resetButton) resetButton.addEventListener("click", () => { resetPuzzle(); renderExerciseCard(); });
    const nextLineButton = document.getElementById("next-line-button");
    if (nextLineButton) nextLineButton.addEventListener("click", () => {
      state.lineIndex = Math.min(work.lines.length - 1, state.lineIndex + 1);
      resetPuzzle();
      renderPoemCard();
      renderExerciseCard();
    });
    const finishButton = document.getElementById("finish-work-button");
    if (finishButton) finishButton.addEventListener("click", chooseNextWork);
  }

  function checkPuzzleResult() {
    const work = getWork();
    const characters = getCharacters(getLine().text);
    if (state.placed.length !== characters.length) return;
    const correct = state.placed.map((token) => token.char).join("") === characters.join("");
    if (!correct) { renderExerciseCard(); return; }
    if (!state.progress[work.id]) state.progress[work.id] = { lines: [], chars: [] };
    if (!Array.isArray(state.progress[work.id].lines)) state.progress[work.id].lines = [];
    state.progress[work.id].lines[state.lineIndex] = true;
    saveProgress();
    renderWorkGrid();
    renderExerciseCard();
    updateTopProgress();
    celebrate();
    showToast("做得好！这一句已经记住啦 ✦");
  }

  function chooseNextWork() {
    const index = works.findIndex((work) => work.id === state.selectedWorkId);
    const next = works[(index + 1) % works.length];
    setWork(next.id, 0);
    showToast(`下一站：${next.title}`);
  }

  function updateTopProgress() {
    const completed = totalCompletedLines();
    const total = totalLines();
    els.topProgressCount.textContent = String(completed);
    els.topProgressBar.style.width = `${total ? (completed / total) * 100 : 0}%`;
  }

  function renderAll() {
    renderWorkGrid();
    renderPoemCard();
    renderExerciseCard();
    updateTopProgress();
  }

  function speak(text) {
    if (!window.speechSynthesis) { showToast("这台设备暂时不能朗读，但可以跟着文字读一遍哦"); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.78;
    window.speechSynthesis.speak(utterance);
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    state.toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
  }

  function celebrate() {
    els.celebration.classList.remove("is-active");
    void els.celebration.offsetWidth;
    els.celebration.classList.add("is-active");
    window.setTimeout(() => els.celebration.classList.remove("is-active"), 950);
  }

  function openCharacterModal(character) {
    state.activeCharacter = character;
    state.writerQuizStarted = false;
    state.modalPreviouslyFocused = document.activeElement;
    els.modalCharacter.textContent = character;
    const info = characterInfo[character] || ["汉字", "这是诗句里的一个重要字"];
    els.modalPinyin.textContent = info[0];
    els.modalMeaning.textContent = info[1];
    els.fallbackCharacter.textContent = character;
    els.writerTarget.innerHTML = "";
    els.writerFallback.classList.add("is-hidden");
    els.writerStatus.textContent = "点击“演示笔顺”，再开始描写。";
    els.practiceButton.textContent = "✎ 开始书写";
    els.modal.classList.remove("is-hidden");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => els.modalClose.focus(), 0);
    initWriter(character);
  }

  function initWriter(character) {
    state.writer = null;
    if (!window.HanziWriter) {
      els.writerFallback.classList.remove("is-hidden");
      els.writerStatus.textContent = "笔顺动画正在准备，先观察字的结构，再试着写一遍。";
      return;
    }
    try {
      state.writer = window.HanziWriter.create(els.writerTarget, character, {
        width: 260,
        height: 260,
        padding: 12,
        showCharacter: true,
        showOutline: true,
        strokeAnimationSpeed: 1.05,
        delayBetweenStrokes: 280,
        highlightOnComplete: true,
        characterColor: "#24332f",
        outlineColor: "#d9ded6",
        mainColor: "#24332f",
        highlightColor: "#e7ac56",
        drawingColor: "#e9826f",
        drawingWidth: 5
      });
      state.writer.animateCharacter();
    } catch (error) {
      els.writerFallback.classList.remove("is-hidden");
      els.writerStatus.textContent = "动画暂时没准备好，依然可以观察结构后完成练习。";
    }
  }

  function startWriterQuiz() {
    if (!state.writer || typeof state.writer.quiz !== "function") {
      els.writerStatus.textContent = "请在田字格中认真写一遍，再点击“我写好了”。";
      state.writerQuizStarted = true;
      return;
    }
    if (state.writerQuizStarted) return;
    state.writerQuizStarted = true;
    els.writerStatus.textContent = "跟着淡淡的笔顺提示，一笔一画来。";
    state.writer.quiz({
      leniency: 1.18,
      showHintAfterMisses: 2,
      highlightOnComplete: true,
      onMistake: () => { els.writerStatus.textContent = "这一笔再观察一下方向，慢慢来。"; },
      onCorrectStroke: (strokeData) => { els.writerStatus.textContent = `第 ${strokeData.strokeNum + 1} 笔完成，继续加油！`; },
      onComplete: () => { els.writerStatus.textContent = "太棒了，笔顺完成！可以继续探索下一字。"; showToast("汉字写得真认真 ✦"); }
    });
  }

  function closeCharacterModal() {
    els.modal.classList.add("is-hidden");
    document.body.style.overflow = "";
    if (state.modalPreviouslyFocused && typeof state.modalPreviouslyFocused.focus === "function") state.modalPreviouslyFocused.focus();
  }

  function randomWork() {
    const candidates = works.filter((work) => work.id !== state.selectedWorkId);
    const work = candidates[Math.floor(Math.random() * candidates.length)] || works[0];
    const lineIndex = Math.floor(Math.random() * work.lines.length);
    setWork(work.id, lineIndex);
    document.getElementById("practice").scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`今天读：${work.title}`);
  }

  els.categoryTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-category]");
    if (tab) setCategory(tab.dataset.category);
  });
  els.startButton.addEventListener("click", () => document.getElementById("practice").scrollIntoView({ behavior: "smooth", block: "start" }));
  els.randomButton.addEventListener("click", randomWork);
  els.modalClose.addEventListener("click", closeCharacterModal);
  els.modalDone.addEventListener("click", closeCharacterModal);
  els.animateButton.addEventListener("click", () => {
    if (state.writer && typeof state.writer.animateCharacter === "function") {
      state.writer.animateCharacter();
      els.writerStatus.textContent = "看清楚了吗？现在轮到你来写。";
    } else {
      els.writerStatus.textContent = "请按汉字的结构，从上到下、从左到右观察。";
    }
  });
  els.practiceButton.addEventListener("click", startWriterQuiz);
  els.modal.addEventListener("click", (event) => { if (event.target === els.modal) closeCharacterModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !els.modal.classList.contains("is-hidden")) closeCharacterModal(); });

  resetPuzzle();
  renderAll();
})();
