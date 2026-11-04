// Both learning and dictation load stroke JSON from this site's own static assets.
// No runtime request to jsDelivr is needed.
(function () {
  "use strict";
  const requests = new Map();

  function fetchCharacter(character) {
    if (!requests.has(character)) {
      const url = new URL("vendor/hanzi-data/" + encodeURIComponent(character) + ".json", document.baseURI);
      const request = fetch(url.href, { cache: "force-cache" }).then(async (response) => {
        if (!response.ok) throw new Error("笔画数据 HTTP " + response.status + ": " + character);
        const data = await response.json();
        if (!Array.isArray(data.strokes) || !Array.isArray(data.medians)) {
          throw new Error("笔画数据格式不正确: " + character);
        }
        return data;
      });
      requests.set(character, request);
      request.catch(() => requests.delete(character));
    }
    return requests.get(character);
  }

  window.XuebabangbangStrokeData = {
    charDataLoader(character, onComplete, onError) {
      fetchCharacter(character).then(onComplete, (error) => {
        console.error("无法加载本地笔画数据", character, error);
        if (typeof onError === "function") onError(error);
      });
    }
  };
})();
