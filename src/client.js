(() => {
  const form = document.querySelector("form");
  const input = form.q;
  const ans = document.getElementById("ans");
  const hint = document.getElementById("hint");
  const KEY = "hail:history";
  let history = [];
  try { history = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
  let pos = -1;

  const remember = (q) => {
    history = [q, ...history.filter((h) => h !== q)].slice(0, 10);
    try { localStorage.setItem(KEY, JSON.stringify(history)); } catch {}
  };
  if (input.value) remember(input.value);

  form.addEventListener("submit", async (e) => {
    const q = input.value.trim();
    e.preventDefault();
    if (!q) return;
    form.classList.add("busy");
    try {
      const res = await fetch("/?partial=1&q=" + encodeURIComponent(q));
      const data = await res.json();
      ans.innerHTML = data.ans;
      hint.innerHTML = data.hint;
      hint.className = data.compact ? "hint compact" : "hint";
      window.history.replaceState(null, "", "/?q=" + encodeURIComponent(q));
      remember(q);
    } catch {
      location.href = "/?q=" + encodeURIComponent(q);
    } finally {
      form.classList.remove("busy");
      pos = -1;
    }
  });

  input.addEventListener("keydown", (e) => {
    if ((e.key !== "ArrowUp" && e.key !== "ArrowDown") || !history.length) return;
    e.preventDefault();
    pos = e.key === "ArrowUp" ? Math.min(pos + 1, history.length - 1) : Math.max(pos - 1, -1);
    input.value = pos < 0 ? "" : history[pos];
  });
})();
