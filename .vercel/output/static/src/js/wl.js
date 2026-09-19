(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * configuration
   * Replace officialX / announcementX with the live project URLs.
   * ------------------------------------------------------------------ */
  var WL_CONFIG = {
    officialX: "https://x.com/Zcash",
    announcementX: "https://x.com/Zcash",
    homeUrl: "/",
    requiredScore: 2500,
    pointsPerFood: 100,
    gridSize: 16,
    storageKey: "zec_wl_progress",
  };

  var TASK_URLS = {
    follow: WL_CONFIG.officialX,
    repost: WL_CONFIG.announcementX,
    friends: WL_CONFIG.announcementX,
  };

  var SCREENS = ["identity", "quests", "game", "result"];

  var DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  var OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

  /* ------------------------------------------------------------------
   * state
   * ------------------------------------------------------------------ */
  var state = {
    screen: "identity",
    username: "",
    tasks: {
      follow: false,
      repost: false,
      friends: false,
    },
    pending: {
      follow: false,
      repost: false,
      friends: false,
    },
    game: {
      score: 0,
      passed: false,
      bestScore: 0,
    },
    accessId: "",
    qualified: false,
  };

  /* ------------------------------------------------------------------
   * DOM helpers
   * ------------------------------------------------------------------ */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function announce(msg) {
    var live = $("#status-live");
    if (live) live.textContent = msg;
  }

  function padScore(n) {
    var s = String(Math.max(0, n | 0));
    while (s.length < 4) s = "0" + s;
    return s;
  }

  /* ------------------------------------------------------------------
   * persistence
   * ------------------------------------------------------------------ */
  function persist() {
    try {
      var payload = {
        v: 1,
        screen: state.screen,
        username: state.username,
        tasks: state.tasks,
        pending: state.pending,
        game: state.game,
        accessId: state.accessId,
        qualified: state.qualified,
      };
      localStorage.setItem(WL_CONFIG.storageKey, JSON.stringify(payload));
    } catch (err) {
      /* private mode / blocked storage */
    }
  }

  function restore() {
    try {
      var raw = localStorage.getItem(WL_CONFIG.storageKey);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data || data.v !== 1) return;
      if (typeof data.username === "string") state.username = data.username;
      if (data.tasks) {
        state.tasks.follow = !!data.tasks.follow;
        state.tasks.repost = !!data.tasks.repost;
        state.tasks.friends = !!data.tasks.friends;
      }
      if (data.pending) {
        state.pending.follow = !!data.pending.follow;
        state.pending.repost = !!data.pending.repost;
        state.pending.friends = !!data.pending.friends;
      }
      if (data.game) {
        state.game.passed = !!data.game.passed;
        state.game.bestScore = data.game.bestScore | 0;
        state.game.score = state.game.passed ? data.game.score | 0 : 0;
      }
      if (typeof data.accessId === "string") state.accessId = data.accessId;
      state.qualified = !!data.qualified;
      if (state.qualified && state.username) {
        state.screen = "result";
      } else if (state.username && allTasksComplete()) {
        state.screen = "game";
      } else if (state.username) {
        state.screen = "quests";
      } else {
        state.screen = "identity";
      }
    } catch (err) {
      /* ignore corrupt storage */
    }
  }

  /* ------------------------------------------------------------------
   * username validation
   * ------------------------------------------------------------------ */
  function normalizeUsername(raw) {
    var value = String(raw || "").trim();
    if (value.charAt(0) === "@") value = value.slice(1);
    value = value.replace(/\s+/g, "");
    return value;
  }

  function isValidUsername(handle) {
    return /^[A-Za-z0-9_]{1,15}$/.test(handle);
  }

  /* ------------------------------------------------------------------
   * screen navigation
   * ------------------------------------------------------------------ */
  function showScreen(name) {
    state.screen = name;
    $all("[data-screen]").forEach(function (el) {
      var on = el.getAttribute("data-screen") === name;
      el.hidden = !on;
      if (on) el.classList.add("is-active");
      else el.classList.remove("is-active");
    });
    updateProgress();
    updateOperator();
    persist();
    if (name === "game") {
      game.resize();
      if (state.game.passed) {
        game.showPassed();
      }
    }
    if (name === "result") renderResult();
  }

  function updateProgress() {
    var order = { identity: 0, quests: 1, game: 2, result: 2 };
    var current = order[state.screen] || 0;
    $all("[data-progress]").forEach(function (el) {
      var key = el.getAttribute("data-progress");
      var idx = order[key];
      var indexEl = $("[data-progress-index]", el);
      var stateEl = $("[data-progress-state]", el);
      el.classList.remove("is-current", "is-done", "is-locked");
      if (idx < current || (key === "game" && state.game.passed)) {
        el.classList.add("is-done");
        if (indexEl) indexEl.textContent = "✓";
        if (stateEl) stateEl.textContent = "COMPLETE";
      } else if (idx === current) {
        el.classList.add("is-current");
        if (indexEl) indexEl.textContent = key === "identity" ? "01" : key === "quests" ? "02" : "03";
        if (stateEl) stateEl.textContent = "CURRENT";
      } else {
        el.classList.add("is-locked");
        if (indexEl) indexEl.textContent = key === "identity" ? "01" : key === "quests" ? "02" : "03";
        if (stateEl) stateEl.textContent = "LOCKED";
      }
    });
  }

  function updateOperator() {
    var label = state.username || "—";
    $all("[data-operator]").forEach(function (el) {
      el.textContent = label;
    });
    var access = state.qualified ? "QUALIFIED" : "RESTRICTED";
    $all("[data-access-flag]").forEach(function (el) {
      el.textContent = "ACCESS: " + access;
    });
    $all("[data-foot-access]").forEach(function (el) {
      el.textContent = access;
    });
  }

  /* ------------------------------------------------------------------
   * task logic
   * Keep verification isolated so a real API can replace confirmTask().
   * ------------------------------------------------------------------ */
  function allTasksComplete() {
    return !!(state.tasks.follow && state.tasks.repost && state.tasks.friends);
  }

  function taskStateFor(key) {
    if (state.tasks[key]) return "complete";
    if (state.pending[key]) return "pending";
    return "idle";
  }

  function renderTasks() {
    $all("[data-task]").forEach(function (card) {
      var key = card.getAttribute("data-task");
      var status = taskStateFor(key);
      card.setAttribute("data-task-state", status);
      var statusEl = $("[data-task-status]", card);
      var openBtn = $("[data-task-open]", card);
      var confirmBtn = $("[data-task-confirm]", card);
      if (status === "complete") {
        if (statusEl) statusEl.textContent = "STATUS: ✓ COMPLETE";
        if (openBtn) {
          openBtn.hidden = true;
          openBtn.disabled = true;
        }
        if (confirmBtn) confirmBtn.hidden = true;
      } else if (status === "pending") {
        if (statusEl) statusEl.textContent = "STATUS: PENDING";
        if (openBtn) {
          openBtn.hidden = false;
          openBtn.disabled = false;
          openBtn.textContent = key === "follow" ? "OPEN X AGAIN" : "OPEN X AGAIN";
        }
        if (confirmBtn) confirmBtn.hidden = false;
      } else {
        if (statusEl) statusEl.textContent = "STATUS: REQUIRED";
        if (openBtn) {
          openBtn.hidden = false;
          openBtn.disabled = false;
        }
        if (confirmBtn) confirmBtn.hidden = true;
      }
    });

    var ready = allTasksComplete();
    var cont = $('[data-testid="quests-continue"]');
    var readyMsg = $("[data-quests-ready]");
    if (cont) {
      cont.disabled = !ready;
      cont.textContent = ready ? "CONTINUE TO ACCESS TEST" : "CONTINUE";
    }
    if (readyMsg) readyMsg.hidden = !ready;
  }

  function openTask(key) {
    var url = TASK_URLS[key];
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    if (!state.tasks[key]) {
      state.pending[key] = true;
      persist();
      renderTasks();
      announce("Task opened. Return and mark complete.");
    }
  }

  function confirmTask(key) {
    /* Isolated verification seam. Currently self-reported for the prototype. */
    if (!state.pending[key] && !state.tasks[key]) return;
    state.tasks[key] = true;
    state.pending[key] = false;
    persist();
    renderTasks();
    announce(key + " marked complete.");
    if (allTasksComplete()) {
      announce("All quests complete. Access test unlocked.");
    }
  }

  /* ------------------------------------------------------------------
   * backend integration point
   * ------------------------------------------------------------------ */
  function submitWLQualification(payload) {
    /* TODO: replace with a real API request when the backend exists, e.g.
     *   return fetch("/api/wl/qualify", {
     *     method: "POST",
     *     headers: { "Content-Type": "application/json" },
     *     body: JSON.stringify(payload)
     *   }).then(function (res) { return res.json(); });
     * Do not treat this mock as server-side verification.
     */
    return Promise.resolve({
      ok: true,
      storedLocally: true,
      payload: payload,
    });
  }

  function generateAccessId() {
    function hex() {
      var n = Math.floor(Math.random() * 0xffff);
      var s = n.toString(16).toUpperCase();
      while (s.length < 4) s = "0" + s;
      return s;
    }
    return "ZEC-" + hex() + "-" + hex();
  }

  function qualify() {
    if (!state.game.passed) return;
    if (!state.accessId) state.accessId = generateAccessId();
    state.qualified = true;
    persist();
    var payload = {
      username: state.username,
      tasksCompleted: allTasksComplete(),
      gameScore: state.game.score,
      qualified: true,
      accessId: state.accessId,
    };
    submitWLQualification(payload).then(function () {
      showScreen("result");
      announce("Access granted. Qualification recorded on this terminal.");
    });
  }

  function renderResult() {
    var op = $("[data-result-operator]");
    var sc = $("[data-result-score]");
    var id = $("[data-result-id]");
    if (op) op.textContent = state.username || "—";
    if (sc) sc.textContent = padScore(state.game.score);
    if (id) id.textContent = state.accessId || generateAccessId();
  }

  /* ------------------------------------------------------------------
   * game logic — vanilla canvas snake
   * ------------------------------------------------------------------ */
  var game = (function () {
    var canvas = null;
    var ctx = null;
    var running = false;
    var raf = 0;
    var acc = 0;
    var last = 0;
    var tickMs = 135;
    var snake = [];
    var dir = "right";
    var queued = "";
    var food = { x: 10, y: 8 };
    var particles = [];
    var flash = 0;
    var cssSize = 384;
    var overlay = null;

    function cell() {
      return cssSize / WL_CONFIG.gridSize;
    }

    function resetSnake() {
      snake = [
        { x: 4, y: 8 },
        { x: 3, y: 8 },
        { x: 2, y: 8 },
      ];
      dir = "right";
      queued = "";
      tickMs = 135;
      state.game.score = 0;
      particles = [];
      flash = 0;
      placeFood();
      paintScore();
    }

    function occupied(x, y) {
      for (var i = 0; i < snake.length; i++) {
        if (snake[i].x === x && snake[i].y === y) return true;
      }
      return false;
    }

    function placeFood() {
      var n = WL_CONFIG.gridSize;
      var empty = [];
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n; x++) {
          if (!occupied(x, y)) empty.push({ x: x, y: y });
        }
      }
      if (!empty.length) {
        food = { x: snake[0].x, y: snake[0].y };
        return;
      }
      food = empty[Math.floor(Math.random() * empty.length)];
    }

    function paintScore() {
      var el = $('[data-testid="game-score"]');
      if (el) el.textContent = padScore(state.game.score);
      var accEl = $("[data-game-access]");
      if (accEl) accEl.textContent = state.game.passed ? "QUALIFIED" : "LOCKED";
    }

    function setOverlay(visible, title, body, btnLabel, btnTestId) {
      overlay = overlay || $("[data-game-overlay]");
      if (!overlay) return;
      overlay.classList.toggle("is-visible", !!visible);
      var t = $("[data-overlay-title]", overlay);
      var b = $("[data-overlay-body]", overlay);
      var btn = $("button", overlay);
      if (t && title) t.textContent = title;
      if (b && body) b.textContent = body;
      if (btn && btnLabel) {
        btn.textContent = btnLabel;
        btn.hidden = false;
        if (btnTestId) btn.setAttribute("data-testid", btnTestId);
      }
    }

    function spawnParticles(gx, gy) {
      var c = cell();
      var px = gx * c + c / 2;
      var py = gy * c + c / 2;
      for (var i = 0; i < 7; i++) {
        var a = (Math.PI * 2 * i) / 7;
        particles.push({
          x: px,
          y: py,
          vx: Math.cos(a) * 40,
          vy: Math.sin(a) * 40,
          life: 1,
        });
      }
    }

    function draw(now) {
      if (!ctx) return;
      var n = WL_CONFIG.gridSize;
      var c = cell();
      var gap = Math.max(1, c * 0.08);

      ctx.fillStyle = "#050504";
      ctx.fillRect(0, 0, cssSize, cssSize);

      ctx.strokeStyle = "rgba(228,180,60,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var i = 1; i < n; i++) {
        ctx.moveTo(i * c + 0.5, 0);
        ctx.lineTo(i * c + 0.5, cssSize);
        ctx.moveTo(0, i * c + 0.5);
        ctx.lineTo(cssSize, i * c + 0.5);
      }
      ctx.stroke();

      var pulse = 0.65 + 0.35 * Math.sin((now || 0) / 160);
      ctx.fillStyle = "rgba(228,180,60," + pulse.toFixed(3) + ")";
      ctx.fillRect(food.x * c + gap, food.y * c + gap, c - gap * 2, c - gap * 2);

      for (var s = snake.length - 1; s >= 0; s--) {
        var part = snake[s];
        var isHead = s === 0;
        ctx.fillStyle = isHead ? "#f5d76a" : "#c9a227";
        ctx.fillRect(part.x * c + gap, part.y * c + gap, c - gap * 2, c - gap * 2);
        if (isHead) {
          ctx.fillStyle = "#1a1408";
          var eye = Math.max(2, c * 0.14);
          ctx.fillRect(part.x * c + c * 0.28, part.y * c + c * 0.28, eye, eye);
          ctx.fillRect(part.x * c + c * 0.58, part.y * c + c * 0.28, eye, eye);
        }
      }

      for (var p = particles.length - 1; p >= 0; p--) {
        var pt = particles[p];
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = "#f5d76a";
        ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
        ctx.globalAlpha = 1;
      }

      if (flash > 0) {
        ctx.fillStyle = "rgba(228,180,60," + (flash * 0.18).toFixed(3) + ")";
        ctx.fillRect(0, 0, cssSize, cssSize);
      }
    }

    function step() {
      if (queued && queued !== OPPOSITE[dir]) dir = queued;
      queued = "";
      var head = snake[0];
      var d = DIRS[dir];
      var nx = head.x + d.x;
      var ny = head.y + d.y;
      var n = WL_CONFIG.gridSize;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || occupied(nx, ny)) {
        die();
        return;
      }
      snake.unshift({ x: nx, y: ny });
      if (nx === food.x && ny === food.y) {
        state.game.score += WL_CONFIG.pointsPerFood;
        if (state.game.score > state.game.bestScore) state.game.bestScore = state.game.score;
        paintScore();
        spawnParticles(nx, ny);
        flash = 1;
        tickMs = Math.max(70, tickMs * 0.97);
        announce("Score " + state.game.score);
        if (state.game.score >= WL_CONFIG.requiredScore) {
          pass();
          return;
        }
        placeFood();
        persist();
      } else {
        snake.pop();
      }
    }

    function die() {
      running = false;
      persist();
      setOverlay(
        true,
        "SIGNAL LOST",
        "Score " + padScore(state.game.score) + ". Required " + WL_CONFIG.requiredScore + ".",
        "RETRY TEST",
        "game-start"
      );
      announce("Access test failed. Retry.");
      draw(performance.now());
    }

    function pass() {
      running = false;
      state.game.passed = true;
      persist();
      paintScore();
      var claim = $('[data-testid="game-continue"]');
      if (claim) {
        claim.hidden = false;
        claim.disabled = false;
      }
      setOverlay(
        true,
        "ACCESS TEST COMPLETE",
        "Score " + padScore(state.game.score) + ". Status: QUALIFIED.",
        "CLAIM WL ACCESS",
        "game-continue-overlay"
      );
      var overlayBtn = overlay && $("button", overlay);
      if (overlayBtn) {
        overlayBtn.removeAttribute("data-testid");
        overlayBtn.setAttribute("data-claim", "1");
      }
      announce("Access test complete. Qualified.");
      draw(performance.now());
    }

    function showPassed() {
      paintScore();
      var claim = $('[data-testid="game-continue"]');
      if (claim) {
        claim.hidden = false;
        claim.disabled = false;
      }
      setOverlay(
        true,
        "ACCESS TEST COMPLETE",
        "Score " + padScore(state.game.score) + ". Status: QUALIFIED.",
        "CLAIM WL ACCESS",
        "game-continue-overlay"
      );
      var overlayBtn = overlay && $("button", overlay);
      if (overlayBtn) overlayBtn.setAttribute("data-claim", "1");
    }

    function loop(ts) {
      if (!running) return;
      if (!last) last = ts;
      var dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      acc += dt * 1000;
      flash = Math.max(0, flash - dt * 3);
      for (var i = particles.length - 1; i >= 0; i--) {
        var pt = particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt * 2.2;
        if (pt.life <= 0) particles.splice(i, 1);
      }
      while (acc >= tickMs) {
        acc -= tickMs;
        step();
        if (!running) break;
      }
      draw(ts);
      if (running) raf = requestAnimationFrame(loop);
    }

    function start() {
      if (state.game.passed) {
        showPassed();
        return;
      }
      cancelAnimationFrame(raf);
      resetSnake();
      paintScore();
      setOverlay(false);
      var claim = $('[data-testid="game-continue"]');
      if (claim) {
        claim.hidden = true;
        claim.disabled = true;
      }
      running = true;
      acc = 0;
      last = 0;
      raf = requestAnimationFrame(loop);
      announce("Access test running.");
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function setDir(name) {
      if (!DIRS[name]) return;
      if (name === OPPOSITE[dir] && !queued) return;
      queued = name;
    }

    function resize() {
      canvas = canvas || document.getElementById("snake-canvas");
      if (!canvas) return;
      ctx = canvas.getContext("2d");
      var rect = canvas.getBoundingClientRect();
      cssSize = Math.max(160, Math.floor(rect.width || canvas.clientWidth || 384));
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(cssSize * dpr);
      canvas.height = Math.floor(cssSize * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }

    function bindInput() {
      canvas = document.getElementById("snake-canvas");
      overlay = $("[data-game-overlay]");

      document.addEventListener("keydown", function (e) {
        if (state.screen !== "game") return;
        var map = {
          ArrowUp: "up",
          ArrowDown: "down",
          ArrowLeft: "left",
          ArrowRight: "right",
          KeyW: "up",
          KeyS: "down",
          KeyA: "left",
          KeyD: "right",
        };
        var next = map[e.code];
        if (!next) return;
        e.preventDefault();
        if (!running && !state.game.passed && e.code !== "Space") {
          /* direction is queued once started */
        }
        setDir(next);
      });

      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          /* freeze clock so a backgrounded tab does not teleport */
          last = 0;
        }
      });
      window.addEventListener("blur", function () {
        last = 0;
      });

      var swipe = { x: 0, y: 0, on: false };
      function bindSwipe(el) {
        if (!el) return;
        el.addEventListener("pointerdown", function (e) {
          swipe.on = true;
          swipe.x = e.clientX;
          swipe.y = e.clientY;
        });
        el.addEventListener("pointerup", function (e) {
          if (!swipe.on) return;
          swipe.on = false;
          var dx = e.clientX - swipe.x;
          var dy = e.clientY - swipe.y;
          if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
          if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? "right" : "left");
          else setDir(dy > 0 ? "down" : "up");
        });
        el.addEventListener("pointercancel", function () {
          swipe.on = false;
        });
      }
      bindSwipe(canvas);

      $all("[data-dir]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          setDir(btn.getAttribute("data-dir"));
        });
      });

      window.addEventListener("resize", function () {
        if (state.screen === "game") resize();
      });
    }

    return {
      start: start,
      stop: stop,
      resize: resize,
      bindInput: bindInput,
      showPassed: showPassed,
      setDir: setDir,
      paintScore: paintScore,
      isRunning: function () {
        return running;
      },
    };
  })();

  /* ------------------------------------------------------------------
   * initialization
   * ------------------------------------------------------------------ */
  function bindIdentity() {
    var form = $("[data-ident-form]");
    var input = $('[data-testid="username-input"]');
    var err = $("[data-username-error]");
    if (!form || !input) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var handle = normalizeUsername(input.value);
      if (!handle) {
        if (err) {
          err.hidden = false;
          err.textContent = "ENTER AN X USERNAME.";
        }
        input.focus();
        return;
      }
      if (!isValidUsername(handle)) {
        if (err) {
          err.hidden = false;
          err.textContent = "USE 1–15 LETTERS, NUMBERS, OR UNDERSCORE.";
        }
        input.focus();
        return;
      }
      if (err) {
        err.hidden = true;
        err.textContent = "";
      }
      state.username = "@" + handle;
      input.value = state.username;
      persist();
      showScreen("quests");
      announce("Operator " + state.username + ". Quest log open.");
    });
  }

  function bindQuests() {
    $all("[data-task]").forEach(function (card) {
      var key = card.getAttribute("data-task");
      var openBtn = $("[data-task-open]", card);
      var confirmBtn = $("[data-task-confirm]", card);
      if (openBtn) {
        openBtn.addEventListener("click", function () {
          openTask(key);
        });
      }
      if (confirmBtn) {
        confirmBtn.addEventListener("click", function () {
          confirmTask(key);
        });
      }
    });
    var cont = $('[data-testid="quests-continue"]');
    if (cont) {
      cont.addEventListener("click", function () {
        if (!allTasksComplete()) return;
        showScreen("game");
        announce("Access test unlocked.");
      });
    }
  }

  function bindGameChrome() {
    var startBtn = $('[data-testid="game-start"]');
    var overlay = $("[data-game-overlay]");
    if (overlay) {
      overlay.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || t.tagName !== "BUTTON") return;
        if (t.getAttribute("data-claim") === "1" || t.getAttribute("data-testid") === "game-continue-overlay") {
          qualify();
          return;
        }
        game.start();
      });
    } else if (startBtn) {
      startBtn.addEventListener("click", function () {
        game.start();
      });
    }
    var claim = $('[data-testid="game-continue"]');
    if (claim) {
      claim.addEventListener("click", function () {
        qualify();
      });
    }
    var req = $("[data-required-score]");
    if (req) req.textContent = String(WL_CONFIG.requiredScore);
  }

  function init() {
    restore();
    bindIdentity();
    bindQuests();
    bindGameChrome();
    game.bindInput();
    renderTasks();
    updateOperator();

    var input = $('[data-testid="username-input"]');
    if (input && state.username) input.value = state.username;

    showScreen(state.screen);
    if (state.screen === "identity" && input) input.focus();

    window.__WL_DEBUG = {
      config: WL_CONFIG,
      state: state,
      completeAllTasks: function () {
        state.tasks.follow = true;
        state.tasks.repost = true;
        state.tasks.friends = true;
        persist();
        renderTasks();
      },
      setScore: function (n) {
        state.game.score = n | 0;
        if (state.game.score >= WL_CONFIG.requiredScore) state.game.passed = true;
        game.paintScore();
        persist();
      },
      forcePass: function () {
        state.game.score = Math.max(state.game.score, WL_CONFIG.requiredScore);
        state.game.passed = true;
        persist();
        game.showPassed();
      },
      reset: function () {
        try {
          localStorage.removeItem(WL_CONFIG.storageKey);
        } catch (err) {}
        window.location.reload();
      },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
