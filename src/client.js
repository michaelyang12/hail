(() => {
  const form = document.querySelector("form");
  const input = form.q;
  const ans = document.getElementById("ans");
  const hint = document.getElementById("hint");
  const KEY = "hail:history";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let history = [];
  try { history = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
  let pos = -1;

  const remember = (q) => {
    history = [q, ...history.filter((h) => h !== q)].slice(0, 10);
    try { localStorage.setItem(KEY, JSON.stringify(history)); } catch {}
  };

  // Once there's an answer, the examples give way to the rider's own recent queries.
  // Built with textContent because history is user input.
  const showRecent = () => {
    const ex = hint.querySelector(".ex");
    const recent = history.filter((h) => h !== input.value.trim()).slice(0, 4);
    if (!ex || !hint.classList.contains("compact") || !recent.length) return;
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = "recent";
    ex.replaceChildren(lbl, ...recent.map((q) => {
      const a = document.createElement("a");
      a.href = "/?q=" + encodeURIComponent(q);
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
      form.animate([{ height: from + "px" }, { height: to + "px" }], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" })
        .finished.finally(() => { form.style.overflow = ""; });
    }
    ans.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 150 });
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
        hint.innerHTML = data.hint;
        hint.className = data.compact ? "hint compact" : "hint";
        showRecent();
      });
      window.history.replaceState(null, "", "/?q=" + encodeURIComponent(q));
    } catch {
      location.href = "/?q=" + encodeURIComponent(q);
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
