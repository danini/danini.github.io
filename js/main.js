/* Daniel Barath — personal site. Vanilla JS, no dependencies. */
(function () {
  "use strict";

  var ME = "Daniel Barath"; // name to emphasize in author lists

  // ---- Theme toggle ----
  var toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  // ---- Footer year ----
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- Small helpers ----
  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + " → HTTP " + r.status);
      return r.json();
    });
  }

  // ---- News ----
  var NEWS_LIMIT = 10;

  function makeNewsItem(item) {
    var li = el("li");
    li.appendChild(el("span", "news-date", formatDate(item.date)));
    var body = el("span", "news-text", item.text);
    if (item.link) {
      var a = el("a", "news-link", "LINK");
      a.href = item.link;
      a.target = "_blank";
      a.rel = "noopener";
      body.appendChild(document.createTextNode(" "));
      body.appendChild(a);
    }
    li.appendChild(body);
    return li;
  }

  function renderNews(items) {
    var list = document.getElementById("news-list");
    var oldBtn = document.getElementById("news-toggle");
    if (oldBtn) oldBtn.parentNode.removeChild(oldBtn);
    list.innerHTML = "";
    if (!items || !items.length) {
      list.appendChild(el("li", "empty", "No news yet."));
      return;
    }
    var sorted = items.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

    var expanded = false;
    var hidden = sorted.length - NEWS_LIMIT;
    function draw() {
      list.innerHTML = "";
      var count = expanded ? sorted.length : Math.min(NEWS_LIMIT, sorted.length);
      var frag = document.createDocumentFragment();
      for (var i = 0; i < count; i++) frag.appendChild(makeNewsItem(sorted[i]));
      list.appendChild(frag);
    }
    draw();

    if (hidden > 0) {
      var btn = el("button", "news-toggle", "Show more (" + hidden + ")");
      btn.id = "news-toggle";
      btn.type = "button";
      btn.addEventListener("click", function () {
        expanded = !expanded;
        draw();
        btn.textContent = expanded ? "Show less" : "Show more (" + hidden + ")";
      });
      list.insertAdjacentElement("afterend", btn);
    }
  }

  function formatDate(d) {
    // expects "YYYY-MM" or "YYYY-MM-DD"; falls back to raw string
    if (!d) return "";
    var parts = String(d).split("-");
    var months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (parts.length >= 2 && months[+parts[1]]) {
      return months[+parts[1]] + " " + parts[0];
    }
    return d;
  }

  // ---- Publications ----
  var allPapers = [];
  var activeYear = "all";
  var searchTerm = "";

  // lazy-loading state
  var PAGE = 12;
  var filtered = [];
  var renderedCount = 0;
  var sentinel = null, moreLabel = null, pubObserver = null;

  function renderAuthors(authors) {
    var span = el("span", "pub-authors");
    (authors || []).forEach(function (name, i) {
      if (i > 0) span.appendChild(document.createTextNode(", "));
      if (name === ME) {
        span.appendChild(el("span", "me", name));
      } else {
        span.appendChild(document.createTextNode(name));
      }
    });
    return span;
  }

  var CHIP_LABELS = { pdf: "PDF", arxiv: "arXiv", code: "Code", project: "Project" };

  function renderLinks(links) {
    var wrap = el("div", "pub-links");
    if (!links) return wrap;
    Object.keys(CHIP_LABELS).forEach(function (key) {
      var url = links[key];
      if (url) {
        var a = el("a", "chip", CHIP_LABELS[key]);
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        wrap.appendChild(a);
      }
    });
    return wrap;
  }

  // ---- BibTeX ----
  var VENUE_FULL = {
    CVPR: "IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)",
    ICCV: "IEEE/CVF International Conference on Computer Vision (ICCV)",
    ECCV: "European Conference on Computer Vision (ECCV)",
    WACV: "IEEE/CVF Winter Conference on Applications of Computer Vision (WACV)",
    BMVC: "British Machine Vision Conference (BMVC)",
    ICRA: "IEEE International Conference on Robotics and Automation (ICRA)",
    "3DV": "International Conference on 3D Vision (3DV)",
    ICPR: "International Conference on Pattern Recognition (ICPR)",
    NeurIPS: "Advances in Neural Information Processing Systems (NeurIPS)",
    ICLR: "International Conference on Learning Representations (ICLR)",
    ICML: "International Conference on Machine Learning (ICML)",
    VISAPP: "International Conference on Computer Vision Theory and Applications (VISAPP)",
    TPAMI: "IEEE Transactions on Pattern Analysis and Machine Intelligence",
    IJCV: "International Journal of Computer Vision",
    TIP: "IEEE Transactions on Image Processing",
    CVIU: "Computer Vision and Image Understanding",
    "Pattern Recognition Letters": "Pattern Recognition Letters"
  };
  var JOURNALS = { TPAMI: 1, IJCV: 1, TIP: 1, CVIU: 1, "Pattern Recognition Letters": 1 };

  function asciiLower(s) {
    s = s || "";
    if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return s.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function bibKey(p) {
    var first = (p.authors && p.authors[0]) || "anon";
    var last = first.trim().split(/\s+/).pop();
    var word = (p.title.match(/[A-Za-z0-9]+/) || ["paper"])[0];
    return asciiLower(last) + (p.year || "") + asciiLower(word);
  }

  function bibtexFor(p) {
    var isJournal = !!JOURNALS[p.venue];
    var type = isJournal ? "article" : "inproceedings";
    var venue = VENUE_FULL[p.venue] || p.venue || "";
    var fieldName = isJournal ? "journal" : "booktitle";
    var lines = [
      "@" + type + "{" + bibKey(p) + ",",
      "  author = {" + (p.authors || []).join(" and ") + "},",
      "  title = {" + p.title + "},",
      "  " + fieldName + " = {" + venue + "},",
      "  year = {" + (p.year || "") + "}",
      "}"
    ];
    return lines.join("\n");
  }

  function copyText(text, btn) {
    var original = btn.getAttribute("data-label") || btn.textContent;
    function done() {
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove("copied");
      }, 1500);
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); done(); });
    } else {
      fallback();
      done();
    }
  }

  function makeBibButton(p) {
    var btn = el("button", "chip chip-bib", "BibTeX");
    btn.type = "button";
    btn.setAttribute("data-label", "BibTeX");
    btn.title = "Copy BibTeX to clipboard";
    btn.addEventListener("click", function () { copyText(bibtexFor(p), btn); });
    return btn;
  }

  function paperMatches(p) {
    if (activeYear !== "all" && String(p.year) !== String(activeYear)) return false;
    if (searchTerm) {
      var hay = (p.title + " " + (p.authors || []).join(" ") + " " + (p.venue || "")).toLowerCase();
      if (hay.indexOf(searchTerm) === -1) return false;
    }
    return true;
  }

  function makePubItem(p) {
    var li = el("li", "pub-item");

    var badge = el("div", "pub-badge");
    badge.appendChild(el("span", "pub-venue", p.venue || ""));
    badge.appendChild(el("span", "pub-year", p.year != null ? String(p.year) : ""));
    li.appendChild(badge);

    var body = el("div", "pub-body");
    var titleRow = el("h3", "pub-title");
    titleRow.appendChild(document.createTextNode(p.title));
    if (p.note) {
      titleRow.appendChild(document.createTextNode(" "));
      titleRow.appendChild(el("span", "pub-note", p.note));
    }
    body.appendChild(titleRow);
    body.appendChild(renderAuthors(p.authors));
    var linksWrap = renderLinks(p.links);
    linksWrap.appendChild(makeBibButton(p));
    body.appendChild(linksWrap);
    li.appendChild(body);
    return li;
  }

  function updateMoreLabel() {
    if (!moreLabel) return;
    if (renderedCount < filtered.length) {
      moreLabel.textContent = "Showing " + renderedCount + " of " + filtered.length;
      moreLabel.style.display = "";
    } else {
      moreLabel.style.display = "none";
    }
  }

  function appendBatch() {
    var list = document.getElementById("pub-list");
    var end = Math.min(renderedCount + PAGE, filtered.length);
    var frag = document.createDocumentFragment();
    for (var i = renderedCount; i < end; i++) frag.appendChild(makePubItem(filtered[i]));
    list.appendChild(frag);
    renderedCount = end;
    updateMoreLabel();
  }

  // keep appending while the sentinel sits within (or just below) the viewport
  function fill() {
    if (!sentinel) { while (renderedCount < filtered.length) appendBatch(); return; }
    var guard = 0;
    while (renderedCount < filtered.length && guard++ < 500) {
      if (sentinel.getBoundingClientRect().top > window.innerHeight + 300) break;
      appendBatch();
    }
  }

  function setupLazyLoad() {
    var list = document.getElementById("pub-list");
    sentinel = el("div", "pub-sentinel");
    moreLabel = el("div", "pub-more");
    moreLabel.style.display = "none";
    list.insertAdjacentElement("afterend", sentinel);
    sentinel.insertAdjacentElement("afterend", moreLabel);
    if ("IntersectionObserver" in window) {
      pubObserver = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) fill();
      }, { rootMargin: "300px 0px" });
      pubObserver.observe(sentinel);
    }
  }

  function renderPapers() {
    var list = document.getElementById("pub-list");
    list.innerHTML = "";
    renderedCount = 0;
    filtered = allPapers.filter(paperMatches);
    if (!filtered.length) {
      list.appendChild(el("li", "empty", "No publications match your filter."));
      updateMoreLabel();
      return;
    }
    appendBatch();
    fill();
  }

  function buildYearFilters() {
    var container = document.getElementById("year-filters");
    container.innerHTML = "";
    var years = Array.from(new Set(allPapers.map(function (p) { return p.year; })))
      .filter(function (y) { return y != null; })
      .sort(function (a, b) { return b - a; });

    function makeBtn(label, value) {
      var b = el("button", "year-btn" + (value === activeYear ? " active" : ""), label);
      b.type = "button";
      b.addEventListener("click", function () {
        activeYear = value;
        Array.prototype.forEach.call(container.children, function (c) { c.classList.remove("active"); });
        b.classList.add("active");
        renderPapers();
      });
      return b;
    }

    container.appendChild(makeBtn("All", "all"));
    years.forEach(function (y) { container.appendChild(makeBtn(String(y), y)); });
  }

  var searchInput = document.getElementById("pub-search");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      searchTerm = searchInput.value.trim().toLowerCase();
      renderPapers();
    });
  }

  // ---- Load data ----
  fetchJSON("data/news.json")
    .then(renderNews)
    .catch(function (err) {
      var list = document.getElementById("news-list");
      list.innerHTML = "";
      list.appendChild(el("li", "error", "Could not load news: " + err.message));
    });

  fetchJSON("data/papers.json")
    .then(function (papers) {
      allPapers = (papers || []).slice().sort(function (a, b) {
        return (b.year || 0) - (a.year || 0) || (b.month || 0) - (a.month || 0);
      });
      buildYearFilters();
      setupLazyLoad();
      renderPapers();
    })
    .catch(function (err) {
      var list = document.getElementById("pub-list");
      list.innerHTML = "";
      list.appendChild(el("li", "error", "Could not load publications: " + err.message));
    });
})();
