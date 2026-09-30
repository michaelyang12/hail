(() => {
  const HISTORY_KEY = "hail:history";
  const HISTORY_MAX = 10;
  const RECENT_SHOWN = 4;
  const RESIZE_MS = 180;
  const FADE_MS = 150;

  const form = document.querySelector("form");
  const input = form.q;
  const ans = document.getElementById("ans");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let history = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch {}
  let pos = -1;

  const hrefFor = (q) => "/?q=" + encodeURIComponent(q);

  const remember = (q) => {
    history = [q, ...history.filter((h) => h !== q)].slice(0, HISTORY_MAX);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  };

  // Once there's an answer, the examples give way to the rider's own recent queries.
  // The server's example link is the template, so the markup lives in one place.
  const showRecent = () => {
    const hint = document.getElementById("hint");
    const ex = hint.querySelector(".ex");
    const recent = history.filter((h) => h !== input.value.trim()).slice(0, RECENT_SHOWN);
    if (!ex || !hint.classList.contains("compact") || !recent.length) return;
    const lbl = ex.querySelector(".lbl");
    const proto = ex.querySelector("a");
    lbl.textContent = "recent";
    ex.replaceChildren(lbl, ...recent.map((q) => {
      const a = proto.cloneNode(false);
      a.href = hrefFor(q);
      a.textContent = q;
      return a;
    }));
  };

  if (input.value) remember(input.value.trim());
  showRecent();

  // Animates the card from its old height to its new one so answers don't jump in.
  const swap = (update) => {
    const from = form.offsetHeight;
    update();
    if (reduce.matches) return;
    const to = form.offsetHeight;
    if (from !== to) {
      form.style.overflow = "hidden";
      form.animate([{ height: from + "px" }, { height: to + "px" }], { duration: RESIZE_MS, easing: "cubic-bezier(.2,.8,.2,1)" })
        .finished.finally(() => { form.style.overflow = ""; });
    }
    ans.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: FADE_MS });
  };

  form.addEventListener("submit", async (e) => {
    const q = input.value.trim();
    e.preventDefault();
    if (!q) return;
    form.classList.add("busy");
    try {
      const res = await fetch("/?partial=1&q=" + encodeURIComponent(q));
      const data = await res.json();
      remember(q);
      swap(() => {
        form.classList.remove("busy");
        ans.innerHTML = data.ans;
        document.getElementById("hint").outerHTML = data.hint;
        showRecent();
      });
      window.history.replaceState(null, "", hrefFor(q));
    } catch {
      location.href = hrefFor(q);
    } finally {
      form.classList.remove("busy");
      pos = -1;
    }
  });

  // Example, recent, and "also" links are plain GETs; upgrade them to the partial fetch.
  form.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='/?q=']");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    input.value = new URL(a.href).searchParams.get("q") || "";
    form.requestSubmit();
  });

  input.addEventListener("keydown", (e) => {
    if ((e.key !== "ArrowUp" && e.key !== "ArrowDown") || !history.length) return;
    e.preventDefault();
    pos = e.key === "ArrowUp" ? Math.min(pos + 1, history.length - 1) : Math.max(pos - 1, -1);
    input.value = pos < 0 ? "" : history[pos];
  });
})();
