(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * configuration
   * Replace officialX / announcementX / nextStageUrl before launch.
   * ------------------------------------------------------------------ */
  var WL_CONFIG = {
    officialX: "https://x.com/Zcash",
    announcementX: "https://x.com/Zcash",
    homeUrl: "/",
    nextStageUrl: "REPLACE_WITH_NEXT_STAGE_URL",
    storageKey: "zec_wl_progress",
    themeKey: "zec_wl_theme",
  };

  var TASK_URLS = {
    follow: WL_CONFIG.officialX,
    repost: WL_CONFIG.announcementX,
    friends: WL_CONFIG.announcementX,
  };

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

  /* ------------------------------------------------------------------
   * persistence
   * ------------------------------------------------------------------ */
  function persist() {
    try {
      localStorage.setItem(
        WL_CONFIG.storageKey,
        JSON.stringify({
          v: 2,
          screen: state.screen,
          username: state.username,
          tasks: state.tasks,
          pending: state.pending,
        })
      );
    } catch (err) {
      /* private mode / blocked storage */
    }
  }

  function restore() {
    try {
      var raw = localStorage.getItem(WL_CONFIG.storageKey);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data || (data.v !== 1 && data.v !== 2)) return;
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
      if (state.username && allTasksComplete()) {
        state.screen = data.screen === "identity" || data.screen === "quests" ? data.screen : "reveal";
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
  var PREV_SCREEN = {
    quests: "identity",
    reveal: "quests",
  };

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
    updateBackButton();
    persist();
    if (name === "identity") {
      var input = $('[data-testid="username-input"]');
      if (input) input.focus();
    }
    if (name === "reveal") playReveal();
  }

  function playReveal() {
    var screen = $('[data-screen="reveal"]');
    if (!screen) return;
    screen.classList.remove("is-playing");
    void screen.offsetWidth;
    screen.classList.add("is-playing");
  }

  function updateBackButton() {
    var btn = $('[data-testid="step-back"]');
    if (!btn) return;
    var first = state.screen === "identity";
    btn.disabled = first;
    btn.setAttribute("aria-disabled", first ? "true" : "false");
    if (first) btn.setAttribute("title", "No previous step");
    else btn.removeAttribute("title");
  }

  function goBack() {
    var prev = PREV_SCREEN[state.screen];
    if (!prev) return;
    showScreen(prev);
    announce("Returned to previous step.");
  }

  function updateProgress() {
    var order = { identity: 0, quests: 1, reveal: 2 };
    var current = order[state.screen] || 0;
    $all("[data-progress]").forEach(function (el) {
      var key = el.getAttribute("data-progress");
      var idx = order[key];
      var indexEl = $("[data-progress-index]", el);
      var stateEl = $("[data-progress-state]", el);
      var nums = { identity: "01", quests: "02", reveal: "03" };
      el.classList.remove("is-current", "is-done", "is-locked");
      if (idx < current) {
        el.classList.add("is-done");
        if (indexEl) indexEl.textContent = "✓";
        if (stateEl) stateEl.textContent = "COMPLETE";
      } else if (idx === current) {
        el.classList.add("is-current");
        if (indexEl) indexEl.textContent = nums[key];
        if (stateEl) stateEl.textContent = "CURRENT";
      } else {
        el.classList.add("is-locked");
        if (indexEl) indexEl.textContent = nums[key];
        if (stateEl) stateEl.textContent = "LOCKED";
      }
    });
  }

  function updateOperator() {
    var label = state.username || "—";
    $all("[data-operator]").forEach(function (el) {
      el.textContent = label;
    });
    var access = state.screen === "reveal" ? "UNLOCKED" : "RESTRICTED";
    $all("[data-access-flag]").forEach(function (el) {
      el.textContent = "ACCESS: " + access;
    });
    $all("[data-foot-access]").forEach(function (el) {
      el.textContent = access;
    });
  }

  /* ------------------------------------------------------------------
   * task logic
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
          openBtn.textContent = "OPEN X AGAIN";
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
      cont.textContent = ready ? "CONTINUE TO NEXT STAGE" : "CONTINUE";
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
    if (!state.pending[key] && !state.tasks[key]) return;
    state.tasks[key] = true;
    state.pending[key] = false;
    persist();
    renderTasks();
    announce(key + " marked complete.");
    if (allTasksComplete()) announce("All quests complete. Next stage unlocked.");
  }

  /* ------------------------------------------------------------------
   * Stage 03 destination — isolated for team integration
   * ------------------------------------------------------------------ */
  function navigateToNextStage() {
    /* Replace WL_CONFIG.nextStageUrl with the live destination.
     * Do not add a game, form, or wallet flow here. */
    window.location.href = WL_CONFIG.nextStageUrl;
  }

  /* ------------------------------------------------------------------
   * theme
   * ------------------------------------------------------------------ */
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function applyTheme(theme) {
    var light = theme === "light";
    if (light) document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", light ? "#e8dcc0" : "#050504");
    var btn = $("[data-theme-toggle]");
    if (btn) {
      btn.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
      btn.setAttribute("title", light ? "Dark terminal" : "Light terminal");
      btn.setAttribute("data-mode", light ? "light" : "dark");
    }
    try {
      localStorage.setItem(WL_CONFIG.themeKey, light ? "light" : "dark");
    } catch (err) {}
  }

  function toggleTheme() {
    applyTheme(currentTheme() === "light" ? "dark" : "light");
  }

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
        showScreen("reveal");
        announce("Stage 03 unlocked.");
      });
    }
  }

  function bindReveal() {
    var enter = $('[data-testid="enter-next-stage"]');
    if (enter) {
      enter.addEventListener("click", function () {
        navigateToNextStage();
      });
    }
  }

  function bindBack() {
    var btn = $('[data-testid="step-back"]');
    if (!btn) return;
    btn.addEventListener("click", function () {
      goBack();
    });
  }

  function bindTheme() {
    var btn = $("[data-theme-toggle]");
    if (!btn) return;
    applyTheme(currentTheme());
    btn.addEventListener("click", function () {
      toggleTheme();
    });
  }

  function init() {
    restore();
    bindTheme();
    bindIdentity();
    bindQuests();
    bindReveal();
    bindBack();
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
      navigateToNextStage: navigateToNextStage,
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
