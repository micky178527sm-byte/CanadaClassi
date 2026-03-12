// ============================================
// CanadaClassi script.js
// NEW表示の安定化（フィードバージョン方式）
// カレンダー・TZ略称・既読挙動も維持
// 都市の「アカウント既定」と「一時選択」を分離（重要）
// ============================================

// ★NEW判定用：助け合いフィードの「更新バージョン」
const HELP_FEED_VERSION = 2;
const CC_DEBUG = false;
const CC_TEST_MODE = true;
const CC_SEED_MODE = "mock"; // "mock" | "none"
const ADMIN_EMAILS = ["admin@canadaclassi.local"];

// ============================
// Mock Auth (prototype)
// - localStorage の mock DB を使ってログイン判定
// - テスト用アカウント（test@test.com）を自動seed
// - 不要になったら "仮アカウントを削除して" でこの1件だけ削除できる
// ============================
const ENABLE_TEST_ACCOUNT_SEED = true;
const ENABLE_ADMIN_ACCOUNT_SEED = true;
const ADMIN_ALL_AREA_KEY = "__all_ca_jp__";
const TEST_ACCOUNT = {
  email: "test@test.com",
  account_name: "まうす",
  password: "12345678",
  default_city: "montreal",
  role: "user",
  is_test: true
};
const ADMIN_ACCOUNT = {
  email: "admin@canadaclassi.local",
  account_name: "Admin",
  password: "admin1234",
  default_city: ADMIN_ALL_AREA_KEY,
  default_city_name: "全カナダ＋日本",
  default_city_tz: "Asia/Tokyo",
  timezone: "Asia/Tokyo",
  role: "admin",
  is_test: true
};
const TZ_SEED_USERS = [
  {
    email: "tz_montreal@test.local",
    account_name: "TZ Montreal",
    password: "pass1234",
    default_city: "montreal",
    default_city_name: "モントリオール",
    default_city_tz: "America/Toronto",
    timezone: "America/Toronto"
  },
  {
    email: "tz_vancouver@test.local",
    account_name: "TZ Vancouver",
    password: "pass1234",
    default_city: "vancouver",
    default_city_name: "バンクーバー",
    default_city_tz: "America/Vancouver",
    timezone: "America/Vancouver"
  },
  {
    email: "tz_calgary@test.local",
    account_name: "TZ Calgary",
    password: "pass1234",
    default_city: "calgary",
    default_city_name: "カルガリー",
    default_city_tz: "America/Edmonton",
    timezone: "America/Edmonton"
  },
  {
    email: "tz_winnipeg@test.local",
    account_name: "TZ Winnipeg",
    password: "pass1234",
    default_city: "winnipeg",
    default_city_name: "ウィニペグ",
    default_city_tz: "America/Winnipeg",
    timezone: "America/Winnipeg"
  },
  {
    email: "tz_halifax@test.local",
    account_name: "TZ Halifax",
    password: "pass1234",
    default_city: "halifax",
    default_city_name: "ハリファックス",
    default_city_tz: "America/Halifax",
    timezone: "America/Halifax"
  },
  {
    email: "tz_stjohns@test.local",
    account_name: "TZ StJohns",
    password: "pass1234",
    default_city: "st_johns",
    default_city_name: "セントジョンズ",
    default_city_tz: "America/St_Johns",
    timezone: "America/St_Johns"
  }
];
const WINDOW_LOGIN_PREFIX = "cc_login|";
const WINDOW_POSTS_PREFIX = "cc_posts|";
const WINDOW_POSTS_SEPARATOR = "|" + WINDOW_POSTS_PREFIX;

function encodeWindowLoginPayload(payload) {
  try {
    const json = JSON.stringify(payload || {});
    return btoa(unescape(encodeURIComponent(json)));
  } catch (e) {
    return "";
  }
}

function splitWindowNameParts(raw) {
  const out = { loginToken: "", postsToken: "" };
  const val = String(raw || "");
  if (val.startsWith(WINDOW_LOGIN_PREFIX)) {
    const rest = val.slice(WINDOW_LOGIN_PREFIX.length);
    const idx = rest.indexOf(WINDOW_POSTS_SEPARATOR);
    if (idx >= 0) {
      out.loginToken = rest.slice(0, idx);
      out.postsToken = rest.slice(idx + WINDOW_POSTS_SEPARATOR.length);
    } else {
      out.loginToken = rest;
    }
    return out;
  }
  if (val.startsWith(WINDOW_POSTS_PREFIX)) {
    out.postsToken = val.slice(WINDOW_POSTS_PREFIX.length);
  }
  return out;
}

function decodeWindowLoginPayload(raw) {
  if (!raw) return null;
  const parts = splitWindowNameParts(raw);
  const token = parts.loginToken;
  if (!token) return null;
  try {
    const json = decodeURIComponent(escape(atob(token)));
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? obj : null;
  } catch (e) {
    return null;
  }
}

function getWindowLoginPayload() {
  return decodeWindowLoginPayload(window.name || "");
}

function encodeWindowPostsPayload(list) {
  try {
    const json = JSON.stringify(Array.isArray(list) ? list : []);
    return btoa(unescape(encodeURIComponent(json)));
  } catch (e) {
    return "";
  }
}

function decodeWindowPostsPayload(raw) {
  if (!raw) return [];
  const parts = splitWindowNameParts(raw);
  const token = parts.postsToken;
  if (!token) return [];
  try {
    const json = decodeURIComponent(escape(atob(token)));
    const obj = JSON.parse(json);
    return Array.isArray(obj) ? obj : [];
  } catch (e) {
    return [];
  }
}

function getMockUsersDB() {
  const raw = localStorage.getItem("mock_users") || localStorage.getItem("users") || "";
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveMockUsersDB(users) {
  try {
    localStorage.setItem("mock_users", JSON.stringify(Array.isArray(users) ? users : []));
  } catch (e) { }
}

function seedTestAccountIfNeeded() {
  if (!ENABLE_TEST_ACCOUNT_SEED) return;
  const users = getMockUsersDB();
  const exists = users.some(u => String(u?.email || "").trim().toLowerCase() === TEST_ACCOUNT.email.toLowerCase());
  if (!exists) {
    users.push({
      email: TEST_ACCOUNT.email,
      account_name: TEST_ACCOUNT.account_name,
      password: TEST_ACCOUNT.password,
      default_city: TEST_ACCOUNT.default_city,
      created_at: new Date().toISOString(),
      role: normalizeUserRole(TEST_ACCOUNT.role),
      status: "active",
      is_test: true
    });
  }

  if (ENABLE_ADMIN_ACCOUNT_SEED) {
    const adminExists = users.some(u => String(u?.email || "").trim().toLowerCase() === ADMIN_ACCOUNT.email.toLowerCase());
    if (!adminExists) {
      users.push({
        email: ADMIN_ACCOUNT.email,
        account_name: ADMIN_ACCOUNT.account_name,
        password: ADMIN_ACCOUNT.password,
        default_city: ADMIN_ACCOUNT.default_city,
        default_city_name: ADMIN_ACCOUNT.default_city_name,
        default_city_tz: ADMIN_ACCOUNT.default_city_tz,
        timezone: ADMIN_ACCOUNT.timezone,
        created_at: new Date().toISOString(),
        role: normalizeUserRole(ADMIN_ACCOUNT.role),
        status: "active",
        is_test: true
      });
    } else {
      users.forEach((u) => {
        if (String(u?.email || "").trim().toLowerCase() === ADMIN_ACCOUNT.email.toLowerCase()) {
          u.default_city = ADMIN_ACCOUNT.default_city;
          u.default_city_name = ADMIN_ACCOUNT.default_city_name;
          u.default_city_tz = ADMIN_ACCOUNT.default_city_tz;
          u.timezone = ADMIN_ACCOUNT.timezone;
        }
      });
    }
  }

  TZ_SEED_USERS.forEach((seed) => {
    const exists = users.some(u => String(u?.email || "").trim().toLowerCase() === seed.email.toLowerCase());
    if (!exists) {
      users.push({
        email: seed.email,
        account_name: seed.account_name,
        password: seed.password,
        default_city: seed.default_city,
        default_city_name: seed.default_city_name,
        default_city_tz: seed.default_city_tz,
        timezone: seed.timezone,
        created_at: new Date().toISOString(),
        role: normalizeUserRole("user"),
        status: "active",
        is_test: true
      });
      return;
    }
    users.forEach((u) => {
      if (String(u?.email || "").trim().toLowerCase() !== seed.email.toLowerCase()) return;
      u.default_city = seed.default_city;
      u.default_city_name = seed.default_city_name;
      u.default_city_tz = seed.default_city_tz;
      u.timezone = seed.timezone;
      if (!u.status) u.status = "active";
      if (!u.role) u.role = normalizeUserRole("user");
    });
  });
  saveMockUsersDB(users);
}

function normalizeMockLoginState() {
  try {
    const raw = localStorage.getItem("mock_is_logged_in");
    const isLoggedIn = raw === "1" || raw === "true" || raw === "yes";
    if (isLoggedIn) {
      const hasIdentity = !!(getUserEmail() || getAccountName());
      if (hasIdentity) return;
      localStorage.setItem("mock_is_logged_in", "false");
    }

    localStorage.removeItem("mock_user_email");
    localStorage.removeItem("mock_email");
    localStorage.removeItem("mock_account_name");
    localStorage.removeItem("mock_accountName");
    localStorage.removeItem("mock_user_name");
    localStorage.removeItem("mock_username");
    localStorage.removeItem("mock_user_role");
  } catch (e) { }
}

function deleteSeededTestAccountOnly() {
  const users = getMockUsersDB();
  const next = users.filter(u => {
    const email = String(u?.email || "").trim().toLowerCase();
    if (email !== TEST_ACCOUNT.email.toLowerCase()) return true;
    // is_test=true のものだけ消す
    return u?.is_test !== true;
  });
  saveMockUsersDB(next);

  // テストアカウントでログイン中ならログアウト相当
  try {
    const cur = String(localStorage.getItem("mock_user_email") || "").trim().toLowerCase();
    if (cur === TEST_ACCOUNT.email.toLowerCase()) {
      localStorage.setItem("mock_is_logged_in", "false");
      localStorage.removeItem("mock_user_email");
      localStorage.removeItem("mock_account_name");
      localStorage.removeItem("mock_user_role");
      // 一時エリアは必ずクリア
      try { sessionStorage.removeItem(KEY_TEMP_AREA); } catch (e) { }
    }
  } catch (e) { }
}

// デバッグ用（必要な時だけ利用）
window.CanadaClassiDev = window.CanadaClassiDev || {};
window.CanadaClassiDev.deleteTestAccount = deleteSeededTestAccountOnly;

window.CanadaClassiDev.deleteInquiryThreads = function () {
  try {
    const KEY_CHAT = "cc_chat_threads_v1";
    const raw = localStorage.getItem(KEY_CHAT);
    const db = raw ? JSON.parse(raw) : {};
    if (!db || typeof db !== "object") return;
    Object.keys(db).forEach((cid) => {
      const role = String(db?.[cid]?.meta?.role || "").trim().toLowerCase();
      if (role === "inquiry") delete db[cid];
    });
    localStorage.setItem(KEY_CHAT, JSON.stringify(db));

    // index も全削除
    const KEY_INQ_INDEX = "cc_inquiry_index_v1";
    localStorage.removeItem(KEY_INQ_INDEX);
  } catch (e) { }
};

// デバッグ用の追加スレッド生成は無効化（モック以外は追加しない）
window.CanadaClassiDev.addInquiryMockThreadForClickTest = function () {
  return;
};

// --------------------------------------------
// ヘッダーの通知ドット（お知らせ）
// --------------------------------------------
const KEY_CHAT_UNREAD = "cc_chat_unread";
const KEY_CHAT_LAST_SEEN = "cc_chat_last_seen_at";
const CC_NOTICES_KEY = "cc_notices";

function ccGetNoticeViewerId() {
  const name = String(getAccountName() || "").trim();
  if (name) return name;
  const email = String(getUserEmail() || "").trim();
  if (email) return email;
  const profile = ccLoadCurrentProfile();
  const profileKey = String(profile?.user_key || "").trim();
  if (profileKey) return profileKey;
  const localKey = String(localStorage.getItem("cc_user_key_v1") || "").trim();
  if (localKey) return localKey;
  return "guest";
}

function ccLoadNotices() {
  try {
    const raw = localStorage.getItem(CC_NOTICES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function ccSaveNotices(list) {
  try { localStorage.setItem(CC_NOTICES_KEY, JSON.stringify(Array.isArray(list) ? list : [])); } catch (e) { }
}

function ccNormalizeNoticeId(value) {
  return String(value || "").trim();
}

function ccEnsureNoticeSchema(notice) {
  const now = new Date().toISOString();
  const id = ccNormalizeNoticeId(notice?.id) || `N_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    userId: String(notice?.userId || "").trim(),
    category: notice?.category || "system",
    type: notice?.type || "system",
    title: String(notice?.title || "お知らせ"),
    body: String(notice?.body || ""),
    link: String(notice?.link || ""),
    createdAt: notice?.createdAt || now,
    readAt: notice?.readAt ?? null,
    hiddenAt: notice?.hiddenAt ?? null
  };
}

function getNotices(userId, { includeHidden = false } = {}) {
  const id = String(userId || "").trim();
  if (!id) return [];
  const list = ccLoadNotices();
  const filtered = list.filter((n) => {
    if (!n || String(n.userId || "") !== id) return false;
    if (!includeHidden && n.hiddenAt) return false;
    return true;
  });
  filtered.sort((a, b) => {
    const ta = Date.parse(a.createdAt || "") || 0;
    const tb = Date.parse(b.createdAt || "") || 0;
    return tb - ta;
  });
  return filtered;
}

function addNotice(notice) {
  if (!notice || typeof notice !== "object") return null;
  const list = ccLoadNotices();
  const normalized = ccEnsureNoticeSchema(notice);
  if (!normalized.userId) return null;
  if (list.some((n) => ccNormalizeNoticeId(n?.id) === normalized.id)) return normalized;
  list.push(normalized);
  ccSaveNotices(list);
  syncHeaderUnreadDot();
  return normalized;
}

function markNoticeRead(noticeId) {
  const id = ccNormalizeNoticeId(noticeId);
  if (!id) return false;
  const list = ccLoadNotices();
  const idx = list.findIndex((n) => ccNormalizeNoticeId(n?.id) === id);
  if (idx < 0) return false;
  list[idx].readAt = new Date().toISOString();
  ccSaveNotices(list);
  syncHeaderUnreadDot();
  return true;
}

function markNoticeUnread(noticeId) {
  const id = ccNormalizeNoticeId(noticeId);
  if (!id) return false;
  const list = ccLoadNotices();
  const idx = list.findIndex((n) => ccNormalizeNoticeId(n?.id) === id);
  if (idx < 0) return false;
  list[idx].readAt = null;
  ccSaveNotices(list);
  syncHeaderUnreadDot();
  return true;
}

function markAllNoticesRead(userId) {
  const id = String(userId || "").trim();
  if (!id) return false;
  const list = ccLoadNotices();
  let touched = false;
  list.forEach((n) => {
    if (!n || String(n.userId || "") !== id) return;
    if (n.hiddenAt) return;
    if (!n.readAt) {
      n.readAt = new Date().toISOString();
      touched = true;
    }
  });
  if (touched) ccSaveNotices(list);
  syncHeaderUnreadDot();
  return touched;
}

function toggleNoticeHidden(noticeId, hidden = true) {
  const id = ccNormalizeNoticeId(noticeId);
  if (!id) return false;
  const list = ccLoadNotices();
  const idx = list.findIndex((n) => ccNormalizeNoticeId(n?.id) === id);
  if (idx < 0) return false;
  list[idx].hiddenAt = hidden ? new Date().toISOString() : null;
  ccSaveNotices(list);
  syncHeaderUnreadDot();
  return true;
}

function getUnreadCount(userId) {
  const id = String(userId || "").trim();
  if (!id) return 0;
  return ccLoadNotices().filter((n) => {
    if (!n || String(n.userId || "") !== id) return false;
    if (n.hiddenAt) return false;
    return !n.readAt;
  }).length;
}

function getLatestNotices(userId, limit = 6, unreadOnly = false) {
  const list = getNotices(userId, { includeHidden: false });
  const filtered = unreadOnly ? list.filter((n) => !n.readAt) : list;
  return filtered.slice(0, Math.max(0, limit || 0));
}

function ccFormatNoticeTime(iso) {
  if (!iso) return "";
  return ccFormatDateTime(iso);
}

function ccEnsureSystemNotice(userId) {
  const id = String(userId || "").trim();
  if (!id) return;
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const existing = ccLoadNotices().some((n) => n && n.id === `N_system_welcome_${safeId}`);
  if (existing) return;
  addNotice({
    id: `N_system_welcome_${safeId}`,
    userId: id,
    category: "system",
    type: "system",
    title: "運営からのお知らせ",
    body: "CanadaClassiへようこそ。最新のお知らせをこちらで確認できます。",
    link: "mypage.html?tab=notices",
    createdAt: new Date().toISOString(),
    readAt: null,
    hiddenAt: null
  });
}

function ccSeedMockNotices(userId) {
  const id = String(userId || "").trim();
  if (!id) return;
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const now = Date.now();
  const toIso = (ms) => new Date(ms).toISOString();
  const list = [
    {
      id: `N_mock_system_1_${safeId}`,
      category: "system",
      type: "system",
      title: "メンテナンスのお知らせ",
      body: "2/10 02:00-04:00 に一時停止します。",
      link: "static.html?type=notice",
      createdAt: toIso(now - 6 * 24 * 60 * 60 * 1000),
      readAt: toIso(now - 5 * 24 * 60 * 60 * 1000)
    },
    {
      id: `N_mock_system_2_${safeId}`,
      category: "system",
      type: "system",
      title: "新機能のご案内",
      body: "お気に入りの整理が簡単になりました。",
      link: "static.html?type=notice",
      createdAt: toIso(now - 3 * 24 * 60 * 60 * 1000),
      readAt: null
    },
    {
      id: `N_mock_system_3_${safeId}`,
      category: "system",
      type: "system",
      title: "安全対策アップデート",
      body: "不正アクセス対策を強化しました。",
      link: "static.html?type=notice",
      createdAt: toIso(now - 1 * 24 * 60 * 60 * 1000),
      readAt: null
    },
    {
      id: `N_mock_post_visibility_${safeId}`,
      category: "post",
      type: "post_visibility",
      title: "投稿が公開されました",
      body: "『ダイニングテーブル』が公開になりました。",
      link: "mypage.html?tab=posts",
      createdAt: toIso(now - 2 * 24 * 60 * 60 * 1000),
      readAt: toIso(now - 1 * 24 * 60 * 60 * 1000)
    },
    {
      id: `N_mock_post_expiring_${safeId}`,
      category: "post",
      type: "post_expiring",
      title: "掲載期限が近づいています",
      body: "あと3日で非表示になります。",
      link: "mypage.html?tab=posts",
      createdAt: toIso(now - 8 * 60 * 60 * 1000),
      readAt: null
    },
    {
      id: `N_mock_inquiry_received_${safeId}`,
      category: "trade",
      type: "inquiry_received",
      title: "問い合わせを受信しました",
      body: "『IKEAのソファ』に問い合わせが届きました。",
      link: "mypage.html?tab=inquiries",
      createdAt: toIso(now - 5 * 60 * 60 * 1000),
      readAt: null
    },
    {
      id: `N_mock_txn_status_${safeId}`,
      category: "trade",
      type: "txn_status_changed",
      title: "取引ステータスが更新されました",
      body: "『IKEAのソファ』が「受付終了」になりました。",
      link: "mypage.html?tab=inquiries",
      createdAt: toIso(now - 2 * 60 * 60 * 1000),
      readAt: toIso(now - 60 * 60 * 1000)
    }
  ];
  list.forEach((item) => {
    addNotice(Object.assign({ userId: id }, item));
  });
}

function initNoticeDropdown() {
  const toggles = Array.from(document.querySelectorAll("[data-cc-notice-toggle]"));
  if (!toggles.length) return;
  const userId = ccGetNoticeViewerId();
  ccEnsureSystemNotice(userId);
  ccSeedMockNotices(userId);
  toggles.forEach((toggle) => {
    if (toggle.dataset.ccNoticeBound === "1") return;
    toggle.dataset.ccNoticeBound = "1";
    const wrap = toggle.closest(".cc-notice");
    const menu = wrap ? wrap.querySelector("[data-cc-notice-dropdown]") : null;
    const listEl = wrap ? wrap.querySelector("[data-cc-notice-list]") : null;
    const unreadToggle = wrap ? wrap.querySelector("[data-cc-notice-unread]") : null;
    const markAllBtn = wrap ? wrap.querySelector("[data-cc-notice-markall]") : null;
    if (!menu || !listEl) return;

    const render = () => {
      const unreadOnly = !!(unreadToggle && unreadToggle.checked);
      const items = getLatestNotices(userId, 6, unreadOnly);
      if (!items.length) {
        listEl.innerHTML = '<div class="cc-notice-empty">お知らせはありません。</div>';
        return;
      }
      listEl.innerHTML = items.map((item) => {
        const title = escapeHtml(String(item.title || "お知らせ"));
        const body = escapeHtml(String(item.body || ""));
        const time = escapeHtml(ccFormatNoticeTime(item.createdAt || ""));
        const href = escapeHtml(item.link || "mypage.html?tab=notices");
        const cls = item.readAt ? "" : " is-unread";
        return `
          <a class="cc-notice-item${cls}" href="${href}" data-notice-id="${escapeHtml(item.id)}">
            <div class="cc-notice-item-title">${title}</div>
            ${body ? `<div class="cc-notice-item-body">${body}</div>` : ""}
            <div class="cc-notice-item-time">${time}</div>
          </a>
        `;
      }).join("");
      listEl.querySelectorAll("[data-notice-id]").forEach((link) => {
        link.addEventListener("click", () => {
          const id = link.getAttribute("data-notice-id");
          if (!id) return;
          markNoticeRead(id);
        });
      });
    };

    const openMenu = () => {
      menu.hidden = false;
      menu.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      render();
    };
    const closeMenu = () => {
      menu.hidden = true;
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menu.hidden) openMenu();
      else closeMenu();
    });
    document.addEventListener("click", (e) => {
      if (menu.hidden) return;
      if (menu.contains(e.target) || toggle.contains(e.target)) return;
      closeMenu();
    });
    if (unreadToggle) unreadToggle.addEventListener("change", render);
    if (markAllBtn) {
      markAllBtn.addEventListener("click", () => {
        markAllNoticesRead(userId);
        render();
      });
    }
  });
  syncHeaderUnreadDot();
}

function ccGetNoticeIdentitySet() {
  const ids = new Set();
  const name = String(getAccountName() || "").trim();
  const email = String(getUserEmail() || "").trim();
  const profile = ccLoadCurrentProfile();
  const profileKey = String(profile?.user_key || "").trim();
  const localKey = String(localStorage.getItem("cc_user_key_v1") || "").trim();
  if (name) ids.add(name);
  if (email) ids.add(email);
  if (profileKey) ids.add(profileKey);
  if (localKey) ids.add(localKey);
  return ids;
}

function ccIsPostOwnerForNotice(post, identities) {
  if (!post) return false;
  const candidates = [
    post.author,
    post.author_name,
    post.author_key,
    post.author_email,
    post.authorEmail
  ].map((v) => String(v || "").trim()).filter(Boolean);
  return candidates.some((id) => identities.has(id));
}

function ccGetPostExpiryTimestamp(post) {
  const raw = post?.expires_at || post?.expiresAt;
  const direct = Date.parse(String(raw || ""));
  if (Number.isFinite(direct)) return direct;
  const created = Date.parse(String(post?.created_at || post?.createdAt || ""));
  if (!Number.isFinite(created)) return 0;
  const days = 30 * 24 * 60 * 60 * 1000;
  return created + days;
}

function ccSeedPostExpiringNotices(userId) {
  const id = String(userId || "").trim();
  if (!id) return;
  const identities = ccGetNoticeIdentitySet();
  if (!identities.size) return;
  const posts = ccGetPosts({ includeHidden: true });
  const now = Date.now();
  const thresholdMs = 3 * 24 * 60 * 60 * 1000;
  posts.forEach((post) => {
    if (!ccIsPostOwnerForNotice(post, identities)) return;
    const expTs = ccGetPostExpiryTimestamp(post);
    if (!expTs || expTs < now) return;
    const diff = expTs - now;
    if (diff > thresholdMs) return;
    const daysLeft = Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
    const postKey = String(post?.key || post?.post_key || post?.post_id || post?.id || "").trim();
    if (!postKey) return;
    const noticeId = `N_post_expiring_${postKey}`;
    addNotice({
      id: noticeId,
      userId: id,
      category: "post",
      type: "post_expiring",
      title: "掲載期限が近づいています",
      body: `あと${daysLeft}日で非表示になります`,
      link: postKey ? `detail.html?post=${encodeURIComponent(postKey)}` : "mypage.html?tab=posts",
      createdAt: new Date().toISOString(),
      readAt: null,
      hiddenAt: null
    });
  });
}

function ccNotifyTxnStatusChange(thread, listing, statusLabel) {
  const targetId = String(listing?.scheduledCounterpartyUserId || "").trim();
  if (!targetId) return;
  const postTitle = String(thread?.postTitle || "投稿");
  const threadId = String(thread?.threadId || "");
  const postId = String(thread?.postId || "");
  const link = threadId
    ? `inquiry-thread.html?thread=${encodeURIComponent(threadId)}`
    : (postId ? `detail.html?post=${encodeURIComponent(postId)}` : "mypage.html?tab=notices");
  addNotice({
    userId: targetId,
    category: "trade",
    type: "txn_status_changed",
    title: "取引ステータスが更新されました",
    body: `『${postTitle}』が「${statusLabel}」になりました`,
    link,
    createdAt: new Date().toISOString(),
    readAt: null,
    hiddenAt: null
  });
}

function initMypageNoticeCenter() {
  const listEl = document.getElementById("mypage-notice-list");
  if (!listEl) return;
  const filterBtns = Array.from(document.querySelectorAll("[data-mypage-notice-filter]"));
  const userId = ccGetNoticeViewerId();
  ccEnsureSystemNotice(userId);
  ccSeedMockNotices(userId);
  ccSeedPostExpiringNotices(userId);

  const getActiveFilter = () => {
    return filterBtns.find((btn) => btn.classList.contains("is-active"))?.dataset?.mypageNoticeFilter || "all";
  };

  const render = () => {
    const filter = getActiveFilter();
    const includeHidden = filter === "hidden";
    let items = getNotices(userId, { includeHidden });
    if (filter === "hidden") items = items.filter((n) => n.hiddenAt);
    if (filter === "unread") items = items.filter((n) => !n.readAt);
    if (filter === "all") items = items.filter((n) => !n.hiddenAt);
    if (!items.length) {
      listEl.innerHTML = '<div class="mypage-notice-empty">お知らせはありません。</div>';
      return;
    }
    listEl.innerHTML = items.map((item) => {
      const title = escapeHtml(String(item.title || "お知らせ"));
      const body = escapeHtml(String(item.body || ""));
      const time = escapeHtml(ccFormatNoticeTime(item.createdAt || ""));
      const href = escapeHtml(item.link || "mypage.html?tab=notices");
      const isUnread = !item.readAt;
      const isHidden = !!item.hiddenAt;
      const readLabel = isUnread ? "既読にする" : "未読に戻す";
      const readBtn = `<button type="button" class="btn btn-secondary" data-notice-action="toggle-read">${readLabel}</button>`;
      const hideBtn = `<button type="button" class="btn btn-secondary" data-notice-action="hide">非表示</button>`;
      const restoreBtn = `<button type="button" class="btn btn-secondary" data-notice-action="restore">復活</button>`;
      const actionHtml = isHidden
        ? `${readBtn}${restoreBtn}`
        : `${readBtn}${hideBtn}`;
      return `
        <div class="mypage-notice-card${isUnread ? " is-unread" : ""}" data-notice-id="${escapeHtml(item.id)}">
          <div class="mypage-notice-main">
            <div class="mypage-notice-title">${title}</div>
            ${body ? `<div class="mypage-notice-body">${body}</div>` : ""}
            <div class="mypage-notice-meta">${time}</div>
          </div>
          <div class="mypage-notice-actions">
            <a class="btn btn-secondary" href="${href}" data-notice-link>詳細を見る</a>
            ${actionHtml}
          </div>
        </div>
      `;
    }).join("");
  };

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
      render();
    });
  });

  listEl.addEventListener("click", (e) => {
    const card = e.target.closest("[data-notice-id]");
    if (!card) return;
    const noticeId = card.getAttribute("data-notice-id");
    const actionBtn = e.target.closest("[data-notice-action]");
    if (actionBtn) {
      const action = actionBtn.getAttribute("data-notice-action");
      if (action === "toggle-read") {
        const notice = getNotices(userId, { includeHidden: true }).find((n) => String(n.id) === String(noticeId));
        if (notice && notice.readAt) markNoticeUnread(noticeId);
        else markNoticeRead(noticeId);
        render();
      }
      if (action === "hide") {
        toggleNoticeHidden(noticeId, true);
        render();
      }
      if (action === "restore") {
        toggleNoticeHidden(noticeId, false);
        render();
      }
      return;
    }
    const link = e.target.closest("[data-notice-link]");
    if (link) {
      markNoticeRead(noticeId);
    }
  });

  render();
}

function getChatDBSafe() {
  try {
    const raw = localStorage.getItem("cc_chat_threads_v1");
    const obj = raw ? JSON.parse(raw) : {};
    return (obj && typeof obj === "object") ? obj : {};
  } catch (e) {
    return {};
  }
}

function getLatestIncomingTs(db) {
  let latest = 0;
  Object.keys(db || {}).forEach((k) => {
    const th = db[k];
    const msgs = Array.isArray(th?.messages) ? th.messages : [];
    msgs.forEach((m) => {
      if (m?.dir !== "in") return;
      const ts = Number(m?.ts || m?.timestamp || 0) || 0;
      if (ts > latest) latest = ts;
    });
  });
  return latest;
}

function setChatLastSeen(ts) {
  try { localStorage.setItem(KEY_CHAT_LAST_SEEN, String(ts || Date.now())); } catch (e) { }
}

function getChatLastSeen() {
  const raw = localStorage.getItem(KEY_CHAT_LAST_SEEN);
  const v = Number(raw || "0");
  return Number.isFinite(v) ? v : 0;
}

function syncHeaderUnreadDot() {
  const userId = ccGetNoticeViewerId();
  const hasUnread = getUnreadCount(userId) > 0;
  const btns = document.querySelectorAll("[data-cc-notice-toggle]");
  btns.forEach((btn) => {
    const dot = btn.querySelector(".notification-dot");
    if (!dot) return;
    if (hasUnread) btn.classList.add("has-unread");
    else btn.classList.remove("has-unread");
  });
}

function updateChatUnreadFlag() {
  const db = getChatDBSafe();
  const latest = getLatestIncomingTs(db);
  const lastSeen = getChatLastSeen();
  const hasUnread = latest > lastSeen;
  try { localStorage.setItem(KEY_CHAT_UNREAD, hasUnread ? "1" : "0"); } catch (e) { }
  syncHeaderUnreadDot();
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function isBlank(value) {
  return String(value || "").trim() === "";
}

function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return { ok: false, message: "メールアドレスを入力してください。" };
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!ok) return { ok: false, message: "メールアドレスの形式が正しくありません。" };
  return { ok: true, value: email };
}

function validatePassword(value) {
  const pw = String(value || "");
  if (!pw) {
    return { ok: false, message: "パスワードを入力してください。" };
  }
  if (pw.length < 8 || pw.length > 16 || /\s/.test(pw) || !/^[\x21-\x7E]+$/.test(pw)) {
    return {
      ok: false,
      message: "パスワードは8〜16文字以内。使用できる文字：英字・数字・記号（スペース不可）。"
    };
  }
  return { ok: true, value: pw };
}

function validateAccountName(value) {
  const name = String(value || "").trim();
  if (!name) return { ok: false, message: "アカウント名を入力してください。" };
  if (name.length > 32) {
    return { ok: false, message: "アカウント名は32文字以内で入力してください。" };
  }
  if (/[\r\n]/.test(name)) {
    return { ok: false, message: "アカウント名に改行は使用できません。" };
  }
  return { ok: true, value: name };
}

function normalizeUserRole(role) {
  return String(role || "").trim().toLowerCase() === "admin" ? "admin" : "user";
}

function setLoggedInUser(user) {
  try {
    const role = normalizeUserRole(user.role);
    localStorage.setItem("mock_is_logged_in", "true");
    localStorage.setItem("mock_user_email", String(user.email || ""));
    localStorage.setItem("mock_account_name", String(user.account_name || ""));
    localStorage.setItem("mock_user_role", role);
  } catch (e) { }

  const iconValue = String(user.icon || user.account_icon || "").trim();
  if (iconValue) {
    try { localStorage.setItem("cc_account_icon", iconValue); } catch (e) { }
  } else if (!ccGetAccountIcon()) {
    try { localStorage.setItem("cc_account_icon", "icon_red_gray.png"); } catch (e) { }
  }

  // 登録時の都市をアカウント既定として保存（永続）
  if (user.default_city) {
    try { localStorage.setItem("mock_default_city", String(user.default_city)); } catch (e) { }
    // ログインした直後は一時選択をクリアして既定へ
    try { sessionStorage.removeItem(KEY_TEMP_AREA); } catch (e) { }
  }
  if (user.default_city_name) {
    try { localStorage.setItem(KEY_DEFAULT_AREA_NAME, String(user.default_city_name)); } catch (e) { }
  }
  if (user.default_city_tz) {
    try { localStorage.setItem(KEY_DEFAULT_AREA_TZ, String(user.default_city_tz)); } catch (e) { }
  }

  // 言語設定（ログイン中はアカウント既定を優先して同期）
  try {
    const rawLang = user.account_lang || user.lang || user.language || user.accountLanguage || "";
    const norm = normalizeLangKey(rawLang);
    const nextLang = (norm === "jp") ? "ja" : norm;
    if (isValidLang(nextLang)) {
      persistLangForAccount(nextLang);
      persistLangForSession(nextLang);
    }
  } catch (e) { }

  // file:// では localStorage がページ間で共有されないため window.name にも保存
  try {
    const payload = {
      email: String(user.email || ""),
      account_name: String(user.account_name || ""),
      role: normalizeUserRole(user.role),
      default_city: String(user.default_city || ""),
      default_city_name: String(user.default_city_name || ""),
      default_city_tz: String(user.default_city_tz || ""),
      lang: String(user.account_lang || user.lang || user.language || user.accountLanguage || "")
    };
    const encoded = encodeWindowLoginPayload(payload);
    if (encoded) {
      const parts = splitWindowNameParts(window.name || "");
      const postsToken = parts.postsToken;
      window.name = WINDOW_LOGIN_PREFIX + encoded + (postsToken ? WINDOW_POSTS_SEPARATOR + postsToken : "");
    }
  } catch (e) { }
}

function doMockLogin(email, password) {
  seedTestAccountIfNeeded();

  const rawEmail = String(email || "");
  const rawPassword = String(password || "");

  // 1. メール・パスワードいずれかが未入力 → 汎用エラー
  if (isBlank(rawEmail) || isBlank(rawPassword)) {
    return { ok: false, message: "メールアドレスまたはパスワードが正しくありません。" };
  }

  // 2. メール形式が不正 → 汎用エラー
  const emailCheck = validateEmail(rawEmail);
  if (!emailCheck.ok) {
    // メッセージは汎用的なものを返す
    return { ok: false, message: "メールアドレスまたはパスワードが正しくありません。" };
  }
  const e = emailCheck.value;
  const p = rawPassword;

  const users = getMockUsersDB();
  const user = users.find(u => normalizeEmail(u?.email) === e);

  // 3. ユーザーが存在しない or パスワードが違う → 汎用エラー
  if (!user || String(user.password || "") !== String(p)) {
    return { ok: false, message: "メールアドレスまたはパスワードが正しくありません。" };
  }

  setLoggedInUser(Object.assign({}, user, { role: normalizeUserRole(user?.role) }));
  return { ok: true };
}

function doMockSignup(payload) {
  seedTestAccountIfNeeded();

  const emailValue = payload.email || "";
  const passwordValue = payload.password || "";

  // 1. メール未入力
  if (isBlank(emailValue)) {
    return { ok: false, message: "メールアドレスを入力してください。" };
  }
  // 2. パスワード未入力
  if (isBlank(passwordValue)) {
    return { ok: false, message: "パスワードを入力してください。" };
  }
  // 3. メール形式不正
  const emailCheck = validateEmail(emailValue);
  if (!emailCheck.ok) {
    // isBlankは済んでいるので形式エラーのはず
    return { ok: false, message: "メールアドレスの形式が正しくありません。" };
  }
  const email = emailCheck.value;

  // --- これ以降は、既存のチェックを優先度を下げて実行 ---

  // パスワード形式
  const passCheck = validatePassword(passwordValue);
  if (!passCheck.ok) return { ok: false, message: passCheck.message };
  const pass = passCheck.value;

  // アカウント名
  const accountCheck = validateAccountName(payload.account_name || "");
  if (!accountCheck.ok) return { ok: false, message: accountCheck.message };
  const accountName = accountCheck.value;

  // パスワード確認
  const pass2 = String(payload.password2 || "");
  if (!pass2) return { ok: false, message: "パスワード（確認）を入力してください。" };
  if (pass !== pass2) {
    return { ok: false, message: "パスワードが一致しません。" };
  }

  // 4. 都市未選択
  const defaultCity = String(payload.default_city || "").trim();
  if (!defaultCity) {
    return { ok: false, message: "お住まいの都市を選択してください。" };
  }

  // 同意チェック
  if (!payload.agreed) {
    return { ok: false, message: "利用規約・プライバシーポリシーに同意してください。" };
  }

  // メールアドレス重複チェック
  const users = getMockUsersDB();
  const exists = users.some(u => normalizeEmail(u?.email) === email);
  if (exists) {
    return { ok: false, message: "このメールアドレスは既に登録されています。" };
  }

  const defaultCityName = String(payload.default_city_name || "").trim();
  const defaultCityTz = String(payload.default_city_tz || "").trim();
  const defaultIcon = String(payload.icon || payload.account_icon || "").trim() || "icon_red_gray.png";

  users.push({
    email,
    account_name: accountName,
    password: pass,
    icon: defaultIcon,
    default_city: defaultCity,
    default_city_name: defaultCityName || undefined,
    default_city_tz: defaultCityTz || undefined,
    created_at: new Date().toISOString(),
    role: "user",
    status: "active"
  });
  saveMockUsersDB(users);
  setLoggedInUser({
    email,
    account_name: accountName,
    icon: defaultIcon,
    default_city: defaultCity,
    default_city_name: defaultCityName || undefined,
    default_city_tz: defaultCityTz || undefined,
    role: "user"
  });
  return { ok: true, message: "登録が完了しました。" };
}

const AUTH_RESET_TOKEN_KEY = "cc_password_reset_tokens_v1";
const AUTH_RESET_RATE_LIMIT_KEY = "cc_password_reset_last_request";
const AUTH_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const AUTH_RESET_RATE_LIMIT_MS = 60 * 1000;

function loadResetTokens() {
  try {
    const raw = localStorage.getItem(AUTH_RESET_TOKEN_KEY) || "";
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveResetTokens(tokens) {
  try {
    localStorage.setItem(AUTH_RESET_TOKEN_KEY, JSON.stringify(Array.isArray(tokens) ? tokens : []));
  } catch (e) { }
}

function generateResetToken() {
  return `rst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function authAdapterLocal() {
  return {
    register(payload) {
      return doMockSignup(payload || {});
    },
    login(email, password) {
      return doMockLogin(email, password);
    },
    logout() {
      clearLoginState();
      return { ok: true };
    },
    getSession() {
      const email = getUserEmail();
      if (!email) return null;
      return {
        email,
        account_name: getAccountName(),
        role: getUserRole(),
        default_city: getAccountDefaultAreaKey(),
        default_city_name: getStoredString([KEY_DEFAULT_AREA_NAME], ""),
        default_city_tz: getStoredString([KEY_DEFAULT_AREA_TZ], "")
      };
    },
    requestPasswordReset(email) {
      const emailCheck = validateEmail(email);
      if (!emailCheck.ok) return { ok: false, message: emailCheck.message };
      const now = Date.now();
      try {
        const last = Number(localStorage.getItem(AUTH_RESET_RATE_LIMIT_KEY) || "0");
        if (last && now - last < AUTH_RESET_RATE_LIMIT_MS) {
          return { ok: false, message: "時間をおいて再度お試しください。" };
        }
        localStorage.setItem(AUTH_RESET_RATE_LIMIT_KEY, String(now));
      } catch (e) { }

      const normalized = emailCheck.value;
      const users = getMockUsersDB();
      const exists = users.some(u => normalizeEmail(u?.email) === normalized);
      const token = generateResetToken();
      const tokens = loadResetTokens();
      tokens.push({
        token,
        email: normalized,
        createdAt: now,
        expiresAt: now + AUTH_RESET_TOKEN_TTL_MS,
        used: false,
        ghost: !exists
      });
      saveResetTokens(tokens);
      return {
        ok: true,
        message: "ご入力のメールアドレスが登録されている場合、再設定リンクを送信しました。",
        testLink: `reset.html?token=${encodeURIComponent(token)}`
      };
    },
    verifyResetToken(token) {
      try {
        const raw = String(token || "").trim();
        if (!raw) return { ok: false, reason: "missing", message: "トークンが見つかりません。再設定リンクを再送してください。" };
        const tokens = loadResetTokens();
        const item = tokens.find(t => t.token === raw);
        if (!item) return { ok: false, reason: "invalid", message: "不正なリンクです。再設定リンクを再送してください。" };
        if (item.used) return { ok: false, reason: "used", message: "このリンクは既に使用されています。再設定リンクを再送してください。" };
        if (Date.now() > Number(item.expiresAt || 0)) {
          return { ok: false, reason: "expired", message: "このリンクは期限切れです。再設定リンクを再送してください。" };
        }
        if (item.ghost) return { ok: false, reason: "invalid", message: "不正なリンクです。再設定リンクを再送してください。" };
        return { ok: true, email: item.email, token: item.token };
      } catch (e) {
        return { ok: false, reason: "invalid", message: "不正なリンクです。再設定リンクを再送してください。" };
      }
    },
    resetPassword(token, newPassword) {
      try {
        const tokenCheck = this.verifyResetToken(token);
        if (!tokenCheck.ok) return { ok: false, message: tokenCheck.message || "不正なリンクです。" };
        const passCheck = validatePassword(newPassword);
        if (!passCheck.ok) return { ok: false, message: passCheck.message };

        const tokens = loadResetTokens();
        const idx = tokens.findIndex(t => t.token === tokenCheck.token);
        if (idx < 0) return { ok: false, message: "不正なリンクです。" };

        const users = getMockUsersDB();
        const user = users.find(u => normalizeEmail(u?.email) === normalizeEmail(tokenCheck.email));
        if (!user) return { ok: false, message: "不正なリンクです。" };

        user.password = passCheck.value;
        tokens[idx].used = true;
        tokens[idx].usedAt = Date.now();
        saveMockUsersDB(users);
        saveResetTokens(tokens);
        return { ok: true };
      } catch (e) {
        return { ok: false, message: "入力内容を確認してください。" };
      }
    }
  };
}

const authAdapter = authAdapterLocal();

function redirectAfterLogin() {
  try {
    const url = new URL(window.location.href);
    const from = url.searchParams.get("from");
    const postId = url.searchParams.get("post");
    if (from === "detail" || from === "inquiry") {
      if (postId) {
        window.location.href = `inquiry.html?post=${encodeURIComponent(postId)}`;
        return;
      }
      window.location.href = "detail.html";
      return;
    }
    if (from) {
      window.location.href = from;
      return;
    }
  } catch (e) { }
  window.location.href = "index.html";
}

window.CanadaClassiDev = window.CanadaClassiDev || {};
window.CanadaClassiDev.ccHandleLogin = function (evOrForm) {
  const form = evOrForm?.target?.tagName === "FORM"
    ? evOrForm.target
    : (evOrForm?.tagName === "FORM" ? evOrForm : null);
  if (evOrForm && evOrForm.preventDefault) evOrForm.preventDefault();
  if (!form) return { ok: false, message: "フォームが見つかりません。" };

  const email = form.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]')?.value || "";
  const pass = form.querySelector('input[type="password"]')?.value || "";
  const res = authAdapter.login(email, pass);
  if (res.ok) redirectAfterLogin();
  return res;
};

function attachLoginFormHook() {
  // capture phase: 既存の inline handler / 古い alert より先に止める
  document.addEventListener("submit", (ev) => {
    const form = ev.target;
    if (!form || form.tagName !== "FORM") return;

    const isLoginPage = /login\.html/i.test(location.pathname) || /login\.html/i.test(location.href);
    if (!isLoginPage) return;

    const pw = form.querySelector('input[type="password"]');
    const emailEl = form.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]');
    if (!pw || !emailEl) return;

    // 「ログイン」フォームだけを狙う（新規登録のformは除外）
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    const btnText = (submitBtn && (submitBtn.value || submitBtn.textContent) || "").trim();
    const looksLikeLogin = /ログイン/i.test(btnText) || form.id === "login-form" || form.classList.contains("login-form");
    if (!looksLikeLogin) return;

    ev.preventDefault();

    const res = authAdapter.login(emailEl.value, pw.value);
    if (res.ok) {
      ev.stopImmediatePropagation();
      redirectAfterLogin();
      return;
    }
  }, true);
}

function restoreLoginFromWindowName() {
  try {
    const payload = decodeWindowLoginPayload(window.name || "");
    if (!payload) return;
    const already = getLoggedInFlag() || !!getUserEmail();
    if (already) return;
    setLoggedInUser(payload);
  } catch (e) { }
}

function runRequestedUserDataCleanupOnce() {
  const FLAG_KEY = "cc_cleanup_user_data_once";
  try {
    if (localStorage.getItem(FLAG_KEY) === "1") return;
  } catch (e) { }

  try {
    localStorage.removeItem("cc_user_posts_v1");
  } catch (e) { }

  try {
    const KEY_CHAT = "cc_chat_threads_v1";
    const raw = localStorage.getItem(KEY_CHAT);
    const db = raw ? JSON.parse(raw) : {};
    if (db && typeof db === "object") {
      Object.keys(db).forEach((key) => {
        const role = String(db[key]?.meta?.role || "").toLowerCase();
        if (role === "inquiry") delete db[key];
      });
      localStorage.setItem(KEY_CHAT, JSON.stringify(db));
    }
  } catch (e) { }

  try {
    localStorage.setItem(FLAG_KEY, "1");
  } catch (e) { }
}

function guardAuthPages() {
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  const needsAuth = page === "post.html" || page === "inquiry.html";
  if (!needsAuth) return;

  const isLoggedIn = getLoggedInFlag() || !!getUserEmail();
  if (isLoggedIn && getAccountName()) return;

  const from = page === "inquiry.html" ? "inquiry" : (page || "index.html");
  let redirectUrl = `login.html?from=${encodeURIComponent(from)}`;
  try {
    const url = new URL(window.location.href);
    const post = url.searchParams.get("post");
    if (post) redirectUrl += `&post=${encodeURIComponent(post)}`;
  } catch (e) { }
  window.location.href = redirectUrl;
}

function guardBannedPages() {
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  const blocked = page === "post.html" || page === "inquiry.html" || page === "reply.html";
  if (!blocked) return;
  if (!isCurrentUserBanned()) return;
  openGlobalConfirmModal({
    id: "cc-banned-page-modal",
    title: "アカウント停止中",
    message: "アカウントが停止されているため、このページは利用できません。",
    confirmText: "マイページへ戻る",
    cancelText: "マイページへ戻る",
    onConfirm: () => {
      window.location.href = "mypage.html";
    },
    onCancel: () => {
      window.location.href = "mypage.html";
    }
  });
}

function guardAdminPage() {
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if (page !== "admin.html") return;
  const session = authAdapter.getSession();
  if (!session || !session.email) {
    window.location.replace("login.html?reason=admin");
    return;
  }
  if (!isAdminEmail(session.email)) {
    window.location.replace("forbidden.html?reason=admin");
  }
}

function openGlobalConfirmModal(opts) {
  const {
    id,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel
  } = opts || {};
  if (!id) return;

  let modal = document.getElementById(id);
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.id = id;
    modal.hidden = true;
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3 class="modal-title"></h3>
          <button class="modal-close" type="button" data-global-modal-close aria-label="閉じる">×</button>
        </div>
        <div class="modal-body"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" type="button" data-global-modal-cancel>キャンセル</button>
          <button class="btn btn-primary" type="button" data-global-modal-confirm>確認する</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const titleEl = modal.querySelector(".modal-title");
  const bodyEl = modal.querySelector(".modal-body");
  const cancelBtn = modal.querySelector("[data-global-modal-cancel]");
  const confirmBtn = modal.querySelector("[data-global-modal-confirm]");
  const closeBtn = modal.querySelector("[data-global-modal-close]");

  if (titleEl) titleEl.textContent = title || "";
  if (bodyEl) bodyEl.textContent = message || "";
  if (cancelBtn) cancelBtn.textContent = cancelText || "キャンセル";
  if (confirmBtn) confirmBtn.textContent = confirmText || "確認する";

  const hide = (cb) => {
    modal.hidden = true;
    modal._ccConfirm = null;
    modal._ccCancel = null;
    if (typeof cb === "function") cb();
  };

  if (!modal.dataset.bound) {
    if (closeBtn) closeBtn.addEventListener("click", () => hide(modal._ccCancel));
    if (cancelBtn) cancelBtn.addEventListener("click", () => hide(modal._ccCancel));
    if (confirmBtn) confirmBtn.addEventListener("click", () => hide(modal._ccConfirm));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hide(modal._ccCancel);
    });
    modal.dataset.bound = "true";
  }

  modal._ccConfirm = onConfirm;
  modal._ccCancel = onCancel;
  modal.hidden = false;
}

function ensurePostReportModal() {
  let modal = document.getElementById("cc-post-report-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "cc-post-report-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3 class="modal-title">投稿を通報</h3>
        <button class="modal-close" type="button" data-report-close aria-label="閉じる">×</button>
      </div>
      <div class="modal-body">
        <div class="cc-modal-form">
          <p class="admin-note" id="cc-post-report-target">対象の投稿を通報します。</p>
          <div class="cc-modal-field">
            <label class="cc-modal-label" for="cc-post-report-reason">理由</label>
            <div class="cc-dropdown cc-select">
              <button class="cc-dd-toggle" type="button" aria-haspopup="listbox" aria-expanded="false">
                <span class="cc-dd-value"></span>
              </button>
              <div class="cc-dd-menu" role="listbox"></div>
              <select id="cc-post-report-reason" class="cc-hidden-select"></select>
            </div>
          </div>
          <div class="cc-modal-field">
            <label class="cc-modal-label" for="cc-post-report-detail">詳細（任意）</label>
            <textarea id="cc-post-report-detail" class="cc-modal-input" rows="4" placeholder="補足があれば入力してください"></textarea>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" type="button" data-report-cancel>キャンセル</button>
        <button class="btn btn-primary" type="button" data-report-submit>通報する</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  ccInitSelectDropdowns(modal);
  return modal;
}

function openReportModal(targetKey, targetType, titleText, meta) {
  const modal = ensurePostReportModal();
  const targetEl = modal.querySelector("#cc-post-report-target");
  const reasonEl = modal.querySelector("#cc-post-report-reason");
  const detailEl = modal.querySelector("#cc-post-report-detail");
  const submitBtn = modal.querySelector("[data-report-submit]");
  const cancelBtn = modal.querySelector("[data-report-cancel]");
  const closeBtn = modal.querySelector("[data-report-close]");

  if (targetEl) targetEl.textContent = titleText || "対象を通報します。";
  ccApplyReportReasonsToSelect(reasonEl);
  ccResetSelectDropdown(reasonEl);
  ccInitSelectDropdowns(modal);
  if (detailEl) detailEl.value = "";

  const close = () => {
    modal.classList.remove("is-open");
    modal.hidden = true;
  };
  const onCancel = () => close();
  const onSubmit = () => {
    const reporterEmail = getUserEmail();
    if (!reporterEmail) {
      window.location.href = "login.html?from=report";
      return;
    }
    if (!assertNotBanned()) return;
    const now = new Date();
    const nowIso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const nowEpoch = now.getTime();
    const extra = (meta && typeof meta === "object") ? meta : {};
    const report = {
      report_id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      target_type: targetType || "post",
      target_key: String(targetKey || ""),
      reason: reasonEl ? String(reasonEl.value || "other") : "other",
      detail: detailEl ? String(detailEl.value || "").trim() : "",
      reporter_email: reporterEmail,
      reporter_name: getAccountName() || "",
      created_at: nowIso,
      reported_at_iso: nowIso,
      reported_at_epoch_ms: nowEpoch,
      thread_id: extra.thread_id || extra.threadId || "",
      post_key: extra.post_key || extra.postKey || (targetType === "post" ? String(targetKey || "") : ""),
      board_post_key: extra.board_post_key || extra.boardPostKey || (targetType === "board_post" ? String(targetKey || "") : ""),
      reply_key: extra.reply_key || extra.replyKey || (targetType === "board_reply" ? String(targetKey || "") : ""),
      buyer_email: extra.buyer_email || extra.buyerEmail || "",
      seller_email: extra.seller_email || extra.sellerEmail || "",
      status: "new",
      assigned_to: "",
      internal_note: "",
      priority: "normal",
      due_at_iso: "",
      handled_by: "",
      handled_at: ""
    };
    ccAddReport(report);
    showGlobalToast("通報を受け付けました。");
    close();
  };

  if (submitBtn) submitBtn.onclick = onSubmit;
  if (cancelBtn) cancelBtn.onclick = onCancel;
  if (closeBtn) closeBtn.onclick = onCancel;
  modal.onclick = (e) => {
    if (e.target === modal) close();
  };
  modal.hidden = false;
  modal.classList.add("is-open");
}

function openPostReportModal(post) {
  const displayTitle = ccGetPostDisplayTitle(post, "");
  const title = displayTitle ? `「${displayTitle}」を通報します。` : "対象の投稿を通報します。";
  openReportModal(post?.key, "post", title);
}

function resolveSignupDefaultCity() {
  const primary = document.getElementById("default-city-primary");
  const primaryKey = primary ? String(primary.value || "") : "";
  if (!primaryKey) return { key: "", name: "", tz: "" };

  // 「その他」が選ばれても、実際の値はサブメニューで選択されたものが primary.value に設定される想定
  return { key: primaryKey, name: getDisplayAreaName(primaryKey), tz: getAreaTimeZone(primaryKey) };
}

window.CanadaClassiDev = window.CanadaClassiDev || {};
window.CanadaClassiDev.ccHandleSignup = function (evOrForm) {
  const form = evOrForm?.target?.tagName === "FORM" ? evOrForm.target : (evOrForm?.tagName === "FORM" ? evOrForm : null);
  if (evOrForm && evOrForm.preventDefault) evOrForm.preventDefault();
  if (!form) return { ok: false, message: "フォームが見つかりません。" };

  const email = form.querySelector("#signup-email")?.value || "";
  const accountName = form.querySelector("#account-name")?.value || "";
  const pass = form.querySelector("#signup-pass")?.value || "";
  const pass2 = form.querySelector("#signup-pass2")?.value || "";
  const agreed = !!form.querySelector("#agree")?.checked;
  const city = resolveSignupDefaultCity();

  return authAdapter.register({
    email,
    account_name: accountName,
    password: pass,
    password2: pass2,
    agreed: agreed,
    default_city: city.key,
    default_city_name: city.name,
    default_city_tz: city.tz
  });
};

window.CanadaClassiDev.authAdapter = authAdapter;

function initForgotPage() {
  const form = document.getElementById("forgot-form");
  if (!form) return;
  const emailEl = document.getElementById("forgot-email");
  const errorEl = document.getElementById("forgotError");
  const successEl = document.getElementById("forgot-success");
  const linkWrap = document.getElementById("forgot-test-link");
  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
  form.classList.remove("is-submitted");
  form.querySelectorAll(".form-row, .field").forEach((row) => {
    row.classList.remove("is-invalid", "is-touched");
  });
  form.querySelectorAll(".warn-icon").forEach((el) => {
    el.hidden = true;
    el.style.display = "none";
  });

  const setError = (msg) => {
    if (!errorEl) return;
    const textEl = errorEl.querySelector(".cc-error-text");
    if (textEl) textEl.textContent = msg || "";
    else errorEl.textContent = msg || "";
    errorEl.hidden = !msg;
  };
  const setSuccess = (msg) => {
    if (!successEl) return;
    successEl.textContent = msg || "";
    successEl.hidden = !msg;
  };
  const setLink = (href) => {
    if (!linkWrap) return;
    const link = linkWrap.querySelector("a");
    if (link && href) link.setAttribute("href", href);
    if (link && href) link.textContent = href;
    linkWrap.hidden = !href;
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLink("");
    if (submitBtn) submitBtn.disabled = true;
    const res = authAdapter.requestPasswordReset(emailEl ? emailEl.value : "");
    if (!res.ok) {
      setError(res.message || "入力内容を確認してください。");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    setSuccess("ご入力のメールアドレスが登録されている場合、再設定リンクを送信しました。迷惑メールフォルダもご確認ください。");
    if (res.testLink) setLink(res.testLink);
    if (submitBtn) submitBtn.disabled = false;
  });
}

function initResetPage() {
  const form = document.getElementById("reset-form");
  if (!form) return;
  const formWrap = document.getElementById("reset-form-wrap");
  const errorEl = document.getElementById("reset-error");
  const statusEl = document.getElementById("reset-status");
  const helperLinks = document.getElementById("reset-helper-links");
  const passEl = document.getElementById("reset-pass");
  const pass2El = document.getElementById("reset-pass2");
  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');

  const setError = (msg) => {
    if (!errorEl) return;
    errorEl.textContent = msg || "";
    errorEl.hidden = !msg;
  };
  const setStatus = (msg) => {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.hidden = !msg;
  };
  const showHelperLinks = (show) => {
    if (helperLinks) helperLinks.hidden = !show;
  };
  const showForm = (show) => {
    if (formWrap) formWrap.hidden = !show;
  };

  const token = (() => {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get("token") || "";
    } catch (e) {
      return "";
    }
  })();

  if (CC_DEBUG) console.log("[reset] token:", token);
  const tokenCheck = authAdapter.verifyResetToken(token);
  if (CC_DEBUG) console.log("[reset] verify:", tokenCheck);
  if (!tokenCheck.ok) {
    setStatus(tokenCheck.message || "不正なリンクです。");
    setError("");
    showForm(false);
    showHelperLinks(true);
    return;
  }
  setStatus("");
  setError("");
  showForm(true);
  showHelperLinks(false);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setError("");
    if (submitBtn) submitBtn.disabled = true;
    const pass = passEl ? passEl.value : "";
    const pass2 = pass2El ? pass2El.value : "";
    if (pass !== pass2) {
      setError("パスワードが一致しません。");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    const res = authAdapter.resetPassword(token, pass);
    if (!res.ok) {
      setError(res.message || "入力内容を確認してください。");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    setStatus("パスワードを更新しました。ログイン画面に移動します。");
    showForm(false);
    showHelperLinks(true);
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
  });
}

function initTestBadge() {
  if (!CC_TEST_MODE) return;
  if (document.getElementById("cc-test-badge")) return;
  const badge = document.createElement("div");
  badge.id = "cc-test-badge";
  badge.className = "cc-test-badge";
  badge.textContent = "テスト公開版A";
  document.body.appendChild(badge);

  const fixedCandidates = [
    ".cc-inbox-toast",
    ".cc-debug-overlay",
    "#toast",
    ".toast",
    ".cc-inbox-modal",
    ".cc-inbox-lightbox"
  ];
  const hasRightBottomFixed = fixedCandidates.some((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.position === "fixed" && style.bottom !== "auto" && style.right !== "auto";
  });

  if (hasRightBottomFixed) {
    badge.classList.add("cc-test-badge--left");
  }
}

// ============================
// 都市の保存キー（重要）
// ============================
// ・アカウント既定都市：mock_default_city（ユーザーに紐づく）
// ・ヘッダーの一時都市：sessionStorage.cc_temp_area（ログアウトで消える）
// ・ゲストの都市（任意）：localStorage.pref_area（従来互換としてゲスト用に使用）

// 言語（簡易：選択状態の保持）
// ・全ページ共通で #lang-select を同期
// ・UI文言の翻訳は将来対応（今は状態保持のみ）
const KEY_LANG = "cc_lang";
const KEY_ACCOUNT_LANG = "cc_account_lang";
const KEY_TEMP_AREA = "cc_temp_area";
const KEY_CUSTOM_AREA_NAME = "cc_custom_city_name";
const KEY_CUSTOM_AREA_TZ = "cc_custom_city_tz";
const KEY_TEMP_AREA_NAME = "cc_temp_area_name";
const KEY_TEMP_AREA_TZ = "cc_temp_area_tz";
const KEY_DEFAULT_AREA_NAME = "mock_default_city_name";
const KEY_DEFAULT_AREA_TZ = "mock_default_city_tz";

const TIMEZONE_OPTIONS = [
  { value: "America/Vancouver", label: "太平洋標準時（PST）" },
  { value: "America/Edmonton", label: "山岳部標準時（MST）" },
  { value: "America/Regina", label: "中部標準時（CST）" },
  { value: "America/Winnipeg", label: "中部標準時（CST/Winnipeg）" },
  { value: "America/Toronto", label: "東部標準時（EST）" },
  { value: "America/Halifax", label: "大西洋標準時（AST）" },
  { value: "America/St_Johns", label: "ニューファンドランド標準時（NST）" },
  { value: "Asia/Tokyo", label: "日本標準時（JST）" }
];

// エリア設定（主要/その他）
const AREA_MAJOR = [
  { key: "canada_all", name: "全カナダ" },
  { key: "vancouver", name: "バンクーバー" },
  { key: "victoria", name: "ビクトリア" },
  { key: "whistler", name: "ウィスラー" },
  { key: "kelowna", name: "ケロウナ" },
  { key: "calgary", name: "カルガリー" },
  { key: "banff", name: "バンフ" },
  { key: "edmonton", name: "エドモントン" },
  { key: "winnipeg", name: "ウィニペグ" },
  { key: "ottawa", name: "オタワ" },
  { key: "toronto", name: "トロント" },
  { key: "montreal", name: "モントリオール" },
  { key: "halifax", name: "ハリファックス" },
  { key: "other", name: "その他（カナダの都市）" },
  { key: "japan", name: "日本" }
];

const AREA_MINOR = [
  { key: "whitehorse", name: "ホワイトホース, YT", tz: "America/Whitehorse" },

  { key: "abbotsford", name: "アボッツフォード, BC", tz: "America/Vancouver" },
  { key: "burnaby", name: "バーナビー, BC", tz: "America/Vancouver" },
  { key: "kamloops", name: "カムループス, BC", tz: "America/Vancouver" },
  { key: "nanaimo", name: "ナナイモ, BC", tz: "America/Vancouver" },
  { key: "prince_george", name: "プリンスジョージ, BC", tz: "America/Vancouver" },
  { key: "richmond", name: "リッチモンド, BC", tz: "America/Vancouver" },
  { key: "surrey", name: "サレー, BC", tz: "America/Vancouver" },

  { key: "kananaskis", name: "カナナスキス, AB", tz: "America/Edmonton" },
  { key: "canmore", name: "キャンモア, AB", tz: "America/Edmonton" },
  { key: "fort_mcmurray", name: "フォートマクマレー, AB", tz: "America/Edmonton" },
  { key: "medicine_hat", name: "メディシンハット, AB", tz: "America/Edmonton" },
  { key: "lake_louise", name: "ルイーズ湖, AB", tz: "America/Edmonton" },
  { key: "red_deer", name: "レッドディア, AB", tz: "America/Edmonton" },
  { key: "lethbridge", name: "レスブリッジ, AB", tz: "America/Edmonton" },

  { key: "regina", name: "レジャイナ, SK", tz: "America/Regina" },
  { key: "saskatoon", name: "サスカトゥーン, SK", tz: "America/Regina" },

  { key: "brandon", name: "ブランドン, MB", tz: "America/Winnipeg" },

  { key: "oakville", name: "オークビル, ON", tz: "America/Toronto" },
  { key: "oshawa", name: "オシャワ, ON", tz: "America/Toronto" },
  { key: "kingston", name: "キングストン, ON", tz: "America/Toronto" },
  { key: "kitchener", name: "キッチナー, ON", tz: "America/Toronto" },
  { key: "guelph", name: "ゲルフ, ON", tz: "America/Toronto" },
  { key: "sudbury", name: "サドベリー, ON", tz: "America/Toronto" },
  { key: "thunder_bay", name: "サンダーベイ, ON", tz: "America/Toronto" },
  { key: "niagara_falls", name: "ナイアガラフォールズ, ON", tz: "America/Toronto" },
  { key: "barrie", name: "バリー, ON", tz: "America/Toronto" },
  { key: "hamilton", name: "ハミルトン, ON", tz: "America/Toronto" },
  { key: "mississauga", name: "ミシサガ, ON", tz: "America/Toronto" },
  { key: "markham", name: "マーカム, ON", tz: "America/Toronto" },
  { key: "vaughan", name: "ヴォーン, ON", tz: "America/Toronto" },
  { key: "london_on", name: "ロンドン, ON", tz: "America/Toronto" },
  { key: "waterloo", name: "ウォータールー, ON", tz: "America/Toronto" },
  { key: "windsor", name: "ウィンザー, ON", tz: "America/Toronto" },

  { key: "gatineau", name: "ガティノー, QC", tz: "America/Toronto" },
  { key: "laval", name: "ラヴァル, QC", tz: "America/Toronto" },
  { key: "longueuil", name: "ロンゲール, QC", tz: "America/Toronto" },
  { key: "quebec_city", name: "ケベックシティ, QC", tz: "America/Toronto" },

  { key: "fredericton", name: "フレデリクトン, NB", tz: "America/Halifax" },
  { key: "moncton", name: "モンクトン, NB", tz: "America/Halifax" },
  { key: "saint_john", name: "セントジョン, NB", tz: "America/Halifax" },

  { key: "charlottetown", name: "シャーロットタウン, PE", tz: "America/Halifax" },

  { key: "sydney_ns", name: "シドニー, NS", tz: "America/Halifax" },

  { key: "st_johns", name: "セントジョンズ, NL", tz: "America/St_Johns" }
];

const CC_CITY_PRIMARY = [
  { key: "vancouver", label: "バンクーバー, BC" },
  { key: "victoria", label: "ビクトリア, BC" },
  { key: "whistler", label: "ウィスラー, BC" },
  { key: "kelowna", label: "ケロウナ, BC" },
  { key: "calgary", label: "カルガリー, AB" },
  { key: "banff", label: "バンフ, AB" },
  { key: "edmonton", label: "エドモントン, AB" },
  { key: "winnipeg", label: "ウィニペグ, MB" },
  { key: "ottawa", label: "オタワ, ON" },
  { key: "toronto", label: "トロント, ON" },
  { key: "montreal", label: "モントリオール, QC" },
  { key: "halifax", label: "ハリファックス, NS" }
];

const CC_CITY_OTHER_GROUPS = [
  { label: "ユーコン準州（YT）", keys: ["whitehorse"] },
  { label: "ブリティッシュコロンビア州（BC）", keys: ["abbotsford", "burnaby", "kamloops", "nanaimo", "prince_george", "richmond", "surrey"] },
  { label: "アルバータ州（AB）", keys: ["kananaskis", "canmore", "fort_mcmurray", "medicine_hat", "lake_louise", "red_deer", "lethbridge"] },
  { label: "サスカチュワン州（SK）", keys: ["regina", "saskatoon"] },
  { label: "マニトバ州（MB）", keys: ["brandon"] },
  { label: "オンタリオ州（ON）", keys: ["oakville", "oshawa", "kingston", "kitchener", "guelph", "sudbury", "thunder_bay", "niagara_falls", "barrie", "hamilton", "mississauga", "markham", "vaughan", "london_on", "waterloo", "windsor"] },
  { label: "ケベック州（QC）", keys: ["gatineau", "laval", "longueuil", "quebec_city"] },
  { label: "ニューブランズウィック州（NB）", keys: ["fredericton", "moncton", "saint_john"] },
  { label: "プリンスエドワードアイランド州（PE）", keys: ["charlottetown"] },
  { label: "ノバスコシア州（NS）", keys: ["sydney_ns"] },
  { label: "ニューファンドランド・ラブラドール州（NL）", keys: ["st_johns"] }
];

const CC_CITY_LABELS = AREA_MINOR.reduce((acc, entry) => {
  acc[entry.key] = entry.name;
  return acc;
}, {});

const CC_CITY_SPECIAL_LABELS = {
  canada_all: "🇨🇦 全カナダ",
  japan: "🇯🇵 日本"
};

const areaSettings = {
  canada_all: { name: "全カナダ", tz: "America/Toronto" }, // 日付基準はオタワ(=Toronto)
  [ADMIN_ALL_AREA_KEY]: { name: "全カナダ＋日本", tz: "America/Toronto" },
  vancouver: { name: "バンクーバー", tz: "America/Vancouver" },
  victoria: { name: "ビクトリア", tz: "America/Vancouver" },
  whistler: { name: "ウィスラー", tz: "America/Vancouver" },
  kelowna: { name: "ケロウナ", tz: "America/Vancouver" },

  calgary: { name: "カルガリー", tz: "America/Edmonton" },
  banff: { name: "バンフ", tz: "America/Edmonton" },
  edmonton: { name: "エドモントン", tz: "America/Edmonton" },

  winnipeg: { name: "ウィニペグ", tz: "America/Winnipeg" },

  ottawa: { name: "オタワ", tz: "America/Toronto" },
  toronto: { name: "トロント", tz: "America/Toronto" },
  montreal: { name: "モントリオール", tz: "America/Toronto" },

  halifax: { name: "ハリファックス", tz: "America/Halifax" },

  other: { name: "その他（カナダの都市）", tz: "America/Toronto" },
  other_custom: { name: "候補がありません（自由記述）", tz: "America/Toronto" },
  japan: { name: "日本", tz: "Asia/Tokyo" }
};

AREA_MINOR.forEach((c) => {
  areaSettings[c.key] = { name: c.name, tz: c.tz };
});

const AREA_MINOR_KEYS = new Set(AREA_MINOR.map(c => c.key));

// さまざまな保存形式（key/日本語名/英語名）を area key に正規化
function normalizeAreaKey(raw) {
  if (raw === null || raw === undefined) return "";
  const v = String(raw)
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/，/g, ",");
  if (!v) return "";

  if (areaSettings[v]) return v;

  const lowered = v.toLowerCase();
  const vClean = v.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");
  const vCleanLower = vClean.toLowerCase();
  const vAscii = v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const vAsciiLower = vAscii.toLowerCase();
  if (areaSettings[lowered]) return lowered;
  const base = v.split(",")[0].trim();
  const baseLower = base.toLowerCase();
  const baseAscii = base.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const baseAsciiLower = baseAscii.toLowerCase();

  const alias = {
    "全カナダ": "canada_all",
    "canada": "canada_all",
    "canada_all": "canada_all",
    "全カナダ＋日本": ADMIN_ALL_AREA_KEY,
    "__all_ca_jp__": ADMIN_ALL_AREA_KEY,

    "バンクーバー": "vancouver",
    "vancouver": "vancouver",

    "ビクトリア": "victoria",
    "victoria": "victoria",

    "ウィスラー": "whistler",
    "whistler": "whistler",

    "ケロウナ": "kelowna",
    "kelowna": "kelowna",

    "カルガリー": "calgary",
    "calgary": "calgary",

    "バンフ": "banff",
    "banff": "banff",

    "エドモントン": "edmonton",
    "edmonton": "edmonton",

    "ウィニペグ": "winnipeg",
    "winnipeg": "winnipeg",

    "オタワ": "ottawa",
    "ottawa": "ottawa",

    "トロント": "toronto",
    "toronto": "toronto",

    "モントリオール": "montreal",
    "モントリオール, QC": "montreal",
    "montreal, qc": "montreal",
    "montreal": "montreal",

    "ハリファックス": "halifax",
    "halifax": "halifax",

    "その他": "other",
    "other": "other",
    "その他（カナダの都市）": "other",
    "その他（自由記述）": "other_custom",
    "候補がありません（自由記述）": "other_custom",
    "custom": "other_custom",
    "other_custom": "other_custom",
    "free": "other_custom",

    "日本": "japan",
    "japan": "japan"
  };

  // minor cities（日本語表記）
  AREA_MINOR.forEach((c) => {
    if (c.name) alias[c.name] = c.key;
    if (c.key) alias[c.key] = c.key;
  });
  alias["ルイーズ湖"] = "lake_louise";
  alias["ルイース湖"] = "lake_louise";

  if (alias[v]) return alias[v];
  if (alias[lowered]) return alias[lowered];
  if (alias[vClean]) return alias[vClean];
  if (alias[vCleanLower]) return alias[vCleanLower];
  if (alias[vAscii]) return alias[vAscii];
  if (alias[vAsciiLower]) return alias[vAsciiLower];
  if (alias[base]) return alias[base];
  if (alias[baseLower]) return alias[baseLower];
  if (alias[baseAscii]) return alias[baseAscii];
  if (alias[baseAsciiLower]) return alias[baseAsciiLower];

  for (const key of Object.keys(areaSettings)) {
    if (areaSettings[key] && areaSettings[key].name === v) return key;
    if (base && areaSettings[key] && areaSettings[key].name === base) return key;
  }

  return "";
}

function getCityLabelFromMaster(key) {
  if (CC_CITY_SPECIAL_LABELS[key]) return CC_CITY_SPECIAL_LABELS[key];
  const primary = CC_CITY_PRIMARY.find((c) => c.key === key);
  if (primary) return primary.label;
  if (CC_CITY_LABELS[key]) return CC_CITY_LABELS[key];
  return getDisplayAreaName(key) || key;
}

function buildCityOptionsForSelect(selectEl, options = {}) {
  if (!selectEl) return;
  const prev = selectEl.value || "";
  const includePlaceholder = !!options.includePlaceholder;
  const includeAll = !!options.includeAll;
  const includeOtherAll = !!options.includeOtherAll;
  const includeJapan = options.includeJapan !== false;
  const useGroups = options.useGroups !== false;

  selectEl.innerHTML = "";
  if (includePlaceholder) {
    const placeholderText = options.placeholderText || "都市を選択してください。";
    const placeholder = new Option(placeholderText, "", true, !prev);
    placeholder.disabled = true;
    selectEl.add(placeholder);
  }

  if (includeAll) {
    selectEl.add(new Option(CC_CITY_SPECIAL_LABELS.canada_all, "canada_all"));
  }
  if (includeOtherAll) {
    selectEl.add(new Option("その他のカナダ都市すべて", "canada_other_all"));
  }

  if (useGroups) {
    const primaryGroup = document.createElement("optgroup");
    primaryGroup.label = "主要都市";
    CC_CITY_PRIMARY.forEach((city) => {
      primaryGroup.appendChild(new Option(city.label, city.key));
    });
    selectEl.appendChild(primaryGroup);

    const otherGroup = document.createElement("optgroup");
    otherGroup.label = "その他のカナダ都市";
    CC_CITY_OTHER_GROUPS.forEach((group) => {
      group.keys.forEach((key) => {
        const label = CC_CITY_LABELS[key] || key;
        otherGroup.appendChild(new Option(label, key));
      });
    });
    selectEl.appendChild(otherGroup);
  } else {
    CC_CITY_PRIMARY.forEach((city) => {
      selectEl.add(new Option(city.label, city.key));
    });
    CC_CITY_OTHER_GROUPS.forEach((group) => {
      group.keys.forEach((key) => {
        const label = CC_CITY_LABELS[key] || key;
        selectEl.add(new Option(label, key));
      });
    });
  }

  if (includeJapan) {
    selectEl.add(new Option(CC_CITY_SPECIAL_LABELS.japan, "japan"));
  }

  if (prev) {
    const exists = Array.from(selectEl.options).some((opt) => String(opt.value) === String(prev));
    if (exists) selectEl.value = prev;
  }
}

function initCityOptionMasters() {
  const loginSelect = document.getElementById("default-city-primary");
  const mypageSelect = document.getElementById("mypage-default-city-primary");
  const listSelect = document.querySelector('[data-cc-area-role="primary"]');
  const postSelect = document.getElementById("post-area-select");

  if (loginSelect) {
    buildCityOptionsForSelect(loginSelect, { includePlaceholder: true, includeAll: true, includeJapan: true, useGroups: true });
  }
  if (mypageSelect) {
    buildCityOptionsForSelect(mypageSelect, { includeAll: true, includeJapan: true, useGroups: true });
  }
  if (listSelect) {
    buildCityOptionsForSelect(listSelect, { includeAll: true, includeOtherAll: true, includeJapan: true, useGroups: true });
  }
  if (postSelect) {
    buildCityOptionsForSelect(postSelect, { includePlaceholder: true, includeJapan: true, useGroups: true });
  }
}

function isMinorAreaKey(key) {
  return AREA_MINOR_KEYS.has(String(key || "").trim());
}

function getStoredCustomAreaName() {
  try {
    const temp = sessionStorage.getItem(KEY_TEMP_AREA_NAME);
    if (temp) return temp;
  } catch (e) { }
  const isLoggedIn = getLoggedInFlag() || !!getUserEmail();
  if (isLoggedIn) {
    const def = localStorage.getItem(KEY_DEFAULT_AREA_NAME);
    if (def) return def;
  }
  return localStorage.getItem(KEY_CUSTOM_AREA_NAME) || "";
}

function getStoredCustomAreaTZ() {
  try {
    const temp = sessionStorage.getItem(KEY_TEMP_AREA_TZ);
    if (temp) return temp;
  } catch (e) { }
  const isLoggedIn = getLoggedInFlag() || !!getUserEmail();
  if (isLoggedIn) {
    const def = localStorage.getItem(KEY_DEFAULT_AREA_TZ);
    if (def) return def;
  }
  return localStorage.getItem(KEY_CUSTOM_AREA_TZ) || "America/Toronto";
}

function setTempCustomArea(name, tz) {
  try {
    if (name) sessionStorage.setItem(KEY_TEMP_AREA_NAME, String(name));
    if (tz) sessionStorage.setItem(KEY_TEMP_AREA_TZ, String(tz));
  } catch (e) { }
}

function clearTempCustomArea() {
  try {
    sessionStorage.removeItem(KEY_TEMP_AREA_NAME);
    sessionStorage.removeItem(KEY_TEMP_AREA_TZ);
  } catch (e) { }
}

function setGuestCustomArea(name, tz) {
  try {
    if (name) localStorage.setItem(KEY_CUSTOM_AREA_NAME, String(name));
    if (tz) localStorage.setItem(KEY_CUSTOM_AREA_TZ, String(tz));
  } catch (e) { }
}

function getProvinceCodeFromKey(cityKey) {
  const key = String(cityKey || "").trim();
  if (!key) return "";
  const primary = CC_CITY_PRIMARY.find((c) => c.key === key);
  const label = (primary && primary.label) || CC_CITY_LABELS[key] || "";
  const match = label.match(/,\s*([A-Za-z]{2})$/);
  return match ? match[1].toUpperCase() : "";
}

function resolveCityKeyFromLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return "";
  const normalized = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ");

  for (const city of CC_CITY_PRIMARY) {
    const lbl = String(city.label || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s*,\s*/g, ", ");
    if (lbl && lbl === normalized) return city.key;
  }
  for (const [k, v] of Object.entries(CC_CITY_LABELS || {})) {
    const lbl = String(v || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s*,\s*/g, ", ");
    if (lbl && lbl === normalized) return k;
  }
  const dictKeys = Object.keys(I18N_DICT.ja || {}).filter((k) => k.startsWith("cities."));
  for (const k of dictKeys) {
    const val = String((I18N_DICT.ja || {})[k] || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s*,\s*/g, ", ");
    if (val && val === normalized) return k.replace(/^cities\./, "");
  }
  for (const k of Object.keys(I18N_DICT.en || {}).filter((k) => k.startsWith("cities."))) {
    const val = String((I18N_DICT.en || {})[k] || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s*,\s*/g, ", ");
    if (val && val === normalized) return k.replace(/^cities\./, "");
  }
  for (const k of Object.keys(I18N_DICT.fr || {}).filter((k) => k.startsWith("cities."))) {
    const val = String((I18N_DICT.fr || {})[k] || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s*,\s*/g, ", ");
    if (val && val === normalized) return k.replace(/^cities\./, "");
  }
  return "";
}

function getDisplayAreaName(key) {
  const normalized = normalizeAreaKey(key) || key || "canada_all";
  if (normalized === "other_custom") {
    const custom = getStoredCustomAreaName();
    return custom || t("cities.other_custom");
  }
  const province = getProvinceCodeFromKey(normalized);
  const i18nLabel = i18nCityLabel(normalized, province);
  if (i18nLabel) return i18nLabel;
  const setting = areaSettings[normalized] || areaSettings.canada_all;
  return setting.name;
}

function getAreaTimeZone(key) {
  const normalized = normalizeAreaKey(key) || key || "canada_all";
  if (normalized === "other_custom") {
    return getStoredCustomAreaTZ() || "America/Toronto";
  }
  const setting = areaSettings[normalized] || areaSettings.canada_all;
  return setting.tz;
}

// ============================
// エリアUI同期（selectのvalueが日本語/英語/キー混在でも追従させる）
// ============================
function setAreaSelectToKey(selectEl, targetKey) {
  if (!selectEl) return false;
  const key = normalizeAreaKey(targetKey) || "canada_all";
  const setting = areaSettings[key] || areaSettings.canada_all;
  if (key === ADMIN_ALL_AREA_KEY && isAdmin()) {
    const exists = Array.from(selectEl.options || []).some((op) => String(op.value || "") === key);
    if (!exists) {
      const op = document.createElement("option");
      op.value = key;
      op.textContent = setting.name || "全カナダ＋日本";
      selectEl.insertBefore(op, selectEl.firstChild || null);
    }
  }

  for (const op of Array.from(selectEl.options || [])) {
    const opVal = (op.value ?? "").toString();
    if (opVal === key) {
      selectEl.value = opVal;
      return true;
    }
    const normVal = normalizeAreaKey(opVal);
    if (normVal && normVal === key) {
      selectEl.value = opVal;
      return true;
    }
  }

  for (const op of Array.from(selectEl.options || [])) {
    const txt = (op.textContent ?? "").toString().trim();
    if (!txt) continue;
    if (txt === setting.name || txt.includes(setting.name)) {
      selectEl.value = (op.value ?? "").toString();
      return true;
    }
  }

  for (const op of Array.from(selectEl.options || [])) {
    const opVal = (op.value ?? "").toString();
    const normVal = normalizeAreaKey(opVal);
    const txt = (op.textContent ?? "").toString().trim();
    if (opVal === "canada_all" || normVal === "canada_all" || txt === "全カナダ" || txt.includes("全カナダ")) {
      selectEl.value = opVal;
      return true;
    }
  }

  return false;
}

function looksLikeAreaSelect(sel) {
  if (sel.dataset && sel.dataset.ccAreaScope === "local") return false;
  if (sel.closest && sel.closest("[data-cc-area-group]")) return false;
  const opts = Array.from(sel.options || []);
  for (const op of opts) {
    const v = normalizeAreaKey(op.value || "");
    const t = normalizeAreaKey(op.textContent || "");
    if (v || t) return true;
  }
  return false;
}

function syncAllAreaSelects(targetKey) {
  const key = normalizeAreaKey(targetKey) || "canada_all";

  const candidates = [
    "area-select",
    "header-area-select",
    "filter-area",
    "filter-area-select",
    "search-area",
    "search-area-select"
  ];

  candidates.forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.tagName === "SELECT") setAreaSelectToKey(el, key);
  });

  const selects = Array.from(document.querySelectorAll("select"));
  selects.forEach((sel) => {
    if (sel.id && candidates.includes(sel.id)) return;
    if (sel.id && sel.id.startsWith("default-city")) return;
    if (looksLikeAreaSelect(sel)) setAreaSelectToKey(sel, key);
  });
}

function attachAreaSelectListeners() {
  const candidates = [
    "area-select",
    "header-area-select",
    "filter-area",
    "filter-area-select",
    "search-area",
    "search-area-select"
  ];

  const seen = new Set();

  candidates.forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.tagName === "SELECT") seen.add(el);
  });

  Array.from(document.querySelectorAll("select")).forEach((sel) => {
    if (sel.id && sel.id.startsWith("default-city")) return;
    if (looksLikeAreaSelect(sel)) seen.add(sel);
  });

  seen.forEach((sel) => {
    if (sel.dataset.ccAreaHooked === "1") return;
    sel.dataset.ccAreaHooked = "1";
    sel.addEventListener("change", (e) => changeArea(e.target.value));
  });

  attachAreaHierarchyHandlers();
  attachTimeZoneHandlers();
  attachSignupCityHandlers();
  initLocalAreaGroups();
  initPostForm();
}

function initLocalAreaGroups() {
  const groups = Array.from(document.querySelectorAll("[data-cc-area-group]"));
  if (!groups.length) return;

  groups.forEach((group) => {
    const primary = group.querySelector("[data-cc-area-role='primary']");
    const sub = group.querySelector("[data-cc-area-role='sub']");
    const custom = group.querySelector("[data-cc-area-role='custom']");
    if (!primary) return;

    const scope = primary.getAttribute("data-cc-area-scope") || "";
    const isLocalScope = scope === "local";
    const defaultKey = getAccountDefaultAreaKey() || getGuestAreaKey() || "";
    const normalized = normalizeAreaKey(defaultKey) || defaultKey || "";
    const hasOption = (val) => Array.from(primary.options || []).some((opt) => String(opt.value) === String(val));

    let primaryKey = "";
    if (sub) {
      primaryKey = (normalized === "other_custom" || isMinorAreaKey(normalized)) ? "other" : normalized;
      primary.value = primaryKey;
    } else if (normalized && (!isLocalScope || normalized !== "canada_all") && hasOption(normalized)) {
      primaryKey = normalized;
      primary.value = normalized;
    }

    if (sub) {
      const subValue = (normalized === "other_custom") ? "other_custom" : (isMinorAreaKey(normalized) ? normalized : "");
      if (subValue) sub.value = subValue;
      else sub.selectedIndex = 0;
      const showSub = primaryKey === "other";
      const subWrap = sub.closest(".cc-select") || sub.closest(".select-box") || sub.parentElement;
      if (subWrap) subWrap.hidden = !showSub;
      sub.disabled = !showSub;
    }

    if (custom) {
      const showCustom = primaryKey === "other" && sub && sub.value === "other_custom";
      custom.hidden = !showCustom;
      if (showCustom) custom.value = getStoredCustomAreaName();
    }

    const handleChange = () => {
      if (!sub && !custom) return;
      const isOther = primary.value === "other";
      if (sub) {
        const subWrap = sub.closest(".cc-select") || sub.closest(".select-box") || sub.parentElement;
        if (subWrap) subWrap.hidden = !isOther;
        sub.disabled = !isOther;
      }
      if (!isOther) {
        if (sub) sub.value = "";
        if (custom) {
          custom.value = "";
          custom.hidden = true;
        }
        return;
      }
      if (sub && sub.value === "other_custom") {
        if (custom) custom.hidden = false;
      } else if (custom) {
        custom.hidden = true;
      }
    };

    primary.addEventListener("change", handleChange);
    if (sub) sub.addEventListener("change", handleChange);
    if (custom) custom.addEventListener("blur", handleChange);
  });
}

function applyPostDefaultCity(force) {
  const select = document.getElementById("post-area-select");
  if (!select) return;
  const cityValue = resolvePostDefaultCityValue(select);
  if (!force && select.value) return;
  select.value = cityValue;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  if (select.buildMenu) select.buildMenu();
  if (typeof window.updateSelectPlaceholder === "function") {
    window.updateSelectPlaceholder(select);
  }
  // console.log("[post default city]", savedCity, select.value);
}

function resolvePostDefaultCityValue(selectEl) {
  if (!selectEl) return "";
  const keyRaw = localStorage.getItem("mock_default_city") || "";
  const key = normalizeAreaKey(keyRaw) || keyRaw;
  if (key === "canada_all") return "";

  const options = Array.from(selectEl.querySelectorAll("option"));
  const hasKey = key && options.some((opt) => String(opt.value) === String(key));
  if (hasKey) return key;

  const nameRaw = localStorage.getItem("mock_default_city_name") || "";
  const name = String(nameRaw || "").trim();
  if (name) {
    const exact = options.find((opt) => String(opt.textContent || "").trim() === name);
    if (exact && exact.value) return exact.value;
    const loose = options.find((opt) => String(opt.textContent || "").trim().includes(name));
    if (loose && loose.value) return loose.value;
  }

  if (!key) return "";
  return "";
}

function initPostForm() {
  const DRAFT_KEY = "cc_post_draft_v1";
  const input = document.getElementById("post-images");
  const note = document.getElementById("post-image-note");
  const list = document.getElementById("post-image-list");
  const countEl = document.getElementById("post-image-count");
  const resetBtn = document.getElementById("post-image-reset");
  const clearBtns = document.querySelectorAll("[data-post-clear]");
  const cancelLinks = document.querySelectorAll("[data-post-cancel]");
  const clearBtn = document.getElementById("post-clear-btn");
  const catSelect = document.getElementById("post-category");
  const subSelect = document.getElementById("post-subcategory");
  const freeCheck = document.getElementById("post-free");
  const priceInput = document.getElementById("post-price");
  const priceInt = document.getElementById("post-price-int");
  const priceDec = document.getElementById("post-price-dec");
  const currencySelect = document.getElementById("post-currency");
  const eventBlock = document.getElementById("post-event-fields");
  const eventDate = document.getElementById("event-date");
  const eventStart = document.getElementById("event-start");
  const eventPlace = document.getElementById("event-place");
  const eventEndDate = document.getElementById("event-end-date");
  const eventEnd = document.getElementById("event-end");
  const eventDurationWarning = document.getElementById("event-duration-warning");
  const imageUrls = [];
  let imageFiles = [];
  let pendingImageOrder = [];
  const form = document.getElementById("post-form");
  if (form) form.noValidate = true;
  const statusEl = document.getElementById("post-save-status");
  const errorBox = document.getElementById("post-errors");
  const previewBtn = document.getElementById("post-preview-btn");
  const previewWrap = document.getElementById("post-preview");
  const previewCard = document.getElementById("post-preview-card");
  const previewModal = document.getElementById("post-preview-modal");
  const previewModalImage = document.getElementById("post-preview-modal-image");
  const previewModalThumbs = document.getElementById("post-preview-modal-thumbs");
  const previewModalClose = document.getElementById("post-preview-close");
  let previewIndex = 0;
  const quoteBtn = document.getElementById("post-quote-btn");
  const quoteModal = document.getElementById("post-quote-modal");
  const quoteClose = document.getElementById("post-quote-close");
  const quoteList = document.getElementById("post-quote-list");
  const modal = document.getElementById("post-confirm-modal");
  const modalClose = document.getElementById("post-modal-close");
  const modalStay = document.getElementById("post-modal-stay");
  const formTitle = document.getElementById("post-form-title");
  const submitBtn = document.getElementById("post-submit");
  const actionModalId = "post-action-confirm-modal";
  let isSubmitting = false;
  const titleLogoHtml = '<img src="logo2_transparent.png" alt="CanadaClassi" class="post-title-logo" />';
  const labelEls = {
    title: document.getElementById("post-title-label"),
    category: document.getElementById("post-category-label"),
    subcategory: document.getElementById("post-subcategory-label"),
    price: document.getElementById("post-price-label"),
    condition: document.getElementById("post-condition-label"),
    delivery: document.getElementById("post-delivery-label"),
    contact: document.getElementById("post-contact-label"),
    desc: document.getElementById("post-desc-label"),
    images: document.getElementById("post-images-label"),
    location: document.getElementById("post-location-label"),
    eventDate: document.getElementById("post-event-date-label"),
    eventStart: document.getElementById("post-event-start-label"),
    eventEndDate: document.getElementById("post-event-end-date-label"),
    eventEnd: document.getElementById("post-event-end-label"),
    eventPlace: document.getElementById("post-event-place-label"),
    eventFormat: document.getElementById("post-event-format-label"),
    eventCapacity: document.getElementById("post-event-capacity-label"),
    eventTitle: document.getElementById("post-event-title")
  };
  const defaultLabels = {
    formTitle: "クラシファイド投稿作成",
    price: "価格（任意）",
    condition: "状態（任意）",
    delivery: "受け渡し方法（任意）",
    contact: "連絡方法（任意）",
    desc: "説明",
    images: "写真（最大5枚）",
    location: "場所情報",
    eventTitle: "イベント・スクール情報",
    eventDate: "開催日",
    eventStart: "開始時間",
    eventEndDate: "終了日",
    eventEnd: "終了時間",
    eventPlace: "開催場所",
    eventFormat: "形式（任意）",
    eventCapacity: "定員（任意）"
  };
  const categoryLabels = {
    housing: {
      formTitle: "住まい投稿作成",
      price: "家賃（任意）",
      condition: "お部屋の状態（任意）",
      delivery: "内見・内覧（任意）",
      desc: "お部屋の紹介",
      location: "エリア（住まい）"
    },
    jobs: {
      formTitle: "求人投稿作成",
      price: "給料（任意）",
      condition: "雇用の形態（任意）",
      delivery: "勤務時間（任意）",
      desc: "仕事内容等",
      location: "勤務地"
    },
    sell: {
      formTitle: "売ります・譲ります投稿作成",
      price: "価格（任意）",
      condition: "商品の状態（任意）",
      delivery: "受け渡し方法（任意）",
      desc: "商品の説明",
      location: "受け渡し場所"
    },
    help: {
      formTitle: "助け合い投稿作成",
      price: "謝礼（任意）",
      condition: "お願いの状況（任意）",
      delivery: "やりとり方法（任意）",
      desc: "お願い内容",
      location: "対応エリア"
    },
    services: {
      formTitle: "サービス・講座投稿作成",
      price: "料金の目安（任意）",
      condition: "事前申し込み（任意）",
      delivery: "受け方（任意）",
      desc: "サービス内容",
      location: "提供エリア"
    },
    community: {
      formTitle: "仲間募集・交流投稿作成",
      price: "参加の目安（任意）",
      condition: "事前申し込み（任意）",
      delivery: "参加のしかた（任意）",
      desc: "募集内容",
      location: "集合エリア"
    },
    events: {
      formTitle: "イベント投稿作成",
      price: "参加費（任意）",
      condition: "事前申し込み（任意）",
      delivery: "参加のしかた（任意）",
      desc: "イベントの説明",
      eventTitle: "イベント情報",
      location: "開催エリア"
    },
    school: {
      formTitle: "スクール投稿作成",
      price: "受講料（任意）",
      condition: "事前申し込み（任意）",
      delivery: "受講のしかた（任意）",
      desc: "スクールの説明",
      eventTitle: "スクール情報",
      location: "開催エリア"
    }
  };
  const categoryPlaceholders = {
    housing: {
      title: "例：駅近シェアハウスの入居者募集",
      desc: "部屋の雰囲気・条件・入居時期など",
      price: "例：900"
    },
    jobs: {
      title: "例：カフェスタッフ募集",
      desc: "仕事内容・シフト・応募方法など",
      price: "例：18"
    },
    sell: {
      title: "例：IKEAのソファ売ります",
      desc: "サイズ・状態・受け渡し方法など",
      price: "例：50"
    },
    help: {
      title: "例：引っ越しの手伝いお願いします",
      desc: "お願いしたい内容・希望日など",
      price: "例：20"
    },
    services: {
      title: "例：英会話レッスン提供",
      desc: "内容・時間・料金など",
      price: "例：30"
    },
    community: {
      title: "例：週末ハイキング仲間募集",
      desc: "日時・集合場所・参加条件など",
      price: "例：5"
    },
    events: {
      title: "例：日系コミュニティイベント",
      desc: "内容・日時・参加方法など",
      price: "例：10"
    },
    school: {
      title: "例：英語クラス参加者募集",
      desc: "内容・日時・受講方法など",
      price: "例：200"
    },
    default: {
      title: "例：引っ越しにつきソファ譲ります",
      desc: "内容・条件・連絡方法などを記載してください。",
      price: "例：12.50"
    }
  };
  const selectConfigs = {
    default: {
      condition: {
        placeholder: "状態を選択",
        options: [
          "新品・未使用",
          "未使用に近い",
          "目立った傷なし",
          "やや傷や汚れあり",
          "状態が悪い",
          "その他（概要に記載）"
        ]
      },
      delivery: {
        placeholder: "方法を選択",
        options: [
          "対面受け渡し",
          "配送",
          "どちらでも可",
          "その他（概要に記載）"
        ]
      },
      contact: {
        placeholder: "連絡方法を選択",
        options: [
          "チャット",
          "メール",
          "電話",
          "その他（概要に記載）"
        ]
      },
      eventFormat: {
        placeholder: "形式を選択",
        options: [
          "対面",
          "オンライン",
          "ハイブリッド",
          "その他（概要に記載）"
        ]
      }
    },
    housing: {
      condition: {
        placeholder: "お部屋の状態を選択",
        options: [
          "築浅・新しめ",
          "ふつう",
          "古め",
          "リフォーム済み",
          "その他（概要に記載）"
        ]
      },
      delivery: {
        placeholder: "内見の形を選択",
        options: [
          "現地で内見",
          "オンライン内見",
          "どちらでも",
          "その他（概要に記載）"
        ]
      }
    },
    jobs: {
      condition: {
        placeholder: "お仕事の形を選択",
        options: [
          "フルタイム",
          "パート",
          "シフト制",
          "短期",
          "その他（概要に記載）"
        ]
      },
      delivery: {
        placeholder: "勤務時間を選択",
        options: [
          "午前中心",
          "午後中心",
          "夜・深夜",
          "時間相談",
          "その他（概要に記載）"
        ]
      }
    },
    sell: {},
    help: {
      condition: {
        placeholder: "お願いの状況を選択",
        options: [
          "受付中",
          "急ぎ",
          "相談中",
          "完了予定",
          "その他（概要に記載）"
        ]
      },
      delivery: {
        placeholder: "やりとり方法を選択",
        options: [
          "対面",
          "オンライン",
          "どちらでも",
          "その他（概要に記載）"
        ]
      }
    },
    services: {
      condition: {
        placeholder: "事前申し込みの要否を選択",
        options: [
          "必要",
          "不要",
          "相談可",
          "その他（概要に記載）"
        ]
      },
      delivery: {
        placeholder: "受け方を選択",
        options: [
          "対面",
          "オンライン",
          "どちらでも",
          "その他（概要に記載）"
        ]
      }
    },
    community: {
      condition: {
        placeholder: "事前申し込みの要否を選択",
        options: [
          "必要",
          "不要",
          "相談可",
          "その他（概要に記載）"
        ]
      },
      delivery: {
        placeholder: "参加のしかたを選択",
        options: [
          "現地集合",
          "オンライン",
          "どちらでも",
          "その他（概要に記載）"
        ]
      }
    },
    events: {
      condition: {
        placeholder: "事前申し込みの要否を選択",
        options: [
          "必要",
          "不要",
          "相談可",
          "その他（概要に記載）"
        ]
      },
      delivery: {
        placeholder: "参加のしかたを選択",
        options: [
          "現地参加",
          "オンライン参加",
          "どちらでも",
          "その他（概要に記載）"
        ]
      }
    },
    school: {
      condition: {
        placeholder: "事前申し込みの要否を選択",
        options: [
          "必要",
          "不要",
          "相談可",
          "その他（概要に記載）"
        ]
      },
      delivery: {
        placeholder: "受講のしかたを選択",
        options: [
          "教室",
          "オンライン",
          "ハイブリッド",
          "その他（概要に記載）"
        ]
      }
    }
  };
  let dragIndex = null;
  let previewTimer = null;
  const editKey = new URLSearchParams(location.search).get("edit") || "";
  let editMode = false;

  function setSelectOptions(select, placeholder, options) {
    if (!select) return;
    const current = String(select.value || "");
    const valueMap = {
      new: "新品・未使用",
      like_new: "未使用に近い",
      good: "目立った傷なし",
      fair: "やや傷や汚れあり",
      poor: "状態が悪い",
      meetup: "対面受け渡し",
      delivery: "配送",
      either: "どちらでも可",
      chat: "チャット",
      email: "メール",
      phone: "電話",
      onsite: "対面",
      online: "オンライン",
      hybrid: "ハイブリッド"
    };
    select.innerHTML = "";
    const base = document.createElement("option");
    base.value = "";
    base.textContent = placeholder;
    base.disabled = true;
    base.selected = true;
    select.appendChild(base);
    options.forEach((label) => {
      const opt = document.createElement("option");
      opt.value = label;
      opt.textContent = label;
      select.appendChild(opt);
    });
    const normalized = valueMap[current] || current;
    if (normalized && options.includes(normalized)) {
      select.value = normalized;
    }
    updateSelectPlaceholder(select);
  }

  function updateSelectPlaceholder(select) {
    if (!select) return;
    const isEmpty = !select.value;
    select.classList.toggle("is-placeholder", isEmpty);
  }

  function updateAllSelectPlaceholders() {
    document.querySelectorAll("select").forEach((select) => {
      updateSelectPlaceholder(select);
    });
  }

  function applyCategoryLabels(cat) {
    const override = categoryLabels[cat] || {};
    const next = Object.assign({}, defaultLabels, override);
    const placeholders = categoryPlaceholders[cat] || categoryPlaceholders.default;
    if (labelEls.price) labelEls.price.textContent = next.price;
    if (labelEls.condition) labelEls.condition.textContent = next.condition;
    if (labelEls.delivery) labelEls.delivery.textContent = next.delivery;
    if (labelEls.contact) labelEls.contact.textContent = next.contact;
    if (labelEls.desc) labelEls.desc.textContent = next.desc;
    if (labelEls.images) labelEls.images.textContent = next.images;
    if (labelEls.location) labelEls.location.textContent = next.location;
    if (labelEls.eventTitle) labelEls.eventTitle.textContent = next.eventTitle;
    if (labelEls.eventDate) labelEls.eventDate.textContent = next.eventDate;
    if (labelEls.eventStart) labelEls.eventStart.textContent = next.eventStart;
    if (labelEls.eventEndDate) labelEls.eventEndDate.textContent = next.eventEndDate;
    if (labelEls.eventEnd) labelEls.eventEnd.textContent = next.eventEnd;
    if (labelEls.eventPlace) labelEls.eventPlace.textContent = next.eventPlace;
    if (labelEls.eventFormat) labelEls.eventFormat.textContent = next.eventFormat;
    if (labelEls.eventCapacity) labelEls.eventCapacity.textContent = next.eventCapacity;
    if (formTitle && !editMode) {
      const catLabel = ccGetCategoryLabel(cat);
      const titleText = catLabel ? `${catLabel} の投稿を作成する` : (next.formTitle || defaultLabels.formTitle);
      formTitle.innerHTML = `${titleLogoHtml}${titleText}`;
    }
    const titleInput = document.getElementById("post-title");
    const descInput = document.getElementById("post-desc");
    const priceInputEl = document.getElementById("post-price-int");
    if (titleInput && placeholders.title) titleInput.placeholder = placeholders.title;
    if (descInput && placeholders.desc) descInput.placeholder = placeholders.desc;
    if (priceInputEl && placeholders.price) priceInputEl.placeholder = placeholders.price;
    const conditionSelect = document.getElementById("post-condition");
    const deliverySelect = document.getElementById("post-delivery");
    const conditionRow = document.getElementById("post-condition-row");
    const deliveryRow = document.getElementById("post-delivery-row");
    const contactSelect = document.getElementById("post-contact");
    const formatSelect = document.getElementById("event-format");
    const cfgBase = selectConfigs.default;
    const cfg = Object.assign({}, cfgBase, selectConfigs[cat] || {});
    const hideCondition = cat === "help";
    const hideDelivery = cat === "help";
    if (conditionRow) conditionRow.style.display = hideCondition ? "none" : "";
    if (deliveryRow) deliveryRow.style.display = hideDelivery ? "none" : "";
    if (!hideCondition && cfg.condition) {
      setSelectOptions(conditionSelect, cfg.condition.placeholder, cfg.condition.options);
    } else if (conditionSelect) {
      conditionSelect.value = "";
      updateSelectPlaceholder(conditionSelect);
    }
    if (!hideDelivery && cfg.delivery) {
      setSelectOptions(deliverySelect, cfg.delivery.placeholder, cfg.delivery.options);
    } else if (deliverySelect) {
      deliverySelect.value = "";
      updateSelectPlaceholder(deliverySelect);
    }
    if (cfg.contact) setSelectOptions(contactSelect, cfg.contact.placeholder, cfg.contact.options);
    if (cfg.eventFormat) setSelectOptions(formatSelect, cfg.eventFormat.placeholder, cfg.eventFormat.options);
  }

  if (catSelect && subSelect) {
    catSelect.addEventListener("change", () => {
      updateSubCategories(catSelect.value, subSelect);
      const isEvent = catSelect.value === "events" || catSelect.value === "school";
      if (eventBlock) eventBlock.hidden = !isEvent;
      if (eventDate) eventDate.required = isEvent;
      if (eventStart) eventStart.required = isEvent;
      if (eventEndDate) eventEndDate.required = isEvent;
      if (eventEnd) eventEnd.required = isEvent;
      if (eventPlace) eventPlace.required = isEvent;
      applyCategoryLabels(catSelect.value);
      updateSelectPlaceholder(catSelect);
      updateSelectPlaceholder(subSelect);
      updateRequiredFieldState(false);
    });
  }
  if (!input) return;

  function syncPriceHidden() {
    if (!priceInput) return;
    if (freeCheck && freeCheck.checked) {
      priceInput.value = "無料";
      return;
    }
    const intVal = String(priceInt?.value || "").trim();
    const decVal = String(priceDec?.value || "").trim();
    const cur = currencySelect ? currencySelect.value : "CA$";
    if (!intVal && !decVal) {
      priceInput.value = "";
      return;
    }
    if (decVal) {
      priceInput.value = `${cur}${intVal || "0"}.${decVal}`;
      return;
    }
    priceInput.value = `${cur}${intVal || "0"}.00`;
  }

  function setPriceParts(value) {
    const raw = String(value || "").trim();
    if (!priceInt || !priceDec) return;
    if (!raw || /無料|free/i.test(raw)) {
      priceInt.value = "";
      priceDec.value = "";
      return;
    }
    let cleaned = raw;
    if (currencySelect) {
      if (cleaned.startsWith("JP¥")) {
        currencySelect.value = "JP¥";
        cleaned = cleaned.replace("JP¥", "");
      } else if (cleaned.startsWith("CA$")) {
        currencySelect.value = "CA$";
        cleaned = cleaned.replace("CA$", "");
      }
    }
    cleaned = cleaned.trim();
    const match = cleaned.split(".");
    priceInt.value = match[0] || "";
    priceDec.value = (match[1] || "").slice(0, 2);
  }

  const freeToggle = document.getElementById("post-free-toggle");
  function setFreeState(isFree, fromQuote) {
    if (!freeCheck || !priceInput) return;
    freeCheck.checked = !!isFree;
    if (freeToggle) freeToggle.setAttribute("aria-pressed", isFree ? "true" : "false");
    if (freeToggle) freeToggle.classList.toggle("is-free-active", !!isFree && !fromQuote);
    if (freeToggle && !isFree) {
      freeToggle.classList.remove("quote-free");
      freeToggle.classList.remove("quote-strong");
    }
    if (isFree) {
      priceInput.value = "無料";
      if (priceInt) priceInt.disabled = true;
      if (priceDec) priceDec.disabled = true;
      if (currencySelect) currencySelect.disabled = true;
    } else {
      if (priceInt) priceInt.disabled = false;
      if (priceDec) priceDec.disabled = false;
      if (currencySelect) currencySelect.disabled = false;
      if (priceInput.value === "無料") priceInput.value = "";
    }
  }
  function updateFreeToggleAvailability() {
    if (!freeToggle) return;
    const hasPriceInput = !!(String(priceInt?.value || "").trim() || String(priceDec?.value || "").trim());
    freeToggle.disabled = hasPriceInput;
    freeToggle.setAttribute("aria-disabled", hasPriceInput ? "true" : "false");
    if (hasPriceInput && freeCheck && freeCheck.checked) {
      setFreeState(false);
    }
  }
  if (freeToggle && freeCheck) {
    freeToggle.addEventListener("click", () => {
      freeToggle.classList.remove("quote-strong");
      freeToggle.classList.remove("quote-free");
      setFreeState(!freeCheck.checked);
      syncPriceHidden();
      schedulePreview();
      scheduleSave();
    });
  }
  if (currencySelect) {
    currencySelect.addEventListener("change", () => {
      syncPriceHidden();
      updateFreeToggleAvailability();
      schedulePreview();
      scheduleSave();
    });
  }
  if (priceInt) {
    priceInt.addEventListener("input", () => {
      priceInt.value = priceInt.value.replace(/[^0-9]/g, "");
      syncPriceHidden();
      updateFreeToggleAvailability();
    });
  }
  if (priceDec) {
    priceDec.addEventListener("input", () => {
      priceDec.value = priceDec.value.replace(/[^0-9]/g, "").slice(0, 2);
      syncPriceHidden();
      updateFreeToggleAvailability();
    });
  }

  function saveStatus(text, ok) {
    if (!statusEl) return;
    const note = "入力途中に画面を移動しても直前に入力した情報は保存されます。ただし、添付した写真情報は保存されません。";
    statusEl.textContent = `${text}：${note}`;
    statusEl.style.color = ok ? "#2a6b43" : "#666";
  }

  function openPostActionModal({ title, message, confirmText, cancelText, onConfirm }) {
    openGlobalConfirmModal({
      id: actionModalId,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm
    });
  }

  function updateRequiredFieldState(markEmpty) {
    if (!form) return;
    const fields = form.querySelectorAll("input[required], textarea[required], select[required]");
    fields.forEach((field) => {
      const value = String(field.value || "").trim();
      const isEmpty = !value;
      const wrap = field.closest(".cc-select") || field.closest(".select-box");
      const label = form.querySelector(`label[for="${field.id}"]`);
      if (label) label.classList.toggle("is-required", true);
      if (!markEmpty) {
        field.classList.remove("is-required-empty");
        if (wrap) wrap.classList.remove("is-required-empty");
        return;
      }
      if (field.disabled) {
        field.classList.remove("is-required-empty");
        if (wrap) wrap.classList.remove("is-required-empty");
        return;
      }
      field.classList.toggle("is-required-empty", isEmpty);
      if (wrap) wrap.classList.toggle("is-required-empty", isEmpty);
    });
  }

  function schedulePreview() {
    if (!previewCard) return;
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 200);
  }

  function getFormValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function saveDraft() {
    syncPriceHidden();
    const data = {
      title: getFormValue("post-title"),
      category: getFormValue("post-category"),
      subcategory: getFormValue("post-subcategory"),
      price: getFormValue("post-price"),
      currency: currencySelect ? currencySelect.value : "CA$",
      price_free: !!(freeCheck && freeCheck.checked),
      condition: getFormValue("post-condition"),
      delivery: getFormValue("post-delivery"),
      contact: getFormValue("post-contact"),
      desc: getFormValue("post-desc"),
      event_date: getFormValue("event-date"),
      event_start: getFormValue("event-start"),
      event_end_date: getFormValue("event-end-date"),
      event_end: getFormValue("event-end"),
      event_place: getFormValue("event-place"),
      event_format: getFormValue("event-format"),
      event_capacity: getFormValue("event-capacity"),
      address: getFormValue("post-address"),
      lat: getFormValue("post-lat"),
      lng: getFormValue("post-lng"),
      image_order: imageFiles.map((item) => item.name || item.file?.name || "")
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      saveStatus("保存済み", true);
    } catch (e) {
      saveStatus("保存に失敗しました", false);
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;

      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el && v !== undefined && v !== null) el.value = v;
      };

      set("post-title", data.title);
      if (catSelect && data.category) {
        catSelect.value = data.category;
        if (subSelect) updateSubCategories(catSelect.value, subSelect);
      }
      set("post-subcategory", data.subcategory);
      set("post-price", data.price);
      setPriceParts(data.price);
      if (currencySelect && data.currency) currencySelect.value = data.currency;
      if (freeCheck) {
        setFreeState(!!data.price_free);
      }
      updateFreeToggleAvailability();
      set("post-condition", data.condition);
      set("post-delivery", data.delivery);
      set("post-contact", data.contact);
      set("post-desc", data.desc);
      set("event-date", data.event_date);
      set("event-start", data.event_start);
      set("event-end-date", data.event_end_date);
      set("event-end", data.event_end);
      set("event-place", data.event_place);
      set("event-format", data.event_format);
      set("event-capacity", data.event_capacity);
      set("post-address", data.address);
      set("post-lat", data.lat);
      set("post-lng", data.lng);
      pendingImageOrder = Array.isArray(data.image_order) ? data.image_order.slice() : [];

      const primary = document.querySelector('[data-cc-area-group] [data-cc-area-role="primary"]');
      updateSelectPlaceholder(primary);

      if (catSelect && eventBlock) {
        const isEvent = catSelect.value === "events" || catSelect.value === "school";
        eventBlock.hidden = !isEvent;
        if (eventDate) eventDate.required = isEvent;
        if (eventStart) eventStart.required = isEvent;
        if (eventEndDate) eventEndDate.required = isEvent;
        if (eventEnd) eventEnd.required = isEvent;
        if (eventPlace) eventPlace.required = isEvent;
      }
      if (catSelect) applyCategoryLabels(catSelect.value);

      syncEventDateConstraints();
      validateEventDurationLimit();
      saveStatus("復元しました", true);
      schedulePreview();
    } catch (e) { }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) { }
  }

  let saveTimer = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 500);
  }

  if (form) {
    form.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const field = target.closest("input, textarea, select");
      if (!field) return;
      if (field.id) clearFieldError(field.id);
      if (field.id === "event-date" || field.id === "event-start") {
        clearFieldError("event-start-datetime");
      }
      if (field.id === "event-end-date" || field.id === "event-end") {
        clearFieldError("event-end-datetime");
        clearFieldError("event-datetime");
      }
      if (field.id === "post-category") {
        clearFieldError("post-category");
        clearFieldError("post-subcategory");
      }
      if (field.id === "post-subcategory") {
        clearFieldError("post-subcategory");
      }
      if (field.matches('[data-cc-area-role="primary"]')) {
        clearFieldError("post-area");
      }
      if (field.id === "post-price-int" || field.id === "post-price-dec" || field.id === "post-price" || field.id === "post-currency") {
        clearFieldError("post-price");
      }
    });
    form.addEventListener("input", () => {
      scheduleSave();
      schedulePreview();
      validateEventDurationLimit();
      updateRequiredFieldState(false);
    });
    form.addEventListener("change", () => {
      scheduleSave();
      schedulePreview();
      updateSelectPlaceholder(document.getElementById("post-condition"));
      updateSelectPlaceholder(document.getElementById("post-delivery"));
      updateSelectPlaceholder(document.getElementById("post-contact"));
      updateSelectPlaceholder(document.getElementById("event-format"));
      updateSelectPlaceholder(document.getElementById("post-category"));
      updateSelectPlaceholder(document.getElementById("post-subcategory"));
      updateDateTimePlaceholders();
      updateAllSelectPlaceholders();
      updateRequiredFieldState(false);
    });
  }

  loadDraft();
  applyPostDefaultCity(false);
  if (catSelect) applyCategoryLabels(catSelect.value);
  if (catSelect) updateSelectPlaceholder(catSelect);
  if (subSelect) updateSelectPlaceholder(subSelect);
  if (document.getElementById("post-condition")) updateSelectPlaceholder(document.getElementById("post-condition"));
  if (document.getElementById("post-delivery")) updateSelectPlaceholder(document.getElementById("post-delivery"));
  if (document.getElementById("post-contact")) updateSelectPlaceholder(document.getElementById("post-contact"));
  if (document.getElementById("event-format")) updateSelectPlaceholder(document.getElementById("event-format"));
  updateDateTimePlaceholders();
  updateAllSelectPlaceholders();
  syncEventDateConstraints();
  updateFreeToggleAvailability();
  validateEventDurationLimit();
  updateRequiredFieldState(false);

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      input.value = "";
      if (list) list.innerHTML = "";
      imageUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
      imageFiles = [];
      if (note) {
        note.textContent = "最大5枚まで添付できます。";
        note.style.color = "";
      }
      if (countEl) countEl.textContent = "選択中: 0 / 5";
    });
  }
  if (clearBtns.length) {
    clearBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        openPostActionModal({
          title: "入力内容を消去しますか？",
          message: "現在の入力内容をすべて消去します。",
          confirmText: "消去する",
          cancelText: "キャンセル",
          onConfirm: () => {
            resetForm();
            clearDraft();
            updateDateTimePlaceholders();
            updateAllSelectPlaceholders();
            updateRequiredFieldState(false);
          }
        });
      });
    });
  }
  if (cancelLinks.length) {
    cancelLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const href = link.getAttribute("href") || "list.html";
        openPostActionModal({
          title: "ページを移動しますか？",
          message: "入力途中の内容は保存されますが、画面を移動します。",
          confirmText: "移動する",
          cancelText: "キャンセル",
          onConfirm: () => {
            window.location.href = href;
          }
        });
      });
    });
  }

  function updateDateTimePlaceholders() {
    const dateInput = document.getElementById("event-date");
    const startInput = document.getElementById("event-start");
    const endDateInput = document.getElementById("event-end-date");
    const endInput = document.getElementById("event-end");
    const apply = (el) => {
      if (!el) return;
      const wrap = el.closest(".input-placeholder");
      if (!wrap) return;
      const isEmpty = !String(el.value || "").trim();
      wrap.classList.toggle("is-empty", isEmpty);
    };
    apply(dateInput);
    apply(startInput);
    apply(endDateInput);
    apply(endInput);
  }

  function getTodayIsoDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().split("T")[0];
  }

  function syncEventDateConstraints() {
    const today = getTodayIsoDate();
    if (eventDate) eventDate.min = today;
    if (eventEndDate) {
      const startVal = eventDate && eventDate.value ? eventDate.value : "";
      const minBase = startVal && startVal > today ? startVal : today;
      eventEndDate.min = minBase;
      if (eventEndDate.value && eventEndDate.value < minBase) {
        eventEndDate.value = minBase;
      }
    }
  }

  function getEventDateTimeValue(dateVal, timeVal) {
    if (!dateVal || !timeVal) return null;
    const dt = new Date(`${dateVal}T${timeVal}`);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  function clearAllFieldErrors() {
    if (!form) return;
    form.querySelectorAll(".field-error").forEach((el) => el.remove());
  }

  function clearFieldError(key) {
    if (!form || !key) return;
    form.querySelectorAll(`.field-error[data-field-error-for="${key}"]`).forEach((el) => el.remove());
  }

  function showFieldError(target, message, key) {
    if (!target || !message) return;
    if (key === "event-datetime") {
      if (key) clearFieldError(key);
      const row = document.getElementById("event-end-date")?.closest(".form-row-split");
      if (row) {
        const err = document.createElement("div");
        err.className = "field-error field-error--wrap field-error-span";
        err.dataset.fieldErrorFor = key;
        err.textContent = message;
        row.appendChild(err);
        return;
      }
    }
    const anchor = target.closest(".input-placeholder")
      || target.closest(".cc-select")
      || target.closest(".select-box")
      || target.closest(".input-currency")
      || target.closest(".form-row")
      || target;
    if (!anchor) return;
    if (key) clearFieldError(key);
    const err = document.createElement("div");
    err.className = "field-error";
    if (key === "event-datetime") err.classList.add("field-error--wrap");
    if (key) err.dataset.fieldErrorFor = key;
    err.textContent = message;
    if (anchor.classList.contains("input-placeholder")) {
      err.classList.add("field-error-inline");
      anchor.appendChild(err);
    } else {
      anchor.insertAdjacentElement("afterend", err);
    }
  }

  function setEventDateTimeError(show) {
    const endTarget = eventEnd || eventEndDate;
    const key = "event-datetime";
    if (show) {
      showFieldError(
        endTarget,
        "日付の指定に誤りがあります。開始日時は終了日時より前に設定してください。",
        key
      );
      return;
    }
    clearFieldError(key);
  }

  function validateEventDateTimeConsistency() {
    const startDate = eventDate ? eventDate.value : "";
    const endDate = eventEndDate ? eventEndDate.value : "";
    const startTime = eventStart ? eventStart.value : "";
    const endTime = eventEnd ? eventEnd.value : "";
    const startDt = getEventDateTimeValue(startDate, startTime);
    const endDt = getEventDateTimeValue(endDate || startDate, endTime);
    if (!startDt || !endDt) {
      setEventDateTimeError(false);
      return true;
    }
    const ok = startDt.getTime() <= endDt.getTime();
    setEventDateTimeError(!ok);
    updateRequiredFieldState(false);
    return ok;
  }

  function setEventDurationWarning(show) {
    if (!eventDurationWarning) return;
    eventDurationWarning.hidden = !show;
  }

  function validateEventDurationLimit() {
    const startDate = eventDate ? eventDate.value : "";
    const endDate = eventEndDate ? eventEndDate.value : "";
    const startTime = eventStart ? eventStart.value : "";
    const endTime = eventEnd ? eventEnd.value : "";
    if (!startDate && !endDate && !startTime && !endTime) {
      setEventDurationWarning(false);
      return true;
    }
    const startDt = getEventDateTimeValue(startDate, startTime);
    const endDt = getEventDateTimeValue(endDate || startDate, endTime);
    if (!startDt || !endDt) {
      setEventDurationWarning(false);
      return true;
    }
    const diffMs = endDt.getTime() - startDt.getTime();
    const over = diffMs <= 0 ? false : diffMs > 24 * 60 * 60 * 1000;
    setEventDurationWarning(over);
    return !over;
  }

  if (eventDate) {
    const onEventDateChange = () => {
      if (eventEndDate) {
        eventEndDate.value = eventDate.value ? eventDate.value : "";
      }
      syncEventDateConstraints();
      updateDateTimePlaceholders();
      scheduleSave();
      schedulePreview();
      updateRequiredFieldState(false);
      validateEventDateTimeConsistency();
      validateEventDurationLimit();
    };
    eventDate.addEventListener("change", onEventDateChange);
    eventDate.addEventListener("input", onEventDateChange);
  }
  if (eventEndDate) {
    const onEndDateChange = () => {
      syncEventDateConstraints();
      updateDateTimePlaceholders();
      scheduleSave();
      schedulePreview();
      updateRequiredFieldState(false);
      validateEventDateTimeConsistency();
      validateEventDurationLimit();
    };
    eventEndDate.addEventListener("change", onEndDateChange);
    eventEndDate.addEventListener("input", onEndDateChange);
  }
  if (eventStart) {
    const onStartTimeChange = () => {
      updateDateTimePlaceholders();
      scheduleSave();
      schedulePreview();
      validateEventDateTimeConsistency();
      validateEventDurationLimit();
    };
    eventStart.addEventListener("change", onStartTimeChange);
    eventStart.addEventListener("input", onStartTimeChange);
  }
  if (eventEnd) {
    const onEndTimeChange = () => {
      updateDateTimePlaceholders();
      scheduleSave();
      schedulePreview();
      validateEventDateTimeConsistency();
      validateEventDurationLimit();
    };
    eventEnd.addEventListener("change", onEndTimeChange);
    eventEnd.addEventListener("input", onEndTimeChange);
  }

  function applyPostTemplate(post) {
    if (!post) return;
    clearQuoteHighlights();
    clearAllFieldErrors();
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el && v !== undefined && v !== null) el.value = v;
    };

    set("post-title", post.title);
    if (catSelect) {
      catSelect.value = post.cat || "";
      if (subSelect) updateSubCategories(catSelect.value, subSelect);
      applyCategoryLabels(catSelect.value);
    }
    set("post-subcategory", post.sub || post.subcategory || "");
    const sanitizedPrice = sanitizePriceForInput(post.price);
    set("post-price", sanitizedPrice);
    setPriceParts(sanitizedPrice);
    if (freeCheck) {
      const isFree = /無料|free/i.test(String(sanitizedPrice || ""));
      setFreeState(isFree, true);
    }
    set("post-desc", post.desc || post.description);
    set("post-condition", post.condition);
    set("post-delivery", post.delivery);
    set("post-contact", post.contact);
    set("event-date", post.event_date);
    set("event-start", post.event_start);
    set("event-end-date", post.event_end_date);
    set("event-end", post.event_end);
    set("event-place", post.place);
    set("event-format", post.format);
    set("event-capacity", post.capacity);
    set("post-address", post.address);

    if (catSelect && eventBlock) {
      const isEvent = catSelect.value === "events" || catSelect.value === "school";
      eventBlock.hidden = !isEvent;
      if (eventDate) eventDate.required = isEvent;
      if (eventStart) eventStart.required = isEvent;
      if (eventEndDate) eventEndDate.required = isEvent;
      if (eventEnd) eventEnd.required = isEvent;
      if (eventPlace) eventPlace.required = isEvent;
    }
    updateSelectPlaceholder(document.getElementById("post-category"));
    updateSelectPlaceholder(document.getElementById("post-subcategory"));
    updateSelectPlaceholder(document.getElementById("post-condition"));
    updateSelectPlaceholder(document.getElementById("post-delivery"));
    updateSelectPlaceholder(document.getElementById("post-contact"));
    updateSelectPlaceholder(document.getElementById("event-format"));
    updateDateTimePlaceholders();

    const primary = document.querySelector('[data-cc-area-group] [data-cc-area-role="primary"]');
    if (primary && post.city) {
      const exists = Array.from(primary.options || []).some((opt) => String(opt.value) === String(post.city));
      if (exists) primary.value = post.city;
    }
    updateSelectPlaceholder(primary);

    imageFiles = (post.images || []).map((url, idx) => ({
      file: null,
      url: url,
      name: "saved_" + idx
    }));
    renderImageList();
    syncEventDateConstraints();
    validateEventDurationLimit();
    updateFreeToggleAvailability();
    applyQuoteHighlights(post);
    schedulePreview();
    scheduleSave();
    updateRequiredFieldState(false);
  }

  function clearQuoteHighlights() {
    document.querySelectorAll(".quote-highlight, .quote-warning").forEach((el) => {
      el.classList.remove("quote-highlight");
      el.classList.remove("quote-warning");
    });
    document.querySelectorAll(".quote-strong").forEach((el) => {
      el.classList.remove("quote-strong");
    });
    document.querySelectorAll(".quote-free").forEach((el) => {
      el.classList.remove("quote-free");
    });
    const warn = document.getElementById("event-date-warning");
    if (warn) warn.hidden = true;
  }

  function applyQuoteHighlights(post) {
    if (!post) return;
    const highlightField = (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add("quote-highlight");
      const wrap = el.closest(".cc-select") || el.closest(".select-box");
      if (wrap) wrap.classList.add("quote-highlight");
    };
    const hasText = (value) => String(value || "").trim() !== "";

    if (hasText(post.title)) highlightField("post-title");
    if (hasText(post.cat)) highlightField("post-category");
    if (hasText(post.sub || post.subcategory)) highlightField("post-subcategory");
    if (hasText(post.desc || post.description)) highlightField("post-desc");
    if (hasText(post.condition)) highlightField("post-condition");
    if (hasText(post.delivery)) highlightField("post-delivery");
    if (hasText(post.contact)) highlightField("post-contact");
    if (hasText(post.event_date)) highlightField("event-date");
    if (hasText(post.event_start)) highlightField("event-start");
    if (hasText(post.event_end_date)) highlightField("event-end-date");
    if (hasText(post.event_end)) highlightField("event-end");
    if (hasText(post.place)) highlightField("event-place");
    if (hasText(post.format)) highlightField("event-format");
    if (hasText(post.capacity)) highlightField("event-capacity");
    if (hasText(post.address)) highlightField("post-address");
    if (hasText(post.lat)) highlightField("post-lat");
    if (hasText(post.lng)) highlightField("post-lng");

    if (hasText(post.price)) {
      const isFree = /無料|free/i.test(String(post.price || ""));
      if (isFree) {
        const freeToggleEl = document.getElementById("post-free-toggle");
        if (freeToggleEl) {
          freeToggleEl.classList.add("quote-strong");
          freeToggleEl.classList.add("quote-free");
        }
      } else {
        highlightField("post-currency");
        highlightField("post-price-int");
        highlightField("post-price-dec");
      }
    }

    if (hasText(post.city) || hasText(post.area)) {
      const areaPrimary = document.querySelector('[data-cc-area-group] [data-cc-area-role="primary"]');
      if (areaPrimary) {
        areaPrimary.classList.add("quote-highlight");
        const wrap = areaPrimary.closest(".cc-select") || areaPrimary.closest(".select-box");
        if (wrap) wrap.classList.add("quote-highlight");
      }
    }

    const imageList = document.getElementById("post-image-list");
    const images = Array.isArray(post.images) ? post.images.filter(Boolean) : [];
    if (imageList && images.length) imageList.classList.add("quote-highlight");

    const today = getTodayIsoDate();
    const eventDateValue = String(post.event_date || "").trim();
    const eventEndDateValue = String(post.event_end_date || "").trim();
    const hasPastEventDate = (eventDateValue && eventDateValue < today)
      || (eventEndDateValue && eventEndDateValue < today);
    if (hasPastEventDate) {
      const warn = document.getElementById("event-date-warning");
      if (warn) warn.hidden = false;
      ["event-date", "event-end-date"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove("quote-highlight");
        el.classList.add("quote-warning");
      });
    }
  }

  function setPostModalLock(isLocked) {
    const root = document.documentElement;
    if (isLocked) {
      document.body.classList.add("modal-open");
      if (root) root.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
      if (root) root.classList.remove("modal-open");
    }
  }

  function renderQuoteList() {
    if (!quoteList) return;
    quoteList.innerHTML = "";
    const posts = ccLoadUserPosts().filter((post) => !ccIsPostDeleted(post?.key));
    if (!posts.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "引用できる投稿がまだありません。";
      quoteList.appendChild(empty);
      return;
    }
    posts.forEach((post) => {
      const item = document.createElement("div");
      item.className = "post-quote-item";
      const thumbWrap = document.createElement("div");
      thumbWrap.className = "post-quote-thumb";
      const images = Array.isArray(post.images) ? post.images.filter(Boolean) : [];
      if (!images.length) {
        thumbWrap.classList.add("is-empty");
      } else {
        const thumb = document.createElement("img");
        thumb.src = images[0];
        thumb.alt = "";
        thumbWrap.appendChild(thumb);
      }

      const content = document.createElement("div");
      content.className = "post-quote-content";
      const title = document.createElement("div");
      title.className = "post-quote-title";
      title.textContent = ccGetPostDisplayTitle(post, "無題の投稿");
      const meta = document.createElement("div");
      meta.className = "post-quote-meta";
      const catLabel = ccGetCategoryLabel(post.cat) || t("ui.categoryUnset");
      const areaLabel = post.area || getDisplayAreaName(post.city) || "場所未設定";
      const date = post.created_at ? formatDateForView(post.created_at, { withTime: false }) : "日時未設定";
      const metaItems = [
        { icon: "fa-tag", text: catLabel },
        { icon: "fa-location-dot", text: areaLabel },
        { icon: "fa-calendar-days", text: date }
      ];
      metaItems.forEach((info) => {
        const span = document.createElement("span");
        span.className = "post-quote-meta-item";
        span.innerHTML = `<i class="fa-solid ${info.icon}" aria-hidden="true"></i><span>${escapeHtml(info.text)}</span>`;
        meta.appendChild(span);
      });
      const actions = document.createElement("div");
      actions.className = "post-quote-actions";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-secondary";
      btn.textContent = "この投稿を引用";
      btn.addEventListener("click", () => {
        applyPostTemplate(post);
        if (quoteModal) quoteModal.hidden = true;
        setPostModalLock(false);
      });
      actions.appendChild(btn);
      content.appendChild(title);
      content.appendChild(meta);
      content.appendChild(actions);
      item.appendChild(thumbWrap);
      item.appendChild(content);
      quoteList.appendChild(item);
    });
  }

  if (quoteBtn && quoteModal) {
    quoteBtn.addEventListener("click", () => {
      renderQuoteList();
      quoteModal.hidden = false;
      setPostModalLock(true);
    });
  }
  if (quoteClose && quoteModal) {
    quoteClose.addEventListener("click", () => {
      quoteModal.hidden = true;
      setPostModalLock(false);
    });
  }
  if (quoteModal) {
    quoteModal.addEventListener("click", (event) => {
      if (event.target === quoteModal) {
        quoteModal.hidden = true;
        setPostModalLock(false);
      }
    });
  }

  function renderImageList() {
    if (!list) return;
    list.innerHTML = "";
    imageFiles.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "post-image-item";
      card.draggable = true;
      card.dataset.index = String(idx);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "post-image-remove";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        const removed = imageFiles.splice(idx, 1)[0];
        if (removed && removed.url) URL.revokeObjectURL(removed.url);
        renderImageList();
        schedulePreview();
      });

      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.file?.name || "preview";

      const name = document.createElement("div");
      name.className = "post-image-name";
      name.textContent = item.name || item.file?.name || "";

      card.addEventListener("dragstart", (e) => {
        dragIndex = Number(card.dataset.index);
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        dragIndex = null;
      });
      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        const targetIndex = Number(card.dataset.index);
        if (Number.isNaN(dragIndex) || Number.isNaN(targetIndex)) return;
        const moved = imageFiles.splice(dragIndex, 1)[0];
        imageFiles.splice(targetIndex, 0, moved);
        renderImageList();
        schedulePreview();
      });

      card.appendChild(removeBtn);
      card.appendChild(img);
      card.appendChild(name);
      list.appendChild(card);
    });
    if (countEl) countEl.textContent = "選択中: " + imageFiles.length + " / 5";
  }

  function applySavedOrder(files, order) {
    if (!order || !order.length) return files;
    const remaining = files.slice();
    const arranged = [];
    order.forEach((name) => {
      if (!name) return;
      const idx = remaining.findIndex((item) => (item.name || item.file?.name) === name);
      if (idx >= 0) {
        arranged.push(remaining.splice(idx, 1)[0]);
      }
    });
    return arranged.concat(remaining);
  }

  function buildFileKey(file) {
    if (!file) return "";
    return [file.name, file.size, file.lastModified].join("|");
  }

  input.addEventListener("change", () => {
    const incoming = Array.from(input.files || []);
    const existing = imageFiles.slice();
    const existingKeys = new Set(
      existing.filter((item) => item.file).map((item) => buildFileKey(item.file))
    );
    const toAdd = [];

    incoming.forEach((file) => {
      if (existing.length + toAdd.length >= 5) return;
      const key = buildFileKey(file);
      if (key && existingKeys.has(key)) return;
      if (key) existingKeys.add(key);
      const url = URL.createObjectURL(file);
      imageUrls.push(url);
      toAdd.push({ file, url, name: file.name || "" });
    });

    const nextCount = existing.length + toAdd.length;
    if (existing.length + incoming.length > 5) {
      if (note) {
        note.textContent = "写真は5枚までです。枚数を減らしてください。";
        note.style.color = "#b91c1c";
      }
    } else {
      if (note) {
        note.textContent = "最大5枚まで添付できます。";
        note.style.color = "";
      }
    }

    if (!list) return;
    imageFiles = existing.concat(toAdd);
    if (pendingImageOrder && pendingImageOrder.length) {
      imageFiles = applySavedOrder(imageFiles, pendingImageOrder);
    }
    renderImageList();
    schedulePreview();
    if (input) input.value = "";
  });

  function resetForm() {
    if (!form) return;
    form.reset();
    imageUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    imageFiles = [];
    if (list) list.innerHTML = "";
    if (countEl) countEl.textContent = "選択中: 0 / 5";
    if (note) {
      note.textContent = "最大5枚まで添付できます。";
      note.style.color = "";
    }
    if (subSelect) {
      subSelect.innerHTML = "<option value=\"\">カテゴリーを選択してください</option>";
      subSelect.disabled = true;
    }
    const conditionSelect = document.getElementById("post-condition");
    const deliverySelect = document.getElementById("post-delivery");
    const contactSelect = document.getElementById("post-contact");
    if (conditionSelect) conditionSelect.value = "";
    if (deliverySelect) deliverySelect.value = "";
    if (contactSelect) contactSelect.value = "";
    if (catSelect) {
      updateSubCategories(catSelect.value, subSelect);
    }
    applyCategoryLabels(catSelect ? catSelect.value : "");
    updateSelectPlaceholder(document.getElementById("post-condition"));
    updateSelectPlaceholder(document.getElementById("post-delivery"));
    updateSelectPlaceholder(document.getElementById("post-contact"));
    updateSelectPlaceholder(document.getElementById("event-format"));
    updateSelectPlaceholder(document.getElementById("post-category"));
    updateSelectPlaceholder(document.getElementById("post-subcategory"));
    if (eventBlock) eventBlock.hidden = true;
    if (previewCard) previewCard.innerHTML = "";
    setFreeState(false);
    syncPriceHidden();
    saveStatus("未保存", false);
    syncEventDateConstraints();
    setEventDurationWarning(false);
    clearQuoteHighlights();
    clearAllFieldErrors();
    updateFreeToggleAvailability();
    updateRequiredFieldState(false);
  }

  function validatePostForm() {
    clearAllFieldErrors();
    const errors = [];
    syncPriceHidden();
    const title = getFormValue("post-title");
    const cat = getFormValue("post-category");
    const sub = getFormValue("post-subcategory");
    const priceRaw = (freeCheck && freeCheck.checked) ? "無料" : getFormValue("post-price");
    const price = priceRaw;
    const desc = getFormValue("post-desc");
    const lat = getFormValue("post-lat");
    const lng = getFormValue("post-lng");
    const primary = (document.querySelector('[data-cc-area-group] [data-cc-area-role="primary"]') || {}).value || "";
    const endDate = getFormValue("event-end-date");
    const startTime = getFormValue("event-start");
    const endTime = getFormValue("event-end");

    if (!title) {
      showFieldError(document.getElementById("post-title"), "タイトルを入力してください。", "post-title");
      errors.push("title");
    }
    if (!cat) {
      showFieldError(document.getElementById("post-category"), "カテゴリーを選択してください。", "post-category");
      errors.push("category");
    }
    if (cat && subSelect && !sub) {
      showFieldError(document.getElementById("post-subcategory"), "ジャンル（詳細）を選択してください。", "post-subcategory");
      errors.push("subcategory");
    }
    if (!desc) {
      showFieldError(document.getElementById("post-desc"), "説明を入力してください。", "post-desc");
      errors.push("desc");
    }

    if (cat === "events" || cat === "school") {
      const evDate = getFormValue("event-date");
      const evStart = getFormValue("event-start");
      const evEndDate = getFormValue("event-end-date");
      const evEnd = getFormValue("event-end");
      const evPlace = getFormValue("event-place");
      if (!evDate || !evStart) {
        showFieldError(document.getElementById("event-date"), "開催日時を入力してください。", "event-start-datetime");
        errors.push("event-start-datetime");
      }
      if (!evEndDate || !evEnd) {
        showFieldError(document.getElementById("event-end-date"), "終了日時を入力してください。", "event-end-datetime");
        errors.push("event-end-datetime");
      }
      if (!evPlace) {
        showFieldError(document.getElementById("event-place"), "開催場所を入力してください。", "event-place");
        errors.push("event-place");
      }
      if (endDate && evDate && endDate < evDate) {
        showFieldError(document.getElementById("event-end-date"), "終了日は開始日以降を選択してください。", "event-end-date");
        errors.push("event-end-date");
      }
      if (evDate && evStart && (evEndDate || endDate) && evEnd) {
        const startDt = getEventDateTimeValue(evDate, evStart);
        const endDt = getEventDateTimeValue((evEndDate || endDate || evDate), evEnd);
        if (startDt && endDt && startDt.getTime() > endDt.getTime()) {
          showFieldError(
            document.getElementById("event-end"),
            "日付の指定に誤りがあります。開始日時は終了日時より前に設定してください。",
            "event-datetime"
          );
          errors.push("event-datetime");
        }
      }
      if (!validateEventDurationLimit()) {
        errors.push("event-duration");
      }
    }

    if (!primary) {
      const areaGroup = document.querySelector("[data-cc-area-group]");
      showFieldError(areaGroup || document.getElementById("post-location-label"), "主要エリアを選択してください。", "post-area");
      errors.push("area");
    }

    if (price && !(freeCheck && freeCheck.checked)) {
      const s = String(price || "").trim();
      const normalized = s
        .replace(/^ca\$/i, "")
        .replace(/^jp¥/i, "")
        .replace(/^[\$¥]/, "")
        .trim();
      const ok = /free|無料/i.test(s) || /^\d+(\.\d+)?$/.test(normalized);
      if (!ok) {
        const priceWrap = document.querySelector(".price-split");
        showFieldError(priceWrap || document.getElementById("post-price-int"), "価格は数値、または Free/無料 の形式で入力してください。", "post-price");
        errors.push("price");
      }
    }

    if (imageFiles.length > 5) {
      showFieldError(document.getElementById("post-images") || document.getElementById("post-image-list"), "写真は5枚までです。", "post-images");
      errors.push("images");
    }

    if (lat && Number.isNaN(Number(lat))) {
      showFieldError(document.getElementById("post-lat"), "緯度は数値で入力してください。", "post-lat");
      errors.push("lat");
    }
    if (lng && Number.isNaN(Number(lng))) {
      showFieldError(document.getElementById("post-lng"), "経度は数値で入力してください。", "post-lng");
      errors.push("lng");
    }

    return { ok: errors.length === 0, errors };
  }

  async function performSubmit() {
    if (isSubmitting) return;
    isSubmitting = true;
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.innerHTML = "";
    }

    const title = getFormValue("post-title");
    const cat = getFormValue("post-category");
    const sub = getFormValue("post-subcategory");
    const priceRaw = (freeCheck && freeCheck.checked) ? "無料" : getFormValue("post-price");
    const price = priceRaw;
    const areaKey = getSelectedPostAreaKey();
    const areaName = getSelectedPostAreaName();
    const now = new Date().toISOString();
    let profileName = "";
    try {
      const raw = localStorage.getItem("cc_profile_v1");
      if (raw) profileName = String(JSON.parse(raw)?.display_name || "");
    } catch (e) { }
    const authorName = profileName || getAccountName() || "まうす";
    const authorKey = getOrCreateUserKey();

    const images = await Promise.all(imageFiles.map((item) => {
      if (!item.file) return Promise.resolve(item.url || "");
      return fileToDataUrl(item.file);
    }));
    const normalizedImages = images.filter(Boolean);
    if (!normalizedImages.length) normalizedImages.push("logo5_transparent.png");

    const basePayload = {
      cat: cat,
      sub: sub,
      city: areaKey,
      area: areaName,
      title: title,
      author: authorName,
      author_name: authorName,
      author_key: authorKey,
      price: price || "",
      images: normalizedImages,
      created_at: now,
      updated_at: now,
      event_date: getFormValue("event-date"),
      event_start: getFormValue("event-start"),
      event_end_date: getFormValue("event-end-date"),
      event_end: getFormValue("event-end"),
      place: getFormValue("event-place"),
      format: getFormValue("event-format"),
      capacity: getFormValue("event-capacity"),
      condition: getFormValue("post-condition"),
      delivery: getFormValue("post-delivery"),
      contact: getFormValue("post-contact"),
      desc: getFormValue("post-desc"),
      address: getFormValue("post-address")
    };

    if (editMode && editKey) {
      const existing = ccGetPostByKey(editKey);
      const payload = Object.assign({}, existing || {}, basePayload, { key: editKey, created_at: existing?.created_at || now, updated_at: now });
      const updated = ccUpdateUserPost(editKey, payload);
      if (!updated) {
        ccAddUserPost(Object.assign({}, payload, { key: editKey }));
      }
    } else {
      const newKey = ccGeneratePostId();
      ccAddUserPost(Object.assign({}, basePayload, { key: newKey, post_id: newKey, id: newKey }));
    }

    clearDraft();
    saveStatus("クリア済み", true);
    if (modal) modal.hidden = false;
    isSubmitting = false;
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const result = validatePostForm();
      if (!result.ok) {
        if (errorBox) {
          errorBox.hidden = true;
          errorBox.innerHTML = "";
        }
        updateRequiredFieldState(true);
        requestAnimationFrame(() => {
          scrollToFirstPostWarning();
        });
        return;
      }
      openPostActionModal({
        title: editMode ? "投稿内容を更新しますか？" : "投稿内容を送信しますか？",
        message: editMode ? "この内容で更新を確定します。" : "この内容で投稿を確定します。",
        confirmText: editMode ? "更新する" : "投稿する",
        cancelText: "キャンセル",
        onConfirm: () => {
          const ngText = [
            getFormValue("post-title"),
            getFormValue("post-desc"),
            getFormValue("post-address"),
            getFormValue("event-place")
          ].join(" ");
          if (!ccCheckNgWords(ngText, "post")) return;
          performSubmit();
        }
      });
    });
  }

  function getSelectedPostAreaName() {
    const primary = document.querySelector('[data-cc-area-group] [data-cc-area-role="primary"]');
    const primaryVal = primary ? primary.value : "";
    if (!primaryVal) return "—";
    return getDisplayAreaName(primaryVal) || primaryVal;
  }

  function getSelectedPostAreaKey() {
    const primary = document.querySelector('[data-cc-area-group] [data-cc-area-role="primary"]');
    const primaryVal = primary ? primary.value : "";
    return primaryVal || "";
  }

  function scrollToFirstPostWarning() {
    if (!form) return;
    const candidates = Array.from(
      form.querySelectorAll(".field-error, .post-event-duration-warning, .post-event-warning")
    ).filter((el) => {
      if (el.hidden) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return el.getClientRects().length > 0;
    });
    if (!candidates.length) return;
    candidates.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const target = candidates[0];
    const top = target.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve) => {
      if (!file) {
        resolve("");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  function hydrateEditMode() {
    if (!editKey) return;
    const post = ccGetPostByKey(editKey);
    if (!post) return;
    editMode = true;
    if (formTitle) formTitle.innerHTML = `${titleLogoHtml}投稿を編集`;
    if (submitBtn) submitBtn.textContent = "更新する";

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el && v !== undefined && v !== null) el.value = v;
    };

    set("post-title", post.title);
    if (catSelect) {
      catSelect.value = post.cat || "";
      if (subSelect) updateSubCategories(catSelect.value, subSelect);
    }
    set("post-subcategory", post.sub);
    set("post-price", post.price);
    setPriceParts(post.price);
    if (freeCheck) {
      const isFree = /無料|free/i.test(String(post.price || ""));
      setFreeState(isFree);
    }
    updateFreeToggleAvailability();
    set("post-desc", post.desc || post.description);
    set("post-condition", post.condition);
    set("post-delivery", post.delivery);
    set("post-contact", post.contact);
    set("event-date", post.event_date);
    set("event-start", post.event_start);
    set("event-end-date", post.event_end_date);
    set("event-end", post.event_end);
    set("event-place", post.place);
    set("event-format", post.format);
    set("event-capacity", post.capacity);
    set("post-address", post.address);

    if (catSelect && eventBlock) {
      const isEvent = catSelect.value === "events" || catSelect.value === "school";
      eventBlock.hidden = !isEvent;
      if (eventDate) eventDate.required = isEvent;
      if (eventStart) eventStart.required = isEvent;
      if (eventEndDate) eventEndDate.required = isEvent;
      if (eventEnd) eventEnd.required = isEvent;
      if (eventPlace) eventPlace.required = isEvent;
    }
    if (catSelect) applyCategoryLabels(catSelect.value);

    const primary = document.querySelector('[data-cc-area-group] [data-cc-area-role="primary"]');
    if (primary && post.city) {
      const exists = Array.from(primary.options || []).some((opt) => String(opt.value) === String(post.city));
      if (exists) primary.value = post.city;
    }

    imageFiles = (post.images || []).map((url, idx) => ({
      file: null,
      url: url,
      name: "saved_" + idx
    }));
    renderImageList();
    syncEventDateConstraints();
    schedulePreview();
    updateRequiredFieldState(false);
  }

  hydrateEditMode();

  function renderPreview() {
    if (!previewCard) return;
    const getLabelText = (el, fallback) => {
      const raw = el && el.textContent ? el.textContent.trim() : fallback;
      return raw.replace(/\s*[（(]\s*任意\s*[)）]\s*/g, "").trim();
    };
    const formatPreviewPrice = (raw) => {
      const val = String(raw || "").trim();
      if (!val || val === "-" || val === "—") return "お問い合わせください。";
      if (/無料|free/i.test(val)) return "無料";
      const cur = currencySelect ? currencySelect.value : "CA$";
      const numMatch = val.match(/\d+(?:\.\d+)?/);
      if (!numMatch) return val;
      const amount = Number(numMatch[0]);
      if (!Number.isFinite(amount)) return val;
      const cat = String(catSelect?.value || "");
      const suffix = cat === "housing" ? " /month" : (cat === "jobs" ? " /hour" : "");
      return `${cur} ${amount.toFixed(2)}${suffix}`;
    };
    const title = getFormValue("post-title") || "タイトル未入力";
    syncPriceHidden();
    const priceRaw = (freeCheck && freeCheck.checked) ? "無料" : getFormValue("post-price");
    const priceDisplay = formatPreviewPrice(priceRaw);
    const desc = getFormValue("post-desc") || "説明文がまだありません。";
    const areaText = getSelectedPostAreaName();
    const catLabel = ccGetCategoryLabel(catSelect?.value) || "未選択";
    const subLabel = getFormValue("post-subcategory") || "未選択";
    const isEvent = catSelect?.value === "events" || catSelect?.value === "school";
    const evDate = getFormValue("event-date");
    const evStart = getFormValue("event-start");
    const evEndDate = getFormValue("event-end-date");
    const evEnd = getFormValue("event-end");
    const evPlace = getFormValue("event-place");
    const showEndDate = evEndDate && evDate && evEndDate !== evDate;
    const eventTimeValue = (evStart && evEnd)
      ? `${evStart}〜${showEndDate ? `翌日${evEnd}` : evEnd}`
      : (evStart || "未入力");
    const condition = getFormValue("post-condition") || "未入力";
    const delivery = getFormValue("post-delivery") || "未入力";
    const contact = getFormValue("post-contact") || "未入力";
    const address = getFormValue("post-address") || "未入力";
    const img = imageFiles.length ? imageFiles[0].url : "";
    if (previewIndex >= imageFiles.length) previewIndex = 0;
    const activeImg = imageFiles.length ? imageFiles[previewIndex].url : "";
    const today = new Date();
    const posted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const descLabel = getLabelText(labelEls.desc, "説明");
    const priceLabel = getLabelText(labelEls.price, "価格");
    const eventTitle = getLabelText(labelEls.eventTitle, "開催情報");
    const eventDateLabel = getLabelText(labelEls.eventDate, "開催日");
    const eventStartLabel = getLabelText(labelEls.eventStart, "開始時間");
    const eventEndLabel = getLabelText(labelEls.eventEnd, "終了時間");
    const eventPlaceLabel = getLabelText(labelEls.eventPlace, "開催場所");
    const eventFormatLabel = getLabelText(labelEls.eventFormat, "形式");
    const eventCapacityLabel = getLabelText(labelEls.eventCapacity, "定員");
    const eventFormatValue = getFormValue("event-format") || "未入力";
    const eventCapacityValue = getFormValue("event-capacity") || "未入力";
    const conditionLabel = getLabelText(labelEls.condition, "状態");
    const deliveryLabel = getLabelText(labelEls.delivery, "受け渡し");
    const contactLabel = getLabelText(labelEls.contact, "連絡方法");
    const locationLabel = getLabelText(labelEls.location, "場所");
    const accountName = getAccountName() || "—";
    const accountLang = "日本語・英語";
    const getProfileField = (key, fallback) => {
      try {
        const isPublic = String(localStorage.getItem(`cc_profile_${key}_public`) || "").toLowerCase();
        if (!["1", "true", "yes", "public"].includes(isPublic)) return "非公開";
        const raw = String(localStorage.getItem(`cc_profile_${key}`) || "").trim();
        if (raw) return raw;
      } catch (e) { }
      return fallback;
    };
    const profileGender = getProfileField("gender", "未入力");
    const profileCity = getProfileField("city", "未入力");
    const profileLink = accountName !== "—"
      ? ccBuildProfileLink(accountName)
      : "profile-view.html";

    previewCard.innerHTML = `
      <div class="post-preview-mobile">
        <div class="post-preview-body">
          <h3 class="detail-title">${escapeHtml(title)}</h3>
          <div class="detail-breadcrumb">クラシファイド ＞ ${escapeHtml(catLabel)} ＞ ${escapeHtml(subLabel)}（${escapeHtml(areaText)}）</div>
          <div class="detail-sub"><span class="detail-date-label">投稿日時：</span><span>${escapeHtml(posted)}</span></div>

          <div class="preview-tile">
            <div class="detail-photo-main preview-photo post-preview-gallery" aria-hidden="true">
              <button class="preview-arrow preview-prev" type="button" data-preview-action="prev" aria-label="前の写真">
                <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
              </button>
              ${activeImg ? `<img src="${activeImg}" alt="" data-preview-action="open" />` : `<div class="thumb-placeholder"></div>`}
              <button class="preview-arrow preview-next" type="button" data-preview-action="next" aria-label="次の写真">
                <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
            ${imageFiles.length ? `
              <div class="detail-photo-thumbs preview-thumbs">
                ${imageFiles.map((item, idx) => `<img src="${item.url}" alt="" data-preview-index="${idx}" class="${idx === previewIndex ? "is-active" : ""}" />`).join("")}
              </div>
            ` : ""}
          </div>

          <div class="card detail-side-block price-block preview-price preview-tile">
            <div class="section-title preview-subtitle">${escapeHtml(priceLabel)}</div>
            <div class="price">${escapeHtml(priceDisplay)}</div>
          </div>

          <div class="preview-tile preview-desc">
            <div class="preview-subtitle">${escapeHtml(descLabel)}</div>
            <div class="preview-desc-body">${escapeHtml(desc).replace(/\n/g, "<br>")}</div>
          </div>

          <div class="card detail-side-block preview-tile">
            <div class="section-title preview-subtitle">投稿者情報</div>
            <div class="seller-row">
              <div class="seller-avatar">${escapeHtml(accountName.charAt(0).toUpperCase())}</div>
              <div>
                <a class="seller-name seller-name-link" href="${escapeHtml(profileLink)}">${escapeHtml(accountName)}</a>
                <div class="seller-rating">対応言語：${escapeHtml(accountLang)}</div>
              </div>
            </div>
            <div class="preview-seller-meta">
              <div><span class="seller-meta-label">性別</span><span>${escapeHtml(profileGender)}</span></div>
              <div><span class="seller-meta-label">居住都市</span><span>${escapeHtml(profileCity)}</span></div>
            </div>
            <div class="preview-seller-actions">
              <button class="btn btn-primary" type="button" disabled>
                <i class="fa-solid fa-paper-plane btn-icon" aria-hidden="true"></i>投稿者に問い合わせ
              </button>
              <button class="btn btn-secondary" type="button" disabled>
                <i class="fa-regular fa-heart btn-icon" aria-hidden="true"></i>投稿をお気に入り
              </button>
            </div>
          </div>

          <div class="detail-info-block preview-tile">
            <div class="detail-info-title preview-subtitle">受付状況</div>
            <div class="deal-status preview-deal-status">
              <i class="fa-regular fa-circle-check deal-status-icon" aria-hidden="true"></i>
              <span class="deal-status-text">受付中</span>
            </div>
          </div>

          ${isEvent ? `
            <div class="detail-info-block preview-tile">
              <div class="detail-info-title preview-subtitle">${escapeHtml(eventTitle)}</div>
              <div class="detail-info-row"><span class="detail-info-label">${escapeHtml(eventDateLabel)}</span><span class="detail-info-value">${escapeHtml(evDate || "未入力")}</span></div>
              ${showEndDate ? `
                <div class="detail-info-row"><span class="detail-info-label">時間</span><span class="detail-info-value">${escapeHtml(eventTimeValue)}</span></div>
              ` : `
                <div class="detail-info-row"><span class="detail-info-label">${escapeHtml(eventStartLabel)}</span><span class="detail-info-value">${escapeHtml(evStart || "未入力")}</span></div>
                <div class="detail-info-row"><span class="detail-info-label">${escapeHtml(eventEndLabel)}</span><span class="detail-info-value">${escapeHtml(evEnd || "未入力")}</span></div>
              `}
              <div class="detail-info-row"><span class="detail-info-label">${escapeHtml(eventPlaceLabel)}</span><span class="detail-info-value">${escapeHtml(evPlace || "未入力")}</span></div>
              <div class="detail-info-row"><span class="detail-info-label">${escapeHtml(priceLabel)}</span><span class="detail-info-value">${escapeHtml(priceDisplay || "未入力")}</span></div>
              <div class="detail-info-row"><span class="detail-info-label">${escapeHtml(eventFormatLabel)}</span><span class="detail-info-value">${escapeHtml(eventFormatValue)}</span></div>
              <div class="detail-info-row"><span class="detail-info-label">${escapeHtml(eventCapacityLabel)}</span><span class="detail-info-value">${escapeHtml(eventCapacityValue)}</span></div>
            </div>
          ` : ""}

          <div class="detail-info-block preview-tile">
            <div class="detail-info-title preview-subtitle">条件・連絡</div>
            ${catSelect?.value !== "help" ? `<div class="detail-info-row"><span class="detail-info-label">${escapeHtml(conditionLabel)}</span><span class="detail-info-value">${escapeHtml(condition)}</span></div>` : ``}
            ${catSelect?.value !== "help" ? `<div class="detail-info-row"><span class="detail-info-label">${escapeHtml(deliveryLabel)}</span><span class="detail-info-value">${escapeHtml(delivery)}</span></div>` : ``}
            <div class="detail-info-row"><span class="detail-info-label">${escapeHtml(contactLabel)}</span><span class="detail-info-value">${escapeHtml(contact)}</span></div>
          </div>

          <div class="card detail-location preview-location preview-tile">
            <div class="section-title preview-subtitle">${escapeHtml(locationLabel)}</div>
            <div class="detail-info-row"><span class="detail-info-label">エリア</span><span class="detail-info-value">${escapeHtml(areaText)}</span></div>
            <div class="detail-info-row"><span class="detail-info-label">詳細</span><span class="detail-info-value">${escapeHtml(address)}</span></div>
          </div>

          <div class="card preview-map preview-tile">
            <div class="section-title preview-subtitle">地図</div>
            <div class="map-placeholder">Google Map（プレビュー）</div>
          </div>

        </div>
      </div>
    `;
  }

  if (previewCard) {
    previewCard.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const actionBtn = target.closest("[data-preview-action]");
      if (actionBtn && actionBtn.matches("[data-preview-action='prev']")) {
        if (imageFiles.length) {
          previewIndex = (previewIndex - 1 + imageFiles.length) % imageFiles.length;
          renderPreview();
        }
        return;
      }
      if (actionBtn && actionBtn.matches("[data-preview-action='next']")) {
        if (imageFiles.length) {
          previewIndex = (previewIndex + 1) % imageFiles.length;
          renderPreview();
        }
        return;
      }
      const thumb = target.closest("[data-preview-index]");
      if (thumb) {
        const idx = Number(thumb.getAttribute("data-preview-index"));
        if (!Number.isNaN(idx)) {
          previewIndex = idx;
          renderPreview();
        }
        return;
      }
      const openTarget = target.closest("[data-preview-action='open']");
      if (openTarget && previewModal) {
        openPreviewModal(previewIndex);
      }
    });
  }

  if (modalClose) {
    modalClose.addEventListener("click", () => {
      if (modal) modal.hidden = true;
    });
  }

  if (modalStay) {
    modalStay.addEventListener("click", () => {
      if (modal) modal.hidden = true;
      resetForm();
    });
  }

  function renderPreviewModalThumbs() {
    if (!previewModalThumbs) return;
    previewModalThumbs.innerHTML = imageFiles.map((item, idx) => (
      `<img src="${item.url}" alt="" data-modal-index="${idx}" class="${idx === previewIndex ? "is-active" : ""}" />`
    )).join("");
  }

  function openPreviewModal(idx) {
    if (!previewModal || !previewModalImage) return;
    if (!imageFiles.length) return;
    previewIndex = idx;
    previewModalImage.src = imageFiles[previewIndex].url;
    renderPreviewModalThumbs();
    previewModal.hidden = false;
  }

  if (previewModal) {
    previewModal.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target === previewModal) previewModal.hidden = true;
      const modalPrev = target.closest(".preview-prev");
      const modalNext = target.closest(".preview-next");
      if (modalPrev && imageFiles.length) {
        previewIndex = (previewIndex - 1 + imageFiles.length) % imageFiles.length;
        if (previewModalImage) previewModalImage.src = imageFiles[previewIndex].url;
        renderPreviewModalThumbs();
      }
      if (modalNext && imageFiles.length) {
        previewIndex = (previewIndex + 1) % imageFiles.length;
        if (previewModalImage) previewModalImage.src = imageFiles[previewIndex].url;
        renderPreviewModalThumbs();
      }
      const modalThumb = target.closest("[data-modal-index]");
      if (modalThumb) {
        const idx = Number(modalThumb.getAttribute("data-modal-index"));
        if (!Number.isNaN(idx)) {
          previewIndex = idx;
          if (previewModalImage) previewModalImage.src = imageFiles[previewIndex].url;
          renderPreviewModalThumbs();
        }
      }
    });
  }
  if (previewModalClose) {
    previewModalClose.addEventListener("click", () => {
      if (previewModal) previewModal.hidden = true;
    });
  }
}

function syncAreaHierarchyUI(areaKey) {
  const primary = document.getElementById("area-select");
  const sub = document.getElementById("area-select-sub");
  const custom = document.getElementById("area-select-custom");
  if (!primary) return;

  const normalized = normalizeAreaKey(areaKey) || areaKey || "canada_all";
  const primaryKey = (normalized === "other_custom" || isMinorAreaKey(normalized)) ? "other" : normalized;
  setAreaSelectToKey(primary, primaryKey);

  if (sub) {
    const showSub = primaryKey === "other";
    const wrap = sub.closest(".cc-select") || sub.closest(".select-box") || sub.parentElement;
    if (wrap) wrap.hidden = !showSub;

    if (showSub) {
      const subValue = (normalized === "other_custom") ? "other_custom" : (isMinorAreaKey(normalized) ? normalized : "");
      if (subValue) sub.value = subValue;
      else sub.selectedIndex = 0;
    }
  }

  if (custom) {
    const showCustom = primaryKey === "other" && sub && sub.value === "other_custom";
    custom.hidden = !showCustom;
    if (showCustom) custom.value = getStoredCustomAreaName();
  }
}

function syncTimeZoneSelect(areaKey) {
  const tzSelect = document.getElementById("tz-select");
  if (!tzSelect) return;

  const normalized = normalizeAreaKey(areaKey) || areaKey || "canada_all";
  tzSelect.value = getAreaTimeZone(normalized);
  tzSelect.disabled = normalized !== "other_custom";
}

function attachAreaHierarchyHandlers() {
  const primary = document.getElementById("area-select");
  const sub = document.getElementById("area-select-sub");
  const custom = document.getElementById("area-select-custom");
  if (!primary) return;

  if (!primary.dataset.ccHierarchyHooked) {
    primary.dataset.ccHierarchyHooked = "1";
    primary.addEventListener("change", () => {
      if (primary.value !== "other") {
        if (sub) sub.value = "";
        if (custom) custom.value = "";
        changeArea(primary.value);
        return;
      }
      if (sub) {
        const v = sub.value || "";
        if (v === "other_custom") {
          const name = (custom && custom.value || "").trim();
          if (name) setTempCustomArea(name, getStoredCustomAreaTZ());
          changeArea("other_custom");
          return;
        }
        if (v) {
          changeArea(v);
          return;
        }
      }
      changeArea("other");
    });
  }

  if (sub && !sub.dataset.ccHierarchyHooked) {
    sub.dataset.ccHierarchyHooked = "1";
    sub.addEventListener("change", () => {
      if (sub.value === "other_custom") {
        if (custom) custom.hidden = false;
        changeArea("other_custom");
        syncTimeZoneSelect("other_custom");
        return;
      }
      if (custom) custom.hidden = true;
      if (sub.value) {
        changeArea(sub.value);
        return;
      }
      changeArea("other");
    });
  }

  if (custom && !custom.dataset.ccHierarchyHooked) {
    custom.dataset.ccHierarchyHooked = "1";
    const onCustomChange = () => {
      const name = (custom.value || "").trim();
      if (!name) return;
      const tz = getStoredCustomAreaTZ();
      const isLoggedIn = getLoggedInFlag() || !!getUserEmail();
      if (isLoggedIn) setTempCustomArea(name, tz);
      else setGuestCustomArea(name, tz);
      changeArea("other_custom");
    };
    custom.addEventListener("change", onCustomChange);
    custom.addEventListener("blur", onCustomChange);
  }
}

function attachTimeZoneHandlers() {
  const tzSelect = document.getElementById("tz-select");
  if (!tzSelect || tzSelect.dataset.ccTzHooked === "1") return;
  tzSelect.dataset.ccTzHooked = "1";
  tzSelect.addEventListener("change", () => {
    if (currentAreaKey !== "other_custom") return;
    const tz = tzSelect.value || "America/Toronto";
    const name = getStoredCustomAreaName();
    const isLoggedIn = getLoggedInFlag() || !!getUserEmail();
    if (isLoggedIn) setTempCustomArea(name, tz);
    else setGuestCustomArea(name, tz);
    currentTimeZone = tz;
    updateClock();
    if (document.getElementById("calendar-grid")) renderCalendar();
  });
}

function attachSignupCityHandlers() {
  // この機能は廃止され、単一のカスタムドロップダウン内で処理されるようになったため、何もしない。
  return;
}

// ============================
// 言語セレクタ（状態保持）
// ============================
function normalizeLangKey(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "jp";
  if (v === "ja" || v === "jp" || v.includes("jpn")) return "jp";
  if (v === "en" || v.includes("eng")) return "en";
  if (v === "fr" || v.includes("fra") || v.includes("fre")) return "fr";
  return "jp";
}

let CC_LANG_SYNCING = false;

function isValidLang(l) {
  return l === "ja" || l === "en" || l === "fr";
}

function getStoredLang() {
  let stored = "";
  try { stored = localStorage.getItem(KEY_LANG) || ""; } catch (e) { }
  const norm = normalizeLangKey(stored || "jp");
  const lang = norm === "jp" ? "ja" : norm;
  return isValidLang(lang) ? lang : "ja";
}

function getStoredAccountLang() {
  let stored = "";
  try { stored = localStorage.getItem(KEY_ACCOUNT_LANG) || ""; } catch (e) { }
  if (!stored) return "";
  const norm = normalizeLangKey(stored);
  const lang = norm === "jp" ? "ja" : norm;
  return isValidLang(lang) ? lang : "";
}

function resolveEffectiveLang() {
  const isLoggedIn = getLoggedInFlag() || !!getUserEmail();
  if (isLoggedIn) {
    const accLang = getStoredAccountLang();
    if (isValidLang(accLang)) return accLang;
    return getStoredLang();
  }
  return getStoredLang();
}

function persistLangForSession(lang) {
  const next = isValidLang(lang) ? lang : "ja";
  const storeKey = next === "ja" ? "jp" : next;
  try { localStorage.setItem(KEY_LANG, storeKey); } catch (e) { }
}

function persistLangForAccount(lang) {
  const next = isValidLang(lang) ? lang : "ja";
  const storeKey = next === "ja" ? "jp" : next;
  try { localStorage.setItem(KEY_ACCOUNT_LANG, storeKey); } catch (e) { }
  const email = getUserEmail();
  if (email) {
    try {
      const users = getMockUsersDB();
      const idx = users.findIndex((u) => normalizeEmail(u?.email) === normalizeEmail(email));
      if (idx >= 0) {
        users[idx].lang = storeKey;
        users[idx].account_lang = storeKey;
        saveMockUsersDB(users);
      }
    } catch (e) { }
  }
  try {
    const payload = decodeWindowLoginPayload(window.name || "") || {};
    payload.lang = storeKey;
    const encoded = encodeWindowLoginPayload(payload);
    if (encoded) {
      const parts = splitWindowNameParts(window.name || "");
      const postsToken = parts.postsToken;
      window.name = WINDOW_LOGIN_PREFIX + encoded + (postsToken ? WINDOW_POSTS_SEPARATOR + postsToken : "");
    }
  } catch (e) { }
}

function syncLangUI(lang) {
  const key = normalizeLangKey(lang);
  CC_LANG_SYNCING = true;
  try {
    syncAllLangSelects(key);
    const langSelect = document.getElementById("lang-select");
    const langValue = document.querySelector('[data-cc-dd-value="lang"]');
    if (langSelect && langValue) {
      const opt = langSelect.options[langSelect.selectedIndex];
      langValue.textContent = opt ? (opt.textContent || "").trim() : langValue.textContent;
    }
    const mypageSelect = document.getElementById("mypage-lang-select");
    if (mypageSelect) setLangSelectValue(mypageSelect, key);
    const mypageValue = document.querySelector('[data-cc-dd-scope="mypage-lang"] [data-cc-dd-value="mypage-lang"]');
    if (mypageSelect && mypageValue) {
      const opt = mypageSelect.options[mypageSelect.selectedIndex];
      mypageValue.textContent = opt ? (opt.textContent || "").trim() : mypageValue.textContent;
    }
  } finally {
    CC_LANG_SYNCING = false;
  }
}

function applyLangEverywhere(lang) {
  const next = isValidLang(lang) ? lang : "ja";
  try { document.documentElement.setAttribute("lang", next); } catch (e) { }
  persistLangForSession(next);
  applyI18n();
  updateDynamicLabels();
  refreshHeaderCityLabels();
  updateLangInLinks(next);
  syncLangUI(next);
}

// ============================
// i18n boot & delayed apply (for late DOM)
// ============================
let __ccI18nBooted = false;
let __ccI18nApplying = false;
let __ccI18nDebounce = null;
let __ccI18nObserver = null;

function debouncedApplyI18n() {
  if (__ccI18nDebounce) return;
  __ccI18nDebounce = setTimeout(() => {
    __ccI18nDebounce = null;
    if (__ccI18nApplying) return;
    const lang = resolveEffectiveLang();
    __ccI18nApplying = true;
    try {
      document.documentElement.setAttribute("lang", lang);
      applyI18n();
      updateDynamicLabels();
      refreshHeaderCityLabels();
      updateLangInLinks(lang);
      syncLangUI(lang);
    } finally {
      __ccI18nApplying = false;
    }
  }, 50);
}

function shouldTriggerI18nApply(node) {
  if (!node || node.nodeType !== 1) return false;
  if (node.matches('[data-i18n], [data-i18n-placeholder], [data-i18n-aria], [data-i18n-title], [data-i18n-attr], .cc-dd-value')) return true;
  if (node.querySelector && node.querySelector('[data-i18n], [data-i18n-placeholder], [data-i18n-aria], [data-i18n-title], [data-i18n-attr], .cc-dd-value')) return true;
  return false;
}

function ccInitI18nBoot() {
  if (__ccI18nBooted) return;
  if (/admin\.html$/i.test(String(location.pathname || ""))) return;
  __ccI18nBooted = true;

  annotateI18nDefaults();
  const qs = new URLSearchParams(location.search || "");
  const param = String(qs.get("lang") || "").trim().toLowerCase();
  const baseLang = resolveEffectiveLang();
  const next = isValidLang(param) ? (param === "jp" ? "ja" : param) : baseLang;
  persistLangForSession(next);
  applyLangEverywhere(next);

  if (!__ccI18nObserver && document.body) {
    __ccI18nObserver = new MutationObserver((mutations) => {
      if (__ccI18nApplying) return;
      for (const m of mutations) {
        if (!m.addedNodes || !m.addedNodes.length) continue;
        for (const n of Array.from(m.addedNodes)) {
          if (shouldTriggerI18nApply(n)) {
            debouncedApplyI18n();
            return;
          }
        }
      }
    });
    try {
      __ccI18nObserver.observe(document.body, { childList: true, subtree: true });
    } catch (e) { }
  }
}

function setLangSelectValue(selectEl, langKey) {
  if (!selectEl) return false;
  const target = normalizeLangKey(langKey);
  for (const op of Array.from(selectEl.options || [])) {
    const ov = normalizeLangKey(op.value);
    if (ov === target) {
      selectEl.value = op.value;
      return true;
    }
  }
  // fallback: try text
  for (const op of Array.from(selectEl.options || [])) {
    const txt = (op.textContent || "").trim().toLowerCase();
    if (txt === target) {
      selectEl.value = op.value;
      return true;
    }
  }
  return false;
}

function syncAllLangSelects(langKey) {
  const target = normalizeLangKey(langKey);

  // 1) id優先
  const byId = document.getElementById("lang-select");
  if (byId && byId.tagName === "SELECT") setLangSelectValue(byId, target);

  // 2) 他にも存在する場合に備えて、選択肢が JP/EN/FR を含む select を自動検出
  const selects = Array.from(document.querySelectorAll("select"));
  selects.forEach(sel => {
    if (sel.id === "lang-select") return;
    const optsText = Array.from(sel.options || []).map(o => (o.textContent || "").trim()).join("|");
    const optsVal = Array.from(sel.options || []).map(o => (o.value || "").trim()).join("|");
    const looksLikeLang = /\bJP\b|\bEN\b|\bFR\b/i.test(optsText) || /\bjp\b|\ben\b|\bfr\b/i.test(optsVal);
    if (looksLikeLang) setLangSelectValue(sel, target);
  });

  // HTML lang 属性も合わせる（簡易）
  try {
    document.documentElement.setAttribute("lang", target === "jp" ? "ja" : target);
  } catch (e) { }
}

function initLangMenu() {
  const initialLang = resolveEffectiveLang();
  syncLangUI(initialLang);

  const selects = Array.from(document.querySelectorAll("select"));
  let prevLang = normalizeLangKey(initialLang);
  const langShort = (key) => {
    if (key === "jp") return "JP";
    if (key === "en") return "EN";
    if (key === "fr") return "FR";
    return String(key || "").toUpperCase();
  };
  selects.forEach(sel => {
    const optsText = Array.from(sel.options || []).map(o => (o.textContent || "").trim()).join("|");
    const optsVal = Array.from(sel.options || []).map(o => (o.value || "").trim()).join("|");
    const looksLikeLang = (sel.id === "lang-select") || /\bJP\b|\bEN\b|\bFR\b/i.test(optsText) || /\bjp\b|\ben\b|\bfr\b/i.test(optsVal);
    if (!looksLikeLang) return;
    if (sel.id === "mypage-lang-select" || sel.closest("#mypage-panel-settings")) return;

    sel.addEventListener("change", (e) => {
      if (CC_LANG_SYNCING) return;
      const next = normalizeLangKey(e.target.value);
      if (next === prevLang) return;
      const prevLabel = langShort(prevLang);
      const nextLabel = langShort(next);
      const msg = `現在${prevLabel}を言語設定しています。${nextLabel}へ言語を切り替えます。（ページがリフレッシュされます。）`;
      syncLangUI(prevLang);
      openGlobalConfirmModal({
        id: "cc-lang-switch-modal",
        title: "言語を切り替えますか？",
        message: msg,
        confirmText: "Yes",
        cancelText: "Cancel",
        onConfirm: () => {
          const nextLang = next === "jp" ? "ja" : next;
          persistLangForSession(nextLang);
          persistLangForAccount(nextLang);
          prevLang = normalizeLangKey(nextLang);
          setTimeout(() => {
            try { location.reload(); } catch (e2) { }
          }, 50);
        },
        onCancel: () => {
          syncLangUI(prevLang);
        }
      });
    });
  });
}

// ============================
// i18n (UI labels only)
// ============================
const I18N_DICT = {
  ja: {
    "nav.home": "ホーム",
    "nav.classified": "クラシファイド",
    "nav.schools": "学校情報",
    "nav.board": "掲示板",
    "nav.links": "外部リンク",
    "nav.guides": "お役立ち情報",
    "action.post": "投稿作成",
    "action.login": "ログイン・新規登録",
    "notice.title": "お知らせ",
    "notice.unreadOnly": "未読のみ",
    "notice.markAllRead": "すべて既読",
    "notice.viewAll": "すべて見る",
    "header.notifications": "お知らせ",
    "header.lang.ja": "日本語",
    "header.lang.en": "English",
    "header.lang.fr": "Français",
    "ui.search": "検索",
    "ui.city": "都市",
    "ui.sort": "並び替え",
    "ui.back": "戻る",
    "ui.clear": "クリア",
    "ui.searchApply": "この条件で検索",
    "ui.category": "カテゴリ",
    "ui.all": "すべて",
    "ui.hidden": "非表示",
    "ui.selectCategory": "カテゴリーを選択してください",
    "ui.selectCity": "都市を選択してください。",
    "ui.categoryUnset": "カテゴリ未設定",
    "school.title": "学校情報",
    "ui.newPosts": "新着の投稿",
    "ui.last7days": "直近7日以内の投稿を表示",
    "index_recent_posts_days": "{city} の直近{days}日以内の投稿を表示",
    "index_events_today": "今日のイベント等",
    "index_events_generic": "イベント等",
    "index_events_date": "{m}/{d}/{y}のイベント等",
    "index_events_empty": "表示するイベントは特にありません",
    "index_classifieds_title": "クラシファイド",
    "index_classifieds_desc": "住まいや仕事、出品情報など気になる投稿がないかチェックしましょう。",
    "index_post_trade_guide": "投稿・取引ガイド",
    "index_scam_warning": "詐欺などのご注意",
    "ui.searchResults": "{place} の検索結果 {n}件",
    "ui.boardCountAll": "全{n}件の相談",
    "ui.boardCountFiltered": "表示 {n}件 / 全{total}件",
    "ui.boardEmpty": "該当する相談がありません。新規作成から投稿できます。",
    "ui.boardLead": "最新の相談をまとめてチェック",
    "search.placeholder.keyword": "キーワード",
    "search.aria.school": "学校名・住所・キーワードで検索",
    "search.help.school": "学校名・住所・キーワードで検索できます",
    "sort.name_asc": "学校名 A→Z",
    "sort.name_desc": "学校名 Z→A",
    "sort.city_asc": "都市 A→Z",
    "sort.city_desc": "都市 Z→A",
    "sort.order": "表示順",
    "sort.count": "投稿数",
    "sort.recent": "最近更新",
    "ui.clearFilters": "絞り込みクリア",
    "sort.newest": "新しい順",
    "sort.oldest": "古い順",
    "sort.price_desc": "価格が高い順",
    "sort.price_asc": "価格が低い順",
    "categories.housing": "住まい",
    "categories.jobs": "求人",
    "categories.sell": "売ります・譲ります",
    "categories.help": "助け合い",
    "categories.services": "サービス・講座",
    "categories.community": "仲間募集・交流",
    "categories.events": "イベント",
    "categories.school": "スクール",
    "cities.canada_all": "全カナダ",
    "cities.other": "その他の都市",
    "cities.other_custom": "候補がありません（自由記述）",
    "cities.vancouver": "バンクーバー",
    "cities.vancouver_bc": "バンクーバー, BC",
    "cities.toronto": "トロント",
    "cities.toronto_on": "トロント, ON",
    "cities.montreal": "モントリオール",
    "cities.montreal_qc": "モントリオール, QC",
    "cities.calgary": "カルガリー",
    "cities.calgary_ab": "カルガリー, AB",
    "cities.ottawa": "オタワ",
    "cities.ottawa_on": "オタワ, ON",
    "cities.victoria": "ビクトリア",
    "cities.victoria_bc": "ビクトリア, BC",
    "cities.edmonton": "エドモントン",
    "cities.edmonton_ab": "エドモントン, AB",
    "cities.winnipeg": "ウィニペグ",
    "cities.winnipeg_mb": "ウィニペグ, MB",
    "cities.halifax": "ハリファックス",
    "cities.halifax_ns": "ハリファックス, NS",
    "cities.quebec_city": "ケベックシティ",
    "cities.quebec_city_qc": "ケベックシティ, QC",
    "i18n.langNote": "表示言語を切り替えるためのプルダウンです。",
    "detail.quick": "クイック情報",
    "detail.overview": "概要（ガイド）",
    "detail.campuses": "キャンパス / 所在地",
    "detail.highlights": "特徴",
    "detail.courses": "コース / プログラム",
    "detail.support": "サポート",
    "detail.contact": "連絡先",
    "detail.map": "地図",
    "ui.prev": "前へ",
    "ui.next": "次へ",
    "ui.backHome": "ホームへ戻る",
    "ui.backLogin": "ログインへ戻る",
    "ui.backList": "一覧へ戻る",
    "board.back": "掲示板へ戻る",
    "school.back": "学校一覧へ戻る",
    "action.postShort": "投稿",
    "action.submitPost": "投稿する",
    "action.loginOnly": "ログイン",
    "board.new": "掲示板を新規作成",
    "board.newPost": "新規投稿",
    "board.detail": "掲示板 詳細",
    "post.content": "投稿内容",
    "post.preview": "投稿プレビュー",
    "post.doneTitle": "投稿完了（プロトタイプ）",
    "post.doneDesc": "投稿が送信されました。内容は一覧に反映される想定です。",
    "post.quote": "過去の投稿から引用",
    "ui.filterSearch": "絞り込み検索",
    "nav.postGuide": "投稿・取引ガイド",
    "footer.notice": "管理者からのお知らせ",
    "footer.guide": "ご利用ガイド",
    "footer.terms": "利用規約",
    "footer.privacy": "プライバシーポリシー",
    "footer.contact": "お問い合わせ",
    "label.majorCities": "主要都市",
    "label.otherCitiesFull": "その他（カナダの都市）",
    "label.otherCities": "その他のカナダ都市",
    "label.otherCity": "その他の都市",
    "ph.searchSchoolKeyword": "学校名やキーワードで検索",
    "ph.searchOrgKeyword": "機関名や内容で検索",
    "ph.searchTips": "暮らしのヒントを検索",
    "ph.keyword": "キーワード",
    "ph.keywordFind": "キーワードで探す",
    "ph.keywordSearch": "キーワードで検索",
    "ph.searchFavorites": "お気に入りを検索",
    "ph.title": "タイトル",
    "ph.body": "本文",
    "ph.bodyHtml": "本文（HTML）",
    "ph.detailNoPhoto": "詳細を入力してください。写真の添付はできません。",
    "ph.replyNoPhoto": "返信内容を入力してください（写真添付はできません）",
    "ph.extraInquiry": "追加の問い合わせ内容を入力してください。",
    "ph.searchPostTitlePlace": "投稿タイトルや場所で検索",
    "ph.searchTitlePostIdAuthor": "タイトル・投稿ID・投稿者で検索",
    "ph.searchTitleBodyAuthor": "タイトル・本文・投稿者で検索",
    "ph.searchTitleCityBody": "タイトル・都市・本文で検索",
    "ph.searchBodyAuthor": "本文・投稿者で検索",
    "ph.searchThread": "スレッドID/投稿/参加者/状態で検索",
    "ph.searchReport": "通報ID・対象・通報者で検索",
    "ph.searchTargetAdmin": "対象/管理者で検索",
    "ph.searchCity": "都市を検索",
    "ph.startTime": "開始時間を選択",
    "ph.endTime": "終了時間を選択",
    "ph.decimal": "小数点以下を入力",
    "ph.dateYMD": "年 / 月 / 日",
    "ph.password": "パスワード",
    "ph.passwordHint": "パスワードは8〜16文字以内",
    "ph.passwordAgain": "もう一度入力",
    "ph.searchEmailUser": "メール/ユーザー名で検索",
    "ph.addNg": "NGワードを追加",
    "ph.addReason": "理由を追加",
    "ph.selectGenre": "ジャンルを選択",
    "ph.postDetailHelp": "住んでいるエリア、探しているもの、連絡可能な時間帯など",
    "ph.postDetailNote": "内容・条件・連絡方法などを記載してください。",
    "ph.areaDetail": "詳細エリア（例：ダウンタウン / 住所）",
    "ph.threadKey": "thread_key (任意)",
    "ph.max": "Max",
    "ph.min": "Min",
    "ph.exNeg": "例：-123.1207",
    "ph.exLat": "例：49.2827",
    "ph.ex12": "例：12",
    "ph.exPeople": "例：20名",
    "ph.exCampus": "例：Downtown Campus",
    "ph.exName": "例：Hana / 花子カナダ",
    "ph.exEmail": "例：hana@example.com",
    "ph.exThanks": "例：お問い合わせありがとうございます。受け渡し可能です。",
    "ph.exTaro": "例：カナダ たろう",
    "ph.exSuper": "例：バンクーバーでおすすめのスーパー",
    "ph.exLang": "例：中文 / 한국어",
    "ph.exPickup": "例：受け渡し可能な日時を教えてください。",
    "ph.exSofa": "例：引っ越しにつきソファ譲ります",
    "ph.exSat": "例：来週の土曜の午後",
    "ph.exVisa": "例：配偶者ビザ",
    "ph.exNear": "例：駅近の場所だと助かります。"
  },
  en: {
    "nav.home": "Home",
    "nav.classified": "Classifieds",
    "nav.schools": "Schools",
    "nav.board": "Board",
    "nav.links": "Links",
    "nav.guides": "Guides",
    "action.post": "New Post",
    "action.login": "Log in / Sign up",
    "notice.title": "Notifications",
    "notice.unreadOnly": "Unread only",
    "notice.markAllRead": "Mark all read",
    "notice.viewAll": "View all",
    "header.notifications": "Notifications",
    "header.lang.ja": "Japanese",
    "header.lang.en": "English",
    "header.lang.fr": "Français",
    "ui.search": "Search",
    "ui.city": "City",
    "ui.sort": "Sort",
    "ui.back": "Back",
    "ui.clear": "Clear",
    "ui.searchApply": "Search with these filters",
    "ui.category": "Category",
    "ui.all": "All",
    "ui.hidden": "Hidden",
    "ui.selectCategory": "Select a category",
    "ui.selectCity": "Select a city",
    "ui.categoryUnset": "Category not set",
    "school.title": "Schools",
    "ui.newPosts": "New posts",
    "ui.last7days": "Showing posts from the last 7 days",
    "index_recent_posts_days": "Showing posts from the last {days} days in {city}",
    "index_events_today": "Today’s events",
    "index_events_generic": "Events",
    "index_events_date": "Events on {m}/{d}/{y}",
    "index_events_empty": "No events to display",
    "index_classifieds_title": "Classifieds",
    "index_classifieds_desc": "Check for posts about housing, jobs, items for sale, and more.",
    "index_post_trade_guide": "Posting & Trading Guide",
    "index_scam_warning": "Scam Safety Tips",
    "ui.searchResults": "{n} results for {place}",
    "ui.boardCountAll": "All {n} threads",
    "ui.boardCountFiltered": "Showing {n} / {total}",
    "ui.boardEmpty": "No threads found. You can create a new one.",
    "ui.boardLead": "Check the latest questions",
    "search.placeholder.keyword": "Keyword",
    "search.aria.school": "Search by school name, address, or keyword",
    "search.help.school": "Search by school name, address, or keyword",
    "sort.name_asc": "Name A–Z",
    "sort.name_desc": "Name Z–A",
    "sort.city_asc": "City A–Z",
    "sort.city_desc": "City Z–A",
    "sort.order": "Order",
    "sort.count": "Most posts",
    "sort.recent": "Recently updated",
    "ui.clearFilters": "Clear filters",
    "sort.newest": "Newest",
    "sort.oldest": "Oldest",
    "sort.price_desc": "Price: High to Low",
    "sort.price_asc": "Price: Low to High",
    "categories.housing": "Housing",
    "categories.jobs": "Jobs",
    "categories.sell": "Buy/Sell",
    "categories.help": "Help",
    "categories.services": "Services & Classes",
    "categories.community": "Community",
    "categories.events": "Events",
    "categories.school": "Schools",
    "cities.canada_all": "All Canada",
    "cities.other": "Other cities",
    "cities.other_custom": "Other (custom)",
    "cities.vancouver": "Vancouver",
    "cities.vancouver_bc": "Vancouver, BC",
    "cities.toronto": "Toronto",
    "cities.toronto_on": "Toronto, ON",
    "cities.montreal": "Montreal",
    "cities.montreal_qc": "Montreal, QC",
    "cities.calgary": "Calgary",
    "cities.calgary_ab": "Calgary, AB",
    "cities.ottawa": "Ottawa",
    "cities.ottawa_on": "Ottawa, ON",
    "cities.victoria": "Victoria",
    "cities.victoria_bc": "Victoria, BC",
    "cities.edmonton": "Edmonton",
    "cities.edmonton_ab": "Edmonton, AB",
    "cities.winnipeg": "Winnipeg",
    "cities.winnipeg_mb": "Winnipeg, MB",
    "cities.halifax": "Halifax",
    "cities.halifax_ns": "Halifax, NS",
    "cities.quebec_city": "Quebec City",
    "cities.quebec_city_qc": "Quebec City, QC",
    "i18n.langNote": "Select the display language.",
    "detail.quick": "Quick info",
    "detail.overview": "Overview",
    "detail.campuses": "Campuses / Location",
    "detail.highlights": "Highlights",
    "detail.courses": "Courses / Programs",
    "detail.support": "Support",
    "detail.contact": "Contact",
    "detail.map": "Map",
    "ui.prev": "Previous",
    "ui.next": "Next",
    "ui.backHome": "Back to Home",
    "ui.backLogin": "Back to Login",
    "ui.backList": "Back to List",
    "board.back": "Back to Board",
    "school.back": "Back to Schools",
    "action.postShort": "Post",
    "action.submitPost": "Submit",
    "action.loginOnly": "Log in",
    "board.new": "Create New Thread",
    "board.newPost": "New Post",
    "board.detail": "Board Detail",
    "post.content": "Post Content",
    "post.preview": "Post Preview",
    "post.doneTitle": "Post Complete (Prototype)",
    "post.doneDesc": "Your post has been sent and will appear in the list.",
    "post.quote": "Quote a Previous Post",
    "ui.filterSearch": "Filter Search",
    "nav.postGuide": "Posting & Trading Guide",
    "footer.notice": "Admin notices",
    "footer.guide": "Guide",
    "footer.terms": "Terms",
    "footer.privacy": "Privacy Policy",
    "footer.contact": "Contact",
    "label.majorCities": "Major cities",
    "label.otherCitiesFull": "Other (Canadian cities)",
    "label.otherCities": "Other Canadian cities",
    "label.otherCity": "Other cities",
    "ph.searchSchoolKeyword": "Search by school or keyword",
    "ph.searchOrgKeyword": "Search by organization or content",
    "ph.searchTips": "Search tips",
    "ph.keyword": "Keyword",
    "ph.keywordFind": "Find by keyword",
    "ph.keywordSearch": "Search by keyword",
    "ph.searchFavorites": "Search favorites",
    "ph.title": "Title",
    "ph.body": "Body",
    "ph.bodyHtml": "Body (HTML)",
    "ph.detailNoPhoto": "Enter details (no photo attachments).",
    "ph.replyNoPhoto": "Enter your reply (no photo attachments).",
    "ph.extraInquiry": "Enter additional inquiry details.",
    "ph.searchPostTitlePlace": "Search by post title or location",
    "ph.searchTitlePostIdAuthor": "Search by title, post ID, or author",
    "ph.searchTitleBodyAuthor": "Search by title, body, or author",
    "ph.searchTitleCityBody": "Search by title, city, or body",
    "ph.searchBodyAuthor": "Search by body or author",
    "ph.searchThread": "Search by thread ID, post, participants, or status",
    "ph.searchReport": "Search by report ID, target, or reporter",
    "ph.searchTargetAdmin": "Search by target or admin",
    "ph.searchCity": "Search cities",
    "ph.startTime": "Select start time",
    "ph.endTime": "Select end time",
    "ph.decimal": "Enter decimals",
    "ph.dateYMD": "Year / Month / Day",
    "ph.password": "Password",
    "ph.passwordHint": "8–16 characters",
    "ph.passwordAgain": "Enter again",
    "ph.searchEmailUser": "Search by email or username",
    "ph.addNg": "Add banned word",
    "ph.addReason": "Add reason",
    "ph.selectGenre": "Select category",
    "ph.postDetailHelp": "Your area, what you need, and when you can be contacted",
    "ph.postDetailNote": "Describe the content, conditions, and how to contact you.",
    "ph.areaDetail": "Area details (e.g. downtown / address)",
    "ph.threadKey": "thread_key (optional)",
    "ph.max": "Max",
    "ph.min": "Min",
    "ph.exNeg": "e.g. -123.1207",
    "ph.exLat": "e.g. 49.2827",
    "ph.ex12": "e.g. 12",
    "ph.exPeople": "e.g. 20 people",
    "ph.exCampus": "e.g. Downtown Campus",
    "ph.exName": "e.g. Hana / Hanako",
    "ph.exEmail": "e.g. hana@example.com",
    "ph.exThanks": "e.g. Thanks for your inquiry. I can arrange pickup.",
    "ph.exTaro": "e.g. Taro Canada",
    "ph.exSuper": "e.g. Recommended supermarkets in Vancouver",
    "ph.exLang": "e.g. 中文 / 한국어",
    "ph.exPickup": "e.g. Please share your available pickup times.",
    "ph.exSofa": "e.g. Sofa giveaway due to moving",
    "ph.exSat": "e.g. Next Saturday afternoon",
    "ph.exVisa": "e.g. Spousal visa",
    "ph.exNear": "e.g. A place near a station would help."
  },
  fr: {
    "nav.home": "Accueil",
    "nav.classified": "Classifiés",
    "nav.schools": "Écoles",
    "nav.board": "Forum",
    "nav.links": "Liens",
    "nav.guides": "Infos utiles",
    "action.post": "Publier",
    "action.login": "Connexion / Inscription",
    "notice.title": "Notifications",
    "notice.unreadOnly": "Non lues",
    "notice.markAllRead": "Tout marquer lu",
    "notice.viewAll": "Tout afficher",
    "header.notifications": "Notifications",
    "header.lang.ja": "Japonais",
    "header.lang.en": "Anglais",
    "header.lang.fr": "Français",
    "ui.search": "Recherche",
    "ui.city": "Ville",
    "ui.sort": "Trier",
    "ui.back": "Retour",
    "ui.clear": "Effacer",
    "ui.searchApply": "Rechercher avec ces filtres",
    "ui.category": "Catégorie",
    "ui.all": "Tout",
    "ui.hidden": "Masqué",
    "ui.selectCategory": "Sélectionner une catégorie",
    "ui.selectCity": "Sélectionner une ville",
    "ui.categoryUnset": "Catégorie non définie",
    "school.title": "Écoles",
    "ui.newPosts": "Nouvelles publications",
    "ui.last7days": "Affichage des publications des 7 derniers jours",
    "index_recent_posts_days": "Affichage des publications des {days} derniers jours à {city}",
    "index_events_today": "Événements du jour",
    "index_events_generic": "Événements",
    "index_events_date": "Événements du {d}/{m}/{y}",
    "index_events_empty": "Aucun événement à afficher",
    "index_classifieds_title": "Petites annonces",
    "index_classifieds_desc": "Consultez les annonces de logement, d’emploi, de vente d’objets, et plus encore.",
    "index_post_trade_guide": "Guide de publication et d’échange",
    "index_scam_warning": "Conseils anti-arnaques",
    "ui.searchResults": "{n} résultats pour {place}",
    "ui.boardCountAll": "Toutes les {n} discussions",
    "ui.boardCountFiltered": "Affichage {n} / {total}",
    "ui.boardEmpty": "Aucune discussion. Vous pouvez en créer une nouvelle.",
    "ui.boardLead": "Consultez les dernières questions",
    "search.placeholder.keyword": "Mot-clé",
    "search.aria.school": "Rechercher par école, adresse ou mot-clé",
    "search.help.school": "Rechercher par école, adresse ou mot-clé",
    "sort.name_asc": "Nom A–Z",
    "sort.name_desc": "Nom Z–A",
    "sort.city_asc": "Ville A–Z",
    "sort.city_desc": "Ville Z–A",
    "sort.order": "Ordre",
    "sort.count": "Le plus de publications",
    "sort.recent": "Récemment mis à jour",
    "ui.clearFilters": "Effacer les filtres",
    "sort.newest": "Plus récent",
    "sort.oldest": "Plus ancien",
    "sort.price_desc": "Prix : décroissant",
    "sort.price_asc": "Prix : croissant",
    "categories.housing": "Logement",
    "categories.jobs": "Emploi",
    "categories.sell": "Acheter / Vendre",
    "categories.help": "Entraide",
    "categories.services": "Services & Cours",
    "categories.community": "Communauté",
    "categories.events": "Événements",
    "categories.school": "Écoles",
    "cities.canada_all": "Tout le Canada",
    "cities.other": "Autres villes",
    "cities.other_custom": "Autre (saisie libre)",
    "cities.vancouver": "Vancouver",
    "cities.vancouver_bc": "Vancouver, BC",
    "cities.toronto": "Toronto",
    "cities.toronto_on": "Toronto, ON",
    "cities.montreal": "Montréal",
    "cities.montreal_qc": "Montréal, QC",
    "cities.calgary": "Calgary",
    "cities.calgary_ab": "Calgary, AB",
    "cities.ottawa": "Ottawa",
    "cities.ottawa_on": "Ottawa, ON",
    "cities.victoria": "Victoria",
    "cities.victoria_bc": "Victoria, BC",
    "cities.edmonton": "Edmonton",
    "cities.edmonton_ab": "Edmonton, AB",
    "cities.winnipeg": "Winnipeg",
    "cities.winnipeg_mb": "Winnipeg, MB",
    "cities.halifax": "Halifax",
    "cities.halifax_ns": "Halifax, NS",
    "cities.quebec_city": "Québec",
    "cities.quebec_city_qc": "Québec, QC",
    "i18n.langNote": "Choisir la langue d'affichage.",
    "detail.quick": "Infos rapides",
    "detail.overview": "Aperçu",
    "detail.campuses": "Campus / Lieu",
    "detail.highlights": "Atouts",
    "detail.courses": "Cours / Programmes",
    "detail.support": "Accompagnement",
    "detail.contact": "Contact",
    "detail.map": "Carte",
    "ui.prev": "Précédent",
    "ui.next": "Suivant",
    "ui.backHome": "Retour à l’accueil",
    "ui.backLogin": "Retour à la connexion",
    "ui.backList": "Retour à la liste",
    "board.back": "Retour au forum",
    "school.back": "Retour à la liste des écoles",
    "action.postShort": "Publier",
    "action.submitPost": "Publier",
    "action.loginOnly": "Connexion",
    "board.new": "Nouveau sujet",
    "board.newPost": "Nouveau message",
    "board.detail": "Détails du forum",
    "post.content": "Contenu du post",
    "post.preview": "Aperçu de la publication",
    "post.doneTitle": "Publication terminée (prototype)",
    "post.doneDesc": "Votre publication a été envoyée. Elle sera reflétée dans la liste.",
    "post.quote": "Citer une publication précédente",
    "ui.filterSearch": "Recherche filtrée",
    "nav.postGuide": "Guide de publication et d’échange",
    "footer.notice": "Annonces admin",
    "footer.guide": "Guide d’utilisation",
    "footer.terms": "Conditions d’utilisation",
    "footer.privacy": "Politique de confidentialité",
    "footer.contact": "Contact",
    "label.majorCities": "Villes principales",
    "label.otherCitiesFull": "Autres (villes canadiennes)",
    "label.otherCities": "Autres villes canadiennes",
    "label.otherCity": "Autres villes",
    "ph.searchSchoolKeyword": "Rechercher école ou mot-clé",
    "ph.searchOrgKeyword": "Rechercher organisme ou contenu",
    "ph.searchTips": "Rechercher des conseils",
    "ph.keyword": "Mot-clé",
    "ph.keywordFind": "Rechercher par mot-clé",
    "ph.keywordSearch": "Rechercher par mot-clé",
    "ph.searchFavorites": "Rechercher les favoris",
    "ph.title": "Titre",
    "ph.body": "Contenu",
    "ph.bodyHtml": "Contenu (HTML)",
    "ph.detailNoPhoto": "Saisissez les détails (pas de photos).",
    "ph.replyNoPhoto": "Saisissez votre réponse (pas de photos).",
    "ph.extraInquiry": "Saisissez les détails supplémentaires de la demande.",
    "ph.searchPostTitlePlace": "Rechercher par titre ou lieu",
    "ph.searchTitlePostIdAuthor": "Rechercher par titre, ID de post ou auteur",
    "ph.searchTitleBodyAuthor": "Rechercher par titre, contenu ou auteur",
    "ph.searchTitleCityBody": "Rechercher par titre, ville ou contenu",
    "ph.searchBodyAuthor": "Rechercher par contenu ou auteur",
    "ph.searchThread": "Rechercher par ID de fil, post, participants ou statut",
    "ph.searchReport": "Rechercher par ID de signalement, cible ou rapporteur",
    "ph.searchTargetAdmin": "Rechercher par cible ou administrateur",
    "ph.searchCity": "Rechercher des villes",
    "ph.startTime": "Sélectionner l’heure de début",
    "ph.endTime": "Sélectionner l’heure de fin",
    "ph.decimal": "Saisir les décimales",
    "ph.dateYMD": "Année / Mois / Jour",
    "ph.password": "Mot de passe",
    "ph.passwordHint": "8–16 caractères",
    "ph.passwordAgain": "Saisir à nouveau",
    "ph.searchEmailUser": "Rechercher par e-mail ou nom d’utilisateur",
    "ph.addNg": "Ajouter un mot interdit",
    "ph.addReason": "Ajouter un motif",
    "ph.selectGenre": "Sélectionner une catégorie",
    "ph.postDetailHelp": "Votre zone, ce que vous recherchez et vos disponibilités",
    "ph.postDetailNote": "Décrivez le contenu, les conditions et comment vous contacter.",
    "ph.areaDetail": "Détails de la zone (ex. centre-ville / adresse)",
    "ph.threadKey": "thread_key (optionnel)",
    "ph.max": "Max",
    "ph.min": "Min",
    "ph.exNeg": "ex. -123,1207",
    "ph.exLat": "ex. 49,2827",
    "ph.ex12": "ex. 12",
    "ph.exPeople": "ex. 20 personnes",
    "ph.exCampus": "ex. Downtown Campus",
    "ph.exName": "ex. Hana / Hanako",
    "ph.exEmail": "ex. hana@example.com",
    "ph.exThanks": "ex. Merci pour votre message. Je peux effectuer la remise.",
    "ph.exTaro": "ex. Taro Canada",
    "ph.exSuper": "ex. Supermarchés recommandés à Vancouver",
    "ph.exLang": "ex. 中文 / 한국어",
    "ph.exPickup": "ex. Merci d’indiquer vos disponibilités pour la remise.",
    "ph.exSofa": "ex. Don de canapé pour déménagement",
    "ph.exSat": "ex. Samedi prochain après-midi",
    "ph.exVisa": "ex. Visa de conjoint",
    "ph.exNear": "ex. Un lieu proche d’une station serait idéal."
  }
};
const I18N_MISSING = new Set();

function getLang() {
  const qs = new URLSearchParams(location.search || "");
  const fromParam = String(qs.get("lang") || "").trim().toLowerCase();
  if (fromParam === "ja" || fromParam === "jp") return "ja";
  if (fromParam === "en") return "en";
  if (fromParam === "fr") return "fr";
  return resolveEffectiveLang();
}

function t(key, lang) {
  const l = lang || getLang();
  // Normalize malformed city keys like "cities.モントリオール, QC"
  if (key && typeof key === "string" && key.startsWith("cities.")) {
    const rawCity = key.replace(/^cities\./, "");
    const normalized = normalizeAreaKey(rawCity) || resolveCityKeyFromLabel(rawCity);
    if (normalized && normalized !== rawCity) {
      const province = getProvinceCodeFromKey(normalized);
      const dictKey = getCityDictKey(normalized, province);
      if (I18N_DICT[l] && I18N_DICT[l][dictKey]) return I18N_DICT[l][dictKey];
      if (I18N_DICT.ja && I18N_DICT.ja[dictKey]) return I18N_DICT.ja[dictKey];
    }
  }
  if (I18N_DICT[l] && I18N_DICT[l][key]) return I18N_DICT[l][key];
  if (I18N_DICT.ja && I18N_DICT.ja[key]) return I18N_DICT.ja[key];
  if (!I18N_MISSING.has(key)) {
    I18N_MISSING.add(key);
    console.warn("[i18n] missing key:", key);
  }
  return key;
}

function tFmt(key, vars = {}, lang) {
  let text = t(key, lang);
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{(\w+)\}/g, (m, p1) => {
    if (Object.prototype.hasOwnProperty.call(vars, p1)) return String(vars[p1]);
    return m;
  });
}

function getCityDictKey(rawKey, provinceCode) {
  if (!rawKey) return "";
  const baseKey = String(rawKey || "").trim().toLowerCase();
  const hasSuffix = /_\w{2}$/.test(baseKey);
  const prov = String(provinceCode || "").trim().toLowerCase();
  if (!hasSuffix && prov) {
    const withProv = `${baseKey}_${prov}`;
    const dictKey = `cities.${withProv}`;
    if ((I18N_DICT.ja && Object.prototype.hasOwnProperty.call(I18N_DICT.ja, dictKey)) ||
        (I18N_DICT.en && Object.prototype.hasOwnProperty.call(I18N_DICT.en, dictKey)) ||
        (I18N_DICT.fr && Object.prototype.hasOwnProperty.call(I18N_DICT.fr, dictKey))) {
      return dictKey;
    }
  }
  return `cities.${baseKey}`;
}

function i18nCityLabel(rawKey, provinceCode) {
  const raw = String(rawKey || "").trim();
  const cleaned = raw.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");
  let key = normalizeAreaKey(raw)
    || normalizeAreaKey(cleaned)
    || normalizeAreaKey(raw.split(",")[0])
    || resolveCityKeyFromLabel(raw)
    || raw;
  if (!key) return "";
  if (key === "other_custom") {
    const custom = getStoredCustomAreaName();
    return custom || t("cities.other_custom");
  }
  const lang = getLang();
  let province = String(provinceCode || "").trim();
  if (!province) {
    const match = raw.match(/,\s*([A-Za-z]{2})$/);
    if (match) province = match[1].toUpperCase();
  }
  if (!province && /_\w{2}$/i.test(key)) {
    const parts = key.split("_");
    province = parts[parts.length - 1].toUpperCase();
  }
  if (!province) province = getProvinceCodeFromKey(key);
  const dictKey = getCityDictKey(key, province);
  const dictExists = !!(
    (I18N_DICT.ja && Object.prototype.hasOwnProperty.call(I18N_DICT.ja, dictKey)) ||
    (I18N_DICT.en && Object.prototype.hasOwnProperty.call(I18N_DICT.en, dictKey)) ||
    (I18N_DICT.fr && Object.prototype.hasOwnProperty.call(I18N_DICT.fr, dictKey))
  );
  if (dictExists) {
    const label = t(dictKey, lang);
    if (label && label !== dictKey) return label;
  }
  if (lang === "ja") return CC_CITY_LABELS[key] || (CC_CITY_PRIMARY.find(c => c.key === key)?.label) || raw;
  const cityCore = String(key || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (m) => m.toUpperCase());
  const jpLabel = CC_CITY_LABELS[key] || (CC_CITY_PRIMARY.find(c => c.key === key)?.label) || "";
  const provFromLabel = jpLabel.includes(",") ? jpLabel.split(",")[1].trim() : "";
  const prov = province || provFromLabel;
  if (prov) return `${cityCore}, ${prov}`;
  return cityCore || raw;
}

function i18nCategoryLabel(rawKey) {
  const key = String(rawKey || "").trim().toLowerCase();
  if (!key) return "";
  const dictKey = `categories.${key}`;
  const label = t(dictKey);
  if (label && label !== dictKey) return label;
  return "";
}

function ccGetCategoryLabel(rawKey) {
  return i18nCategoryLabel(rawKey)
    || (typeof CC_CATEGORY_LABELS === "object" && CC_CATEGORY_LABELS[rawKey])
    || "";
}

function setLang(lang) {
  const next = (lang === "jp") ? "ja" : lang;
  applyLangEverywhere(next);
}

function updateLangInLinks(lang) {
  const l = lang || getLang();
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  anchors.forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if (/^https?:\/\//i.test(href)) return;
    if (href.includes("admin.html")) return;
    try {
      const u = new URL(href, location.href);
      if (!u.searchParams.has("lang")) u.searchParams.set("lang", l);
      else u.searchParams.set("lang", l);
      if (u.protocol === "file:") {
        a.setAttribute("href", u.href);
      } else {
        a.setAttribute("href", u.pathname + u.search + u.hash);
      }
    } catch (e) { }
  });
}

function shouldSkipI18n(el) {
  if (!el) return true;
  if (el.classList && el.classList.contains("sr-only")) return false;
  if (el.hasAttribute && el.hasAttribute("data-i18n-attr")) return false;
  if (el.hasAttribute && el.hasAttribute("data-i18n-placeholder")) return false;
  if (el.hasAttribute && el.hasAttribute("data-i18n-aria")) return false;
  if (el.hasAttribute && el.hasAttribute("data-i18n-title")) return false;
  if (el.hasAttribute && el.hasAttribute("data-i18n-skip")) return true;
  const tag = String(el.tagName || "").toUpperCase();
  if (["SVG", "PATH", "I", "IMG", "USE"].includes(tag)) return true;
  if (String(el.getAttribute && el.getAttribute("aria-hidden") || "") === "true") return true;
  if (el.className && /material-icons|fa[srlb]?|bi\b|icon\b/.test(String(el.className))) return true;
  if (el.closest && el.closest("svg, .cc-icon, .cc-bell-icon, [data-i18n-skip], [aria-hidden='true']")) return true;
  if (el.querySelector && el.querySelector("svg, img")) return true;
  return false;
}

function applyI18n(root = document) {
  const lang = getLang();
  const nodes = Array.from(root.querySelectorAll("[data-i18n]"));
  nodes.forEach((el) => {
    if (shouldSkipI18n(el)) return;
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = t(key, lang);
  });
  const attrNodes = Array.from(root.querySelectorAll("[data-i18n-attr]"));
  attrNodes.forEach((el) => {
    if (shouldSkipI18n(el)) return;
    const baseKey = el.getAttribute("data-i18n") || "";
    const attrs = String(el.getAttribute("data-i18n-attr") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    attrs.forEach((attr) => {
      const parts = attr.split("=");
      const attrName = parts[0].trim();
      const attrKey = (parts[1] || "").trim();
      const key = attrKey || baseKey;
      if (!key) return;
      el.setAttribute(attrName, t(key, lang));
    });
  });

  const attrMaps = [
    { sel: "[data-i18n-placeholder]", attr: "placeholder" },
    { sel: "[data-i18n-aria]", attr: "aria-label" },
    { sel: "[data-i18n-title]", attr: "title" }
  ];
  attrMaps.forEach((cfg) => {
    const items = Array.from(root.querySelectorAll(cfg.sel));
    items.forEach((el) => {
      if (shouldSkipI18n(el)) return;
      const key = el.getAttribute(cfg.sel.replace(/^\[|\]$/g, ""));
      if (!key) return;
      el.setAttribute(cfg.attr, t(key, lang));
    });
  });
}

function setI18nTextTarget(el, key) {
  if (!el || !key) return;
  const tag = String(el.tagName || "").toUpperCase();
  if (tag === "OPTION") {
    el.dataset.i18n = key;
    return;
  }
  let span = el.querySelector(".cc-i18n-text");
  if (!span) {
    const textNodes = Array.from(el.childNodes || []).filter((n) => n.nodeType === Node.TEXT_NODE && String(n.textContent || "").trim());
    const text = textNodes.map((n) => n.textContent).join(" ").trim();
    textNodes.forEach((n) => el.removeChild(n));
    span = document.createElement("span");
    span.className = "cc-i18n-text";
    span.textContent = text;
    el.appendChild(span);
  }
  span.dataset.i18n = key;
}

const I18N_TEXT_MAP = {
  "学校情報": "nav.schools",
  "掲示板": "nav.board",
  "外部リンク": "nav.links",
  "お役立ち情報": "nav.guides",
  "クラシファイド": "nav.classified",
  "管理者からのお知らせ": "footer.notice",
  "ご利用ガイド": "footer.guide",
  "利用規約": "footer.terms",
  "プライバシーポリシー": "footer.privacy",
  "お問い合わせ": "footer.contact",
  "前へ": "ui.prev",
  "次へ": "ui.next",
  "戻る": "ui.back",
  "ホームへ戻る": "ui.backHome",
  "ログインへ戻る": "ui.backLogin",
  "一覧へ戻る": "ui.backList",
  "学校一覧へ戻る": "school.back",
  "学校一覧に戻る": "school.back",
  "掲示板へ戻る": "board.back",
  "掲示板一覧へ戻る": "board.back",
  "検索": "ui.search",
  "都市": "ui.city",
  "並び替え": "ui.sort",
  "クリア": "ui.clear",
  "投稿作成": "action.post",
  "投稿": "action.postShort",
  "ログイン": "action.loginOnly",
  "ログイン・新規登録": "action.login",
  "新規投稿": "board.newPost",
  "掲示板を新規作成": "board.new",
  "掲示板 新規作成": "board.new",
  "掲示板 詳細": "board.detail",
  "最新の相談をまとめてチェック": "ui.boardLead",
  "相談がありません": "ui.boardEmpty",
  "投稿する": "action.submitPost",
  "投稿内容": "post.content",
  "投稿プレビュー": "post.preview",
  "投稿完了（プロトタイプ）": "post.doneTitle",
  "投稿が送信されました。内容は一覧に反映される想定です。": "post.doneDesc",
  "過去の投稿から引用": "post.quote",
  "絞り込み検索": "ui.filterSearch",
  "この条件で検索": "ui.searchApply",
  "カテゴリ": "ui.category",
  "カテゴリー": "ui.category",
  "カテゴリーを選択してください": "ui.selectCategory",
  "都市を選択してください。": "ui.selectCity",
  "すべて": "ui.all",
  "非表示": "ui.hidden",
  "新しい順": "sort.newest",
  "古い順": "sort.oldest",
  "学校名 A→Z": "sort.name_asc",
  "学校名 Z→A": "sort.name_desc",
  "都市 A→Z": "sort.city_asc",
  "都市 Z→A": "sort.city_desc",
  "表示順": "sort.order",
  "投稿数": "sort.count",
  "最近更新": "sort.recent",
  "絞り込みクリア": "ui.clearFilters",
  "住まい": "categories.housing",
  "求人": "categories.jobs",
  "売ります・譲ります": "categories.sell",
  "助け合い": "categories.help",
  "サービス・講座": "categories.services",
  "仲間募集・交流": "categories.community",
  "イベント": "categories.events",
  "スクール": "categories.school",
  "主要都市": "label.majorCities",
  "投稿・取引ガイド": "nav.postGuide",
  "詐欺などのご注意": "index_scam_warning",
  "全カナダ": "cities.canada_all",
  "その他（カナダの都市）": "label.otherCitiesFull",
  "その他のカナダ都市": "label.otherCities",
  "その他の都市": "label.otherCity"
};

const I18N_PLACEHOLDER_MAP = {
  "キーワード": "ph.keyword",
  "キーワードで探す": "ph.keywordFind",
  "キーワードで検索": "ph.keywordSearch",
  "学校名やキーワードで検索": "ph.searchSchoolKeyword",
  "機関名や内容で検索": "ph.searchOrgKeyword",
  "暮らしのヒントを検索": "ph.searchTips",
  "お気に入りを検索": "ph.searchFavorites",
  "タイトル": "ph.title",
  "本文": "ph.body",
  "本文（HTML）": "ph.bodyHtml",
  "詳細を入力してください。写真の添付はできません。": "ph.detailNoPhoto",
  "返信内容を入力してください（写真添付はできません）": "ph.replyNoPhoto",
  "追加の問い合わせ内容を入力してください。": "ph.extraInquiry",
  "投稿タイトルや場所で検索": "ph.searchPostTitlePlace",
  "タイトル・投稿ID・投稿者で検索": "ph.searchTitlePostIdAuthor",
  "タイトル・本文・投稿者で検索": "ph.searchTitleBodyAuthor",
  "タイトル・都市・本文で検索": "ph.searchTitleCityBody",
  "本文・投稿者で検索": "ph.searchBodyAuthor",
  "スレッドID/投稿/参加者/状態で検索": "ph.searchThread",
  "通報ID・対象・通報者で検索": "ph.searchReport",
  "対象/管理者で検索": "ph.searchTargetAdmin",
  "都市を検索": "ph.searchCity",
  "開始時間を選択": "ph.startTime",
  "終了時間を選択": "ph.endTime",
  "小数点以下を入力": "ph.decimal",
  "年 / 月 / 日": "ph.dateYMD",
  "パスワード": "ph.password",
  "パスワードは8〜16文字以内": "ph.passwordHint",
  "もう一度入力": "ph.passwordAgain",
  "メール/ユーザー名で検索": "ph.searchEmailUser",
  "NGワードを追加": "ph.addNg",
  "理由を追加": "ph.addReason",
  "ジャンルを選択": "ph.selectGenre",
  "住んでいるエリア、探しているもの、連絡可能な時間帯など": "ph.postDetailHelp",
  "内容・条件・連絡方法などを記載してください。": "ph.postDetailNote",
  "詳細エリア（例：ダウンタウン / 住所）": "ph.areaDetail",
  "thread_key (任意)": "ph.threadKey",
  "Max": "ph.max",
  "Min": "ph.min",
  "例：-123.1207": "ph.exNeg",
  "例：49.2827": "ph.exLat",
  "例：12": "ph.ex12",
  "例：20名": "ph.exPeople",
  "例：Downtown Campus": "ph.exCampus",
  "例：Hana / 花子カナダ": "ph.exName",
  "例：hana@example.com": "ph.exEmail",
  "例：お問い合わせありがとうございます。受け渡し可能です。": "ph.exThanks",
  "例：カナダ たろう": "ph.exTaro",
  "例：バンクーバーでおすすめのスーパー": "ph.exSuper",
  "例：中文 / 한국어": "ph.exLang",
  "例：受け渡し可能な日時を教えてください。": "ph.exPickup",
  "例：引っ越しにつきソファ譲ります": "ph.exSofa",
  "例：来週の土曜の午後": "ph.exSat",
  "例：配偶者ビザ": "ph.exVisa",
  "例：駅近の場所だと助かります。": "ph.exNear"
};

function applyTextMap(root, selector, map) {
  const nodes = Array.from(root.querySelectorAll(selector));
  nodes.forEach((el) => {
    if (shouldSkipI18n(el)) return;
    if (el.dataset && el.dataset.i18n) return;
    const txt = (el.textContent || "").trim();
    if (!txt) return;
    const key = map[txt];
    if (!key) return;
    setI18nTextTarget(el, key);
  });
}

function annotateI18nDefaults() {
  // global nav
  const navItems = Array.from(document.querySelectorAll(".global-nav .nav-item"));
  navItems.forEach((item) => {
    const href = String(item.getAttribute("href") || "");
    if (href.includes("index.html")) setI18nTextTarget(item, "nav.home");
    else if (href.includes("list.html")) setI18nTextTarget(item, "nav.classified");
    else if (href.includes("static.html?type=school")) setI18nTextTarget(item, "nav.schools");
    else if (href.includes("board.html")) setI18nTextTarget(item, "nav.board");
    else if (href.includes("static.html?type=links")) setI18nTextTarget(item, "nav.links");
    else if (href.includes("static.html?type=tips")) setI18nTextTarget(item, "nav.guides");
  });

  const postBtn = document.getElementById("post-button");
  if (postBtn) setI18nTextTarget(postBtn, "action.post");
  const loginBtn = document.getElementById("login-button");
  if (loginBtn) setI18nTextTarget(loginBtn, "action.login");

  const noticeTitle = document.querySelector(".cc-notice-title");
  if (noticeTitle) noticeTitle.dataset.i18n = "notice.title";
  const noticeUnread = document.querySelector(".cc-notice-filter span");
  if (noticeUnread) noticeUnread.dataset.i18n = "notice.unreadOnly";
  const noticeMarkAll = document.querySelector(".cc-notice-markall");
  if (noticeMarkAll) noticeMarkAll.dataset.i18n = "notice.markAllRead";
  const noticeViewAll = document.querySelector(".cc-notice-footer a");
  if (noticeViewAll) noticeViewAll.dataset.i18n = "notice.viewAll";
  const noticeBellLabel = document.querySelector("#notifBell .cc-notif-label");
  if (noticeBellLabel) noticeBellLabel.dataset.i18n = "header.notifications";
  const noticeBell = document.getElementById("notifBell");
  if (noticeBell) {
    noticeBell.setAttribute("data-i18n-attr", "title=header.notifications,aria-label=header.notifications");
  }

  // school page labels
  const schoolSection = document.querySelector(".school-page");
  if (schoolSection) {
    const titles = Array.from(schoolSection.querySelectorAll(".school-side-title"));
    if (titles[0]) titles[0].dataset.i18n = "ui.search";
    if (titles[1]) titles[1].dataset.i18n = "ui.city";
    const schoolTitle = schoolSection.querySelector(".school-title");
    if (schoolTitle) schoolTitle.dataset.i18n = "school.title";
    const searchInput = schoolSection.querySelector("#school-search");
    if (searchInput) {
      searchInput.dataset.i18n = "search.placeholder.keyword";
      searchInput.setAttribute("data-i18n-attr", "placeholder=search.placeholder.keyword,aria-label=search.aria.school,title=search.aria.school");
    }
    const searchHelp = schoolSection.querySelector(".cc-search-help");
    if (searchHelp) searchHelp.dataset.i18n = "search.help.school";
  }

  // language note
  const langNote = document.querySelector('.cc-dropdown[data-cc-dropdown="lang"] .cc-dd-note');
  if (langNote) langNote.dataset.i18n = "i18n.langNote";

  const sectionTitles = Array.from(document.querySelectorAll(".cc-section-title span"));
  sectionTitles.forEach((span) => {
    const txt = (span.textContent || "").trim();
    if (txt === "クイック情報") span.dataset.i18n = "detail.quick";
    else if (txt === "概要（ガイド）") span.dataset.i18n = "detail.overview";
    else if (txt === "キャンパス / 所在地") span.dataset.i18n = "detail.campuses";
    else if (txt === "特徴") span.dataset.i18n = "detail.highlights";
    else if (txt === "コース / プログラム") span.dataset.i18n = "detail.courses";
    else if (txt === "サポート") span.dataset.i18n = "detail.support";
    else if (txt === "連絡先") span.dataset.i18n = "detail.contact";
    else if (txt === "地図") span.dataset.i18n = "detail.map";
  });

  // footer nav and common UI labels
  const footer = document.querySelector("footer");
  if (footer) {
    applyTextMap(footer, "a, button, span", I18N_TEXT_MAP);
  }

  // buttons / labels (avoid user content)
  applyTextMap(document, "button, a.btn, a.btn-primary, a.btn-secondary, .btn-search, .pager-btn, .school-page-btn, .cc-search-btn", I18N_TEXT_MAP);
  applyTextMap(document, ".form-label, .filter-label, .setting-label, .setting-title, .setting-desc, .filters-title", I18N_TEXT_MAP);
  applyTextMap(document, "option", I18N_TEXT_MAP);
  const optgroups = Array.from(document.querySelectorAll("optgroup[label]"));
  optgroups.forEach((el) => {
    if (shouldSkipI18n(el)) return;
    const label = (el.getAttribute("label") || "").trim();
    const key = I18N_TEXT_MAP[label];
    if (!key) return;
    el.setAttribute("data-i18n-attr", `label=${key}`);
  });

  // placeholder translations
  const inputs = Array.from(document.querySelectorAll("input[placeholder], textarea[placeholder]"));
  inputs.forEach((el) => {
    const ph = el.getAttribute("placeholder");
    const key = I18N_PLACEHOLDER_MAP[ph || ""];
    if (!key) return;
    el.dataset.i18n = key;
    const attrs = ["placeholder"];
    if (el.hasAttribute("aria-label")) attrs.push("aria-label");
    if (el.hasAttribute("title")) attrs.push("title");
    el.setAttribute("data-i18n-attr", attrs.map(a => `${a}=${key}`).join(","));
  });

  // area select options (header)
  const areaSelect = document.getElementById("area-select");
  if (areaSelect) {
    Array.from(areaSelect.options || []).forEach((op) => {
      const raw = String(op.value || "").trim();
      if (!raw) return;
      const key = normalizeAreaKey(raw) || raw;
      const province = getProvinceCodeFromKey(key);
      const dictKey = getCityDictKey(key, province);
      if (I18N_DICT.ja[dictKey] || I18N_DICT.en[dictKey] || I18N_DICT.fr[dictKey]) {
        op.dataset.i18n = dictKey;
      }
    });
  }

  // language select options (header)
  const langSelect = document.getElementById("lang-select");
  if (langSelect) {
    Array.from(langSelect.options || []).forEach((op) => {
      const val = String(op.value || "").toLowerCase();
      if (val === "jp" || val === "ja") op.dataset.i18n = "header.lang.ja";
      else if (val === "en") op.dataset.i18n = "header.lang.en";
      else if (val === "fr") op.dataset.i18n = "header.lang.fr";
    });
  }

  // category select options (filters)
  document.querySelectorAll("select").forEach((select) => {
    const id = String(select.id || "");
    if (!/category|cat/i.test(id)) return;
    Array.from(select.options || []).forEach((op) => {
      const key = String(op.value || "").trim().toLowerCase();
      if (!key) return;
      const dictKey = `categories.${key}`;
      if (I18N_DICT.ja[dictKey] || I18N_DICT.en[dictKey] || I18N_DICT.fr[dictKey]) {
        op.dataset.i18n = dictKey;
      }
    });
  });

  // city/area select options (filters, forms)
  document.querySelectorAll("select").forEach((select) => {
    const id = String(select.id || "");
    const name = String(select.name || "");
    if (!/city|area/i.test(id) && !/city|area/i.test(name)) return;
    Array.from(select.options || []).forEach((op) => {
      const raw = String(op.value || "").trim();
      if (!raw) return;
      const key = normalizeAreaKey(raw) || raw;
      const province = getProvinceCodeFromKey(key);
      const dictKey = getCityDictKey(key, province);
      if (I18N_DICT.ja[dictKey] || I18N_DICT.en[dictKey] || I18N_DICT.fr[dictKey]) {
        op.dataset.i18n = dictKey;
      }
    });
  });
}

function updateDynamicLabels() {
  const lang = getLang();
  const resultsTitle = document.querySelector(".results-title");
  if (resultsTitle) {
    const countEl = document.getElementById("results-count");
    const areaEl = document.getElementById("results-area");
    const n = countEl ? String(countEl.textContent || "").trim() : "0";
    let place = areaEl ? String(areaEl.textContent || "").trim() : t("cities.canada_all", lang);
    let cityKey = "";
    const areaSelect = document.getElementById("area-select");
    if (areaSelect && areaSelect.value) {
      cityKey = normalizeAreaKey(areaSelect.value) || areaSelect.value;
    }
    if (!cityKey && areaEl) {
      const dataKey = areaEl.getAttribute("data-area-key") || areaEl.dataset.areaKey || "";
      if (dataKey) cityKey = normalizeAreaKey(dataKey) || dataKey;
    }
    try {
      if (!cityKey) cityKey = resolveCityKeyFromLabel(place) || normalizeAreaKey(place) || place;
      const translated = i18nCityLabel(cityKey, getProvinceCodeFromKey(cityKey));
      if (translated) place = translated;
    } catch (e) { }
    const placeHtml = `<span id="results-area">${escapeHtml(place)}</span>`;
    const nHtml = `<span id="results-count">${escapeHtml(n)}</span>`;
    resultsTitle.innerHTML = tFmt("ui.searchResults", { place: placeHtml, n: nHtml }, lang);
  }

  const boardCount = document.getElementById("board-count");
  if (boardCount) {
    const total = boardCount.dataset.total;
    const filtered = boardCount.dataset.filtered;
    if (total !== undefined && total !== null && total !== "") {
      const totalNum = Number(total);
      const filteredNum = filtered !== undefined && filtered !== null && filtered !== ""
        ? Number(filtered)
        : totalNum;
      if (!totalNum) {
        boardCount.textContent = t("ui.boardEmpty", lang);
      } else if (filteredNum !== totalNum) {
        boardCount.textContent = tFmt("ui.boardCountFiltered", { n: filteredNum, total: totalNum }, lang);
      } else {
        boardCount.textContent = tFmt("ui.boardCountAll", { n: totalNum }, lang);
      }
    }
  }

  const indexRecent = document.getElementById("indexRecentPostsLabel");
  if (indexRecent) {
    let cityKey = "";
    const areaSelect = document.getElementById("area-select");
    const areaSub = document.getElementById("area-select-sub");
    try {
      cityKey = getTempAreaKey() || getGuestAreaKey() || getAccountDefaultAreaKey() || "";
    } catch (e) { }
    if (areaSelect && areaSelect.value) {
      cityKey = normalizeAreaKey(areaSelect.value) || cityKey;
    }
    if (areaSelect && areaSelect.value === "other") {
      const subVal = areaSub ? String(areaSub.value || "") : "";
      cityKey = normalizeAreaKey(subVal) || subVal || "other";
    }
    if (!cityKey) cityKey = "canada_all";
    const cityLabel = i18nCityLabel(cityKey, getProvinceCodeFromKey(cityKey)) || t("cities.canada_all", lang);
    indexRecent.textContent = tFmt("index_recent_posts_days", { city: cityLabel, days: 7 }, lang);
  }
}

function refreshHeaderCityLabels() {
  const areaSelect = document.getElementById("area-select");
  if (areaSelect) {
    Array.from(areaSelect.options || []).forEach((op) => {
      const val = String(op.value || "").trim();
      if (!val || val === "other") return;
      const key = normalizeAreaKey(val) || val;
      const label = i18nCityLabel(key, getProvinceCodeFromKey(key));
      if (!label) return;
      if (val === "canada_all" && /🇨🇦/.test(op.textContent || "")) {
        op.textContent = `🇨🇦 ${label}`;
      } else if (val === "japan" && /🇯🇵/.test(op.textContent || "")) {
        op.textContent = `🇯🇵 ${label}`;
      } else {
        op.textContent = label;
      }
    });
    syncHeaderAreaOptionLabel();
  }

  const areaItems = Array.from(document.querySelectorAll('[data-cc-dd-select="area"], [data-cc-dd-select="area-sub"]'));
  areaItems.forEach((item) => {
    const val = String(item.getAttribute("data-value") || "").trim();
    if (!val || val === "other") return;
    const key = normalizeAreaKey(val) || val;
    const label = i18nCityLabel(key, getProvinceCodeFromKey(key));
    if (!label) return;
    if (val === "canada_all" && /🇨🇦/.test(item.textContent || "")) {
      item.textContent = `🇨🇦 ${label}`;
    } else if (val === "japan" && /🇯🇵/.test(item.textContent || "")) {
      item.textContent = `🇯🇵 ${label}`;
    } else {
      item.textContent = label;
    }
  });

  const areaValue = document.querySelector('[data-cc-dd-value="area"]');
  if (areaValue && areaSelect) {
    let currentKey = "";
    try {
      currentKey = getTempAreaKey() || getGuestAreaKey() || getAccountDefaultAreaKey() || "canada_all";
    } catch (e) { }
    if (areaSelect.value) currentKey = normalizeAreaKey(areaSelect.value) || currentKey || "canada_all";
    if (areaSelect.value === "other") {
      const areaSub = document.getElementById("area-select-sub");
      const subVal = areaSub ? String(areaSub.value || "") : "";
      currentKey = normalizeAreaKey(subVal) || subVal || "other";
    }
    const display = i18nCityLabel(currentKey, getProvinceCodeFromKey(currentKey)) || t("cities.canada_all", getLang());
    if (display) areaValue.textContent = display;
  }
}

function initI18n() {
  if (/admin\.html$/i.test(String(location.pathname || ""))) return;
  ccInitI18nBoot();
}

// --------------------------------------------
// Header custom dropdowns (area/lang)
// --------------------------------------------
function syncHeaderAreaOptionLabel() {
  const areaSelect = document.getElementById("area-select");
  if (!areaSelect) return;
  const otherOpt = Array.from(areaSelect.options).find(opt => String(opt.value || "") === "other");
  if (!otherOpt) return;
  if (!otherOpt.dataset.ccDefaultLabel) {
    otherOpt.dataset.ccDefaultLabel = (otherOpt.textContent || "").trim() || t("label.otherCitiesFull");
  }
  let storedName = "";
  let storedKey = "";
  try {
    storedName = localStorage.getItem(KEY_DEFAULT_AREA_NAME) || "";
    storedKey = localStorage.getItem("mock_default_city") || "";
  } catch (e) { }
  const normalized = normalizeAreaKey(storedKey) || storedKey;
  const shouldUseName = !!(storedName && storedName.trim())
    && (storedKey === "other" || isMinorAreaKey(normalized));
  otherOpt.textContent = shouldUseName ? storedName.trim() : (otherOpt.dataset.ccDefaultLabel || t("label.otherCitiesFull"));
}

function initHeaderCustomDropdowns() {
  const dropdowns = Array.from(document.querySelectorAll(".site-header .cc-dropdown"));
  if (!dropdowns.length) return;

  const areaSelect = document.getElementById("area-select");
  const areaSub = document.getElementById("area-select-sub");
  const langSelect = document.getElementById("lang-select");
  const areaValue = document.querySelector('[data-cc-dd-value="area"]');
  const langValue = document.querySelector('[data-cc-dd-value="lang"]');

  const getSelectedText = (selectEl) => {
    if (!selectEl) return "";
    const opt = selectEl.options[selectEl.selectedIndex];
    return opt ? (opt.textContent || "").trim() : "";
  };

  const updateAreaDisplay = () => {
    if (!areaSelect || !areaValue) return;
    syncHeaderAreaOptionLabel();
    let currentKey = "";
    try {
      currentKey = getTempAreaKey() || getGuestAreaKey() || getAccountDefaultAreaKey() || "canada_all";
    } catch (e) {
      currentKey = areaSelect.value || "canada_all";
    }
    if (areaSelect.value) currentKey = normalizeAreaKey(areaSelect.value) || currentKey || "canada_all";
    let display = i18nCityLabel(currentKey, getProvinceCodeFromKey(currentKey)) || getDisplayAreaName(currentKey) || "全カナダ";
    if (areaSelect.value === "other") {
      const subValue = areaSub ? String(areaSub.value || "") : "";
      const subKey = normalizeAreaKey(subValue) || subValue;
      display = i18nCityLabel(subKey, getProvinceCodeFromKey(subKey)) || "その他のカナダ都市";
    }
    areaValue.textContent = display;
  };

  const updateLangDisplay = () => {
    if (!langSelect || !langValue) return;
    langValue.textContent = getSelectedText(langSelect);
  };

  const ensureHeaderDefaults = () => {
    if (areaSelect && !areaSelect.value) {
      const initialArea = getInitialAreaKey() || "canada_all";
      setAreaSelectToKey(areaSelect, initialArea);
      areaSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (langSelect && !langSelect.value) {
      const initialLang = normalizeLangKey(resolveEffectiveLang());
      CC_LANG_SYNCING = true;
      setLangSelectValue(langSelect, initialLang);
      CC_LANG_SYNCING = false;
      updateLangDisplay();
    }
  };

  const closeDropdown = (dd) => {
    dd.classList.remove("is-open");
    const toggle = dd.querySelector(".cc-dd-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    const panel = dd.querySelector(".cc-dd-subpanel");
    if (panel) panel.hidden = true;
  };

  const closeAll = (except) => {
    dropdowns.forEach((dd) => {
      if (dd !== except) closeDropdown(dd);
    });
  };

  dropdowns.forEach((dd) => {
    if (dd.dataset.ccDdReady === "1") return;
    dd.dataset.ccDdReady = "1";
    const toggle = dd.querySelector(".cc-dd-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      if (dd.classList.contains("is-disabled")) return;
      if (dd.classList.contains("is-open")) {
        closeDropdown(dd);
        return;
      }
      closeAll(dd);
      dd.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
    });
  });

  if (!document.body.dataset.ccDdDoc) {
    document.body.dataset.ccDdDoc = "1";
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".site-header .cc-dropdown")) closeAll();
    });
  }

  document.querySelectorAll("[data-cc-dd-select]").forEach((item) => {
    if (item.dataset.ccDdBound === "1") return;
    item.dataset.ccDdBound = "1";
    item.addEventListener("click", () => {
      const type = item.getAttribute("data-cc-dd-select");
      const value = item.getAttribute("data-value");
      if (!type || value === null) return;

      if (type === "area" && areaSelect) {
        areaSelect.value = value;
        if (value !== "other" && areaSub) areaSub.value = "";
        areaSelect.dispatchEvent(new Event("change", { bubbles: true }));
        updateAreaDisplay();
      }

      if (type === "area-sub" && areaSub) {
        if (areaSelect) areaSelect.value = "other";
        areaSub.value = value;
        areaSub.dispatchEvent(new Event("change", { bubbles: true }));
        updateAreaDisplay();
      }

      if (type === "lang" && langSelect) {
        langSelect.value = value;
        langSelect.dispatchEvent(new Event("change", { bubbles: true }));
        updateLangDisplay();
      }

      const dd = item.closest(".cc-dropdown");
      if (dd) closeDropdown(dd);
    });
  });

  document.querySelectorAll("[data-cc-dd-subtoggle]").forEach((btn) => {
    if (btn.dataset.ccDdBound === "1") return;
    btn.dataset.ccDdBound = "1";
    btn.addEventListener("click", () => {
      const panel = btn.parentElement ? btn.parentElement.querySelector(".cc-dd-subpanel") : null;
      if (!panel) return;
      panel.hidden = !panel.hidden;
    });
  });

  if (areaSelect) areaSelect.addEventListener("change", updateAreaDisplay);
  if (areaSub) areaSub.addEventListener("change", updateAreaDisplay);
  if (langSelect) langSelect.addEventListener("change", updateLangDisplay);

  ensureHeaderDefaults();
  syncHeaderAreaOptionLabel();
  updateAreaDisplay();
  updateLangDisplay();
}

// カテゴリ設定（list.htmlの「ジャンル(詳細)」用）
const categories = {
  housing: { name: "住まい", subs: ["すべて", "シェアハウス・ルームシェア", "アパート・コンド（一人暮らし）", "ホームステイ", "駐車場・ガレージ", "倉庫・ストレージ", "その他不動産"] },
  jobs: { name: "求人", subs: ["すべて", "飲食店・カフェ", "販売・接客", "オフィス・事務", "美容・理容", "IT・Web・クリエイティブ", "清掃・ハウスキーピング", "ナニー・ベビーシッター", "建築・専門職", "ボランティア・インターン", "その他"] },
  sell: { name: "売る・譲る", subs: ["すべて", "家具", "家電", "PC・スマホ・カメラ", "衣料品・ファッション", "本・教科書", "自転車・車・バイク", "スポーツ・レジャー（スノボ等）", "楽器・音楽", "チケット・金券", "0円・無料", "帰国売り（まとめ）", "その他"] },
  help: { name: "助け合い", subs: ["すべて", "買います・探してます", "教えてください（質問）", "手伝ってください", "迷子・探し物", "情報提供", "その他"] },
  services: { name: "サービス・講座", subs: ["すべて", "レッスン（語学・音楽）", "美容・ネイル・マツエク", "引越し・運搬", "修理・リペア", "撮影・代行", "その他サービス"] },
  community: { name: "仲間募集・交流", subs: ["すべて", "友達作り", "言語交換（Language Exchange）", "スポーツ・サークル", "ママ友・パパ友", "勉強会", "その他"] },
  events: { name: "イベント", subs: ["すべて", "パーティー・交流会", "セミナー・説明会", "フェスティバル", "ガレージセール", "展示・個展", "その他"] },
  school: { name: "スクール", subs: ["すべて", "語学学校", "専門学校", "大学・カレッジ", "短期講座", "テスト対策", "その他"] }
};

// ============================
// ログイン状態（Storage）ヘルパー（揺れ吸収）
// ============================
function getStoredBool(keys, fallback = false) {
  for (const k of keys) {
    let v = null;
    try { v = localStorage.getItem(k); } catch (e) { }
    if (v === null) continue;
    if (v === "1" || v === "true" || v === "yes") return true;
    if (v === "0" || v === "false" || v === "no") return false;
  }
  return fallback;
}

function getStoredString(keys, fallback = "") {
  for (const k of keys) {
    let v = null;
    try { v = localStorage.getItem(k); } catch (e) { }
    if (v !== null && String(v).trim() !== "") return String(v);
  }
  return fallback;
}

function truncateForButton(text, maxChars = 18) {
  const t = String(text || "");
  if (t.length <= maxChars) return t;
  return t.slice(0, Math.max(1, maxChars - 1)) + "…";
}

function getAnyStorageItem(key) {
  try {
    const v1 = localStorage.getItem(key);
    if (v1 !== null) return v1;
  } catch (e) { }
  try {
    const v2 = sessionStorage.getItem(key);
    if (v2 !== null) return v2;
  } catch (e) { }
  return null;
}

function getAccountNameFromJson(raw) {
  if (!raw) return "";
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return "";

    const candidates = [
      obj.account_name, obj.accountName, obj.user_name, obj.userName,
      obj.userId, obj.username, obj.displayName, obj.display_name,
      obj.name, obj.nickname
    ].filter(Boolean);

    if (!candidates.length && obj.user && typeof obj.user === "object") {
      const u = obj.user;
      const nested = [
        u.account_name, u.accountName, u.user_name, u.userName,
        u.userId, u.username, u.displayName, u.display_name,
        u.name, u.nickname
      ].filter(Boolean);
      if (nested.length) return String(nested[0]);
    }

    if (candidates.length) return String(candidates[0]);
  } catch (e) { }
  return "";
}

function getAccountName() {
  const directKeys = [
    "account_name", "accountName", "user_name", "userName", "userId",
    "username", "displayName", "display_name", "nickname", "name",
    "canadaclassi_account_name", "canadaclassi_user_name", "current_account_name",
    "mock_account_name", "mock_accountName", "mock_user_name",
    "mock_username", "mock_displayName", "mock_display_name"
  ];

  for (const k of directKeys) {
    const v = getAnyStorageItem(k);
    if (v !== null && String(v).trim() !== "") return String(v);
  }

  const payload = getWindowLoginPayload();
  if (payload && payload.account_name) return String(payload.account_name);

  const jsonKeys = [
    "currentUser", "current_user", "user", "account", "profile",
    "canadaclassi_user", "canadaclassi_account"
  ];

  for (const k of jsonKeys) {
    const raw = getAnyStorageItem(k);
    const name = getAccountNameFromJson(raw);
    if (name) return name;
  }

  return "";
}

const CC_AUTHOR_KEY_MAP_KEY = "cc_author_key_map_v1";
const CC_PROFILES_KEY = "cc_profiles_v1";

function ccLoadProfilesList() {
  try {
    const raw = localStorage.getItem(CC_PROFILES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function ccLoadCurrentProfile() {
  try {
    const raw = localStorage.getItem("cc_profile_v1");
    const profile = raw ? JSON.parse(raw) : null;
    return profile && typeof profile === "object" ? profile : null;
  } catch (e) {
    return null;
  }
}

function ccGetProfileIconByKey(key) {
  const clean = String(key || "").trim();
  if (!clean) return "";
  const current = ccLoadCurrentProfile();
  if (current && String(current.user_key || "").trim() === clean && current.icon) {
    return String(current.icon || "");
  }
  const list = ccLoadProfilesList();
  const hit = list.find((p) => String(p?.user_key || "").trim() === clean);
  return hit && hit.icon ? String(hit.icon || "") : "";
}

function ccGetProfileIconByName(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  const current = ccLoadCurrentProfile();
  if (current && String(current.display_name || "").trim() === clean && current.icon) {
    return String(current.icon || "");
  }
  const list = ccLoadProfilesList();
  const byName = list.find((p) => String(p?.display_name || "").trim() === clean);
  if (byName && byName.icon) return String(byName.icon || "");
  const map = ccLoadAuthorKeyMap();
  const key = map[clean];
  if (key) {
    const byKey = list.find((p) => String(p?.user_key || "").trim() === String(key).trim());
    if (byKey && byKey.icon) return String(byKey.icon || "");
  }
  return "";
}

const CC_FALLBACK_AVATAR_PRESETS = [
  "icon_red_gray.png",
  "icon_red_lightblue.png",
  "icon_red_pink.png",
  "icon_yellow_blue.png",
  "icon_yellow_gray.png",
  "icon_yellow_pink.png"
];

function ccHashNameToIndex(name, length) {
  const clean = String(name || "");
  let hash = 0;
  for (let i = 0; i < clean.length; i += 1) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  const mod = length > 0 ? length : 1;
  return Math.abs(hash) % mod;
}

function ccPickFallbackAvatar(name) {
  if (!name) return "";
  const idx = ccHashNameToIndex(name, CC_FALLBACK_AVATAR_PRESETS.length);
  return CC_FALLBACK_AVATAR_PRESETS[idx] || "";
}

function ccGetChatAvatarByName(name) {
  const fromProfile = ccGetProfileIconByName(name);
  return fromProfile || ccPickFallbackAvatar(name);
}

function ccGetAvatarForPost(post) {
  const direct = String(post?.author_avatar || post?.authorAvatar || "").trim();
  if (direct) return direct;
  const key = String(post?.author_key || "").trim();
  const byKey = key ? ccGetProfileIconByKey(key) : "";
  if (byKey) return byKey;
  const name = String(post?.author_name || post?.author || "").trim();
  return name ? ccGetProfileIconByName(name) : "";
}

function ccSetAvatarBackground(el, src) {
  if (!el) return;
  const clean = String(src || "").trim();
  if (clean) {
    el.classList.add("has-avatar-image");
    el.style.backgroundImage = `url("${clean}")`;
  } else {
    el.classList.remove("has-avatar-image");
    el.style.backgroundImage = "";
  }
}

function ccLoadAuthorKeyMap() {
  try {
    const raw = localStorage.getItem(CC_AUTHOR_KEY_MAP_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch (e) {
    return {};
  }
}

function ccSaveAuthorKeyMap(map) {
  try {
    localStorage.setItem(CC_AUTHOR_KEY_MAP_KEY, JSON.stringify(map || {}));
  } catch (e) { }
}

function ccGetCurrentDisplayName() {
  try {
    const raw = localStorage.getItem("cc_profile_v1");
    const profile = raw ? JSON.parse(raw) : null;
    if (profile && profile.display_name) return String(profile.display_name);
  } catch (e) { }
  return getAccountName() || "";
}

function ccGetAuthorKeyForName(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  const map = ccLoadAuthorKeyMap();
  const currentName = ccGetCurrentDisplayName();
  if (currentName && !map[currentName]) {
    map[currentName] = getOrCreateUserKey();
    ccSaveAuthorKeyMap(map);
  }
  if (!map[clean]) {
    map[clean] = generateUserKey();
    ccSaveAuthorKeyMap(map);
  }
  return map[clean] || "";
}

function ccBuildProfileLink(name) {
  const clean = String(name || "").trim();
  const params = new URLSearchParams();
  if (clean) params.set("user", clean);
  const key = ccGetAuthorKeyForName(clean);
  if (key) params.set("user_key", key);
  const qs = params.toString();
  return `profile-view.html${qs ? `?${qs}` : ""}`;
}

function ccBuildProfileLinkWithContext(name, extraParams) {
  const base = ccBuildProfileLink(name);
  const parts = base.split("?");
  const path = parts[0] || "profile-view.html";
  const params = new URLSearchParams(parts[1] || "");
  Object.keys(extraParams || {}).forEach((key) => {
    const val = String(extraParams[key] || "").trim();
    if (val) params.set(key, val);
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function ccEnsureProfilesFromPosts() {
  const posts = (typeof ccGetPosts === "function") ? ccGetPosts() : [];
  if (!Array.isArray(posts) || !posts.length) return;
  const map = ccLoadAuthorKeyMap();
  const currentName = ccGetCurrentDisplayName();
  if (currentName && !map[currentName]) map[currentName] = getOrCreateUserKey();
  const profilesMap = {};
  const defaultVisibility = {
    display_name: "required",
    icon: "required",
    gender: "public",
    visa: "public",
    bio: "public",
    languages: "public",
    age: "public"
  };

  posts.forEach((post) => {
    const name = String(post?.author_name || post?.author || "").trim();
    if (!name) return;
    const key = post?.author_key || map[name] || generateUserKey();
    map[name] = key;
    if (!profilesMap[name]) {
      profilesMap[name] = {
        user_key: key,
        display_name: name,
        gender: "",
        visa_type: "",
        visa_other: "",
        birthday: "",
        bio: "",
        languages: [],
        languages_other: "",
        icon: post?.author_avatar || "",
        area: post?.city || "",
        area_other_name: post?.area || "",
        area_tz: "",
        is_profile_public: true,
        visibility: Object.assign({}, defaultVisibility)
      };
    } else if (!profilesMap[name].icon && post?.author_avatar) {
      profilesMap[name].icon = post.author_avatar;
    }
    if (post?.area && !profilesMap[name].area_other_name) {
      profilesMap[name].area_other_name = post.area;
    }
    if (post?.city && !profilesMap[name].area) {
      profilesMap[name].area = post.city;
    }
  });

  ccSaveAuthorKeyMap(map);
  try {
    const list = Object.values(profilesMap);
    localStorage.setItem(CC_PROFILES_KEY, JSON.stringify(list));
  } catch (e) { }
}

function ccEnsureProfilesFromChats() {
  let threads = {};
  try {
    const raw = localStorage.getItem("cc_chat_threads_v1");
    threads = raw ? JSON.parse(raw) : {};
  } catch (e) {
    threads = {};
  }
  if (!threads || typeof threads !== "object") return;

  const existing = ccLoadProfilesList();
  const byKey = new Map();
  const byName = new Map();
  existing.forEach((p) => {
    const key = String(p?.user_key || "").trim();
    const name = String(p?.display_name || "").trim();
    if (key) byKey.set(key, p);
    if (name) byName.set(name, p);
  });

  const map = ccLoadAuthorKeyMap();
  const currentName = ccGetCurrentDisplayName();
  if (currentName && !map[currentName]) map[currentName] = getOrCreateUserKey();

  const defaultVisibility = {
    display_name: "required",
    icon: "required",
    gender: "public",
    visa: "public",
    bio: "public",
    languages: "public",
    age: "public"
  };

  Object.keys(threads).forEach((convoId) => {
    const meta = threads?.[convoId]?.meta || {};
    const name = String(meta?.name || "").trim();
    if (!name) return;
    const key = map[name] || generateUserKey();
    map[name] = key;

    if (byKey.has(key) || byName.has(name)) {
      const target = byKey.get(key) || byName.get(name);
      if (target && !target.icon) {
        const fallbackIcon = ccPickFallbackAvatar(name);
        if (fallbackIcon) target.icon = fallbackIcon;
      }
      if (target && !target.area && meta.city) target.area = String(meta.city || "");
      if (target && !target.area_other_name && meta.area) target.area_other_name = String(meta.area || "");
      return;
    }

    const icon = ccPickFallbackAvatar(name);
    const profile = {
      user_key: key,
      display_name: name,
      gender: "",
      visa_type: "",
      visa_other: "",
      birthday: "",
      bio: "",
      languages: [],
      languages_other: "",
      icon,
      area: String(meta.city || ""),
      area_other_name: String(meta.area || ""),
      area_tz: "",
      is_profile_public: true,
      visibility: Object.assign({}, defaultVisibility)
    };
    existing.push(profile);
    byKey.set(key, profile);
    byName.set(name, profile);
  });

  ccSaveAuthorKeyMap(map);
  try {
    localStorage.setItem(CC_PROFILES_KEY, JSON.stringify(existing));
  } catch (e) { }
}
function generateUserKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `u_${crypto.randomUUID()}`;
  }
  const r = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `u_${r()}${r()}`;
}

function getOrCreateUserKey() {
  const key = localStorage.getItem("cc_user_key_v1");
  if (key) return key;
  const next = generateUserKey();
  localStorage.setItem("cc_user_key_v1", next);
  return next;
}

function getUserEmail() {
  const directKeys = [
    "email", "user_email", "userEmail", "mail", "userMail",
    "mock_user_email", "mock_email",
    "canadaclassi_user_email"
  ];
  for (const k of directKeys) {
    const v = getAnyStorageItem(k);
    if (v !== null && String(v).trim() !== "") return String(v);
  }

  const payload = getWindowLoginPayload();
  if (payload && payload.email) return String(payload.email);

  const jsonKeys = [
    "currentUser", "current_user", "user", "account", "profile",
    "canadaclassi_user", "canadaclassi_account"
  ];
  for (const k of jsonKeys) {
    const raw = getAnyStorageItem(k);
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw);
      const candidates = [
        obj.email, obj.user_email, obj.userEmail, obj.mail,
        obj?.user?.email, obj?.user?.user_email, obj?.user?.userEmail
      ].filter(Boolean);
      if (candidates.length) return String(candidates[0]);
    } catch (e) { }
  }

  return "";
}

function getDefaultCityKey() {
  const directKeys = [
    "mock_default_city", "mock_defaultCity",
    "canadaclassi_default_city",
    "default_city", "defaultCity"
  ];
  for (const k of directKeys) {
    const v = getAnyStorageItem(k);
    if (v !== null && String(v).trim() !== "") {
      const normalized = normalizeAreaKey(v) || String(v);
      if (normalized === "other_custom" || normalized === "free") return "canada_all";
      return normalized;
    }
  }

  const payload = getWindowLoginPayload();
  if (payload && payload.default_city) {
    const normalized = normalizeAreaKey(payload.default_city) || String(payload.default_city);
    if (normalized === "other_custom" || normalized === "free") return "canada_all";
    return normalized;
  }

  const jsonKeys = [
    "currentUser", "current_user", "user", "account", "profile",
    "canadaclassi_user", "canadaclassi_account"
  ];
  for (const k of jsonKeys) {
    const raw = getAnyStorageItem(k);
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw);
      const candidates = [
        obj.default_city, obj.defaultCity,
        obj?.user?.default_city, obj?.user?.defaultCity
      ].filter(Boolean);
      if (candidates.length) {
        const normalized = normalizeAreaKey(candidates[0]) || String(candidates[0]);
        if (normalized === "other_custom" || normalized === "free") return "canada_all";
        return normalized;
      }
    } catch (e) { }
  }

  const dbKeys = ["mock_users", "users"];
  const email = getUserEmail();

  for (const k of dbKeys) {
    const raw = getAnyStorageItem(k);
    if (!raw) continue;
    try {
      const db = JSON.parse(raw);
      if (Array.isArray(db)) {
        for (const u of db) {
          const uEmail = (u && (u.email || u.user_email || u.userEmail)) ? String(u.email || u.user_email || u.userEmail) : "";
          if (email && uEmail && uEmail === email) {
            const city = u.default_city || u.defaultCity;
            if (city) {
              const normalized = normalizeAreaKey(city) || String(city);
              if (normalized === "other_custom" || normalized === "free") return "canada_all";
              return normalized;
            }
          }
        }
      }
    } catch (e) { }
  }

  return "";
}

function normalizeDefaultCityStorage() {
  const bad = (v) => {
    const normalized = normalizeAreaKey(v) || String(v || "");
    return normalized === "other_custom" || normalized === "free";
  };
  const storageKeys = [
    "mock_default_city", "mock_defaultCity",
    "canadaclassi_default_city",
    "default_city", "defaultCity"
  ];
  let touched = false;
  try {
    storageKeys.forEach((k) => {
      const v = localStorage.getItem(k);
      if (v && bad(v)) {
        localStorage.setItem(k, "canada_all");
        touched = true;
      }
    });
    const pref = localStorage.getItem("pref_area");
    if (pref && bad(pref)) {
      localStorage.setItem("pref_area", "canada_all");
      touched = true;
    }
  } catch (e) { }
  try {
    const temp = sessionStorage.getItem(KEY_TEMP_AREA);
    if (temp && bad(temp)) {
      sessionStorage.setItem(KEY_TEMP_AREA, "canada_all");
      sessionStorage.removeItem(KEY_TEMP_AREA_NAME);
      sessionStorage.removeItem(KEY_TEMP_AREA_TZ);
    }
  } catch (e) { }
  if (touched) {
    try { localStorage.removeItem(KEY_DEFAULT_AREA_NAME); } catch (e) { }
    try { localStorage.setItem(KEY_DEFAULT_AREA_TZ, getAreaTimeZone("canada_all")); } catch (e) { }
  }
  try {
    const users = getMockUsersDB();
    let dirty = false;
    users.forEach((u) => {
      const key = normalizeAreaKey(u?.default_city) || String(u?.default_city || "");
      if (key === "other_custom" || key === "free") {
        u.default_city = "canada_all";
        u.default_city_name = "";
        u.default_city_tz = getAreaTimeZone("canada_all");
        dirty = true;
      }
    });
    if (dirty) saveMockUsersDB(users);
  } catch (e) { }
}

function getLoggedInFlag() {
  if (getStoredBool(
    ["is_logged_in", "logged_in", "isLoggedIn", "mock_is_logged_in", "mock_logged_in", "mock_isLoggedIn"],
    false
  )) return true;

  const payload = getWindowLoginPayload();
  if (payload && (payload.email || payload.account_name)) return true;

  const tokenKeys = ["auth_token", "token", "session_token", "access_token", "jwt"];
  for (const k of tokenKeys) {
    const v = getAnyStorageItem(k);
    if (v !== null && String(v).trim() !== "") return true;
  }

  const emailKeys = ["email", "user_email", "mail", "userMail", "mock_user_email", "mock_email"];
  for (const k of emailKeys) {
    const v = getAnyStorageItem(k);
    if (v !== null && String(v).trim() !== "") return true;
  }
  return false;
}

function getUserRole() {
  const directKeys = [
    "mock_user_role", "user_role", "role", "account_role", "canadaclassi_user_role"
  ];
  for (const k of directKeys) {
    const v = getAnyStorageItem(k);
    if (v !== null && String(v).trim() !== "") return normalizeUserRole(v);
  }

  const payload = getWindowLoginPayload();
  if (payload && payload.role) return normalizeUserRole(payload.role);

  const jsonKeys = [
    "currentUser", "current_user", "user", "account", "profile",
    "canadaclassi_user", "canadaclassi_account"
  ];
  for (const k of jsonKeys) {
    const raw = getAnyStorageItem(k);
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw);
      const role = obj.role || obj.user_role || obj.userRole || obj?.user?.role;
      if (role) return normalizeUserRole(role);
    } catch (e) { }
  }

  const email = getUserEmail();
  if (email) {
    const dbKeys = ["mock_users", "users"];
    for (const k of dbKeys) {
      const raw = getAnyStorageItem(k);
      if (!raw) continue;
      try {
        const db = JSON.parse(raw);
        if (Array.isArray(db)) {
          const hit = db.find((u) => normalizeEmail(u?.email) === normalizeEmail(email));
          if (hit && hit.role) return normalizeUserRole(hit.role);
        }
      } catch (e) { }
    }
  }

  return "user";
}

function isAdmin() {
  return (getLoggedInFlag() || !!getUserEmail()) && getUserRole() === "admin";
}

function assertAdmin() {
  if (!isAdmin()) return false;
  return true;
}

function normalizeUserStatus(status) {
  return String(status || "").trim().toLowerCase() === "banned" ? "banned" : "active";
}

function getUserRecordByEmail(email) {
  const e = normalizeEmail(email || "");
  if (!e) return null;
  const users = getMockUsersDB();
  return users.find((u) => normalizeEmail(u?.email) === e) || null;
}

function getCurrentUserStatus() {
  const email = getUserEmail();
  if (!email) return "active";
  const user = getUserRecordByEmail(email);
  return normalizeUserStatus(user?.status);
}

function isCurrentUserBanned() {
  return getCurrentUserStatus() === "banned";
}

function showGlobalToast(message) {
  if (!message) return;
  const toast = document.createElement("div");
  toast.className = "cc-inbox-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

function ccToast(message, type) {
  const text = String(message || "").trim();
  if (!text) return;
  showGlobalToast(text);
}

function ccOpenModal({ title, bodyHtml, buttons } = {}) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3 class="modal-title">${escapeHtml(String(title || ""))}</h3>
        <button class="modal-close" type="button" data-cc-modal-close aria-label="閉じる">×</button>
      </div>
      <div class="modal-body">${bodyHtml || ""}</div>
      <div class="modal-actions"></div>
    </div>
  `;
  const actions = modal.querySelector(".modal-actions");
  (buttons || []).forEach((btn) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = btn.className || "btn btn-secondary";
    el.textContent = btn.label || "OK";
    el.addEventListener("click", () => {
      if (typeof btn.onClick === "function") btn.onClick();
      modal.remove();
    });
    actions.appendChild(el);
  });
  const closeBtn = modal.querySelector("[data-cc-modal-close]");
  if (closeBtn) closeBtn.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
  return modal;
}

function ccConfirm({ title, message, confirmText = "OK", cancelText = "キャンセル" } = {}) {
  return new Promise((resolve) => {
    openGlobalConfirmModal({
      id: "cc-confirm-modal",
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}

function openAdminUnsavedModal({ onSave, onDiscard, onCancel } = {}) {
  const existing = document.querySelector(".modal-overlay[data-admin-unsaved='1']");
  if (existing) existing.remove();
  const modal = ccOpenModal({
    title: "未保存の変更があります",
    bodyHtml: "<p>保存して移動しますか？</p>",
    buttons: [
      {
        label: "保存して移動",
        className: "btn btn-primary",
        onClick: () => { if (typeof onSave === "function") onSave(); }
      },
      {
        label: "破棄して移動",
        className: "btn btn-secondary",
        onClick: () => { if (typeof onDiscard === "function") onDiscard(); }
      },
      {
        label: "キャンセル",
        className: "btn btn-secondary",
        onClick: () => { if (typeof onCancel === "function") onCancel(); }
      }
    ]
  });
  modal.dataset.adminUnsaved = "1";
  return modal;
}

function ccInitSelectDropdowns(scope) {
  const root = scope || document;
  const dropdowns = [];
  if (root && root.classList && root.classList.contains("cc-select")) {
    dropdowns.push(root);
  }
  dropdowns.push(...Array.from(root.querySelectorAll(".cc-select")));
  dropdowns.forEach((dd) => {
    if (dd.dataset.ccSelectReady === "1") return;
    const select = dd.querySelector("select");
    const toggle = dd.querySelector(".cc-dd-toggle");
    const valueEl = dd.querySelector(".cc-dd-value");
    const menu = dd.querySelector(".cc-dd-menu");
    if (!select || !toggle || !valueEl || !menu) return;

    const buildMenu = () => {
      const selectedOption = Array.from(select.options).find(opt => opt.value === select.value);
      const placeholder = select.querySelector('option[value=""]');
      const isAccordionCitySelect = select.id === "default-city-primary" || select.id === "post-area-select";

      if (valueEl) {
        if (selectedOption && select.value) {
          valueEl.textContent = (selectedOption.textContent || "").trim();
          valueEl.classList.remove('is-placeholder');
        } else {
          valueEl.textContent = placeholder ? (placeholder.textContent || "").trim() : "選択してください";
          valueEl.classList.add('is-placeholder');
        }
      }
      
      menu.innerHTML = "";

      const appendOption = (optNode, targetMenu) => {
        // Hide placeholder from dropdown if a value is selected
        if (optNode.value === "" && select.value !== "") return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cc-dd-item";
        const text = (optNode.textContent || "").trim();
        if (optNode.value === "other" && !isAccordionCitySelect) {
          btn.classList.add("has-chevron");
          btn.innerHTML = `<span>${escapeHtml(text)}</span><i class="fa-solid fa-chevron-right"></i>`;
        } else {
          btn.textContent = text;
        }
        btn.dataset.value = optNode.value;
        if (optNode.disabled) {
          btn.disabled = true;
          btn.classList.add("is-disabled");
        }
        if (String(optNode.value) === String(select.value)) {
          btn.classList.add("is-active");
        }
        (targetMenu || menu).appendChild(btn);
      };

      let otherGroup = null;
      Array.from(select.children).forEach((child) => {
        if (!child) return;
        if (child.tagName === "OPTGROUP" && isAccordionCitySelect && /その他のカナダ都市/.test(child.label || "")) {
          otherGroup = child;
          return;
        }
        if (child.tagName === "OPTGROUP") {
          const label = (child.label || "").trim();
          if (label) {
            const title = document.createElement("div");
            title.className = "cc-dd-group-title";
            title.textContent = label;
            menu.appendChild(title);
          }
          Array.from(child.children).forEach((optNode) => appendOption(optNode));
          return;
        }
        if (child.tagName === "OPTION") appendOption(child);
      });

      if (isAccordionCitySelect && otherGroup) {
        const subToggle = document.createElement("button");
        subToggle.type = "button";
        subToggle.className = "cc-dd-item cc-dd-subtoggle";
        subToggle.dataset.role = "subtoggle";
        subToggle.innerHTML = '<span>その他のカナダ都市</span><span class="cc-dd-subarrow">&gt;</span>';
        menu.appendChild(subToggle);

        const subPanel = document.createElement("div");
        subPanel.className = "cc-dd-subpanel";
        subPanel.hidden = true;
        Array.from(otherGroup.children).forEach((optNode) => appendOption(optNode, subPanel));
        menu.appendChild(subPanel);
      }
    };
    select.buildMenu = buildMenu;

    buildMenu();
    select.addEventListener("change", buildMenu);

    if (!document.body.dataset.ccSelectDoc) {
      document.body.dataset.ccSelectDoc = "1";
      document.addEventListener("click", (e) => {
        const toggleEl = e.target.closest(".cc-dd-toggle");
        if (toggleEl) {
          const wrap = toggleEl.closest(".cc-select");
          if (!wrap) return;
          e.preventDefault();
          e.stopPropagation();
          if (wrap.dataset.ccSelectReady !== "1") ccInitSelectDropdowns(wrap);
          const isOpen = wrap.classList.contains("is-open");
          document.querySelectorAll(".cc-select.is-open").forEach((el) => {
            if (el !== wrap) {
              el.classList.remove("is-open");
              const btn = el.querySelector(".cc-dd-toggle");
              if (btn) btn.setAttribute("aria-expanded", "false");
            }
          });
          if (isOpen) {
            wrap.classList.remove("is-open");
            toggleEl.setAttribute("aria-expanded", "false");
            if (select.id === "default-city-primary" || select.id === "post-area-select") {
              const panel = wrap.querySelector(".cc-dd-subpanel");
              if (panel) panel.hidden = true;
              const arrow = wrap.querySelector(".cc-dd-subarrow");
              if (arrow) arrow.textContent = ">";
            }
          } else {
            wrap.classList.add("is-open");
            toggleEl.setAttribute("aria-expanded", "true");
            if (select.id === "default-city-primary" || select.id === "post-area-select") {
              const panel = wrap.querySelector(".cc-dd-subpanel");
              if (panel) panel.hidden = true;
              const arrow = wrap.querySelector(".cc-dd-subarrow");
              if (arrow) arrow.textContent = ">";
            }
          }
          return;
        }
        const itemEl = e.target.closest(".cc-dd-item");
        if (itemEl) {
          const wrap = itemEl.closest(".cc-select");
          if (!wrap) return;
          e.preventDefault();
          e.stopPropagation();
          if (itemEl.disabled || itemEl.classList.contains("is-disabled")) return;

          const selectEl = wrap.querySelector("select");
          const menuEl = wrap.querySelector(".cc-dd-menu");
          const valueEl = wrap.querySelector(".cc-dd-value");
          const value = itemEl.dataset.value;

          if (itemEl.dataset.role === "subtoggle") {
            const panel = itemEl.nextElementSibling;
            if (panel && panel.classList.contains("cc-dd-subpanel")) {
              panel.hidden = !panel.hidden;
              const arrow = itemEl.querySelector(".cc-dd-subarrow");
              if (arrow) arrow.textContent = panel.hidden ? ">" : "v";
            }
            return;
          }

          if (itemEl.dataset.role === "back") {
            if (selectEl.buildMenu) selectEl.buildMenu();
            return;
          }

          if (value === 'other' && (selectEl.id === 'default-city-primary' || selectEl.id === 'mypage-default-city-primary' || (selectEl.id && selectEl.id.includes('-city')))) {
              menuEl.innerHTML = '';
              const backBtn = document.createElement("button");
              backBtn.type = "button";
              backBtn.className = "cc-dd-item";
              backBtn.innerHTML = `&larr; 主要都市に戻る`;
              backBtn.dataset.role = "back";
              menuEl.appendChild(backBtn);

              const divider = document.createElement("div");
              divider.className = "cc-dd-divider";
              menuEl.appendChild(divider);

              const grouped = AREA_MINOR.reduce((acc, city) => {
                const provinceFull = city.name.split(', ')[1] || 'その他';
                const province = provinceFull.replace(/州|準州/,'');
                if (!acc[province]) acc[province] = [];
                acc[province].push(city);
                return acc;
              }, {});

              for (const province of Object.keys(grouped).sort()) {
                  const groupTitle = document.createElement("div");
                  groupTitle.className = "cc-dd-group-title";
                  groupTitle.textContent = province;
                  menuEl.appendChild(groupTitle);

                  grouped[province].forEach(city => {
                      const btn = document.createElement("button");
                      btn.type = "button";
                      btn.className = "cc-dd-item";
                      btn.textContent = city.name.split(', ')[0];
                      btn.dataset.value = city.key;
                      menuEl.appendChild(btn);
                  });
              }
            return;
          }
          
          const isSubmenuOpen = !!menuEl.querySelector('[data-role="back"]');
          if (isSubmenuOpen) {
            const optionExists = Array.from(selectEl.options).some(opt => opt.value === value);
            if (!optionExists) {
              const newOption = new Option(itemEl.textContent.trim(), value, false, true);
              selectEl.add(newOption);
            }
            selectEl.value = value;
            if(valueEl) {
              valueEl.textContent = itemEl.textContent.trim();
              valueEl.classList.remove('is-placeholder');
            }
            selectEl.dispatchEvent(new Event("change", { bubbles: true }));
            wrap.classList.remove("is-open");
            const toggleBtn = wrap.querySelector(".cc-dd-toggle");
            if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
            return;
          }

          const toggleBtn = wrap.querySelector(".cc-dd-toggle");
          if (selectEl) {
            selectEl.value = itemEl.dataset.value || "";
            selectEl.dispatchEvent(new Event("change", { bubbles: true }));
          }
          wrap.classList.remove("is-open");
          if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
          return;
        }
        if (e.target.closest(".cc-select")) return;
        document.querySelectorAll(".cc-select.is-open").forEach((el) => {
          el.classList.remove("is-open");
          const btn = el.querySelector(".cc-dd-toggle");
          if (btn) btn.setAttribute("aria-expanded", "false");
        });
      });
    }

    dd.dataset.ccSelectReady = "1";
  });
}

function ccResetSelectDropdown(selectEl) {
  if (!selectEl) return;
  const wrap = selectEl.closest(".cc-select");
  if (!wrap) return;
  delete wrap.dataset.ccSelectReady;
  const menu = wrap.querySelector(".cc-dd-menu");
  if (menu) menu.innerHTML = "";
}

function assertNotBanned(message) {
  if (!isCurrentUserBanned()) return true;
  openGlobalConfirmModal({
    id: "cc-banned-modal",
    title: "アカウント停止中",
    message: message || "アカウントが停止されているため操作できません。",
    confirmText: "OK",
    cancelText: "OK"
  });
  return false;
}

// ============================
// 都市：アカウント既定 / 一時選択 / ゲスト選択
// ============================
function getTempAreaKey() {
  return normalizeAreaKey(sessionStorage.getItem(KEY_TEMP_AREA) || "");
}
function setTempAreaKey(areaKey) {
  const k = normalizeAreaKey(areaKey);
  if (k) sessionStorage.setItem(KEY_TEMP_AREA, k);
}
function clearTempAreaKey() {
  sessionStorage.removeItem(KEY_TEMP_AREA);
}
function getGuestAreaKey() {
  return normalizeAreaKey(localStorage.getItem("pref_area") || "");
}
function setGuestAreaKey(areaKey) {
  const k = normalizeAreaKey(areaKey);
  if (k) localStorage.setItem("pref_area", k);
}
function getAccountDefaultAreaKey() {
  return normalizeAreaKey(getDefaultCityKey()) || "";
}
function isAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return ADMIN_EMAILS.some(a => a.toLowerCase() === e);
}
function ccIsAdminAllLocationMode() {
  const key = normalizeAreaKey(getDefaultCityKey()) || "";
  return isAdmin() && key === ADMIN_ALL_AREA_KEY;
}
function getInitialAreaKey() {
  const isLoggedIn = getLoggedInFlag() || !!getUserEmail();
  if (isLoggedIn) {
    return getTempAreaKey() || getAccountDefaultAreaKey() || "canada_all";
  }
  return getGuestAreaKey() || "canada_all";
}

// ★ログアウト処理（強化版）
function clearLoginState() {
  // ログイン状態に関わるキーを広めにクリア（プロトタイプの揺れ吸収）
  const keysToClear = [
    // flags
    "is_logged_in", "logged_in", "isLoggedIn",
    "mock_is_logged_in", "mock_logged_in", "mock_isLoggedIn",

    // identity
    "account_name", "accountName", "user_name", "userName", "userId", "username", "displayName", "display_name",
    "email", "user_email", "userEmail", "mail", "userMail",

    // mock identity
    "mock_user_email", "mock_email",
    "mock_account_name", "mock_accountName", "mock_user_name", "mock_username",
    "mock_user_role",

    // default city (account-bound)
    "mock_default_city", "mock_defaultCity",
    "default_city", "defaultCity",
    "canadaclassi_default_city",
    "mock_default_city_name", "mock_default_city_tz",

    // session/user objects
    "currentUser", "current_user", "user", "account", "profile",
    "canadaclassi_user", "canadaclassi_account",

    // auth tokens (if any)
    "auth_token", "token", "session_token", "access_token", "jwt"
  ];

  keysToClear.forEach(k => {
    try { localStorage.removeItem(k); } catch (e) { }
    try { sessionStorage.removeItem(k); } catch (e) { }
  });

  // 一時エリア選択は必ずクリア
  try { sessionStorage.removeItem("cc_temp_area"); } catch (e) { }
  try { sessionStorage.removeItem("cc_temp_area_name"); } catch (e) { }
  try { sessionStorage.removeItem("cc_temp_area_tz"); } catch (e) { }

  // UI: アカウントメニューが残っていたら消す
  try { removeAuthDropdown(); } catch (e) { }

  // window.name のログイン情報もクリア
  try {
    const parts = splitWindowNameParts(window.name || "");
    if (parts.postsToken) {
      window.name = WINDOW_POSTS_PREFIX + parts.postsToken;
    } else if ((window.name || "").startsWith(WINDOW_LOGIN_PREFIX)) {
      window.name = "";
    }
  } catch (e) { }
}

function removeAuthDropdown() {
  const m = document.getElementById("account-menu");
  if (m && m.parentNode) m.parentNode.removeChild(m);
}

// =========================================================
// クラシファイド投稿データ（共通）
// ・イベントは「クラシファイドの1カテゴリ」として扱う
// ・カレンダー側は“同じ投稿データ”から日付を拾って強調/一覧に使う
// ※現時点ではUI(表示)は変更しない。まずデータ基盤を共通化する。
// =========================================================

// カテゴリKey -> 表示名（左カラムの大分類に合わせる）
const CC_CATEGORY_LABELS = {
  housing: "住まい",
  jobs: "求人",
  sell: "売ります・譲ります",
  help: "助け合い",
  services: "サービス・講座",
  community: "仲間募集・交流",
  events: "イベント",
  school: "スクール" // ※将来カテゴリ追加時のため（現状未使用ならデータ側で使わない）
};

function ccNormalizeCategoryKey(rawCat) {
  const raw = String(rawCat || "").trim();
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  if (CC_CATEGORY_LABELS[lower]) return lower;
  if (/住まい|住宅|部屋|housing|house|home/.test(raw)) return "housing";
  if (/求人|仕事|アルバイト|バイト|jobs|job|work/.test(raw)) return "jobs";
  if (/売|譲|sell/.test(raw)) return "sell";
  if (/助け|help/.test(raw)) return "help";
  if (/サービス|講座|service/.test(raw)) return "services";
  if (/仲間|交流|community/.test(raw)) return "community";
  if (/イベント|event/.test(raw)) return "events";
  if (/スクール|school/.test(raw)) return "school";
  return raw;
}

// 既存の categories 定義に events はあるが、"スクール" が将来必要になった時に備えて表示名だけ用意しておく
// （UI側で勝手にカテゴリを増やさない。ここは“受け皿”で、表示はHTML側の左カラムに従う）

// 投稿キーの正規化（URLパラメータ/検索/並び替えで安定させる）
function ccNormalizePostKey(v) {
  return String(v || "").trim();
}

const CC_LEGACY_SEED_PREFIXES = ["demo_"];
const CC_LEGACY_SEED_KEYWORDS = ["thread_nesting_demo"];
function ccIsLegacySeedKey(value) {
  const text = String(value || "");
  if (!text) return false;
  if (CC_LEGACY_SEED_PREFIXES.some((prefix) => text.startsWith(prefix))) return true;
  return CC_LEGACY_SEED_KEYWORDS.some((keyword) => text.includes(keyword));
}

function ccFormatMockPrefix(text) {
  const base = String(text || "").trim();
  if (!base) return "【MOCK】";
  return base.startsWith("【MOCK】") ? base : `【MOCK】${base}`;
}

function ccIsMockPost(post) {
  return !!(post && (post.isMock === true || post.source === "mock" || ccIsMockPostKey(post.key)));
}

function ccGetPostDisplayTitle(post, fallback = "無題の投稿") {
  const base = String(post?.title || "").trim() || fallback;
  return ccIsMockPost(post) ? ccFormatMockPrefix(base) : base;
}

function ccIsMockBoardThread(thread) {
  return !!(thread && (thread.isMock === true || thread.source === "mock"));
}

function ccGetBoardDisplayTitle(thread, fallback = "—") {
  const base = String(thread?.title || thread?.body || "").trim() || fallback;
  return ccIsMockBoardThread(thread) ? ccFormatMockPrefix(base) : base;
}

function ccGetDisplayNameWithMock(name, isMock) {
  const base = String(name || "").trim();
  return isMock ? ccFormatMockPrefix(base || "相手未選択") : (base || "相手未選択");
}

function ccIsThreadMock(thread) {
  const postKey = String(thread?.postId || thread?.post_key || thread?.meta?.post_key || "");
  return !!(thread && (thread.isMock === true || thread.source === "mock" || ccIsMockPostKey(postKey)));
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ISO日付（YYYY-MM-DD）を返す（値が無ければ空）
function ccNormalizeYMD(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  // 既に YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYY/MM/DD -> YYYY-MM-DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-");
  return s;
}

// モック投稿（seed）
// ・テスト公開Aでは "mock" のみ表示
// ・本番ではサーバー/APIに置き換える
const CC_MOCK_POST_PREFIX = "mock_";
const CC_SEED_MINUTE_BUFFER_MS = 60 * 1000;
const CC_MOCK_SEED_VERSION = "2026-01-14-01";
const CC_MOCK_SEED_VERSION_KEY = "cc_mock_seed_version_v1";
function ccSeedIsoAgo(baseTs, offset) {
  const days = offset?.days || 0;
  const hours = offset?.hours || 0;
  const minutes = offset?.minutes || 0;
  const seconds = offset?.seconds || 0;
  const ms = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  const ts = baseTs - CC_SEED_MINUTE_BUFFER_MS - ms;
  return new Date(ts).toISOString();
}

function ccSeedDateFromBase(baseTs, offset) {
  const days = offset?.days || 0;
  const ms = days * 24 * 60 * 60 * 1000;
  const dt = new Date(baseTs + ms);
  return dt.toISOString().slice(0, 10);
}

function ccIsMockPostKey(key) {
  return String(key || "").startsWith(CC_MOCK_POST_PREFIX);
}

function ccApplySeedBoundaryDates(list, baseTs) {
  if (!Array.isArray(list)) return [];
  return list.map((post) => Object.assign({}, post));
}

function ccBuildSeedPosts(baseTs) {
  return CC_MOCK_POST_TEMPLATES.map((raw) => {
    const post = Object.assign({ isMock: true, source: "mock" }, raw);
    if (post.created_at_seed) {
      post.created_at = ccSeedIsoAgo(baseTs, post.created_at_seed);
    }
    if (post.event_date_seed) {
      post.event_date = ccSeedDateFromBase(baseTs, post.event_date_seed);
    }
    if (!post.created_at) {
      post.created_at = ccSeedIsoAgo(baseTs, { days: 2 });
    }
    if (!post.published_at) {
      post.published_at = post.created_at;
    }
    delete post.created_at_seed;
    delete post.event_date_seed;
    return post;
  });
}

const CC_MOCK_POST_COUNT = 50;
const CC_MOCK_CITIES = [
  { key: "vancouver", area: "バンクーバー", cityLabel: "Vancouver, BC" },
  { key: "toronto", area: "トロント", cityLabel: "Toronto, ON" },
  { key: "montreal", area: "モントリオール", cityLabel: "Montreal, QC" },
  { key: "calgary", area: "カルガリー", cityLabel: "Calgary, AB" },
  { key: "ottawa", area: "オタワ", cityLabel: "Ottawa, ON" },
  { key: "victoria", area: "ビクトリア", cityLabel: "Victoria, BC" }
];
const CC_MOCK_AUTHORS = ["MockUser", "Hana", "Sora", "Kai", "Mio", "Ren", "Yuna", "Noel"];
const CC_MOCK_CATEGORY_DEFS = [
  {
    cat: "sell",
    subs: ["家具", "家電", "キッチン", "衣類", "生活用品"],
    titles: ["IKEAデスク（美品）", "電子レンジを譲ります", "冬用コートまとめて", "食器セット一式", "小型ヒーターお譲りします"],
    descs: [
      "使用期間は短めで、目立つ傷は少なめです。{cityLabel}で受け渡し希望、価格交渉はご相談ください。",
      "動作確認済みです。{area}周辺での手渡し希望。早めに引き取っていただける方優先です。",
      "状態は写真の通りで、使用感はあります。{cityLabel}の公共の場所で受け渡し可能です。"
    ],
    price: { min: 20, max: 300, unit: "" },
    imageSeed: "items"
  },
  {
    cat: "housing",
    subs: ["シェアハウス", "ルームメイト", "サブレット", "短期"],
    titles: ["シェアハウス空きあり", "ルームメイト募集", "短期サブレット募集中", "静かな個室あります", "駅近シェアルーム"],
    descs: [
      "期間: {period}。家賃は{price}で光熱費込み。家具付きで、ルームメイトは1〜2名です。",
      "入居は{period}から相談可。デポジット{deposit}。{area}の生活音少なめエリアです。",
      "静かな環境で、女性限定（要相談）。最寄りから徒歩{walk}分、内見OKです。"
    ],
    price: { min: 600, max: 1500, unit: " /month" },
    imageSeed: "housing"
  },
  {
    cat: "jobs",
    subs: ["飲食", "清掃", "販売", "サポート"],
    titles: ["キッチンスタッフ募集", "カフェのスタッフ募集", "週末清掃スタッフ", "受付サポート募集", "配達サポート募集"],
    descs: [
      "内容: {job}. 時間帯は{hours}、時給{price}です。英語は日常会話レベルでOK。",
      "週{days}日、{area}周辺の勤務。履歴書は英語/日本語どちらでも可です。",
      "短期〜長期まで相談可。{cityLabel}で面接予定、経験者歓迎です。"
    ],
    price: { min: 15, max: 25, unit: " /hour" },
    imageSeed: "jobs"
  },
  {
    cat: "help",
    subs: ["引越し", "買い物", "送迎", "簡単作業"],
    titles: ["引越しの手伝い募集", "家具搬入のサポート", "買い物サポートお願い", "短時間の作業依頼", "配達の手伝い"],
    descs: [
      "{date}の{hours}にお手伝いをお願いしたいです。場所は{area}で、謝礼は{price}を予定。",
      "短時間（1〜2時間）で終わる内容です。{cityLabel}の受け渡し場所で集合予定です。",
      "体力作業は少なめです。交通費込みで{price}をお支払いします。"
    ],
    price: { min: 20, max: 80, unit: "" },
    imageSeed: "help"
  },
  {
    cat: "services",
    subs: ["英会話", "翻訳", "写真撮影", "レッスン"],
    titles: ["英会話の個別レッスン", "翻訳サポートします", "プロフィール写真撮影", "面接対策サポート", "履歴書添削"],
    descs: [
      "{area}で対面 or オンライン対応。料金は{price}目安で、初回は相談だけでもOKです。",
      "内容は柔軟に調整できます。{cityLabel}での対面相談も可能です。",
      "短時間の相談歓迎です。{price}前後、日程はメッセージで調整します。"
    ],
    price: { min: 20, max: 60, unit: "" },
    imageSeed: "services"
  },
  {
    cat: "community",
    subs: ["交流", "友達作り", "スポーツ", "趣味"],
    titles: ["週末カフェ交流", "ランニング仲間募集", "ボードゲーム会", "写真散歩メンバー募集", "日本語/英語交流"],
    descs: [
      "{date}に{area}で集まる予定です。初参加歓迎、参加費は{price}程度です。",
      "人数は少なめでゆったり。{cityLabel}周辺で開催します。",
      "初心者OK。集合場所は{area}、詳細は連絡で共有します。"
    ],
    price: { min: 0, max: 20, unit: "" },
    imageSeed: "community"
  },
  {
    cat: "events",
    subs: ["イベント", "交流会", "マーケット"],
    titles: ["日系コミュニティの交流イベント", "週末マーケット情報", "言語交換ミートアップ", "季節のコミュニティパーティー", "フードフェス参加者募集"],
    descs: [
      "{eventDate} {eventStart}〜{eventEnd}に開催。内容は{eventBody}、参加費は{price}です。場所は{place}。",
      "{eventDate}に{area}で開催。対象は{target}、事前申込が必要です。",
      "{eventDate}の{eventStart}から開催。{eventBody}中心のイベントです。"
    ],
    price: { min: 0, max: 50, unit: "" },
    imageSeed: "events",
    needsEventFields: true
  },
  {
    cat: "school",
    subs: ["語学", "資格", "勉強会"],
    titles: ["英会話クラス体験会", "就活用レジュメ講座", "カナダ生活オリエンテーション", "資格勉強会の参加者募集", "発音ワークショップ"],
    descs: [
      "{eventDate} {eventStart}〜{eventEnd}に開催。内容は{eventBody}、参加費は{price}。場所は{place}です。",
      "対象は初心者〜中級者。{area}で開催、{price}で参加できます。",
      "{eventDate}開催。少人数で丁寧に進めます。"
    ],
    price: { min: 0, max: 80, unit: "" },
    imageSeed: "school",
    needsEventFields: true
  }
];

function ccMockPick(list, idx, offset = 0) {
  if (!Array.isArray(list) || !list.length) return "";
  return list[(idx + offset) % list.length];
}

function ccMockPrice(def, idx) {
  if (!def || !def.price) return "";
  const min = def.price.min ?? 0;
  const max = def.price.max ?? min;
  const span = Math.max(0, max - min);
  const val = min + ((idx * 11) % (span + 1));
  if (def.cat === "events" || def.cat === "school" || def.cat === "community") {
    if (idx % 5 === 0) return "無料";
  }
  return String(val);
}

function ccMockDescription(def, ctx, idx) {
  const tpl = ccMockPick(def.descs, idx, 1) || "";
  const parts = {
    cityLabel: ctx.city.cityLabel,
    area: ctx.city.area,
    price: ctx.priceDisplay,
    period: ccMockPick(["1ヶ月〜", "3ヶ月〜", "即日可", "短期（1〜2ヶ月）"], idx),
    deposit: `$${400 + (idx % 4) * 100}`,
    walk: 5 + (idx % 10),
    job: ccMockPick(["接客・簡単な調理", "清掃・片付け", "受付補助", "配達補助"], idx),
    hours: ccMockPick(["10:00〜15:00", "18:00〜22:00", "週末のみ", "平日夕方中心"], idx),
    days: 2 + (idx % 4),
    date: ccMockPick(["今週末", "来週火曜", "今月末"], idx),
    eventDate: ctx.eventDate,
    eventStart: ctx.eventStart,
    eventEnd: ctx.eventEnd,
    eventBody: ccMockPick(["交流・情報交換", "マーケット見学", "学習会", "ワークショップ"], idx),
    target: ccMockPick(["初心者歓迎", "学生向け", "どなたでも"], idx),
    place: ctx.place
  };
  let text = tpl.replace(/\{(\w+)\}/g, (_, key) => parts[key] || "");
  if (idx % 6 === 0) text += "\n詳細はメッセージでご相談ください。";
  if (idx % 9 === 0) text = text + "😊";
  return text.trim();
}

function ccMockImages(def, idx) {
  const images = [];
  const mode = idx % 4;
  if (mode === 0) return images;
  const seedBase = `${def.imageSeed}-${idx + 1}`;
  images.push(`https://picsum.photos/seed/${seedBase}-1/800/600`);
  if (mode >= 2) images.push(`https://picsum.photos/seed/${seedBase}-2/800/600`);
  if (mode === 3) images.push(`https://picsum.photos/seed/${seedBase}-3/800/600`);
  return images;
}

function ccBuildMockPostTemplates() {
  const list = [];
  for (let i = 0; i < CC_MOCK_POST_COUNT; i += 1) {
    const city = CC_MOCK_CITIES[i % CC_MOCK_CITIES.length];
    const def = CC_MOCK_CATEGORY_DEFS[i % CC_MOCK_CATEGORY_DEFS.length];
    const sub = ccMockPick(def.subs, i);
    const author = ccMockPick(CC_MOCK_AUTHORS, i);
    let titleBase = ccMockPick(def.titles, i);
    const createdSeed = {
      days: (i * 3) % 90,
      hours: (i * 5) % 24,
      minutes: (i * 7) % 60
    };
    const status = (i % 7 === 0) ? "completed" : "active";
    if (status === "completed") titleBase = `${titleBase}（〆）`;
    const priceValue = ccMockPrice(def, i);
    const priceDisplay = formatCardPrice(priceValue, def.cat) || priceValue;
    const eventDate = ccSeedDateFromBase(Date.now(), { days: (i % 30) + 1 });
    const eventStart = ccMockPick(["10:00", "13:00", "18:00"], i);
    const eventEnd = ccMockPick(["12:00", "15:00", "20:00"], i);
    const place = city.cityLabel;
    const ctx = { city, priceDisplay, eventDate, eventStart, eventEnd, place };
    const description = ccMockDescription(def, ctx, i);
    const images = ccMockImages(def, i);
    const template = {
      key: `mock_post_${String(i + 1).padStart(2, "0")}`,
      cat: def.cat,
      sub: sub,
      city: city.key,
      area: city.area,
      title: titleBase,
      author: author,
      author_key: `mock_user_${String(i + 1).padStart(3, "0")}`,
      price: priceValue,
      priceUnit: def.cat === "housing" ? "month" : (def.cat === "jobs" ? "hour" : ""),
      images: images,
      description: description,
      created_at_seed: createdSeed,
      status: status
    };
    if (def.needsEventFields) {
      template.event_date_seed = { days: (i % 30) + 1 };
      template.event_start = eventStart;
      template.event_end = eventEnd;
      template.place = place;
    }
    list.push(template);
  }
  return list;
}

const CC_MOCK_POST_TEMPLATES = ccBuildMockPostTemplates();

function ccSeedPostStatusMock() {
  // mock seedの状態は初期値のみ（必要なら後で追加）
}

// =========================================================
// 掲示板データ（prototype）
// =========================================================
const CC_BOARD_KEY = "cc_board_threads";
const CC_BOARD_KEY_LEGACY = "cc_board_threads_v1";
const CC_MOCK_BOARD_TOPICS = [
  "渡航前に準備しておくことは？",
  "ワーホリ中の住まい探しのコツ",
  "現地での銀行口座開設について",
  "おすすめの英語学習方法を教えてください",
  "冬の防寒グッズで必須なもの",
  "仕事探しの流れや体験談",
  "公共交通の使い方と注意点",
  "中古品の受け渡しで気をつけること",
  "イベントや交流会の見つけ方",
  "トラブル回避のための注意点"
];
const CC_MOCK_BOARD_CATEGORIES = [
  "初心者Q&A",
  "住まい",
  "仕事・ワーホリ",
  "学校・留学",
  "イベント・交流",
  "トラブル注意",
  "雑談"
];
const CC_MOCK_BOARD_CITIES = [
  { area: "vancouver", cityLabel: "バンクーバー, BC" },
  { area: "toronto", cityLabel: "トロント, ON" },
  { area: "montreal", cityLabel: "モントリオール, QC" },
  { area: "calgary", cityLabel: "カルガリー, AB" },
  { area: "ottawa", cityLabel: "オタワ, ON" }
];
const CC_MOCK_BOARD_AUTHORS = ["MockUser", "Hana", "Sota", "Mio", "Ren", "Yuki"];

function ccBuildMockBoardReplies(threadId, baseTs, count, depth) {
  const list = [];
  const replyBodies = [
    "参考になりました。ありがとうございます！",
    "私も同じ状況でした。{tip}が助かりました。",
    "経験談ですが、{place}で相談するとスムーズでした。",
    "注意点として、{warn}は確認した方がいいです。",
    "少し違う意見ですが、{alt}も検討すると良いかも。"
  ];
  const tips = ["早めに連絡すること", "事前に書類を準備すること", "見学を複数回すること"];
  const warns = ["契約内容", "支払い方法", "受け渡し場所"];
  const alts = ["Facebookグループ", "現地掲示板", "知人経由"];
  for (let i = 0; i < count; i += 1) {
    const author = CC_MOCK_BOARD_AUTHORS[(i + depth) % CC_MOCK_BOARD_AUTHORS.length];
    const createdAt = ccSeedIsoAgo(baseTs, {
      days: (i + depth * 2) % 30,
      hours: (i * 3) % 24,
      minutes: (i * 7) % 60
    });
    const bodyBase = ccMockPick(replyBodies, i, depth);
    const body = bodyBase
      .replace("{tip}", ccMockPick(tips, i))
      .replace("{place}", ccMockPick(["市役所", "図書館", "コミュニティセンター"], i))
      .replace("{warn}", ccMockPick(warns, i))
      .replace("{alt}", ccMockPick(alts, i));
    const reply = {
      id: `mock_reply_${threadId}_${depth}_${i + 1}`,
      authorName: author,
      authorIcon: "icon_red_gray.png",
      isAnonymous: false,
      body: body,
      created_at: createdAt,
      replies: []
    };
    if (depth < 2 && i % 2 === 0) {
      reply.replies = ccBuildMockBoardReplies(threadId, baseTs, 2, depth + 1);
    }
    if (depth === 1 && i === 0) {
      reply.replies = reply.replies.concat(ccBuildMockBoardReplies(threadId, baseTs, 1, depth + 1));
    }
    list.push(reply);
  }
  return list;
}

function ccBuildMockBoardThreads() {
  const baseTs = Date.now();
  return CC_MOCK_BOARD_TOPICS.map((topic, idx) => {
    const city = CC_MOCK_BOARD_CITIES[idx % CC_MOCK_BOARD_CITIES.length];
    const author = CC_MOCK_BOARD_AUTHORS[idx % CC_MOCK_BOARD_AUTHORS.length];
    const createdAt = ccSeedIsoAgo(baseTs, { days: (idx * 2) % 40, hours: (idx * 5) % 24 });
    const replyCount = 3 + (idx % 5);
    return {
      id: `mock_thread_${String(idx + 1).padStart(2, "0")}`,
      title: topic,
      category: CC_MOCK_BOARD_CATEGORIES[idx % CC_MOCK_BOARD_CATEGORIES.length],
      authorName: author,
      authorIcon: "icon_red_gray.png",
      isAnonymous: false,
      area: city.area,
      cityLabel: city.cityLabel,
      body: `${topic}について相談です。現地での経験やおすすめがあれば教えてください。`,
      created_at: createdAt,
      notify: false,
      isMock: true,
      source: "mock",
      replies: ccBuildMockBoardReplies(`t${idx + 1}`, baseTs, replyCount, 0)
    };
  });
}

const CC_BOARD_DEFAULT = ccBuildMockBoardThreads();

function ccMigrateMockSeedIfNeeded() {
  try {
    const savedVersion = localStorage.getItem(CC_MOCK_SEED_VERSION_KEY) || "";
    if (savedVersion === CC_MOCK_SEED_VERSION) return;
    if (CC_DEBUG) console.log("[mock-seed] migrate start", savedVersion, "->", CC_MOCK_SEED_VERSION);

    try {
      const existing = ccReadUserPostsRaw();
      const userOnly = Array.isArray(existing) ? existing.filter((post) => {
        if (ccIsMockPost(post)) return false;
        const key = String(post?.key || "");
        if (ccIsLegacySeedKey(key)) return false;
        if (post?.source === "demo" || post?.isDemo === true) return false;
        return true;
      }) : [];
      const rebuilt = ccMergeMockPosts(userOnly, ccBuildSeedPosts(Date.now()), { replaceExisting: false });
      ccSaveUserPosts(rebuilt);
      const postHealth = ccLoadUserPosts();
      if (!Array.isArray(postHealth)) {
        const fallback = ccMergeMockPosts(userOnly, ccBuildSeedPosts(Date.now()), { replaceExisting: false });
        ccSaveUserPosts(fallback);
        if (CC_DEBUG) console.warn("[mock-seed] posts health check failed, fallback applied");
      }
      if (CC_DEBUG) console.log("[mock-seed] posts rebuilt", { userCount: userOnly.length, total: rebuilt.length });
    } catch (e) { }

    try {
      const existingThreads = ccLoadBoardThreads();
      const userThreads = Array.isArray(existingThreads) ? existingThreads.filter((thread) => {
        if (ccIsMockBoardThread(thread)) return false;
        const id = String(thread?.id || "");
        if (ccIsLegacySeedKey(id)) return false;
        if (thread?.source === "demo" || thread?.isDemo === true) return false;
        return true;
      }).map(ccNormalizeBoardThread) : [];
      const base = CC_BOARD_DEFAULT.map(ccNormalizeBoardThread);
      const merged = base.slice();
      userThreads.forEach((thread) => {
        if (!thread.id) return;
        if (merged.some((t) => String(t.id) === String(thread.id))) return;
        merged.unshift(thread);
      });
      ccSaveBoardThreads(merged);
      const boardHealth = ccLoadBoardThreads();
      if (!Array.isArray(boardHealth)) {
        const fallback = CC_BOARD_DEFAULT.map(ccNormalizeBoardThread).concat(userThreads);
        ccSaveBoardThreads(fallback);
        if (CC_DEBUG) console.warn("[mock-seed] board health check failed, fallback applied");
      }
      if (CC_DEBUG) console.log("[mock-seed] board rebuilt", { userCount: userThreads.length, total: merged.length });
    } catch (e) { }

    try {
      const threads = ccLoadInquiryThreads();
      const cleaned = Array.isArray(threads) ? threads.filter((thread) => {
        if (thread?.source === "demo" || thread?.isDemo === true) return false;
        if (thread?.isMock === true || thread?.source === "mock") return false;
        const postId = String(thread?.postId || "");
        if (ccIsMockPostKey(postId) || ccIsLegacySeedKey(postId)) return false;
        return true;
      }) : [];
      ccSaveInquiryThreads(cleaned);
      const inquiryHealth = ccLoadInquiryThreads();
      if (!Array.isArray(inquiryHealth)) {
        ccSaveInquiryThreads(cleaned);
        if (CC_DEBUG) console.warn("[mock-seed] inquiry health check failed, fallback applied");
      }
      if (CC_DEBUG) console.log("[mock-seed] inquiry threads cleaned", cleaned.length);
    } catch (e) { }

    try {
      const tokens = ccLoadInquiryTokens();
      const cleaned = Array.isArray(tokens) ? tokens.filter((token) => {
        if (token?.source === "demo" || token?.isDemo === true) return false;
        if (token?.isMock === true || token?.source === "mock") return false;
        return true;
      }) : [];
      ccSaveInquiryTokens(cleaned);
      const tokenHealth = ccLoadInquiryTokens();
      if (!Array.isArray(tokenHealth)) {
        ccSaveInquiryTokens(cleaned);
        if (CC_DEBUG) console.warn("[mock-seed] inquiry tokens health check failed, fallback applied");
      }
      if (CC_DEBUG) console.log("[mock-seed] inquiry tokens cleaned", cleaned.length);
    } catch (e) { }

    try {
      const listings = ccLoadInquiryListings();
      Object.keys(listings || {}).forEach((key) => {
        if (ccIsMockPostKey(key) || ccIsLegacySeedKey(key)) delete listings[key];
      });
      ccSaveInquiryListings(listings);
      const listingHealth = ccLoadInquiryListings();
      if (!listingHealth || typeof listingHealth !== "object") {
        ccSaveInquiryListings(listings);
        if (CC_DEBUG) console.warn("[mock-seed] inquiry listings health check failed, fallback applied");
      }
      if (CC_DEBUG) console.log("[mock-seed] inquiry listings cleaned");
    } catch (e) { }

    try {
      const sellers = ccLoadSellerInquiries();
      Object.keys(sellers || {}).forEach((key) => {
        if (ccIsMockPostKey(key) || ccIsLegacySeedKey(key)) delete sellers[key];
      });
      ccSaveSellerInquiries(sellers);
      const sellerHealth = ccLoadSellerInquiries();
      if (!sellerHealth || typeof sellerHealth !== "object") {
        ccSaveSellerInquiries(sellers);
        if (CC_DEBUG) console.warn("[mock-seed] seller inquiries health check failed, fallback applied");
      }
      if (CC_DEBUG) console.log("[mock-seed] seller inquiries cleaned");
    } catch (e) { }

    try {
      const db = ccLoadChatThreads();
      Object.keys(db || {}).forEach((id) => {
        const thread = db[id];
        const postKey = String(thread?.meta?.post_key || thread?.postId || "");
        if (thread?.source === "demo" || thread?.isDemo === true) {
          delete db[id];
        } else if (thread?.isMock === true || thread?.source === "mock" || ccIsMockPostKey(postKey)) {
          delete db[id];
        }
      });
      localStorage.setItem(CC_CHAT_THREADS_KEY, JSON.stringify(db || {}));
      const chatHealth = ccLoadChatThreads();
      if (!chatHealth || typeof chatHealth !== "object") {
        localStorage.setItem(CC_CHAT_THREADS_KEY, JSON.stringify(db || {}));
        if (CC_DEBUG) console.warn("[mock-seed] chat threads health check failed, fallback applied");
      }
      if (CC_DEBUG) console.log("[mock-seed] chat threads cleaned");
    } catch (e) { }

    try {
      const db = ccLoadArchivedThreads();
      Object.keys(db || {}).forEach((id) => {
        const thread = db[id];
        const postKey = String(thread?.meta?.post_key || thread?.postId || "");
        if (thread?.source === "demo" || thread?.isDemo === true) {
          delete db[id];
        } else if (thread?.isMock === true || thread?.source === "mock" || ccIsMockPostKey(postKey)) {
          delete db[id];
        }
      });
      localStorage.setItem(CC_CHAT_ARCHIVE_KEY, JSON.stringify(db || {}));
      const archiveHealth = ccLoadArchivedThreads();
      if (!archiveHealth || typeof archiveHealth !== "object") {
        localStorage.setItem(CC_CHAT_ARCHIVE_KEY, JSON.stringify(db || {}));
        if (CC_DEBUG) console.warn("[mock-seed] chat archive health check failed, fallback applied");
      }
      if (CC_DEBUG) console.log("[mock-seed] chat archive cleaned");
    } catch (e) { }

    try {
      localStorage.setItem(CC_MOCK_SEED_VERSION_KEY, CC_MOCK_SEED_VERSION);
      if (CC_DEBUG) console.log("[mock-seed] migrate done");
    } catch (e) { }
  } catch (e) { }
}

const CC_ANON_ICONS = [
  "icon_red_gray.png",
  "icon_red_lightblue.png",
  "icon_red_pink.png",
  "icon_yellow_blue.png",
  "icon_yellow_gray.png",
  "icon_yellow_pink.png"
];

function ccGetAccountName() {
  try {
    const saved = localStorage.getItem("cc_account_name");
    return saved ? String(saved).trim() : "";
  } catch (e) {
    return "";
  }
}

function ccGetAccountIcon() {
  try {
    const saved = localStorage.getItem("cc_account_icon");
    return saved ? String(saved).trim() : "";
  } catch (e) {
    return "";
  }
}

function ccGetDefaultAuthorProfile() {
  return {
    authorName: ccGetAccountName() || "ユーザー",
    authorIcon: ccGetAccountIcon() || "icon_red_gray.png",
    isAnonymous: false
  };
}

function ccPickAnonymousIcon() {
  const list = CC_ANON_ICONS.slice();
  return list[Math.floor(Math.random() * list.length)];
}

function ccNormalizeBoardReply(raw, parentId) {
  const r = raw && typeof raw === "object" ? raw : {};
  const legacyName = String(r.author || "").trim();
  const isAnonymous = r.isAnonymous === true || legacyName === "匿名";
  const authorName = String(r.authorName || legacyName || "").trim() || "匿名";
  const authorIcon = String(r.authorIcon || "").trim() || "icon_red_gray.png";
  const createdAt = r.created_at ? String(r.created_at) : "";
  const baseId = String(r.id || r.reply_id || "").trim();
  const hashBase = `${authorName}|${createdAt}|${String(r.body || "").trim()}`;
  const replyId = baseId || (hashBase.trim() ? `reply_${ccHashString(hashBase)}` : "");
  const parentReplyId = String(r.parentReplyId || r.parent_reply_id || parentId || "").trim();
  const replies = Array.isArray(r.replies)
    ? r.replies.map((child) => ccNormalizeBoardReply(child, replyId))
    : [];
  return {
    id: replyId,
    parentReplyId: parentReplyId,
    authorName: authorName,
    authorIcon: authorIcon,
    isAnonymous: isAnonymous,
    body: String(r.body || "").trim(),
    created_at: createdAt || new Date().toISOString(),
    replies: replies
  };
}

function ccNormalizeBoardThread(raw) {
  const t = raw && typeof raw === "object" ? raw : {};
  const areaRaw = String(t.area || "").trim();
  const cityLabelRaw = String(t.cityLabel || "").trim();
  const legacyCity = String(t.city || "").trim();
  const legacyName = String(t.author || "").trim();
  const isAnonymous = t.isAnonymous === true || legacyName === "匿名";
  const authorName = String(t.authorName || legacyName || "").trim() || "匿名";
  const authorIcon = String(t.authorIcon || "").trim() || "icon_red_gray.png";
  let area = normalizeAreaKey(areaRaw) || areaRaw || "";
  let cityLabel = cityLabelRaw || legacyCity || "";
  if (!cityLabel && area && typeof getDisplayAreaName === "function") {
    cityLabel = getDisplayAreaName(area) || area;
  }
  if (!area && (cityLabel || legacyCity)) {
    const base = cityLabel.split(",")[0].trim();
    area = normalizeAreaKey(base) || normalizeAreaKey(cityLabel || legacyCity) || "";
  }
  const replies = Array.isArray(t.replies) ? t.replies.map((reply) => ccNormalizeBoardReply(reply, "")) : [];
  return {
    id: String(t.id || "").trim(),
    title: String(t.title || "").trim(),
    body: String(t.body || "").trim(),
    category: String(t.category || "").trim() || "住まい",
    area: area,
    cityLabel: cityLabel,
    authorName: authorName,
    authorIcon: authorIcon,
    isAnonymous: isAnonymous,
    created_at: t.created_at ? String(t.created_at) : new Date().toISOString(),
    replies: replies,
    notify: !!t.notify,
    isMock: t.isMock === true || t.source === "mock",
    source: (t.isMock === true || t.source === "mock") ? "mock" : "user"
  };
}

function ccSeedBoardThreads() {
  try {
    const raw = localStorage.getItem(CC_BOARD_KEY);
    if (raw) return;
    const legacy = localStorage.getItem(CC_BOARD_KEY_LEGACY);
    if (legacy) localStorage.setItem(CC_BOARD_KEY, legacy);
  } catch (e) { }
}

function ccLoadBoardThreads() {
  try {
    const raw = localStorage.getItem(CC_BOARD_KEY);
    const data = raw ? JSON.parse(raw) : [];
    if (Array.isArray(data)) return data;
  } catch (e) { }
  try {
    const legacy = localStorage.getItem(CC_BOARD_KEY_LEGACY);
    const data = legacy ? JSON.parse(legacy) : [];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function ccSaveBoardThreads(list) {
  try {
    localStorage.setItem(CC_BOARD_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (e) { }
}

function ccGetBoardThreads(options) {
  const base = CC_SEED_MODE === "mock" ? CC_BOARD_DEFAULT.map(ccNormalizeBoardThread) : [];
  const local = ccLoadBoardThreads().map(ccNormalizeBoardThread).filter((thread) => {
    const id = String(thread?.id || "");
    if (ccIsLegacySeedKey(id)) return false;
    if (thread?.source === "demo" || thread?.isDemo === true) return false;
    return true;
  });
  const merged = base.slice();
  local.forEach((item) => {
    if (!item.id) return;
    const idx = merged.findIndex((t) => String(t.id) === String(item.id));
    if (idx >= 0) {
      merged[idx] = item;
    } else {
      merged.unshift(item);
    }
  });
  const allowHidden = !!(options && options.includeHidden && isAdmin());
  if (allowHidden) return merged;
  return merged.filter((item) => !ccIsBoardHidden(item?.id));
}

function ccGetBoardThreadById(id, options) {
  const key = String(id || "");
  return ccGetBoardThreads(options).find(t => String(t.id) === key) || null;
}

function ccUpsertLocalBoardThread(next) {
  if (!next || !next.id) return;
  const list = ccLoadBoardThreads().map(ccNormalizeBoardThread);
  const idx = list.findIndex((t) => String(t.id) === String(next.id));
  if (idx >= 0) {
    list[idx] = next;
  } else {
    list.unshift(next);
  }
  ccSaveBoardThreads(list);
}

function ccAddBoardThread(thread) {
  const normalized = ccNormalizeBoardThread(thread);
  if (!normalized.id) return null;
  ccUpsertLocalBoardThread(normalized);
  return normalized;
}

function ccUpdateBoardThread(threadId, patch) {
  const base = ccGetBoardThreadById(threadId);
  if (!base) return;
  const updated = ccNormalizeBoardThread(Object.assign({}, base, patch));
  ccUpsertLocalBoardThread(updated);
}

function ccFindBoardReply(replies, replyId) {
  if (!Array.isArray(replies) || !replyId) return null;
  for (const item of replies) {
    if (String(item?.id || "") === replyId) return item;
    const nested = ccFindBoardReply(item?.replies, replyId);
    if (nested) return nested;
  }
  return null;
}

function ccAddBoardReply(threadId, reply, parentReplyId) {
  const base = ccGetBoardThreadById(threadId);
  if (!base) return;
  const next = ccNormalizeBoardThread(base);
  next.replies = Array.isArray(next.replies) ? next.replies : [];
  const parentId = String(parentReplyId || reply?.parentReplyId || reply?.parent_reply_id || "").trim();
  const normalized = ccNormalizeBoardReply(reply, parentId || "");
  if (parentId) {
    const parent = ccFindBoardReply(next.replies, parentId);
    if (parent) {
      parent.replies = Array.isArray(parent.replies) ? parent.replies : [];
      normalized.parentReplyId = parent.id;
      parent.replies.push(normalized);
    } else {
      normalized.parentReplyId = "";
      next.replies.push(normalized);
    }
  } else {
    normalized.parentReplyId = "";
    next.replies.push(normalized);
  }
  ccUpsertLocalBoardThread(next);
}


// 選択都市（ヘッダー）を“今の保存ルール”に従って返す
function ccGetSelectedCity() {
  // getInitialAreaKey(): ログイン中=一時→既定 / ゲスト=pref_area→全カナダ
  const k = normalizeAreaKey(getInitialAreaKey()) || "canada_all";
  return k;
}

// 投稿一覧（将来APIに置き換える出口）
function ccGetPosts(options) {
  const list = ccLoadUserPosts();
  if ((options && options.includeHidden) || isAdmin()) return list;
  return list.filter((post) => !ccIsPostHidden(post?.key));
}

function ccReadUserPostsRaw() {
  let local = [];
  try {
    const raw = localStorage.getItem(CC_USER_POSTS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    local = Array.isArray(data) ? data : [];
  } catch (e) {
    local = [];
  }
  const windowPosts = decodeWindowPostsPayload(window.name || "");
  if (!Array.isArray(windowPosts) || !windowPosts.length) return local;
  if (!local.length) {
    try { localStorage.setItem(CC_USER_POSTS_KEY, JSON.stringify(windowPosts)); } catch (e) { }
    return windowPosts;
  }
  const merged = [];
  const seen = new Set();
  const push = (post) => {
    if (!post) return;
    const key = String(post.key || post.post_key || post.post_id || "").trim();
    if (key) {
      if (seen.has(key)) return;
      seen.add(key);
    }
    merged.push(post);
  };
  local.forEach(push);
  windowPosts.forEach(push);
  return merged;
}

function ccMergeMockPosts(existing, mockPosts, { replaceExisting = false } = {}) {
  const list = Array.isArray(existing) ? existing.slice() : [];
  const mockList = Array.isArray(mockPosts) ? mockPosts : [];
  const mockMap = new Map();
  mockList.forEach((post) => {
    const key = String(post?.key || "");
    if (!key) return;
    mockMap.set(key, post);
  });
  const seen = new Set();
  const merged = list.map((post) => {
    const key = String(post?.key || "");
    if (ccIsMockPostKey(key) && mockMap.has(key)) {
      seen.add(key);
      return replaceExisting ? mockMap.get(key) : post;
    }
    return post;
  });
  mockList.forEach((post) => {
    const key = String(post?.key || "");
    if (!key || seen.has(key)) return;
    if (merged.some((item) => String(item?.key || "") === key)) return;
    merged.push(post);
  });
  merged.forEach((post) => {
    const key = String(post?.key || "");
    if (!ccIsMockPostKey(key)) return;
    post.price = sanitizePriceForStorage(post?.price);
    if (!post.priceUnit) {
      const catKey = getPostCategoryKey(post);
      if (catKey === "housing") post.priceUnit = "month";
      if (catKey === "jobs") post.priceUnit = "hour";
    }
  });
  return merged;
}

function ccMergeSeedPosts(existing, incoming, seedNow) {
  const base = Array.isArray(existing) ? existing.slice() : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];
  const adjustedIncoming = ccApplySeedBoundaryDates(incomingList, seedNow);
  const incomingMock = adjustedIncoming.filter((post) => ccIsMockPostKey(post?.key));
  const incomingManual = adjustedIncoming.filter((post) => !ccIsMockPostKey(post?.key));
  const seen = new Set(base.map((post) => String(post?.key || "")));
  incomingManual.forEach((post) => {
    const key = String(post?.key || "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    base.push(post);
  });
  const mockSource = incomingMock.length ? incomingMock : ccBuildSeedPosts(seedNow);
  return ccMergeMockPosts(base, mockSource, { replaceExisting: true });
}

function ccRestoreMockPosts() {
  const existing = ccReadUserPostsRaw();
  const base = Array.isArray(existing) ? existing : [];
  const mock = ccBuildSeedPosts(Date.now());
  const merged = ccMergeMockPosts(base, mock, { replaceExisting: false });
  ccSaveUserPosts(merged);
  return merged;
}

function ccResetAllPosts() {
  const mock = ccBuildSeedPosts(Date.now());
  ccSaveUserPosts(mock);
  return mock;
}

function ccEnsureSeedPosts() {
  const existing = ccReadUserPostsRaw();
  const hasExisting = Array.isArray(existing) && existing.length > 0;
  const baseTs = Date.now();
  if (CC_SEED_MODE !== "mock") return Array.isArray(existing) ? existing : [];
  const mock = ccBuildSeedPosts(baseTs);
  if (!hasExisting) {
    ccSaveUserPosts(mock);
    return mock;
  }
  const merged = ccMergeMockPosts(existing, mock, { replaceExisting: false });
  if (merged.length !== existing.length) {
    ccSaveUserPosts(merged);
  }
  return merged;
}

function ccNormalizePostRecord(post) {
  const next = Object.assign({}, post || {});
  let key = String(next.key || next.post_key || next.post_id || next.id || "").trim();
  if (!key) key = ccGeneratePostId();
  if (key) next.key = key;
  if (!next.post_id) next.post_id = key || "";
  if (!next.id) next.id = next.post_id || next.key || "";
  if (!next.title) next.title = next.post_title || next.name || "";
  if (!next.desc) next.desc = next.description || next.body || "";
  next.cat = ccNormalizeCategoryKey(
    next.cat
    || next.category
    || next.cat_key
    || next.categoryKey
    || next.category_key
    || next.type
  );
  if (!next.sub) next.sub = next.subcategory || next.sub_category || "";
  if (!next.city) next.city = next.city_key || next.area_key || "canada_all";
  if (!next.area && typeof getDisplayAreaName === "function") {
    next.area = getDisplayAreaName(next.city) || next.area || "";
  }
  if (!Array.isArray(next.images)) {
    const fallbackImage = next.image || next.img || "";
    next.images = fallbackImage ? [fallbackImage] : [];
  }
  if (!next.images.length) next.images = ["logo5_transparent.png"];
  if (!next.created_at) next.created_at = next.createdAt || next.created || next.published_at || "";
  if (!next.created_at) next.created_at = new Date().toISOString();
  if (!next.updated_at) next.updated_at = next.updatedAt || next.updated || next.created_at || "";
  return next;
}

function ccLoadUserPosts() {
  const raw = ccReadUserPostsRaw();
  let touched = false;
  const cleaned = Array.isArray(raw) ? raw.filter((post) => {
    const key = String(post?.key || "");
    if (ccIsLegacySeedKey(key)) return false;
    if (post?.source === "demo" || post?.isDemo === true) return false;
    return true;
  }).map((post) => {
    const next = ccNormalizePostRecord(post);
    if (!post?.key || !post?.post_id || !post?.id) touched = true;
    if (!Array.isArray(post?.images) || !post.images.length) touched = true;
    if (!post?.created_at || !post?.updated_at) touched = true;
    if (!post?.cat || !post?.title) touched = true;
    const isMock = next.isMock === true || next.source === "mock" || ccIsMockPostKey(next.key);
    next.isMock = isMock;
    next.source = isMock ? "mock" : "user";
    return next;
  }) : [];
  if (Array.isArray(raw) && (raw.length !== cleaned.length || touched)) {
    ccSaveUserPosts(cleaned);
  }
  if (Array.isArray(cleaned) && cleaned.length) {
    return cleaned;
  }
  return ccEnsureSeedPosts();
}

function ccSaveUserPosts(list) {
  const payload = JSON.stringify(Array.isArray(list) ? list : []);
  let saved = false;
  try {
    localStorage.setItem(CC_USER_POSTS_KEY, payload);
    saved = true;
  } catch (e) { }
  try {
    sessionStorage.setItem(CC_USER_POSTS_SESSION_KEY, payload);
  } catch (e) { }
  try {
    const postsToken = encodeWindowPostsPayload(list);
    const parts = splitWindowNameParts(window.name || "");
    const loginToken = parts.loginToken;
    if (postsToken) {
      window.name = (loginToken ? WINDOW_LOGIN_PREFIX + loginToken : "") +
        (loginToken ? WINDOW_POSTS_SEPARATOR : WINDOW_POSTS_PREFIX) +
        postsToken;
    }
  } catch (e) { }
}

function ccAddUserPost(post) {
  const list = ccLoadUserPosts();
  const next = ccNormalizePostRecord(Object.assign({ isMock: false, source: "user" }, post));
  next.isMock = false;
  next.source = "user";
  const now = new Date().toISOString();
  if (!next.created_at) next.created_at = now;
  if (!next.updated_at) next.updated_at = next.created_at;
  if (!next.published_at) next.published_at = next.created_at;
  if (!next.status) next.status = "active";
  if (!next.cat) next.cat = "sell";
  if (!next.sub) next.sub = "";
  if (!next.city) next.city = ccGetSelectedCity() || "canada_all";
  if (!next.area && typeof getDisplayAreaName === "function") {
    next.area = getDisplayAreaName(next.city) || "";
  }
  if (!next.key) next.key = next.post_id || ccGeneratePostId();
  if (!next.id) next.id = next.post_id || next.key;
  if (!next.post_id) {
    let candidate = ccGeneratePostId();
    let guard = 0;
    while (list.some(p => String(p.post_id) === candidate) && guard < 10) {
      candidate = ccGeneratePostId();
      guard += 1;
    }
    next.post_id = candidate;
  }
  if (!Array.isArray(next.images) || !next.images.length) {
    next.images = ["logo5_transparent.png"];
  }
  list.unshift(next);
  ccSaveUserPosts(list);
}

function ccGeneratePostId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "CC-";
  for (let i = 0; i < 5; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  out += Math.floor(Math.random() * 10);
  return out;
}

function ccUpdateUserPost(postKey, patch) {
  const list = ccLoadUserPosts();
  const idx = list.findIndex(p => String(p.key) === String(postKey));
  if (idx < 0) return false;
  const next = Object.assign({}, list[idx], patch);
  next.updated_at = new Date().toISOString();
  list[idx] = ccNormalizePostRecord(next);
  ccSaveUserPosts(list);
  return true;
}

function ccGetPostByKey(postKey, options) {
  const key = ccNormalizePostKey(postKey);
  if (!key) return null;
  return ccGetPosts(options).find((p) => {
    const candidates = [p?.key, p?.post_key, p?.post_id, p?.id];
    return candidates.some((value) => ccNormalizePostKey(value) === key);
  }) || null;
}

// city と cat でフィルタ
function ccFilterPosts({ cityKey = "", catKey = "" } = {}) {
  const city = normalizeAreaKey(cityKey) || "";
  const cat = String(catKey || "").trim();
  return ccGetPosts().filter(p => {
    if (ccIsPostDeleted(p?.key)) return false;
    const pCity = normalizeAreaKey(p?.city) || "";
    const adminAll = isAdmin() && city === ADMIN_ALL_AREA_KEY;
    const okCity = adminAll ? true : ((!city || city === "canada_all" || city === "other") ? true : (pCity === city));
    const okCat = (!cat) ? true : (String(p?.cat || "").trim() === cat);
    return okCity && okCat;
  });
}

// イベント投稿（cat=events）を日付で集約して eventDB 互換の形に変換
// 返す形: { 'YYYY-MM-DD': [ { title, url, post_key } ... ] }
function ccBuildEventDBFromPosts(cityKey) {
  const city = normalizeAreaKey(cityKey) || ccGetSelectedCity();
  const events = ccFilterPosts({ cityKey: city, catKey: "events" }).concat(
    ccFilterPosts({ cityKey: city, catKey: "school" })
  );
  const db = {};
  events.forEach(ev => {
    const ymd = ccNormalizeYMD(ev?.event_date);
    if (!ymd) return;
    if (!db[ymd]) db[ymd] = [];
    db[ymd].push({
      title: ccGetPostDisplayTitle(ev, ""),
      post_key: ccNormalizePostKey(ev?.key || "")
    });
  });
  return db;
}

// デバッグ用に公開（UIは触らず、データ確認だけできるように）
window.CanadaClassiDev = window.CanadaClassiDev || {};
window.CanadaClassiDev.ccGetPosts = ccGetPosts;
window.CanadaClassiDev.ccGetPostByKey = ccGetPostByKey;
window.CanadaClassiDev.ccGetPostDisplayTitle = ccGetPostDisplayTitle;
window.CanadaClassiDev.ccGetBoardThreads = ccGetBoardThreads;
window.CanadaClassiDev.ccGetBoardThreadById = ccGetBoardThreadById;
window.CanadaClassiDev.ccGetBoardDisplayTitle = ccGetBoardDisplayTitle;
window.CanadaClassiDev.ccAddBoardThread = ccAddBoardThread;
window.CanadaClassiDev.ccAddBoardReply = ccAddBoardReply;
window.CanadaClassiDev.ccUpdateBoardThread = ccUpdateBoardThread;
window.CanadaClassiDev.ccGetDisplayNameWithMock = ccGetDisplayNameWithMock;
window.CanadaClassiDev.ccIsBoardHidden = ccIsBoardHidden;
window.CanadaClassiDev.ccIsBoardReplyHidden = ccIsBoardReplyHidden;
window.CanadaClassiDev.ccCheckNgWords = ccCheckNgWords;
window.CanadaClassiDev.ccGetVisibleAnnouncements = ccGetVisibleAnnouncements;
window.CanadaClassiDev.ccBuildEventDBFromPosts = ccBuildEventDBFromPosts;
window.CanadaClassiDev.ccGetSelectedCity = ccGetSelectedCity;
window.CanadaClassiDev.ccGetPostStatusInfo = ccGetPostStatusInfo;
window.CanadaClassiDev.ccIsEventClosed = ccIsEventClosed;
window.CanadaClassiDev.ccIsAdminAllLocationMode = ccIsAdminAllLocationMode;
window.CanadaClassiDev.openReportModal = openReportModal;
window.CanadaClassiDev.ccGetAreaSetting = function (key) {
  const k = normalizeAreaKey(key) || key || "canada_all";
  return { key: k, name: getDisplayAreaName(k), tz: getAreaTimeZone(k) };
};
window.CanadaClassiDev.ccGetSelectedTimeZone = function () {
  return getAreaTimeZone(ccGetSelectedCity());
};

const CC_DAYS_WINDOW = 7;
const CC_RELATIVE_CUTOFF_DAYS = CC_DAYS_WINDOW;
const CC_INDEX_NEW_WINDOW_DAYS = CC_DAYS_WINDOW;
window.CanadaClassiDev.ccIndexNewWindowDays = CC_DAYS_WINDOW;

function ccNormalizeTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parts = trimmed.split("-").map((p) => Number(p));
      if (parts.length === 3) {
        const [y, m, d] = parts;
        if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
          return new Date(y, m - 1, d).getTime();
        }
      }
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function ccIsAdminPage() {
  const path = String(location.pathname || "").toLowerCase();
  return path.endsWith("admin.html");
}

function ccGetDebugParams() {
  const params = new URLSearchParams(location.search || "");
  return {
    debug: params.get("debug") === "1",
    tz: String(params.get("tz") || "").trim()
  };
}

function ccIsValidTimeZone(tz) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch (e) {
    return false;
  }
}

function ccGetAccountTimezone() {
  try {
    const email = String(getUserEmail() || "").trim().toLowerCase();
    if (!email) return "";
    const users = getMockUsersDB();
    const user = users.find((u) => String(u?.email || "").trim().toLowerCase() === email);
    return String(user?.timezone || user?.default_city_tz || "").trim();
  } catch (e) {
    return "";
  }
}

function ccGetViewerTimezoneInfo() {
  if (ccIsAdminPage()) {
    return { tz: "Asia/Tokyo", source: "account" };
  }
  const debug = ccGetDebugParams();
  if (debug.debug && debug.tz && ccIsValidTimeZone(debug.tz)) {
    return { tz: debug.tz, source: "query" };
  }
  const accountTz = ccGetAccountTimezone();
  if (accountTz && ccIsValidTimeZone(accountTz)) {
    return { tz: accountTz, source: "account" };
  }
  const intlTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return { tz: intlTz, source: "intl" };
}

function ccGetViewerTimezone() {
  return ccGetViewerTimezoneInfo().tz;
}

function initDebugOverlay() {
  const params = ccGetDebugParams();
  if (!params.debug) return;
  const info = ccGetViewerTimezoneInfo();
  const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const nowView = formatDateForView(nowIso, info.tz, true, true);
  let el = document.getElementById("cc-debug-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "cc-debug-overlay";
    el.className = "cc-debug-overlay";
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div><strong>DEBUG</strong> debug=1</div>
    <div>viewerTimezone: ${escapeHtml(info.tz)}</div>
    <div>viewerTimezoneSource: ${escapeHtml(info.source)}</div>
    <div>now(UTC): ${escapeHtml(nowIso)}</div>
    <div>now(viewer): ${escapeHtml(nowView)}</div>
  `;
}

function ccFormatWithTimeZone(ts, timeZone, withTime, withSeconds) {
  const base = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  };
  if (withTime) {
    base.hour = "2-digit";
    base.minute = "2-digit";
    base.hour12 = false;
    if (withSeconds) base.second = "2-digit";
  }
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", Object.assign({ timeZone }, base)).formatToParts(new Date(ts));
  } catch (e) {
    parts = new Intl.DateTimeFormat("en-CA", base).formatToParts(new Date(ts));
  }
  const pick = (type) => (parts.find((p) => p.type === type) || {}).value || "";
  const y = pick("year");
  const m = pick("month");
  const d = pick("day");
  if (!withTime) return `${y}-${m}-${d}`;
  const hh = pick("hour");
  const mm = pick("minute");
  if (!withSeconds) return `${y}-${m}-${d} ${hh}:${mm}`;
  const ss = pick("second");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function formatDateForView(value, viewerTimezone, withSeconds = false, withTime = true) {
  let tz = viewerTimezone;
  let seconds = !!withSeconds;
  let time = Object.prototype.hasOwnProperty.call(arguments, 3) ? !!withTime : true;

  if (viewerTimezone && typeof viewerTimezone === "object") {
    const opts = viewerTimezone;
    const mode = String(opts.mode || "").toLowerCase();
    tz = opts.viewerTimezone || (mode === "admin" ? "Asia/Tokyo" : ccGetViewerTimezone());
    time = Object.prototype.hasOwnProperty.call(opts, "withTime") ? !!opts.withTime : true;
    seconds = Object.prototype.hasOwnProperty.call(opts, "withSeconds") ? !!opts.withSeconds : (mode === "admin");
  }
  if (!tz) tz = ccGetViewerTimezone();
  if (ccIsAdminPage()) tz = "Asia/Tokyo";
  if (value === null || value === undefined || value === "") return "—";
  const ts = ccNormalizeTimestamp(value);
  if (ts === null) return "—";
  if (!Number.isFinite(ts)) return "—";
  return ccFormatWithTimeZone(ts, tz, time, seconds);
}

function formatDateLabel(raw) {
  return formatDateForView(raw, ccGetViewerTimezone(), false, false);
}

function formatDateTimeSeconds(raw) {
  return formatDateForView(raw, "Asia/Tokyo", true, true);
}

function formatRelativeTime(raw, opts = {}) {
  const ts = ccNormalizeTimestamp(raw);
  if (ts === null) return formatDateForView(raw, ccGetViewerTimezone(), false, true);
  const now = opts.now instanceof Date ? opts.now.getTime() : (Number.isFinite(opts.now) ? opts.now : Date.now());
  const diffMs = now - ts;
  if (!Number.isFinite(diffMs) || diffMs < 0) return formatDateForView(raw, ccGetViewerTimezone(), false, true);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}時間前`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}日前`;
}

function formatPostCreatedAtForPublicMeta(input) {
  const ts = ccNormalizeTimestamp(input);
  const viewerTz = ccGetViewerTimezone();
  const absolute = formatDateForView(input, viewerTz, false, true);
  if (ts === null) return { text: absolute, absolute, isRelative: false };
  const now = Date.now();
  const diffMs = now - ts;
  if (!Number.isFinite(diffMs) || diffMs < 0) return { text: absolute, absolute, isRelative: false };
  const cutoffMs = CC_RELATIVE_CUTOFF_DAYS * 24 * 60 * 60 * 1000;
  if (diffMs < cutoffMs) {
    return { text: formatRelativeTime(ts, { now }), absolute, isRelative: true };
  }
  return { text: absolute, absolute, isRelative: false };
}

function formatPostCreatedAtForPublic(input, opts = {}) {
  const meta = formatPostCreatedAtForPublicMeta(input);
  return meta.text;
}

function ccHashString(str) {
  const s = String(str || "");
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Storage key constants (single source of truth).
// Add new CC_*_KEY values here to avoid TDZ/ordering issues.
const CC_POST_STATUS_KEY_PREFIX = "cc_post_status__";
const CC_POST_DEAL_KEY = "cc_post_deal_status_v1";
const CC_POST_DELETED_KEY = "cc_post_deleted_v1";
const CC_POST_HIDDEN_KEY = "cc_post_hidden_v1";
const CC_BOARD_HIDDEN_KEY = "cc_board_hidden_v1";
const CC_BOARD_REPLY_HIDDEN_KEY = "cc_board_reply_hidden_v1";
const CC_REPORTS_KEY = "cc_reports_v1";
const CC_ADMIN_AUDIT_KEY = "cc_admin_audit_v1";
const CC_NG_WORDS_KEY = "cc_ng_words_v1";
const CC_REPORT_REASONS_KEY = "cc_report_reasons_v1";
const CC_ANNOUNCEMENTS_KEY = "cc_announcements_v1";
const CC_STATIC_PAGES_KEY = "ccStaticPages";
const CC_STATIC_PAGES_HISTORY_KEY = "ccStaticPagesHistory";
const CC_STATIC_DRAFTS_KEY = "ccStaticDrafts";
const CC_CONVERSATION_FLAGS_KEY = "cc_conversation_flags_v1";
const CC_CHAT_THREADS_KEY = "cc_chat_threads_v1";
const CC_CHAT_ARCHIVE_KEY = "cc_chat_archived_v1";
const CC_FAVORITES_KEY = "cc_favorites_v1";
const CC_INQUIRY_THREADS_KEY = "cc_inquiry_threads_v1";
const CC_INQUIRY_TOKENS_KEY = "cc_inquiry_tokens_v1";
const CC_INQUIRY_LISTINGS_KEY = "cc_inquiry_listings_v1";
const CC_INQUIRY_BLOCKED_KEY = "cc_inquiry_blocked_v1";
const CC_INQUIRY_REPORTS_KEY = "cc_inquiry_reports_v1";
const CC_INQUIRY_RATE_LIMIT_MS = 30000;
const CC_USER_POSTS_KEY = "cc_user_posts_v1";
const CC_USER_POSTS_SESSION_KEY = "cc_user_posts_v1_session";
const CC_SELLER_INQUIRIES_KEY = "cc_seller_inquiries_v1";
const CC_ADMIN_DATA_BACKUP_KEY = "cc_admin_data_backup_last_v1";
const CC_ADMIN_DATA_KEYS = [
  CC_REPORTS_KEY,
  CC_ADMIN_AUDIT_KEY,
  CC_POST_HIDDEN_KEY,
  CC_POST_DELETED_KEY,
  CC_BOARD_HIDDEN_KEY,
  CC_BOARD_REPLY_HIDDEN_KEY,
  CC_CONVERSATION_FLAGS_KEY,
  CC_ANNOUNCEMENTS_KEY,
  CC_STATIC_PAGES_KEY,
  CC_STATIC_PAGES_HISTORY_KEY,
  CC_STATIC_DRAFTS_KEY,
  CC_NG_WORDS_KEY,
  CC_REPORT_REASONS_KEY,
  "mock_users",
  "users"
];
const ccSafeKey = (value) => (typeof value === "string" && value) ? value : null;
const CC_SEED_KEYS_BASE = [
  "mock_users",
  ccSafeKey(typeof CC_USER_POSTS_KEY !== "undefined" ? CC_USER_POSTS_KEY : null),
  ccSafeKey(typeof CC_BOARD_KEY !== "undefined" ? CC_BOARD_KEY : null),
  ccSafeKey(typeof CC_INQUIRY_THREADS_KEY !== "undefined" ? CC_INQUIRY_THREADS_KEY : null),
  ccSafeKey(typeof CC_REPORTS_KEY !== "undefined" ? CC_REPORTS_KEY : null),
  ccSafeKey(typeof CC_INQUIRY_REPORTS_KEY !== "undefined" ? CC_INQUIRY_REPORTS_KEY : null),
  ccSafeKey(typeof CC_POST_HIDDEN_KEY !== "undefined" ? CC_POST_HIDDEN_KEY : null),
  ccSafeKey(typeof CC_POST_DELETED_KEY !== "undefined" ? CC_POST_DELETED_KEY : null),
  ccSafeKey(typeof CC_BOARD_HIDDEN_KEY !== "undefined" ? CC_BOARD_HIDDEN_KEY : null),
  ccSafeKey(typeof CC_BOARD_REPLY_HIDDEN_KEY !== "undefined" ? CC_BOARD_REPLY_HIDDEN_KEY : null),
  ccSafeKey(typeof CC_CONVERSATION_FLAGS_KEY !== "undefined" ? CC_CONVERSATION_FLAGS_KEY : null),
  ccSafeKey(typeof CC_ADMIN_AUDIT_KEY !== "undefined" ? CC_ADMIN_AUDIT_KEY : null),
  ccSafeKey(typeof CC_ANNOUNCEMENTS_KEY !== "undefined" ? CC_ANNOUNCEMENTS_KEY : null),
  ccSafeKey(typeof CC_NG_WORDS_KEY !== "undefined" ? CC_NG_WORDS_KEY : null),
  ccSafeKey(typeof CC_REPORT_REASONS_KEY !== "undefined" ? CC_REPORT_REASONS_KEY : null)
].filter(Boolean);

function ccNormalizePostStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "completed" || s === "done" || s === "finished") return "completed";
  if (s === "cancelled" || s === "canceled" || s === "cancel") return "cancelled";
  if (s === "deleted" || s === "removed") return "deleted";
  if (s === "in_progress" || s === "active" || s === "open" || s === "") return "active";
  return "active";
}

function ccGetStatusKind(cat) {
  return "受付";
}

function ccGetStatusLabels(cat) {
  const kind = ccGetStatusKind(cat);
  return {
    kind,
    active: `${kind}中`,
    completed: `${kind}終了`,
    cancelled: `キャンセル（投稿者により${kind}がキャンセルされました）`,
    deleted: "削除済み"
  };
}

function ccGetPlanStatusLabel(cat) {
  const map = {
    sell: "受け渡し予定者",
    housing: "入居予定者",
    jobs: "面接予定者",
    help: "お願いする",
    services: "サービス予約者",
    community: "参加予定者",
    events: "参加予定者",
    school: "受講予定者"
  };
  const key = String(cat || "").toLowerCase();
  return map[key] || "予定者";
}

function ccLoadDeletedPosts() {
  try {
    const raw = localStorage.getItem(CC_POST_DELETED_KEY);
    const db = raw ? JSON.parse(raw) : {};
    return (db && typeof db === "object") ? db : {};
  } catch (e) {
    return {};
  }
}

function ccSaveDeletedPosts(db) {
  try { localStorage.setItem(CC_POST_DELETED_KEY, JSON.stringify(db || {})); } catch (e) { }
}

function ccLoadHiddenPosts() {
  try {
    const raw = localStorage.getItem(CC_POST_HIDDEN_KEY);
    const db = raw ? JSON.parse(raw) : {};
    return (db && typeof db === "object") ? db : {};
  } catch (e) {
    return {};
  }
}

function ccSaveHiddenPosts(db) {
  try { localStorage.setItem(CC_POST_HIDDEN_KEY, JSON.stringify(db || {})); } catch (e) { }
}

function ccLoadHiddenBoards() {
  try {
    const raw = localStorage.getItem(CC_BOARD_HIDDEN_KEY);
    const db = raw ? JSON.parse(raw) : {};
    return (db && typeof db === "object") ? db : {};
  } catch (e) {
    return {};
  }
}

function ccSaveHiddenBoards(db) {
  try { localStorage.setItem(CC_BOARD_HIDDEN_KEY, JSON.stringify(db || {})); } catch (e) { }
}

function ccIsBoardHidden(threadId) {
  const key = String(threadId || "").trim();
  if (!key) return false;
  const db = ccLoadHiddenBoards();
  return !!(db[key] || db[key.toLowerCase()]);
}

function ccSetBoardHidden(threadId, hidden, meta) {
  if (!assertAdmin()) return false;
  const key = String(threadId || "").trim();
  if (!key) return false;
  const db = ccLoadHiddenBoards();
  if (hidden) {
    const payload = {
      hidden: true,
      hidden_at: meta?.hidden_at || new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      hidden_by: meta?.hidden_by || "",
      reason: meta?.reason || ""
    };
    db[key] = payload;
    db[key.toLowerCase()] = payload;
  } else {
    delete db[key];
    delete db[key.toLowerCase()];
  }
  ccSaveHiddenBoards(db);
  return true;
}

function ccLoadHiddenBoardReplies() {
  try {
    const raw = localStorage.getItem(CC_BOARD_REPLY_HIDDEN_KEY);
    const db = raw ? JSON.parse(raw) : {};
    return (db && typeof db === "object") ? db : {};
  } catch (e) {
    return {};
  }
}

function ccSaveHiddenBoardReplies(db) {
  try { localStorage.setItem(CC_BOARD_REPLY_HIDDEN_KEY, JSON.stringify(db || {})); } catch (e) { }
}

function ccIsBoardReplyHidden(replyId) {
  const key = String(replyId || "").trim();
  if (!key) return false;
  const db = ccLoadHiddenBoardReplies();
  return !!(db[key] || db[key.toLowerCase()]);
}

function ccSetBoardReplyHidden(replyId, hidden, meta) {
  if (!assertAdmin()) return false;
  const key = String(replyId || "").trim();
  if (!key) return false;
  const db = ccLoadHiddenBoardReplies();
  if (hidden) {
    const payload = {
      hidden: true,
      hidden_at: meta?.hidden_at || new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      hidden_by: meta?.hidden_by || ""
    };
    db[key] = payload;
    db[key.toLowerCase()] = payload;
  } else {
    delete db[key];
    delete db[key.toLowerCase()];
  }
  ccSaveHiddenBoardReplies(db);
  return true;
}

function ccIsPostHidden(postKey) {
  const key = String(postKey || "").trim();
  if (!key) return false;
  const db = ccLoadHiddenPosts();
  return !!(db[key] || db[key.toLowerCase()]);
}

function ccSetPostHidden(postKey, hidden, meta) {
  if (!assertAdmin()) return false;
  const key = String(postKey || "").trim();
  if (!key) return false;
  const db = ccLoadHiddenPosts();
  if (hidden) {
    const payload = {
      hidden: true,
      hidden_at: meta?.hidden_at || new Date().toISOString(),
      hidden_by: meta?.hidden_by || "",
      reason: meta?.reason || ""
    };
    db[key] = payload;
    db[key.toLowerCase()] = payload;
  } else {
    delete db[key];
    delete db[key.toLowerCase()];
  }
  ccSaveHiddenPosts(db);
  return true;
}

function ccLoadReports() {
  try {
    const raw = localStorage.getItem(CC_REPORTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function ccSaveReports(list) {
  try {
    localStorage.setItem(CC_REPORTS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (e) { }
}

function ccAddReport(report) {
  const list = ccLoadReports();
  list.push(report);
  ccSaveReports(list);
}

function ccLoadAdminAudit() {
  try {
    const raw = localStorage.getItem(CC_ADMIN_AUDIT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function ccSaveAdminAudit(list) {
  try {
    localStorage.setItem(CC_ADMIN_AUDIT_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (e) { }
}

function ccAddAdminAudit(entry) {
  if (!assertAdmin()) return;
  if (entry && entry.at && !entry.at_epoch_ms) {
    const t = Date.parse(entry.at);
    if (!Number.isNaN(t)) entry.at_epoch_ms = t;
  }
  const list = ccLoadAdminAudit();
  list.push(entry);
  ccSaveAdminAudit(list);
}

function ccGetInquiryThreadId(input) {
  if (!input) return "";
  if (typeof input === "string") return String(input);
  if (input.threadId) return String(input.threadId);
  if (input.thread_id) return String(input.thread_id);
  const postKey = String(input.post_key || input.postId || "").trim().toLowerCase();
  const a = String(input.participantA || input.buyerEmail || input.buyerId || "").trim().toLowerCase();
  const b = String(input.participantB || input.sellerEmail || input.sellerId || "").trim().toLowerCase();
  if (!postKey || !a || !b) return "";
  const pair = [a, b].sort().join("|");
  return `thread_${postKey}_${pair}`;
}

function ccLoadConversationFlags() {
  try {
    const raw = localStorage.getItem(CC_CONVERSATION_FLAGS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return (obj && typeof obj === "object") ? obj : {};
  } catch (e) {
    return {};
  }
}

function ccSaveConversationFlags(map) {
  try {
    localStorage.setItem(CC_CONVERSATION_FLAGS_KEY, JSON.stringify(map || {}));
  } catch (e) {}
}

function ccGetConversationFlag(threadId) {
  const id = ccGetInquiryThreadId(threadId);
  if (!id) return null;
  const db = ccLoadConversationFlags();
  return db[id] || db[id.toLowerCase()] || null;
}

function ccIsConversationFrozen(threadId) {
  const flag = ccGetConversationFlag(threadId);
  return !!flag?.frozen;
}

function ccSetConversationFrozen(threadId, frozen, meta) {
  if (!assertAdmin()) return false;
  const id = ccGetInquiryThreadId(threadId);
  if (!id) return false;
  const db = ccLoadConversationFlags();
  if (frozen) {
    const payload = {
      frozen: true,
      frozen_at: meta?.frozen_at || new Date().toISOString(),
      frozen_by: meta?.frozen_by || "",
      note: meta?.note || ""
    };
    db[id] = payload;
    db[id.toLowerCase()] = payload;
  } else {
    delete db[id];
    delete db[id.toLowerCase()];
  }
  ccSaveConversationFlags(db);
  return true;
}

function assertConversationNotFrozen(threadId) {
  if (!ccIsConversationFrozen(threadId)) return true;
  openGlobalConfirmModal({
    id: "cc-conversation-frozen-modal",
    title: "送信できません",
    message: "この会話は運営により凍結されています。",
    confirmText: "OK",
    cancelText: "OK"
  });
  return false;
}

const CC_DEFAULT_REPORT_REASONS = [
  { id: "scam", label: "詐欺" },
  { id: "spam", label: "スパム" },
  { id: "abuse", label: "不適切" },
  { id: "illegal", label: "違法" },
  { id: "other", label: "その他" }
];

function ccNormalizeReportReasons(raw) {
  const enabled = raw && typeof raw.enabled === "boolean" ? raw.enabled : true;
  const reasons = Array.isArray(raw?.reasons) ? raw.reasons : [];
  const cleaned = reasons.map((r) => ({
    id: String(r?.id || "").trim() || `reason_${Date.now()}`,
    label: String(r?.label || "").trim()
  })).filter((r) => r.label);
  return { enabled, reasons: cleaned };
}

function ccLoadReportReasons() {
  try {
    const raw = localStorage.getItem(CC_REPORT_REASONS_KEY);
    if (!raw) return { enabled: true, reasons: CC_DEFAULT_REPORT_REASONS.slice() };
    const obj = JSON.parse(raw);
    const normalized = ccNormalizeReportReasons(obj);
    if (normalized.enabled && !normalized.reasons.length) {
      return { enabled: true, reasons: CC_DEFAULT_REPORT_REASONS.slice() };
    }
    return normalized;
  } catch (e) {
    return { enabled: true, reasons: CC_DEFAULT_REPORT_REASONS.slice() };
  }
}

function ccSaveReportReasons(data) {
  const normalized = ccNormalizeReportReasons(data);
  try { localStorage.setItem(CC_REPORT_REASONS_KEY, JSON.stringify(normalized)); } catch (e) { }
}

function ccGetActiveReportReasons() {
  const data = ccLoadReportReasons();
  if (!data.enabled || !data.reasons.length) return CC_DEFAULT_REPORT_REASONS.slice();
  return data.reasons.slice();
}

function ccApplyReportReasonsToSelect(selectEl) {
  if (!selectEl) return;
  const reasons = ccGetActiveReportReasons();
  selectEl.innerHTML = "";
  reasons.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = String(r.id || r.label || "");
    opt.textContent = String(r.label || "");
    selectEl.appendChild(opt);
  });
}

const CC_DEFAULT_NG_WORDS = {
  enabled: false,
  words: [],
  targets: { post: true, board: true, inquiry: true }
};

function ccNormalizeNgWords(raw) {
  const enabled = raw && typeof raw.enabled === "boolean" ? raw.enabled : CC_DEFAULT_NG_WORDS.enabled;
  const words = Array.isArray(raw?.words) ? raw.words : [];
  const cleaned = words.map((w) => String(w || "").trim()).filter(Boolean);
  const targets = Object.assign({}, CC_DEFAULT_NG_WORDS.targets, raw?.targets || {});
  return { enabled, words: cleaned, targets };
}

function ccLoadNgWords() {
  try {
    const raw = localStorage.getItem(CC_NG_WORDS_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    return ccNormalizeNgWords(obj || CC_DEFAULT_NG_WORDS);
  } catch (e) {
    return ccNormalizeNgWords(CC_DEFAULT_NG_WORDS);
  }
}

function ccSaveNgWords(data) {
  const normalized = ccNormalizeNgWords(data);
  try { localStorage.setItem(CC_NG_WORDS_KEY, JSON.stringify(normalized)); } catch (e) { }
}

function ccFindNgMatches(text, target) {
  const data = ccLoadNgWords();
  if (!data.enabled) return [];
  if (target && data.targets && data.targets[target] === false) return [];
  const raw = String(text || "").toLowerCase();
  if (!raw) return [];
  const matches = [];
  data.words.forEach((w) => {
    const needle = String(w || "").toLowerCase();
    if (!needle) return;
    if (raw.includes(needle)) matches.push(w);
  });
  return Array.from(new Set(matches));
}

function ccBlockNgWords(matches) {
  const words = Array.isArray(matches) ? matches : [];
  const list = words.length ? `禁止ワード: ${words.join(" / ")}` : "禁止ワードが含まれています。";
  openGlobalConfirmModal({
    id: "cc-ng-words-modal",
    title: "送信できません",
    message: list,
    confirmText: "OK",
    cancelText: "OK"
  });
}

function ccCheckNgWords(text, target) {
  const matches = ccFindNgMatches(text, target);
  if (!matches.length) return true;
  ccBlockNgWords(matches);
  return false;
}

function ccLoadAnnouncements() {
  try {
    const raw = localStorage.getItem(CC_ANNOUNCEMENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function ccSaveAnnouncements(list) {
  try {
    localStorage.setItem(CC_ANNOUNCEMENTS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (e) { }
}

function ccLoadStaticPages() {
  try {
    const raw = localStorage.getItem(CC_STATIC_PAGES_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch (e) {
    return {};
  }
}

function ccSaveStaticPages(data) {
  try {
    localStorage.setItem(CC_STATIC_PAGES_KEY, JSON.stringify(data && typeof data === "object" ? data : {}));
  } catch (e) { }
}

function ccLoadStaticPagesHistory() {
  try {
    const raw = localStorage.getItem(CC_STATIC_PAGES_HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch (e) {
    return {};
  }
}

function ccSaveStaticPagesHistory(data) {
  try {
    localStorage.setItem(CC_STATIC_PAGES_HISTORY_KEY, JSON.stringify(data && typeof data === "object" ? data : {}));
  } catch (e) { }
}

function ccGetStaticDirectoryConfigs() {
  return {
    school: {
      title: "学校情報",
      meta: "語学学校・専門学校・カレッジ",
      searchPlaceholder: "学校名やキーワードで検索",
      items: [
        { name: "Vancouver Language Hub", desc: "短期集中・ビジネス英語に強い語学学校。", tags: ["語学", "短期", "バンクーバー"], region: "バンクーバー" },
        { name: "Pacific Career College", desc: "IT・デザイン系の専門ディプロマ。", tags: ["専門", "IT", "トロント"], region: "トロント" },
        { name: "Maple Community College", desc: "ホスピタリティとカレッジ進学サポート。", tags: ["カレッジ", "ホスピタリティ", "ビクトリア"], region: "ビクトリア" },
        { name: "Northern University Pathway", desc: "大学編入・進学相談に対応。", tags: ["大学", "進学", "全国"], region: "全国" }
      ]
    },
    links: {
      title: "外部リンク",
      meta: "公的機関・生活情報",
      searchPlaceholder: "機関名や内容で検索",
      externalLinks: true,
      items: [
        { name: "IRCC", desc: "ビザ・滞在情報の公式サイト", url: "https://www.canada.ca/", tags: ["Immigration", "Canada"], region: "Canada" },
        { name: "Service Canada", desc: "SIN番号・公的サービスの案内", url: "https://www.servicecanada.gc.ca/", tags: ["Government", "Canada"], region: "Canada" },
        { name: "BC Transit", desc: "バンクーバー近郊の公共交通情報", url: "https://www.translink.ca/", tags: ["Transportation", "BC"], region: "バンクーバー" },
        { name: "Ontario Health", desc: "オンタリオ州の医療・保険情報", url: "https://www.ontario.ca/page/health-care-ontario", tags: ["Health", "ON"], region: "オンタリオ" }
      ]
    }
  };
}

function ccBuildStaticDirectoryHtml(config) {
  const items = Array.isArray(config?.items) ? config.items : [];
  const tags = Array.isArray(config?.tags)
    ? config.tags
    : Array.from(new Set(items.flatMap((item) => Array.isArray(item.tags) ? item.tags : [])));
  const placeholder = String(config?.searchPlaceholder || "キーワードで検索");
  return `
    <div class="static-directory">
      <div class="static-toolbar">
        <div class="static-search">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="search" id="static-search" placeholder="${escapeHtml(placeholder)}" aria-label="検索" />
          <button class="static-search-btn" id="static-search-btn" type="button" aria-label="検索">
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
        <div class="static-toolbar-meta">
          <div class="static-count" id="static-count">0件</div>
          <button class="btn btn-secondary static-clear" id="static-clear" type="button">クリア</button>
        </div>
      </div>
      <div class="static-tags" role="toolbar" aria-label="カテゴリ">
        <button class="tag-pill is-active" type="button" data-tag="all" aria-pressed="true">すべて</button>
        ${tags.map((tag) => `<button class="tag-pill" type="button" data-tag="${escapeHtml(tag)}" aria-pressed="false">${escapeHtml(tag)}</button>`).join("")}
      </div>
      <div class="static-card-grid" id="static-card-grid"></div>
      <div class="static-empty" id="static-empty" hidden>該当する情報がありません。条件を変えて探してください。</div>
    </div>
  `;
}

function ccGetStaticDefaultBodyHtml(type) {
  const key = String(type || "").toLowerCase();
  const directory = ccGetStaticDirectoryConfigs();
  if (directory[key]) return ccBuildStaticDirectoryHtml(directory[key]);
  if (key === "guide") {
    return `
      <article class="static-article">
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">基本の使い方</h2>
          <p class="static-lead">エリアを選択して、投稿一覧から目的の情報を探せます。</p>
          <p>気になる投稿があれば、チャットで相談・問い合わせができます。</p>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">メッセージ</h2>
          <p>取引はチャットでやり取りできます。返信期限や条件を明確にしましょう。</p>
        </section>
      </article>
    `;
  }
  if (key === "post-guide") {
    return `
      <article class="static-article">
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">投稿の注意点</h2>
          <ul class="static-list">
            <li><span class="k">写真</span><span class="v">著作権・肖像権を侵害しない画像を使用してください。</span></li>
            <li><span class="k">価格</span><span class="v">明確な金額を記載し、条件がある場合は補足を記載。</span></li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">取引ルール</h2>
          <ul class="static-list">
            <li><span class="k">取引</span><span class="v">受け渡し場所・支払い方法は事前に明確にしましょう。</span></li>
            <li><span class="k">禁止</span><span class="v">違法取引や危険物の出品は禁止です。</span></li>
          </ul>
        </section>
      </article>
    `;
  }
  if (key === "scam") {
    return `
      <article class="static-article">
        <section class="static-section">
          <p class="muted">テスト公開版です。内容は予告なく更新されます。</p>
          <h2 class="static-h2 static-h2-leaf">テスト公開版について</h2>
          <p class="static-lead">このページはテスト公開A向けの暫定版です。内容は予告なく更新される場合があります。</p>
          <p>当サービスは取引の場を提供するのみで、取引の安全を保証するものではありません。</p>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">取引前に必ず確認</h2>
          <ul class="static-list">
            <li>相手の氏名・連絡先・受け渡し方法を確認する</li>
            <li>可能なら対面、公共の場所で受け渡しする</li>
            <li>受け渡し場所・時間は第三者にも共有する</li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">送金に注意</h2>
          <ul class="static-list">
            <li>不自然に急かす、先払いのみ要求、外部サイトへ誘導する相手は要注意</li>
            <li>返金保証を口頭だけで約束する相手は避ける</li>
            <li>「今だけ」「今日中」など強い圧をかける相手は警戒する</li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">個人情報の扱い</h2>
          <ul class="static-list">
            <li>パスポートや身分証の画像送付は慎重に（必要最小限）</li>
            <li>住所・電話番号などは、取引の必要範囲に限定する</li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">危険な兆候（例）</h2>
          <ul class="static-list">
            <li>相場より極端に安い／高い</li>
            <li>説明が曖昧、質問に答えない、写真や情報が不足している</li>
            <li>連絡手段を限定する、外部ツールへ強引に誘導する</li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">困ったとき</h2>
          <ul class="static-list">
            <li>少しでも不審に感じたら連絡を中止する</li>
            <li>被害が疑われる場合は、警察など関係機関に相談する</li>
            <li>当サービスの通報機能は準備中です（テスト公開版）</li>
          </ul>
        </section>
      </article>
    `;
  }
  if (key === "terms") {
    return `
      <article class="static-article">
        <section class="static-section">
          <p class="muted">テスト公開版です。内容は予告なく更新されます。</p>
          <h2 class="static-h2 static-h2-leaf">最終更新日</h2>
          <p class="static-lead">2026-01-13</p>
          <p>本規約はテスト公開A向けの暫定版です。内容は予告なく更新される場合があります。</p>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">1. サービスの性質</h2>
          <p>当サービスは、利用者同士の情報掲載・連絡の場を提供するものです。取引の当事者は利用者であり、当サービスは取引に関与しません。</p>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">2. 禁止事項</h2>
          <ul class="static-list">
            <li>虚偽情報の投稿、なりすまし</li>
            <li>違法行為、違法行為を助長する募集</li>
            <li>誹謗中傷、差別、嫌がらせ、脅迫</li>
            <li>詐欺目的の投稿、外部サイトへの不審な誘導</li>
            <li>個人情報の不適切な掲載（本人・第三者を含む）</li>
            <li>スパム行為（同内容の連投、過度な宣伝、荒らし）</li>
            <li>当サービスの運営を妨げる行為</li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">3. 投稿・アカウントの取り扱い</h2>
          <p>運営は、以下の場合に投稿の非表示・削除、アカウントの制限等を行うことがあります。</p>
          <ul class="static-list">
            <li>規約違反がある、またはその疑いがある場合</li>
            <li>安全上の理由がある場合</li>
            <li>事実関係の確認が困難で、トラブル防止が必要な場合</li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">4. 免責</h2>
          <ul class="static-list">
            <li>取引・連絡は、利用者の責任で行ってください。</li>
            <li>運営は、取引の成立、支払い、配送、品質、損害等について保証しません。</li>
            <li>利用者間のトラブルについて、運営は原則として介入しません。</li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">5. 変更・停止</h2>
          <p>テスト公開版のため、機能・表示・仕様・本規約は予告なく変更される場合があります。サービス提供を停止する場合もあります。</p>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">6. お問い合わせ</h2>
          <p>テスト公開版のお問い合わせは、support@canadaclassi.local（仮）までご連絡ください。</p>
        </section>
      </article>
    `;
  }
  if (key === "privacy") {
    return `
      <article class="static-article">
        <section class="static-section">
          <p class="muted">テスト公開版です。内容は予告なく更新されます。</p>
          <h2 class="static-h2 static-h2-leaf">最終更新日</h2>
          <p class="static-lead">2026-01-13</p>
          <p>このプライバシーポリシーは、CanadaClassi（カナダくらし）（以下「当サービス」）における、利用者情報の取り扱いを定めるものです。テスト公開期間中のため、取得・保存・削除の扱いは本番と異なる場合があります。</p>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">1. 取得する情報（例）</h2>
          <ul class="static-list">
            <li>アカウント登録情報（メールアドレス、表示名、デフォルト都市）</li>
            <li>投稿・問い合わせに関する情報（タイトル、本文、カテゴリ、価格、画像、メッセージ内容）</li>
            <li>利用状況の計測（導入する場合：ページ閲覧、クリック、端末・ブラウザ情報など）</li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">2. 取得しない情報（例）</h2>
          <ul class="static-list">
            <li>クレジットカード情報、銀行口座情報などの決済情報</li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">3. 利用目的</h2>
          <ul class="static-list">
            <li>サービス提供（ログイン、投稿、問い合わせなど）</li>
            <li>不正利用防止、セキュリティ対策</li>
            <li>品質改善、機能改善、トラブル分析</li>
            <li>お問い合わせ対応、連絡</li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">4. 第三者提供</h2>
          <p>法令に基づく場合を除き、本人の同意なく第三者へ提供することはありません。</p>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">5. 保存期間と削除</h2>
          <ul class="static-list">
            <li>テスト公開期間中は、予告なくデータが削除される場合があります。</li>
            <li>不正利用や規約違反が疑われる場合、調査のため一定期間保存される場合があります。</li>
          </ul>
        </section>
        <section class="static-section">
          <h2 class="static-h2 static-h2-leaf">6. お問い合わせ</h2>
          <p>プライバシーに関するお問い合わせは、support@canadaclassi.local（仮）へご連絡ください。</p>
        </section>
      </article>
    `;
  }
  return "";
}

function ccGetVisibleAnnouncements(limit) {
  const list = ccLoadAnnouncements().slice();
  const visible = list.filter((a) => a && a.visible);
  visible.sort((a, b) => {
    const ta = Date.parse(a.created_at || "") || 0;
    const tb = Date.parse(b.created_at || "") || 0;
    return tb - ta;
  });
  if (typeof limit === "number") return visible.slice(0, limit);
  return visible;
}

function renderAnnouncements() {
  const root = document.getElementById("cc-announcements");
  if (!root) return;
  const list = ccGetVisibleAnnouncements(3);
  if (!list.length) {
    root.innerHTML = '<div class="notice-item">現在お知らせはありません。</div>';
    return;
  }
  root.innerHTML = list.map((item) => {
    const title = escapeHtml(String(item.title || "お知らせ"));
    const body = escapeHtml(String(item.body || ""));
    return `
      <div class="notice-item notice-item--stack">
        <div class="notice-item-title">${title}</div>
        ${body ? `<div class="notice-item-body">${body}</div>` : ""}
      </div>
    `;
  }).join("");
}

function ccIsPostDeleted(postKey) {
  const key = String(postKey || "").trim();
  if (!key) return false;
  const db = ccLoadDeletedPosts();
  return !!(db[key] || db[key.toLowerCase()]);
}

function ccSetPostDeleted(postKey, deleted) {
  const key = String(postKey || "").trim();
  if (!key) return;
  const db = ccLoadDeletedPosts();
  if (deleted) {
    db[key] = { deleted: true, deleted_at: new Date().toISOString() };
    db[key.toLowerCase()] = db[key];
  } else {
    delete db[key];
    delete db[key.toLowerCase()];
  }
  ccSaveDeletedPosts(db);
  try {
    const statusKey = `${CC_POST_STATUS_KEY_PREFIX}${key}`;
    localStorage.setItem(statusKey, deleted ? "deleted" : "active");
    const lowerKey = `${CC_POST_STATUS_KEY_PREFIX}${key.toLowerCase()}`;
    localStorage.setItem(lowerKey, deleted ? "deleted" : "active");
  } catch (e) { }
}

function ccNormalizeFavKey(key) {
  return String(key || "").trim().toLowerCase();
}

function ccLoadFavorites() {
  try {
    const raw = localStorage.getItem(CC_FAVORITES_KEY);
    const data = raw ? JSON.parse(raw) : [];
    if (Array.isArray(data)) {
      return new Set(data.map(ccNormalizeFavKey).filter(Boolean));
    }
    if (data && typeof data === "object") {
      return new Set(Object.keys(data).map(ccNormalizeFavKey).filter(Boolean));
    }
  } catch (e) { }
  return new Set();
}

function ccSaveFavorites(set) {
  try {
    const list = Array.from(set || []).filter(Boolean);
    localStorage.setItem(CC_FAVORITES_KEY, JSON.stringify(list));
  } catch (e) { }
}

function ccIsFavorite(postKey) {
  const key = ccNormalizeFavKey(postKey);
  if (!key) return false;
  const set = ccLoadFavorites();
  return set.has(key);
}

function ccToggleFavorite(postKey) {
  const key = ccNormalizeFavKey(postKey);
  if (!key) return false;
  const set = ccLoadFavorites();
  if (set.has(key)) set.delete(key);
  else set.add(key);
  ccSaveFavorites(set);
  return set.has(key);
}

function ccSetPostDealDone(postKey, done) {
  const raw = String(postKey || "").trim();
  if (!raw) return;
  const lower = raw.toLowerCase();
  try {
    const existing = localStorage.getItem(CC_POST_DEAL_KEY);
    const db = existing ? JSON.parse(existing) : {};
    const payload = { done: !!done, updated_at: new Date().toISOString() };
    db[raw] = payload;
    db[lower] = payload;
    localStorage.setItem(CC_POST_DEAL_KEY, JSON.stringify(db));
  } catch (e) { }
  try {
    localStorage.setItem(`${CC_POST_STATUS_KEY_PREFIX}${raw}`, done ? "completed" : "active");
    localStorage.setItem(`${CC_POST_STATUS_KEY_PREFIX}${lower}`, done ? "completed" : "active");
  } catch (e) { }
  try {
    const list = ccLoadUserPosts();
    const idx = list.findIndex(p => String(p?.key || "") === raw);
    if (idx >= 0) {
      list[idx] = Object.assign({}, list[idx], {
        status: done ? "completed" : "active",
        completed_at: done ? new Date().toISOString() : ""
      });
      ccSaveUserPosts(list);
    }
  } catch (e) { }
}

function ccLoadChatThreads() {
  try {
    const raw = localStorage.getItem(CC_CHAT_THREADS_KEY);
    const db = raw ? JSON.parse(raw) : {};
    if (!db || typeof db !== "object") return {};
    let touched = false;
    Object.keys(db).forEach((id) => {
      const thread = db[id];
      if (ccIsLegacySeedKey(id) || thread?.source === "demo" || thread?.isDemo === true) {
        delete db[id];
        touched = true;
        return;
      }
      const postKey = String(thread?.meta?.post_key || thread?.postId || "");
      const isMock = thread?.isMock === true || thread?.source === "mock" || ccIsMockPostKey(postKey);
      if (thread && thread.isMock !== isMock) {
        thread.isMock = isMock;
        touched = true;
      }
      const nextSource = isMock ? "mock" : "user";
      if (thread && thread.source !== nextSource) {
        thread.source = nextSource;
        touched = true;
      }
    });
    if (touched) {
      try { localStorage.setItem(CC_CHAT_THREADS_KEY, JSON.stringify(db)); } catch (e) { }
    }
    return db;
  } catch (e) {
    return {};
  }
}

function ccLoadArchivedThreads() {
  try {
    const raw = localStorage.getItem(CC_CHAT_ARCHIVE_KEY);
    const db = raw ? JSON.parse(raw) : {};
    if (!db || typeof db !== "object") return {};
    let touched = false;
    Object.keys(db).forEach((id) => {
      const thread = db[id];
      if (ccIsLegacySeedKey(id) || thread?.source === "demo" || thread?.isDemo === true) {
        delete db[id];
        touched = true;
        return;
      }
      const postKey = String(thread?.meta?.post_key || thread?.postId || "");
      const isMock = thread?.isMock === true || thread?.source === "mock" || ccIsMockPostKey(postKey);
      if (thread && thread.isMock !== isMock) {
        thread.isMock = isMock;
        touched = true;
      }
      const nextSource = isMock ? "mock" : "user";
      if (thread && thread.source !== nextSource) {
        thread.source = nextSource;
        touched = true;
      }
    });
    if (touched) {
      try { localStorage.setItem(CC_CHAT_ARCHIVE_KEY, JSON.stringify(db)); } catch (e) { }
    }
    return db;
  } catch (e) {
    return {};
  }
}

function ccStripRefPrefix(ref) {
  return String(ref || "").trim().replace(/^（[^）]+）\s*/g, "");
}

function ccThreadMatchesPostKey(thread, postKey, postTitle) {
  const meta = thread?.meta || {};
  const directKey = String(meta.post_key || "").trim();
  if (directKey && directKey === String(postKey || "").trim()) return true;
  const ref = ccStripRefPrefix(meta.ref || "");
  if (ref && postTitle && ref === String(postTitle || "").trim()) return true;
  return false;
}

function ccHasBlockingThreads(postKey) {
  const post = ccGetPostByKey(postKey);
  const title = post?.title || "";
  const db = ccLoadChatThreads();
  const archived = ccLoadArchivedThreads();
  return Object.keys(db || {}).some((id) => {
    if (archived && archived[id]) return false;
    const th = db[id];
    if (!th) return false;
    const role = String(th?.meta?.role || "").toLowerCase();
    if (role && role !== "owner") return false;
    if (!ccThreadMatchesPostKey(th, postKey, title)) return false;
    if (th.unread) return true;
    const msgs = Array.isArray(th.messages) ? th.messages : [];
    return msgs.length > 0;
  });
}

function ccRemoveUserPost(postKey) {
  const key = String(postKey || "").trim();
  if (!key) return;
  const list = ccLoadUserPosts();
  const next = list.filter((p) => String(p?.key || "") !== key);
  ccSaveUserPosts(next);
}

function ccIsEventClosed(post) {
  const cat = String(post?.cat || "").toLowerCase();
  if (cat !== "events" && cat !== "school") return false;
  const date = String(post?.event_date || "").trim();
  if (!date) return false;
  const time = String(post?.event_end || post?.event_start || "23:59").trim();
  const dt = new Date(date + "T" + time);
  if (Number.isNaN(dt.getTime())) return false;
  return Date.now() > dt.getTime();
}

function ccGetPostStatus(post) {
  if (!post || !post.key) return "active";
  const inlineStatus = ccNormalizePostStatus(post?.status || post?.post_status || "");
  if (inlineStatus !== "active") return inlineStatus;
  const rawKey = String(post.key || "");
  if (ccIsPostDeleted(rawKey)) return "deleted";
  const key = `${CC_POST_STATUS_KEY_PREFIX}${rawKey}`;
  let status = ccNormalizePostStatus(localStorage.getItem(key));
  if (status === "active") {
    const lowerKey = `${CC_POST_STATUS_KEY_PREFIX}${rawKey.toLowerCase()}`;
    if (lowerKey !== key) {
      const lowerStatus = ccNormalizePostStatus(localStorage.getItem(lowerKey));
      if (lowerStatus !== "active") status = lowerStatus;
    }
  }
  try {
    const raw = localStorage.getItem(CC_POST_DEAL_KEY);
    const db = raw ? JSON.parse(raw) : {};
    if (db && db[rawKey] && db[rawKey].done) status = "completed";
    if (db && db[rawKey.toLowerCase()] && db[rawKey.toLowerCase()].done) status = "completed";
  } catch (e) { }
  if (status !== "cancelled" && ccIsEventClosed(post)) {
    status = "completed";
    try { localStorage.setItem(key, "completed"); } catch (e) { }
  }
  return status;
}

function ccGetPostStatusInfo(post) {
  const status = ccGetPostStatus(post);
  const labels = ccGetStatusLabels(post?.cat);
  return { status, labels };
}

function ccIsPostClosed(post) {
  if (!post) return false;
  const status = String(ccGetPostStatus(post) || "").toLowerCase();
  if (["completed", "cancelled", "closed", "ended", "finished"].includes(status)) return true;
  if (ccIsEventClosed(post)) return true;
  const endCandidates = [
    post?.end_at, post?.endAt, post?.due_at, post?.dueAt,
    post?.deadline, post?.closed_at, post?.closedAt
  ];
  for (const raw of endCandidates) {
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) return true;
  }
  return false;
}

function initMypagePosts() {
  if (!document.body.classList.contains("mypage-page")) return;
  const openPanel = document.getElementById("myposts-open");
  const closedPanel = document.getElementById("myposts-closed");
  if (!openPanel || !closedPanel) return;
  const searchInput = document.getElementById("myposts-search");
  const searchBtn = document.getElementById("myposts-search-btn");

  const me = getAccountName() || getStoredString(["mock_account_name", "account_name"], "まうす");
  const all = ccGetPosts();
  const mine = all
    .filter((post) => String(post?.author || "").trim() === String(me || "").trim())
    .filter((post) => !ccIsPostDeleted(post?.key))
    .sort((a, b) => {
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

  const buildCard = (post, isClosed) => {
    const catKey = getPostCategoryKey(post);
    const catIconMap = {
      housing: "fa-house",
      jobs: "fa-briefcase",
      sell: "fa-tag",
      help: "fa-handshake",
      services: "fa-wand-magic-sparkles",
      community: "fa-people-group",
      events: "fa-calendar-days",
      school: "fa-graduation-cap"
    };
    const catLabel = ccGetCategoryLabel(catKey) || catKey;
    const catIcon = catIconMap[catKey] || "fa-tag";
    const priceText = formatPostPriceForDisplay(post);
    const areaText = formatAreaText(post);
    const thumb = (Array.isArray(post?.images) && post.images[0]) ? post.images[0] : "";
    const postId = post?.post_id || post?.key || "—";
    const createdAt = post?.created_at || "";
    const displayTitle = ccGetPostDisplayTitle(post);
    const statusBadge = isClosed
      ? `<span class="status-badge">${escapeHtml(ccGetStatusLabels(post?.cat).completed)}</span>`
      : "";
    return `
      <article class="card" data-post-id="${escapeHtml(String(postId))}" data-post-key="${escapeHtml(String(post?.key || ""))}" data-created-at="${escapeHtml(String(createdAt))}" data-cat="${escapeHtml(catKey)}">
        <a href="detail.html?post=${encodeURIComponent(String(post?.key || ""))}">
          <div class="card-thumb">
            ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" />` : `<div class="thumb-placeholder"></div>`}
            ${priceText ? `<div class="post-price">${escapeHtml(priceText)}</div>` : ``}
            <div class="post-cat cat-${escapeHtml(catKey)}"><i class="fa-solid ${catIcon}"></i><span>${escapeHtml(catLabel)}</span></div>
            ${statusBadge}
          </div>
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(displayTitle)}</h3>
            <div class="card-meta">
              <div class="card-meta-row location">
                <span class="left"><i class="fa-solid fa-location-dot"></i><span>${escapeHtml(areaText)}</span></span>
              </div>
              <div class="card-meta-spacer" aria-hidden="true"></div>
              <div class="card-meta-row time">
                <span class="time">—</span>
              </div>
            </div>
            <div class="myposts-stats">
              <span><i class="fa-regular fa-eye"></i> 0</span>
              <span><i class="fa-regular fa-heart"></i> 0</span>
              <span><i class="fa-regular fa-message"></i> 0</span>
            </div>
            <div class="card-id">投稿ID：${escapeHtml(String(postId))}</div>
          </div>
        </a>
        <div class="mypage-actions">
          <a class="btn btn-secondary mypage-btn" href="post.html?edit=${encodeURIComponent(String(post?.key || ""))}">編集</a>
          ${isClosed ? `<button class="btn btn-secondary mypage-btn" type="button" data-post-delete="${escapeHtml(String(post?.key || ""))}">削除</button>` : ""}
          ${isClosed
        ? `<button class="btn btn-secondary mypage-btn" type="button" aria-disabled="true" disabled data-post-repost="${escapeHtml(String(post?.key || ""))}">再投稿</button>`
        : `<button class="btn btn-primary mypage-btn" type="button" data-post-complete="${escapeHtml(String(post?.key || ""))}">取引完了</button>`}
        </div>
      </article>
    `;
  };

  const openEntries = [];
  const closedEntries = [];
  mine.forEach((post) => {
    const info = ccGetPostStatusInfo(post);
    if (info && info.status === "completed") closedEntries.push(post);
    else if (info && info.status === "cancelled") closedEntries.push(post);
    else openEntries.push(post);
  });

  const getCompletedAt = (postKey) => {
    const post = ccGetPostByKey(postKey);
    if (post && post.completed_at) {
      const ts = Date.parse(post.completed_at);
      if (Number.isFinite(ts)) return ts;
    }
    try {
      const raw = localStorage.getItem(CC_POST_DEAL_KEY);
      const db = raw ? JSON.parse(raw) : {};
      const entry = db?.[String(postKey || "")] || db?.[String(postKey || "").toLowerCase()];
      if (entry && entry.updated_at) {
        const ts = Date.parse(entry.updated_at);
        return Number.isFinite(ts) ? ts : 0;
      }
    } catch (e) { }
    return 0;
  };

  closedEntries.sort((a, b) => {
    const ta = getCompletedAt(a?.key);
    const tb = getCompletedAt(b?.key);
    if (ta || tb) return tb - ta;
    const ca = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const cb = b?.created_at ? new Date(b.created_at).getTime() : 0;
    return cb - ca;
  });

  const renderPanel = (panel, entries, emptyText, isClosed) => {
    if (!entries.length) {
      panel.innerHTML = `<div class="myposts-empty">${escapeHtml(emptyText)}</div>`;
      return;
    }
    panel.innerHTML = `<div class="listings-grid">${entries.map((post) => buildCard(post, isClosed)).join("")}</div>`;
  };

  const matchQuery = (post, query) => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const title = String(post?.title || "").toLowerCase();
    const body = String(post?.body || post?.description || "").toLowerCase();
    const area = String(post?.area || post?.city || "").toLowerCase();
    return title.includes(q) || body.includes(q) || area.includes(q);
  };

  let currentQuery = "";

  const switchToMypageTab = (targetId) => {
    const tabs = document.querySelectorAll(".myposts-tab");
    tabs.forEach((t) => {
      const isActive = t.getAttribute("data-target") === targetId;
      t.classList.toggle("is-active", isActive);
      t.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    document.querySelectorAll(".myposts-panel").forEach((panel) => {
      const isActive = panel.id === targetId;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  };

  const hasPlanDone = (postKey) => {
    const post = ccGetPostByKey(postKey);
    const title = post?.title || "";
    const db = ccLoadChatThreads();
    return Object.keys(db || {}).some((id) => {
      const th = db[id];
      if (!th) return false;
      const role = String(th?.meta?.role || "").toLowerCase();
      if (role && role !== "owner") return false;
      if (!ccThreadMatchesPostKey(th, postKey, title)) return false;
      return !!th.plan_done;
    });
  };

  const bindPostActions = () => {
    document.querySelectorAll("[data-post-complete]").forEach((btn) => {
      if (btn.dataset.ccBound === "1") return;
      btn.dataset.ccBound = "1";
      btn.addEventListener("click", () => {
        if (!assertNotBanned()) return;
        const postKey = btn.getAttribute("data-post-complete") || "";
        if (!postKey) return;
        const post = ccGetPostByKey(postKey);
        if (!post) return;
        const labels = ccGetStatusLabels(post.cat);
        const planLabel = ccGetPlanStatusLabel(post.cat);
        const message = hasPlanDone(postKey)
          ? `この取引を完了し、${labels.completed}にしますか？`
          : `${planLabel}を設定していませんが${labels.completed}してもよろしいですか？`;
        openGlobalConfirmModal({
          id: "cc-post-complete-modal",
          title: `${labels.completed}の確認`,
          message,
          confirmText: `${labels.completed}にする`,
          cancelText: "キャンセル",
          onConfirm: () => {
            ccSetPostDealDone(postKey, true);
            initMypagePosts();
            applyRelativeTimesToCards();
            switchToMypageTab("myposts-closed");
          }
        });
      });
    });

    document.querySelectorAll("[data-post-delete]").forEach((btn) => {
      if (btn.dataset.ccBound === "1") return;
      btn.dataset.ccBound = "1";
      btn.addEventListener("click", () => {
        if (!assertNotBanned()) return;
        const postKey = btn.getAttribute("data-post-delete") || "";
        if (!postKey) return;
        if (ccHasBlockingThreads(postKey)) {
          openGlobalConfirmModal({
            id: "cc-post-delete-blocked-modal",
            title: "削除できません",
            message: "未読または進行中の問い合わせがあるため、この投稿は削除できません。",
            confirmText: "OK",
            cancelText: "OK"
          });
          return;
        }
        openGlobalConfirmModal({
          id: "cc-post-delete-confirm-modal",
          title: "投稿を削除しますか？",
          message: "削除すると復元できません。本当に削除しますか？",
          confirmText: "削除する",
          cancelText: "キャンセル",
          onConfirm: () => {
            ccSetPostDeleted(postKey, true);
            ccRemoveUserPost(postKey);
            initMypagePosts();
            applyRelativeTimesToCards();
          }
        });
      });
    });
  };

  const renderPanels = () => {
    const openFiltered = openEntries.filter((post) => matchQuery(post, currentQuery));
    const closedFiltered = closedEntries.filter((post) => matchQuery(post, currentQuery));
    renderPanel(openPanel, openFiltered, "該当する投稿はありません。", false);
    renderPanel(closedPanel, closedFiltered, "該当する投稿はありません。", true);
    bindPostActions();
    applyPriceFormatToCards();
    applyRelativeTimesToCards();
  };

  renderPanels();
  if (CC_SEED_MODE === "mock") ccSeedSellerInquiryMock();
  ccSeedSellerInquiryForUserPosts();
  applySellerInquiryCounts();
  const openKpi = document.getElementById("mypage-kpi-open");
  if (openKpi) openKpi.textContent = String(openEntries.length);

  const applySearch = () => {
    currentQuery = (searchInput ? searchInput.value : "").trim();
    if (searchBtn) searchBtn.disabled = !currentQuery;
    renderPanels();
  };

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const next = (searchInput.value || "").trim();
      if (searchBtn) searchBtn.disabled = !next;
      if (!next && currentQuery) {
        currentQuery = "";
        renderPanels();
      }
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      applySearch();
    });
  }
  if (searchBtn) {
    searchBtn.addEventListener("click", applySearch);
    searchBtn.disabled = !currentQuery;
  }
}

function initMypageFavorites() {
  if (!document.body.classList.contains("mypage-page")) return;
  const grid = document.querySelector("#mypage-panel-favorites .listings-grid");
  if (!grid) return;
  const searchInput = document.querySelector("[data-favorites-search]");
  const searchBtn = document.querySelector("[data-favorites-search-btn]");
  const sortSelect = document.querySelector("[data-favorites-sort]");
  const favSet = ccLoadFavorites();
  const posts = ccGetPosts();
  const favorites = posts
    .filter((post) => favSet.has(ccNormalizeFavKey(post?.key)))
    .filter((post) => !ccIsPostDeleted(post?.key))
    .sort((a, b) => {
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

  const sortFavorites = (list, mode) => {
    if (mode === "old") {
      return list.slice().sort((a, b) => {
        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      });
    }
    if (mode === "title") {
      return list.slice().sort((a, b) => {
        const ta = String(a?.title || "");
        const tb = String(b?.title || "");
        return ta.localeCompare(tb, "ja");
      });
    }
    return list.slice().sort((a, b) => {
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  };

  const matchQuery = (post, query) => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const title = String(post?.title || "").toLowerCase();
    const area = String(post?.area || "").toLowerCase();
    const address = String(post?.address || "").toLowerCase();
    return title.includes(q) || area.includes(q) || address.includes(q);
  };

  const renderFavorites = (list) => {
    if (!list.length) {
      grid.innerHTML = `<div class="myposts-empty">お気に入りはありません。</div>`;
      return;
    }
    grid.innerHTML = list.map((post) => {
    const catKey = ccNormalizeCategoryKey(post?.cat);
      const catLabel = ccGetCategoryLabel(catKey) || catKey;
      const catIcon = catIconMap[catKey] || "fa-tag";
      const priceText = formatPostPriceForDisplay(post);
      const areaText = formatAreaText(post);
      const thumb = (Array.isArray(post?.images) && post.images[0]) ? post.images[0] : "";
      const postId = post?.post_id || post?.key || "—";
      const createdAt = post?.created_at || "";
      const info = ccGetPostStatusInfo(post);
      const displayTitle = ccGetPostDisplayTitle(post);
      const statusBadge = info && info.status === "completed"
        ? `<span class="status-badge">${escapeHtml(info.labels.completed)}</span>`
        : "";
      const author = String(post?.author || "—");
      return `
        <article class="card" data-post-id="${escapeHtml(String(postId))}" data-created-at="${escapeHtml(String(createdAt))}" data-cat="${escapeHtml(catKey)}">
          <a href="detail.html?post=${encodeURIComponent(String(post?.key || ""))}">
            <div class="card-thumb">
              ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" />` : `<div class="thumb-placeholder"></div>`}
              ${priceText ? `<div class="post-price">${escapeHtml(priceText)}</div>` : ``}
              <div class="post-cat cat-${escapeHtml(catKey)}"><i class="fa-solid ${catIcon}"></i><span>${escapeHtml(catLabel)}</span></div>
              ${statusBadge}
            </div>
            <div class="card-body">
              <h3 class="card-title">${escapeHtml(displayTitle)}</h3>
              <div class="card-meta">
                <div class="card-meta-row location">
                  <span class="left"><i class="fa-solid fa-location-dot"></i><span>${escapeHtml(areaText)}</span></span>
                </div>
                <div class="card-meta-spacer" aria-hidden="true"></div>
                <div class="card-meta-row time">
                  <span class="time">—</span>
                </div>
              </div>
              <div class="card-author"><i class="fa-regular fa-user"></i><span>${escapeHtml(author)}</span></div>
            </div>
          </a>
        </article>
      `;
    }).join("");
    applyPriceFormatToCards();
    applyRelativeTimesToCards();
  };

  let currentQuery = "";

  const applyFilters = () => {
    const query = currentQuery;
    const mode = sortSelect ? sortSelect.value : "new";
    const filtered = sortFavorites(favorites.filter((post) => matchQuery(post, query)), mode);
    renderFavorites(filtered);
  };

  const favKpi = document.getElementById("mypage-kpi-favorites");
  if (favKpi) favKpi.textContent = String(favorites.length);

  if (!favorites.length) {
    grid.innerHTML = `<div class="myposts-empty">お気に入りはありません。</div>`;
    return;
  }

  const catIconMap = {
    housing: "fa-house",
    jobs: "fa-briefcase",
    sell: "fa-tag",
    help: "fa-handshake",
    services: "fa-wand-magic-sparkles",
    community: "fa-people-group",
    events: "fa-calendar-days",
    school: "fa-graduation-cap"
  };

  const applySearch = () => {
    currentQuery = (searchInput ? searchInput.value : "").trim();
    if (searchBtn) searchBtn.disabled = !currentQuery;
    applyFilters();
  };

  applyFilters();
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const next = (searchInput.value || "").trim();
      if (searchBtn) searchBtn.disabled = !next;
      if (!next && currentQuery) {
        currentQuery = "";
        applyFilters();
      }
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      applySearch();
    });
  }
  if (searchBtn) {
    searchBtn.addEventListener("click", applySearch);
    searchBtn.disabled = !currentQuery;
  }
  if (sortSelect) {
    sortSelect.addEventListener("change", applyFilters);
  }
}

function initMypageSectionTabs() {
  if (!document.body.classList.contains("mypage-page")) return;
  const tabs = Array.from(document.querySelectorAll(".mypage-section-tab"));
  const panels = Array.from(document.querySelectorAll(".mypage-panel"));
  if (!tabs.length || !panels.length) return;

  const map = {
    posts: "mypage-panel-posts",
    inquiries: "mypage-panel-inquiries",
    messages: "mypage-panel-inquiries",
    favorites: "mypage-panel-favorites",
    notices: "mypage-panel-news",
    news: "mypage-panel-news",
    settings: "mypage-panel-settings",
    options: "mypage-panel-options"
  };

  const setActive = (targetId) => {
    const target = targetId || "mypage-panel-posts";
    tabs.forEach((tab) => {
      const isActive = tab.dataset.target === target;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    panels.forEach((panel) => {
      const isActive = panel.id === target;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
    localStorage.setItem("mypage_active_tab", target);
  };

  let initial = "";
  try {
    const params = new URLSearchParams(window.location.search || "");
    const tab = params.get("tab");
    if (tab && map[tab]) initial = map[tab];
  } catch (e) { }
  if (!initial) initial = localStorage.getItem("mypage_active_tab") || "";
  if (!initial) initial = tabs[0].dataset.target || "mypage-panel-posts";
  setActive(initial);

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActive(tab.dataset.target);
    });
  });
}

function ccBuildListingCardHtml(post) {
  const ccGetClockIconHtml = () => (
    '<span class="cc-icon cc-icon-clock" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" role="img" focusable="false">' +
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M12 7v6l4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg></span>'
  );
  const catIconMap = {
    housing: "fa-house",
    jobs: "fa-briefcase",
    sell: "fa-tag",
    help: "fa-handshake",
    services: "fa-wand-magic-sparkles",
    community: "fa-people-group",
    events: "fa-calendar-days",
    school: "fa-graduation-cap"
  };
  const postId = String(post?.id || post?.post_id || post?.key || "").trim();
      const catKey = ccNormalizeCategoryKey(post?.cat);
  const catLabel = ccGetCategoryLabel(catKey) || catKey;
  const catIcon = catIconMap[catKey] || "fa-tag";
  const priceText = formatPostPriceForDisplay(post);
  const areaText = formatAreaText(post);
  const timeMeta = post?.created_at ? formatPostCreatedAtForPublicMeta(post.created_at) : { text: "—", absolute: "", isRelative: false };
  const createdAt = timeMeta.text || "—";
  const timeTitle = (timeMeta.isRelative && timeMeta.absolute) ? timeMeta.absolute : "";
  const author = String(post?.author || "—");
  const images = Array.isArray(post?.images) ? post.images.filter(Boolean) : [];
  const thumb = images[0] || "";
  const closedBadge = post?.__ccClosedFallback
    ? `<span class="status-badge is-completed" data-status-badge style="display:inline-flex;">受付終了</span>`
    : "";
  return `
    <article class="card" data-post-key="${escapeHtml(String(postId))}">
      <a href="detail.html?id=${encodeURIComponent(String(postId))}">
        <div class="card-thumb" aria-hidden="true">
          ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" />` : `<div class="thumb-placeholder"></div>`}
          ${priceText ? `<div class="post-price">${escapeHtml(priceText)}</div>` : ``}
          <div class="post-cat cat-${escapeHtml(catKey)}"><i class="fa-solid ${catIcon}"></i><span>${escapeHtml(catLabel)}</span></div>
          ${closedBadge ? closedBadge : `<span class="status-badge" data-status-badge style="display:none;">取引完了</span>`}
        </div>
        <div class="card-body">
          <div class="card-topline">
            <h2 class="card-title">${escapeHtml(ccGetPostDisplayTitle(post))}</h2>
          </div>
          <div class="card-meta">
            <div class="card-meta-row location">
              <span class="left"><i class="fa-solid fa-location-dot"></i><span>${escapeHtml(areaText)}</span></span>
            </div>
            <div class="card-meta-spacer" aria-hidden="true"></div>
            <div class="card-meta-row time">
              <span class="time cc-date"${timeTitle ? ` title="${escapeHtml(timeTitle)}"` : ""}>${ccGetClockIconHtml()}<span class="cc-date-text">${escapeHtml(createdAt)}</span></span>
            </div>
          </div>
          <div class="card-author"><i class="fa-regular fa-user"></i><span>${escapeHtml(author)}</span></div>
        </div>
      </a>
    </article>
  `;
}

function initMypage() {
  const page = document.querySelector(".mypage-page");
  if (!page) return;

  const session = authAdapter.getSession();
  if (!session || !session.email) {
    const from = "mypage.html";
    try {
      const params = new URLSearchParams(window.location.search || "");
      const tab = params.get("tab");
      if (tab) {
        window.location.href = `login.html?from=${encodeURIComponent(from)}&tab=${encodeURIComponent(tab)}`;
        return;
      }
    } catch (e) { }
    window.location.href = `login.html?from=${encodeURIComponent(from)}`;
    return;
  }
  
  const nameSpan = document.getElementById("mypage-account-name");
  if (nameSpan) nameSpan.textContent = session.account_name || 'ユーザー';

  const citySpan = document.getElementById("mypage-default-city");
  if (citySpan) {
    citySpan.textContent = session.default_city_name || getDisplayAreaName(session.default_city) || "未設定";
  }

  const settingsPanel = document.getElementById('mypage-panel-settings');
  if (!settingsPanel) return;

  const areaSelect = document.getElementById("mypage-default-city-primary");
  const langSelect = document.getElementById("mypage-lang-select");
  const timezoneSelect = document.getElementById("mypage-timezone-select");
  const notificationCheckboxes = settingsPanel.querySelectorAll('.setting-toggle input[type="checkbox"]');
  const areaDropdown = settingsPanel.querySelector('[data-cc-dd-scope="mypage-area"]');
  const langDropdown = settingsPanel.querySelector('[data-cc-dd-scope="mypage-lang"]');
  const timezoneDropdown = settingsPanel.querySelector('[data-cc-dd-scope="mypage-timezone"]');
  
  const saveAreaBtn = settingsPanel.querySelector('[data-mypage-save-area]');
  const saveLangBtn = settingsPanel.querySelector('[data-mypage-save-lang]');
  const saveNotificationsBtn = document.getElementById('mypage-save-notifications');

  let tzAuto = true;
  let isAutoTzUpdate = false;
  let isManualTzChange = false;
  let isManualAreaChange = false;

  const users = getMockUsersDB();
  const currentUser = users.find(u => normalizeEmail(u.email) === normalizeEmail(session.email));
  
  const userSettings = currentUser || {};

  const closeSettingDropdown = (dd) => {
    if (!dd) return;
    dd.classList.remove("is-open");
    const toggle = dd.querySelector(".cc-dd-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  };

  const ensureAreaOption = (value) => {
    if (!areaSelect || !value) return;
    const exists = Array.from(areaSelect.options).some(opt => opt.value === value);
    if (!exists) {
      const label = getDisplayAreaName(value) || value;
      areaSelect.add(new Option(label, value));
    }
  };

  const updateAreaDisplay = () => {
    if (!areaSelect || !areaDropdown) return;
    const valueEl = areaDropdown.querySelector('[data-cc-dd-value="mypage-area"]');
    if (!valueEl) return;
    const key = String(areaSelect.value || "");
    const label = key ? (getDisplayAreaName(key) || key) : "都市を選択してください";
    valueEl.textContent = label;
  };

  const updateLangDisplay = () => {
    if (!langSelect || !langDropdown) return;
    const valueEl = langDropdown.querySelector('[data-cc-dd-value="mypage-lang"]');
    if (!valueEl) return;
    const opt = langSelect.options[langSelect.selectedIndex];
    valueEl.textContent = opt ? (opt.textContent || "").trim() : "JP（日本語）";
  };

  const updateTimezoneDisplay = () => {
    if (!timezoneSelect || !timezoneDropdown) return;
    const valueEl = timezoneDropdown.querySelector('[data-cc-dd-value="mypage-timezone"]');
    if (!valueEl) return;
    const opt = timezoneSelect.options[timezoneSelect.selectedIndex];
    valueEl.textContent = opt ? (opt.textContent || "").trim() : "太平洋標準時（PST）";
  };

  const setTimeZoneByCity = (cityValue) => {
    if (!timezoneSelect) return;
    const mapped = getAreaTimeZone(cityValue);
    if (!mapped) return;
    isAutoTzUpdate = true;
    timezoneSelect.value = mapped;
    timezoneSelect.dispatchEvent(new Event("change", { bubbles: true }));
    updateTimezoneDisplay();
    isAutoTzUpdate = false;
  };

  const buildAreaMenu = () => {
    if (!areaDropdown || !areaSelect) return;
    const menu = areaDropdown.querySelector(".cc-dd-menu");
    if (!menu || menu.dataset.ccBuilt === "1") return;
    menu.dataset.ccBuilt = "1";
    const primaryButtons = [];
    const tailButtons = [];
    primaryButtons.push(`<button class="cc-dd-item" type="button" data-cc-settings-select="area" data-value="canada_all">${escapeHtml(CC_CITY_SPECIAL_LABELS.canada_all)}</button>`);
    CC_CITY_PRIMARY.forEach((city) => {
      const btn = `<button class="cc-dd-item" type="button" data-cc-settings-select="area" data-value="${escapeHtml(city.key)}">${escapeHtml(city.label)}</button>`;
      primaryButtons.push(btn);
    });
    tailButtons.push(`<button class="cc-dd-item" type="button" data-cc-settings-select="area" data-value="japan">${escapeHtml(CC_CITY_SPECIAL_LABELS.japan)}</button>`);

    const subButtons = CC_CITY_OTHER_GROUPS.map((group) => {
      const title = `<div class="cc-dd-group-title">${escapeHtml(group.label)}</div>`;
      const items = group.keys.map((key) => {
        const label = CC_CITY_LABELS[key] || key;
        return `<button class="cc-dd-item" type="button" data-cc-settings-select="area-sub" data-value="${escapeHtml(key)}">${escapeHtml(label)}</button>`;
      }).join("");
      return title + items;
    }).join("");
    const subMenu = `
      <div class="cc-dd-submenu" data-cc-dd-submenu>
        <button class="cc-dd-item cc-dd-subtoggle" type="button" data-cc-dd-subtoggle>
          その他のカナダ都市 <i class="fa-solid fa-chevron-right"></i>
        </button>
        <div class="cc-dd-subpanel" hidden>
          ${subButtons}
        </div>
      </div>
    `;
    menu.innerHTML = primaryButtons.join("") + subMenu + tailButtons.join("");
  };

  const buildTimezoneMenu = () => {
    if (!timezoneDropdown || !timezoneSelect) return;
    const menu = timezoneDropdown.querySelector(".cc-dd-menu");
    if (!menu || menu.dataset.ccBuilt === "1") return;
    menu.dataset.ccBuilt = "1";
    menu.innerHTML = Array.from(timezoneSelect.options).map((opt) => (
      `<button class="cc-dd-item" type="button" data-cc-settings-select="timezone" data-value="${escapeHtml(opt.value)}">${escapeHtml(opt.textContent || "")}</button>`
    )).join("");
  };

  // Load and Apply Saved Settings
  if (areaSelect) {
      let rawCityKey = userSettings.default_city || getAccountDefaultAreaKey() || "montreal";
      const normalizedRaw = normalizeAreaKey(rawCityKey) || rawCityKey;
      if (normalizedRaw === "other_custom" || normalizedRaw === "free") {
        rawCityKey = "canada_all";
      }
      const cityKey = normalizeAreaKey(rawCityKey) || rawCityKey;
      const isSubCity = isMinorAreaKey(cityKey);
      if (isSubCity) ensureAreaOption(cityKey);
      areaSelect.value = cityKey;
  }

  if (langSelect && userSettings.lang) {
    langSelect.value = userSettings.lang;
  } else if (langSelect) {
    let storedAccountLang = "";
    try { storedAccountLang = localStorage.getItem(KEY_ACCOUNT_LANG) || ""; } catch (e) { }
    langSelect.value = storedAccountLang || localStorage.getItem(KEY_LANG) || 'ja';
  }

  if (timezoneSelect) {
      const baseKey = areaSelect ? areaSelect.value : "";
      const mapped = getAreaTimeZone(baseKey);
      if (userSettings.timezone) {
          timezoneSelect.value = userSettings.timezone;
          tzAuto = mapped ? userSettings.timezone === mapped : true;
      } else {
          if (mapped) timezoneSelect.value = mapped;
      }
  }

  if (notificationCheckboxes.length > 0 && userSettings.notifications) {
      notificationCheckboxes.forEach(cb => {
          const key = cb.parentElement.querySelector('span').textContent.trim();
          cb.checked = userSettings.notifications[key] !== false;
      });
  }

  buildAreaMenu();
  buildTimezoneMenu();
  ccInitSelectDropdowns(settingsPanel);
  
  [areaSelect, langSelect, timezoneSelect].forEach(sel => {
      if (sel) {
          sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
  });

  if (areaSelect && timezoneSelect) {
      areaSelect.addEventListener('change', (e) => {
          if (isManualAreaChange || (e && e.isTrusted)) tzAuto = true;
          isManualAreaChange = false;
          updateAreaDisplay();
          if (tzAuto) {
              setTimeZoneByCity(areaSelect.value);
          }
      });
      timezoneSelect.addEventListener('change', (e) => {
          if (!isAutoTzUpdate && (isManualTzChange || e.isTrusted)) tzAuto = false;
          isManualTzChange = false;
          updateTimezoneDisplay();
      });
      if (tzAuto && areaSelect.value) setTimeZoneByCity(areaSelect.value);
  }
  if (langSelect) {
      langSelect.addEventListener("change", updateLangDisplay);
  }
  updateAreaDisplay();
  updateLangDisplay();
  updateTimezoneDisplay();

  const settingDropdowns = [areaDropdown, langDropdown, timezoneDropdown].filter(Boolean);
  settingDropdowns.forEach((dd) => {
    if (dd.dataset.ccBound === "1") return;
    dd.dataset.ccBound = "1";
    const toggle = dd.querySelector(".cc-dd-toggle");
    if (toggle) {
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = dd.classList.contains("is-open");
        settingDropdowns.forEach((el) => { if (el !== dd) closeSettingDropdown(el); });
        dd.classList.toggle("is-open", !isOpen);
        toggle.setAttribute("aria-expanded", String(!isOpen));
      });
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest(".cc-dropdown-setting")) return;
    settingDropdowns.forEach((dd) => closeSettingDropdown(dd));
  });

  settingsPanel.querySelectorAll("[data-cc-dd-subtoggle]").forEach((btn) => {
    if (btn.dataset.ccBound === "1") return;
    btn.dataset.ccBound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const panel = btn.parentElement?.querySelector(".cc-dd-subpanel");
      if (panel) panel.removeAttribute("hidden");
    });
  });

  settingsPanel.addEventListener("click", (e) => {
    const item = e.target.closest("[data-cc-settings-select]");
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    const type = item.getAttribute("data-cc-settings-select");
    const value = item.getAttribute("data-value");
    if (!type || value === null) return;
    if (type === "area" && areaSelect) {
      isManualAreaChange = true;
      areaSelect.value = value;
      areaSelect.dispatchEvent(new Event("change", { bubbles: true }));
      updateAreaDisplay();
    }
    if (type === "area-sub" && areaSelect) {
      isManualAreaChange = true;
      ensureAreaOption(value);
      areaSelect.value = value;
      areaSelect.dispatchEvent(new Event("change", { bubbles: true }));
      updateAreaDisplay();
    }
    if (type === "lang" && langSelect) {
      langSelect.value = value;
      langSelect.dispatchEvent(new Event("change", { bubbles: true }));
      updateLangDisplay();
    }
    if (type === "timezone" && timezoneSelect) {
      isManualTzChange = true;
      timezoneSelect.value = value;
      timezoneSelect.dispatchEvent(new Event("change", { bubbles: true }));
      updateTimezoneDisplay();
    }
    const dd = item.closest(".cc-dropdown-setting");
    if (dd) closeSettingDropdown(dd);
  });
  
  const setSaveState = (btn, enabled) => {
    if (!btn) return;
    btn.disabled = !enabled;
  };

  const getNotificationsState = () => {
    const next = {};
    notificationCheckboxes.forEach(cb => {
      const key = cb.parentElement.querySelector('span').textContent.trim();
      next[key] = cb.checked;
    });
    return next;
  };

  const baseState = {
    city: areaSelect ? areaSelect.value : "",
    tz: timezoneSelect ? timezoneSelect.value : "",
    lang: langSelect ? langSelect.value : "",
    notifications: getNotificationsState()
  };

  const isSameNotifications = (a, b) => {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of keys) {
      if ((a && a[k]) !== (b && b[k])) return false;
    }
    return true;
  };

  const refreshDirtyStates = () => {
    const currentCity = areaSelect ? areaSelect.value : "";
    const currentTz = timezoneSelect ? timezoneSelect.value : "";
    const areaDirty = currentCity !== baseState.city
      || currentTz !== baseState.tz;
    const areaReady = !!currentCity;
    const langDirty = (langSelect ? langSelect.value : "") !== baseState.lang;
    const notifDirty = !isSameNotifications(getNotificationsState(), baseState.notifications);
    setSaveState(saveAreaBtn, areaDirty && areaReady);
    setSaveState(saveLangBtn, langDirty);
    setSaveState(saveNotificationsBtn, notifDirty);
  };

  refreshDirtyStates();

  const showSaveConfirmation = (title, onConfirm) => {
      openGlobalConfirmModal({
        id: `cc-mypage-save-confirm-${title}`,
        title: `${title}の保存`,
        message: `この内容で${title}を保存しますか？`,
        confirmText: "保存する",
        cancelText: "キャンセル",
        onConfirm: () => {
          onConfirm();
          showGlobalToast(`${title}を保存しました。`);
          try {
            localStorage.setItem("mypage_active_tab", "mypage-panel-settings");
            localStorage.setItem("mypage_scroll_top", "1");
          } catch (e) { }
          setTimeout(() => window.location.reload(), 300);
        }
      });
  };

  if (saveAreaBtn) {
    saveAreaBtn.addEventListener('click', () => {
        showSaveConfirmation('デフォルト都市とタイムゾーン', () => {
            const cityKey = areaSelect ? areaSelect.value : "";
            const storedCityName = getDisplayAreaName(cityKey);
            try { localStorage.setItem("mock_default_city", cityKey); } catch (e) { }
            try { localStorage.setItem(KEY_DEFAULT_AREA_TZ, timezoneSelect ? timezoneSelect.value : getAreaTimeZone(cityKey)); } catch (e) { }
            try { localStorage.setItem(KEY_DEFAULT_AREA_NAME, storedCityName || ""); } catch (e) { }
            try {
              const users = getMockUsersDB();
              const idx = users.findIndex((u) => normalizeEmail(u?.email) === normalizeEmail(session.email));
              if (idx >= 0) {
                users[idx].default_city = cityKey;
                users[idx].default_city_name = storedCityName || "";
                users[idx].default_city_tz = timezoneSelect ? timezoneSelect.value : getAreaTimeZone(cityKey);
                users[idx].timezone = timezoneSelect ? timezoneSelect.value : getAreaTimeZone(cityKey);
                saveMockUsersDB(users);
              }
            } catch (e) { }
            changeArea(cityKey);
            baseState.city = areaSelect ? areaSelect.value : cityKey;
            baseState.tz = timezoneSelect ? timezoneSelect.value : "";
            refreshDirtyStates();
        });
    });
  }

  if (saveLangBtn) {
    saveLangBtn.addEventListener('click', () => {
      const nextLang = langSelect ? normalizeLangKey(langSelect.value) : "";
      if (!nextLang) return;
      const langKey = nextLang === "jp" ? "ja" : nextLang;
      persistLangForAccount(langKey);
      persistLangForSession(langKey);
      baseState.lang = nextLang;
      refreshDirtyStates();
      setTimeout(() => window.location.reload(), 50);
    });
  }

  if (saveNotificationsBtn) {
    saveNotificationsBtn.addEventListener('click', () => {
      showSaveConfirmation('通知設定', () => {
        const notifications = {};
        notificationCheckboxes.forEach(cb => {
            const key = cb.parentElement.querySelector('span').textContent.trim();
            notifications[key] = cb.checked;
        });
        updateUserSettings(session.email, { notifications });
        baseState.notifications = getNotificationsState();
        refreshDirtyStates();
      });
    });
  }

  if (areaSelect) areaSelect.addEventListener("change", refreshDirtyStates);
  if (timezoneSelect) timezoneSelect.addEventListener("change", refreshDirtyStates);
  if (langSelect) langSelect.addEventListener("change", refreshDirtyStates);
  notificationCheckboxes.forEach(cb => cb.addEventListener("change", refreshDirtyStates));

  initMypagePosts(session);
  initMypageFavorites(session);
}

function initMypageSettingsUI() {
  // This function is now merged into initMypage.
}


function switchAdminTab(tabId, { updateHash = true } = {}) {
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-panel]"));
  if (!tabs.length || !panels.length) return;
  const target = tabId || "posts";
  tabs.forEach((btn) => {
    const isActive = btn.getAttribute("data-tab") === target;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  panels.forEach((panel) => {
    const isActive = panel.getAttribute("data-panel") === target;
    panel.classList.toggle("is-active", isActive);
  });
  if (updateHash) {
    try {
      history.replaceState(null, "", `#${target}`);
    } catch (e) { }
  }
}

function getActiveAdminTab() {
  const active = document.querySelector("[data-tab].is-active");
  return active ? active.getAttribute("data-tab") : "posts";
}

function initAdminTabs({ onBeforeSwitch } = {}) {
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-panel]"));
  if (!tabs.length || !panels.length) return;
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-tab");
      if (!key) return;
      if (typeof onBeforeSwitch === "function") {
        const proceed = onBeforeSwitch(key, { source: "click" });
        if (proceed === false) return;
      }
      switchAdminTab(key);
    });
  });
  const hash = String(location.hash || "").replace("#", "");
  const initial = tabs.some((btn) => btn.getAttribute("data-tab") === hash) ? hash : "posts";
  switchAdminTab(initial, { updateHash: false });
  window.addEventListener("hashchange", () => {
    const next = String(location.hash || "").replace("#", "");
    if (tabs.some((btn) => btn.getAttribute("data-tab") === next)) {
      if (typeof onBeforeSwitch === "function") {
        const proceed = onBeforeSwitch(next, { source: "hash" });
        if (proceed === false) return;
      }
      switchAdminTab(next, { updateHash: false });
    }
  });
}

function initAdminPage() {
  const root = document.getElementById("admin-page");
  if (!root) return;
  const gate = document.getElementById("admin-gate");
  const app = document.getElementById("admin-app");

  if (!isAdmin()) {
    if (gate) gate.hidden = false;
    if (app) app.hidden = true;
    return;
  }

  if (gate) gate.hidden = true;
  if (app) app.hidden = false;

  const actor = () => getUserEmail() || getAccountName() || "admin";
  const pendingPosts = {};
  const pendingBoards = {};
  const pendingBoardReplies = {};
  const pendingReports = {};
  const pendingUsers = {};
  const pendingConversations = {};
  const reportMissingThread = new Set();
  let settingsDirty = false;
  let settingsBase = null;
  let settingsDraft = null;
  let announcementsDirty = false;
  let announcementsBase = null;
  let announcementsDraft = null;
  let staticPagesDirty = false;
  let staticBaselineByType = {};
  let isProgrammaticSet = false;
  let staticPagesDraft = null;
  let staticPagesHistory = null;
  let staticPagesDrafts = null;
  let activeLogQuick = "all";

  const hasAdminPending = () => {
    return (
      Object.keys(pendingPosts).length > 0 ||
      Object.keys(pendingBoards).length > 0 ||
      Object.keys(pendingBoardReplies).length > 0 ||
      Object.keys(pendingReports).length > 0 ||
      Object.keys(pendingUsers).length > 0 ||
      Object.keys(pendingConversations).length > 0 ||
      settingsDirty ||
      announcementsDirty ||
      staticPagesDirty
    );
  };

  const postSearchInput = document.getElementById("admin-search");
  const postFilterSelect = document.getElementById("admin-filter");
  const postCountEl = document.getElementById("admin-count");
  const postListEl = document.getElementById("admin-post-list");
  const postSaveBtn = document.getElementById("admin-save");
  const postDiscardBtn = document.getElementById("admin-discard");

  const boardSearchInput = document.getElementById("admin-board-search");
  const boardFilterSelect = document.getElementById("admin-board-filter");
  const boardCountEl = document.getElementById("admin-board-count");
  const boardListEl = document.getElementById("admin-board-list");
  const boardSaveBtn = document.getElementById("admin-board-save");
  const boardDiscardBtn = document.getElementById("admin-board-discard");
  const boardViewToggles = Array.from(document.querySelectorAll(".admin-board-toggle [data-board-view]"));
  const boardViews = Array.from(document.querySelectorAll(".admin-board-view"));

  const replySearchInput = document.getElementById("admin-reply-search");
  const replyFilterSelect = document.getElementById("admin-reply-filter");
  const replyThreadInput = document.getElementById("admin-reply-thread");
  const replyCountEl = document.getElementById("admin-reply-count");
  const replyListEl = document.getElementById("admin-reply-list");

  const reportSearchInput = document.getElementById("admin-report-search");
  const reportStatusSelect = document.getElementById("admin-report-status");
  const reportTypeSelect = document.getElementById("admin-report-type");
  const reportSortSelect = document.getElementById("admin-report-sort");
  const reportCountEl = document.getElementById("admin-report-count");
  const reportListEl = document.getElementById("admin-report-list");
  const reportSaveBtn = document.getElementById("admin-report-save");
  const reportDiscardBtn = document.getElementById("admin-report-discard");

  const userSearchInput = document.getElementById("admin-user-search");
  const userFilterSelect = document.getElementById("admin-user-filter");
  const userCountEl = document.getElementById("admin-user-count");
  const userListEl = document.getElementById("admin-user-list");
  const userSaveBtn = document.getElementById("admin-user-save");
  const userDiscardBtn = document.getElementById("admin-user-discard");

  const convoSearchInput = document.getElementById("admin-convo-search");
  const convoClearBtn = document.getElementById("admin-convo-clear");
  const convoFilterSelect = document.getElementById("admin-convo-filter");
  const convoCountEl = document.getElementById("admin-convo-count");
  const convoListEl = document.getElementById("admin-convo-list");
  const convoSaveBtn = document.getElementById("admin-convo-save");
  const convoDiscardBtn = document.getElementById("admin-convo-discard");

  const logSearchInput = document.getElementById("admin-log-search");
  const logRangeSelect = document.getElementById("admin-log-range");
  const logFilterSelect = document.getElementById("admin-log-filter");
  const logCountEl = document.getElementById("admin-log-count");
  const logListEl = document.getElementById("admin-log-list");
  const logQuickBtns = Array.from(document.querySelectorAll("[data-log-quick]"));
  const logExportCsvBtn = document.getElementById("admin-log-export-csv");
  const logExportJsonBtn = document.getElementById("admin-log-export-json");
  const smokeCopyBtn = document.getElementById("admin-smoke-copy");
  const smokeText = document.getElementById("admin-smoke-text");

  const settingsSaveBtn = document.getElementById("admin-settings-save");
  const settingsDiscardBtn = document.getElementById("admin-settings-discard");
  const settingsPendingEl = document.getElementById("admin-settings-pending");
  const ngEnabledEl = document.getElementById("admin-ng-enabled");
  const ngInputEl = document.getElementById("admin-ng-input");
  const ngAddBtn = document.getElementById("admin-ng-add");
  const ngListEl = document.getElementById("admin-ng-list");
  const reasonEnabledEl = document.getElementById("admin-reason-enabled");
  const reasonInputEl = document.getElementById("admin-reason-input");
  const reasonAddBtn = document.getElementById("admin-reason-add");
  const reasonListEl = document.getElementById("admin-reason-list");
  const announceTitleEl = document.getElementById("admin-announce-title");
  const announceBodyEl = document.getElementById("admin-announce-body");
  const announceVisibleEl = document.getElementById("admin-announce-visible");
  const announceAddBtn = document.getElementById("admin-announce-add");
  const announceListEl = document.getElementById("admin-announce-list");
  const announcePendingEl = document.getElementById("admin-announce-pending");
  const announceSaveBtn = document.getElementById("admin-announce-save");
  const announceDiscardBtn = document.getElementById("admin-announce-discard");
  const staticTypeSelect = document.getElementById("admin-static-type");
  const staticBodyEl = document.getElementById("admin-static-body");
  const staticSaveBtn = document.getElementById("admin-static-save");
  const staticPreviewBtn = document.getElementById("admin-static-preview");
  const staticPreviewLink = document.getElementById("admin-static-preview-link");
  const staticResetBtn = document.getElementById("admin-static-reset");
  const staticCurrentEl = document.getElementById("admin-static-current");
  const staticHistorySelect = document.getElementById("admin-static-history");
  const staticRestoreBtn = document.getElementById("admin-static-restore");
  const staticStatusEl = document.getElementById("admin-static-status");
  const dataExportBtn = document.getElementById("admin-data-export");
  const dataSelectBtn = document.getElementById("admin-data-select");
  const dataImportBtn = document.getElementById("admin-data-import");
  const dataRestoreBtn = document.getElementById("admin-data-restore");
  const dataFileInput = document.getElementById("admin-data-file");
  const dataFileName = document.getElementById("admin-data-filename");
  const dataModeSelect = document.getElementById("admin-data-mode");
  const dataBackupLabel = document.getElementById("admin-data-backup");
  const dataExportHint = document.getElementById("admin-export-hint");
  const dataImportPolicy = document.getElementById("admin-import-policy");
  const dataManifestInfo = document.getElementById("admin-data-manifest");
  const seedAdminEl = document.getElementById("seed-admin-users");
  const seedUsersEl = document.getElementById("seed-users");
  const seedPostsEl = document.getElementById("seed-posts");
  const seedBoardEl = document.getElementById("seed-board");
  const seedBoardRepliesEl = document.getElementById("seed-board-replies");
  const seedInquiryEl = document.getElementById("seed-inquiry");
  const seedReportsEl = document.getElementById("seed-reports");
  const seedModerationEl = document.getElementById("seed-moderation");
  const seedRulesEl = document.getElementById("seed-rules");
  const seedExportBtn = document.getElementById("admin-seed-export");
  const seedKeysEl = document.getElementById("admin-seed-keys");
  const seedFileInput = document.getElementById("admin-seed-file");
  const seedSelectBtn = document.getElementById("admin-seed-select");
  const seedImportBtn = document.getElementById("admin-seed-import");
  const seedFileName = document.getElementById("admin-seed-filename");
  const seedManifestEl = document.getElementById("admin-seed-manifest");
  const seedPreviewEl = document.getElementById("admin-seed-preview");
  const postSourceStatusEl = document.getElementById("admin-post-source-status");
  const mockRegenerateBtn = document.getElementById("admin-mock-regenerate");
  const postsResetBtn = document.getElementById("admin-posts-reset");
  const tabBadges = Array.from(document.querySelectorAll("[data-tab-badge]"));

  const isInquiryReportType = (type) => {
    const key = String(type || "").toLowerCase();
    return ["inquiry", "thread", "inquiry_thread", "inquiry_message", "inquirythread", "inquirymessage"].includes(key);
  };

  const resolveInquiryThreadId = (report) => {
    const direct = String(report?.thread_id || report?.threadId || report?.target_thread_id || "").trim();
    if (direct) return direct;
    const targetKey = String(report?.target_key || "").trim();
    if (targetKey && targetKey.startsWith("thread_")) return targetKey;
    const postKey = String(report?.post_key || report?.postKey || report?.post_id || report?.target_post_key || "").trim();
    const participantA = String(report?.buyer_email || report?.buyerEmail || report?.participantA || report?.participant_a || "").trim();
    const participantB = String(report?.seller_email || report?.sellerEmail || report?.participantB || report?.participant_b || "").trim();
    if (!postKey || !participantA || !participantB) return "";
    return ccGetInquiryThreadId({ post_key: postKey, participantA, participantB });
  };

  const setTabBadge = (key, count) => {
    const el = tabBadges.find((badge) => badge.getAttribute("data-tab-badge") === key);
    if (!el) return;
    const value = Number(count || 0);
    if (value > 0) {
      el.textContent = String(value);
      el.classList.remove("is-hidden");
    } else {
      el.textContent = "0";
      el.classList.add("is-hidden");
    }
  };

  const updateAdminTabBadges = () => {
    const reportNewCount = ccLoadReports().reduce((sum, report) => {
      const id = String(report.report_id || "");
      const pending = pendingReports[id] || {};
      const status = normalizeReportStatus(Object.prototype.hasOwnProperty.call(pending, "status") ? pending.status : report.status);
      return sum + (status === "new" ? 1 : 0);
    }, 0);
    const convoFrozenCount = ccLoadInquiryThreads().reduce((sum, thread) => {
      const threadId = ccGetInquiryThreadId(thread?.threadId || "");
      const pending = pendingConversations[threadId] || {};
      const currentFrozen = ccIsConversationFrozen(threadId);
      const effectiveFrozen = typeof pending.frozen === "boolean" ? pending.frozen : currentFrozen;
      return sum + (effectiveFrozen ? 1 : 0);
    }, 0);
    const userBannedCount = getMockUsersDB().reduce((sum, user) => {
      const email = String(user?.email || "");
      const pending = pendingUsers[email] || {};
      const status = typeof pending.status === "string" ? pending.status : normalizeUserStatus(user?.status);
      return sum + (status === "banned" ? 1 : 0);
    }, 0);
    const boardHiddenCount = ccGetBoardThreads({ includeHidden: true }).reduce((sum, thread) => {
      const id = String(thread?.id || "");
      const pending = pendingBoards[id] || {};
      const hidden = ccIsBoardHidden(id);
      const effectiveHidden = typeof pending.hidden === "boolean" ? pending.hidden : hidden;
      return sum + (effectiveHidden ? 1 : 0);
    }, 0);
    setTabBadge("reports", reportNewCount);
    setTabBadge("conversations", convoFrozenCount);
    setTabBadge("users", userBannedCount);
    setTabBadge("board", boardHiddenCount);
  };

  const normalizeReportStatus = (raw) => {
    const key = String(raw || "").toLowerCase();
    if (key === "in_progress") return "investigating";
    if (key === "rejected") return "dismissed";
    if (["new", "investigating", "resolved", "dismissed"].includes(key)) return key;
    return "new";
  };

  const normalizeReportPriority = (raw) => {
    const key = String(raw || "").toLowerCase();
    if (["low", "normal", "high"].includes(key)) return key;
    return "normal";
  };

  const getReportPriorityMeta = (priority) => {
    const key = normalizeReportPriority(priority);
    const map = {
      low: { label: "低", className: "admin-status-low" },
      normal: { label: "中", className: "admin-status-normal" },
      high: { label: "高", className: "admin-status-high" }
    };
    return map[key] || map.normal;
  };

  const normalizeDueDate = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
    return raw;
  };

  const getDueTimestamp = (value) => {
    const normalized = normalizeDueDate(value);
    if (!normalized) return null;
    const t = Date.parse(`${normalized}T23:59:59`);
    return Number.isNaN(t) ? null : t;
  };

  const getReportStatusMeta = (status) => {
    const key = normalizeReportStatus(status);
    const map = {
      new: { label: "新規", className: "admin-status-new" },
      investigating: { label: "対応中", className: "admin-status-investigating" },
      resolved: { label: "対応済", className: "admin-status-resolved" },
      dismissed: { label: "却下", className: "admin-status-dismissed" }
    };
    return map[key] || map.new;
  };

  const normalizeReportType = (raw) => {
    const key = String(raw || "").toLowerCase();
    if (!key) return "";
    if (["inquiry", "thread", "inquiry_thread", "inquiry_message", "inquirythread", "inquirymessage"].includes(key)) {
      return "inquiry";
    }
    if (["board", "board_post", "board_thread", "boardthread", "boardpost"].includes(key)) {
      return "board_post";
    }
    if (["boardreply", "board_reply", "board_post_reply", "boardreply_post"].includes(key)) {
      return "board_reply";
    }
    if (key.startsWith("board") && key.includes("reply")) {
      return "board_reply";
    }
    if (key.startsWith("board")) {
      return "board_post";
    }
    if (["board_post", "board_reply"].includes(key)) {
      return key;
    }
    if (key === "post") return "post";
    return key;
  };

  const resolveReportAssigned = (report) => {
    return String(report?.assigned_to || report?.assignedTo || "").trim();
  };

  const resolveReportNote = (report) => {
    if (Object.prototype.hasOwnProperty.call(report || {}, "internal_note")) {
      return String(report?.internal_note || "");
    }
    if (Object.prototype.hasOwnProperty.call(report || {}, "admin_note")) {
      return String(report?.admin_note || "");
    }
    return "";
  };

  const getAdminAssignees = () => {
    const seen = new Set();
    return getMockUsersDB().reduce((list, user) => {
      const email = normalizeEmail(user?.email || "");
      if (!email) return list;
      if (normalizeUserRole(user?.role) !== "admin") return list;
      if (seen.has(email)) return list;
      seen.add(email);
      const name = String(user?.account_name || "").trim();
      list.push({ email, label: name || email });
      return list;
    }, []);
  };

  const navigateAdminWithGuard = (href) => {
    if (!href) return;
    if (!hasAdminPending()) {
      window.location.href = href;
      return;
    }
    openAdminUnsavedModal({
      onSave: () => {
        saveAllPending();
        window.location.href = href;
      },
      onDiscard: () => {
        discardAllPending();
        window.location.href = href;
      },
      onCancel: () => { }
    });
  };

  const runAdminDataAction = (action) => {
    if (!action) return;
    if (!hasAdminPending()) {
      action();
      return;
    }
    openAdminUnsavedModal({
      onSave: () => {
        saveAllPending();
        action();
      },
      onDiscard: () => {
        discardAllPending();
        action();
      },
      onCancel: () => { }
    });
  };

  const buildPostStatus = (postKey) => {
    const deleted = ccIsPostDeleted(postKey);
    const hidden = ccIsPostHidden(postKey);
    return { deleted, hidden };
  };

  const matchesPostQuery = (post, query) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const hay = [
      post?.title,
      post?.author,
      post?.key,
      post?.post_id
    ].map((v) => String(v || "").toLowerCase()).join(" ");
    return hay.includes(q);
  };

  const renderPosts = () => {
    if (!postListEl) return;
    const query = String(postSearchInput?.value || "").trim();
    const filter = String(postFilterSelect?.value || "all");
    const posts = ccGetPosts({ includeHidden: true });
    const filtered = posts.filter((post) => {
      const key = String(post?.key || "");
      const status = buildPostStatus(key);
      const pending = pendingPosts[key] || {};
      const effectiveHidden = typeof pending.hidden === "boolean" ? pending.hidden : status.hidden;
      const effectiveDeleted = typeof pending.deleted === "boolean" ? pending.deleted : status.deleted;
      if (!matchesPostQuery(post, query)) return false;
      if (filter === "public" && (effectiveHidden || effectiveDeleted)) return false;
      if (filter === "hidden" && (!effectiveHidden || effectiveDeleted)) return false;
      if (filter === "deleted" && !effectiveDeleted) return false;
      return true;
    });

    if (postCountEl) postCountEl.textContent = String(filtered.length);
    if (!filtered.length) {
      postListEl.innerHTML = `<div class="admin-empty">該当する投稿はありません。</div>`;
      return;
    }

    postListEl.innerHTML = filtered.map((post) => {
      const postKey = String(post?.key || "");
      const status = buildPostStatus(postKey);
      const pending = pendingPosts[postKey] || {};
      const hasPending = Object.prototype.hasOwnProperty.call(pendingPosts, postKey);
      const effectiveHidden = typeof pending.hidden === "boolean" ? pending.hidden : status.hidden;
      const effectiveDeleted = typeof pending.deleted === "boolean" ? pending.deleted : status.deleted;
      const effectiveStatus = effectiveDeleted
        ? { key: "deleted", label: "削除済み" }
        : (effectiveHidden ? { key: "hidden", label: "非表示" } : { key: "public", label: "公開中" });
      const author = String(post?.author || "—");
      const title = ccGetPostDisplayTitle(post, "無題の投稿");
      const createdAt = post?.created_at ? formatDateForView(post.created_at, { mode: "admin" }) : "—";
      const statusClass = effectiveStatus.key === "hidden"
        ? "admin-status-hidden"
        : (effectiveStatus.key === "deleted" ? "admin-status-deleted" : "admin-status-public");
      const hideLabel = effectiveHidden ? "復帰" : "非表示にする";
      const hideAction = effectiveHidden ? "show" : "hide";
      const deleteLabel = effectiveDeleted ? "復元" : "削除";
      const deleteAction = effectiveDeleted ? "restore" : "delete";
      const openHref = postKey ? `detail.html?post=${encodeURIComponent(postKey)}` : "";
      return `
        <article class="admin-post-card" data-post-key="${escapeHtml(postKey)}">
          <div class="admin-post-main">
            <div class="admin-post-title">${escapeHtml(title)}</div>
            <div class="admin-post-meta">
              <span>投稿ID：${escapeHtml(String(post?.post_id || postKey || "—"))}</span>
              <span>投稿者：${escapeHtml(author)}</span>
              <span>投稿日：${escapeHtml(createdAt)}</span>
            </div>
          </div>
          <div class="admin-post-actions">
            <span class="admin-status ${statusClass}">${escapeHtml(effectiveStatus.label)}</span>
            ${hasPending ? `<span class="admin-pending">未保存</span>` : ""}
            <button class="btn btn-secondary admin-btn" type="button" data-admin-action="${hideAction}">${escapeHtml(hideLabel)}</button>
            <button class="btn btn-secondary admin-btn" type="button" data-admin-action="${deleteAction}">${escapeHtml(deleteLabel)}</button>
            ${openHref ? `<a class="admin-link admin-open-link" href="${openHref}">開く</a>` : `<span class="admin-link is-disabled" aria-disabled="true">開く</span>`}
          </div>
        </article>
      `;
    }).join("");
  };

  const countBoardReplies = (list) => {
    if (!Array.isArray(list)) return 0;
    let count = 0;
    list.forEach((r) => {
      count += 1;
      if (Array.isArray(r.replies) && r.replies.length) {
        count += countBoardReplies(r.replies);
      }
    });
    return count;
  };

  const matchesBoardQuery = (thread, query) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const hay = [
      thread?.title,
      thread?.body,
      thread?.authorName
    ].map((v) => String(v || "").toLowerCase()).join(" ");
    return hay.includes(q);
  };

  const renderBoards = () => {
    if (!boardListEl) return;
    const query = String(boardSearchInput?.value || "").trim();
    const filter = String(boardFilterSelect?.value || "all");
    const threads = ccGetBoardThreads({ includeHidden: true });
    const filtered = threads.filter((thread) => {
      const id = String(thread?.id || "");
      const hidden = ccIsBoardHidden(id);
      const pending = pendingBoards[id] || {};
      const effectiveHidden = typeof pending.hidden === "boolean" ? pending.hidden : hidden;
      if (!matchesBoardQuery(thread, query)) return false;
      if (filter === "active" && effectiveHidden) return false;
      if (filter === "hidden" && !effectiveHidden) return false;
      return true;
    });

    if (boardCountEl) boardCountEl.textContent = String(filtered.length);
    if (!filtered.length) {
      boardListEl.innerHTML = `<div class="admin-empty">該当するスレッドはありません。</div>`;
      updateAdminTabBadges();
      return;
    }

    boardListEl.innerHTML = filtered.map((thread) => {
      const id = String(thread?.id || "");
      const hidden = ccIsBoardHidden(id);
      const pending = pendingBoards[id] || {};
      const hasPending = Object.prototype.hasOwnProperty.call(pendingBoards, id);
      const effectiveHidden = typeof pending.hidden === "boolean" ? pending.hidden : hidden;
      const statusLabel = effectiveHidden ? "非表示" : "公開中";
      const statusClass = effectiveHidden ? "admin-status-hidden" : "admin-status-public";
      const actionLabel = effectiveHidden ? "復帰" : "非表示にする";
      const actionKey = effectiveHidden ? "show" : "hide";
      const repliesCount = countBoardReplies(thread?.replies);
      const createdAt = formatDateTimeSeconds(thread?.created_at);
      const title = ccGetBoardDisplayTitle(thread, "—");
      const author = String(thread?.authorName || "—");
      const openHref = id ? `board_detail.html?thread=${encodeURIComponent(id)}` : "";
      return `
        <article class="admin-board-card" data-board-id="${escapeHtml(id)}">
          <div class="admin-board-main">
            <div class="admin-board-title">${escapeHtml(title)}</div>
            <div class="admin-board-meta">
              <span>作成者：${escapeHtml(author)}</span>
              <span>作成日時：${escapeHtml(createdAt)}</span>
              <span>返信数：${escapeHtml(String(repliesCount))}</span>
            </div>
          </div>
          <div class="admin-board-actions">
            <span class="admin-status ${statusClass}">${escapeHtml(statusLabel)}</span>
            ${hasPending ? `<span class="admin-pending">未保存</span>` : ""}
            <button class="btn btn-secondary admin-btn" type="button" data-board-action="${actionKey}">${escapeHtml(actionLabel)}</button>
            ${openHref ? `<a class="admin-link admin-open-link" href="${openHref}">開く</a>` : `<span class="admin-link is-disabled" aria-disabled="true">開く</span>`}
          </div>
        </article>
      `;
    }).join("");
    updateAdminTabBadges();
  };

  if (postListEl) {
    postListEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-admin-action]");
      if (!btn) return;
      const card = btn.closest(".admin-post-card");
      const postKey = card ? card.getAttribute("data-post-key") || "" : "";
      if (!postKey) return;
      const action = btn.getAttribute("data-admin-action");
      const post = ccGetPostByKey(postKey, { includeHidden: true });
      const title = ccGetPostDisplayTitle(post, "この投稿");
      const messageMap = {
        hide: `「${title}」を非表示にしますか？`,
        show: `「${title}」を復帰しますか？`,
        delete: `「${title}」を削除しますか？`,
        restore: `「${title}」を復元しますか？`
      };
      openGlobalConfirmModal({
        id: "cc-admin-post-action-modal",
        title: "操作の確認",
        message: messageMap[action] || "操作を実行しますか？",
        confirmText: action === "delete" ? "削除する" : (action === "restore" ? "復元する" : (action === "hide" ? "非表示にする" : "復帰する")),
        cancelText: "キャンセル",
        onConfirm: () => {
          const next = pendingPosts[postKey] || {};
          if (action === "hide") next.hidden = true;
          if (action === "show") next.hidden = false;
          if (action === "delete") next.deleted = true;
          if (action === "restore") next.deleted = false;
          pendingPosts[postKey] = next;
          renderPosts();
        }
      });
    });
  }

  if (boardListEl) {
    boardListEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-board-action]");
      if (!btn) return;
      const card = btn.closest(".admin-board-card");
      const boardId = card ? card.getAttribute("data-board-id") || "" : "";
      if (!boardId) return;
      const action = btn.getAttribute("data-board-action");
      const title = card ? card.querySelector(".admin-board-title")?.textContent || "このスレッド" : "このスレッド";
      const message = action === "hide"
        ? `「${title}」を非表示にしますか？`
        : `「${title}」を復帰しますか？`;
      openGlobalConfirmModal({
        id: "cc-admin-board-action-modal",
        title: "操作の確認",
        message,
        confirmText: action === "hide" ? "非表示にする" : "復帰する",
        cancelText: "キャンセル",
        onConfirm: () => {
          pendingBoards[boardId] = { hidden: action === "hide" };
          renderBoards();
        }
      });
    });
  }

  const savePendingBoards = () => {
    if (!assertAdmin()) return;
    const keys = Object.keys(pendingBoards);
    if (!keys.length) return;
    const adminEmail = actor();
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    keys.forEach((id) => {
      const currentHidden = ccIsBoardHidden(id);
      const pending = pendingBoards[id] || {};
      const nextHidden = typeof pending.hidden === "boolean" ? pending.hidden : currentHidden;
      if (nextHidden !== currentHidden) {
        ccSetBoardHidden(id, nextHidden, { hidden_by: adminEmail, hidden_at: now });
        ccAddAdminAudit({
          at: now,
          admin_email: adminEmail,
          action: nextHidden ? "board_hide" : "board_unhide",
          target: id,
          before: { hidden: currentHidden },
          after: { hidden: nextHidden }
        });
      }
    });
    keys.forEach((k) => { delete pendingBoards[k]; });
    renderBoards();
    renderLogs();
  };

  const discardPendingBoards = () => {
    Object.keys(pendingBoards).forEach((k) => { delete pendingBoards[k]; });
    renderBoards();
  };

  const isBoardViewActive = (viewId) => {
    return boardViews.some((panel) => panel.classList.contains("is-active") && panel.getAttribute("data-board-view") === viewId);
  };
  if (boardSaveBtn) boardSaveBtn.addEventListener("click", () => {
    if (isBoardViewActive("replies")) {
      savePendingBoardReplies();
    } else {
      savePendingBoards();
    }
  });
  if (boardDiscardBtn) boardDiscardBtn.addEventListener("click", () => {
    if (isBoardViewActive("replies")) {
      Object.keys(pendingBoardReplies).forEach((k) => { delete pendingBoardReplies[k]; });
      renderBoardReplies();
    } else {
      discardPendingBoards();
    }
  });
  if (boardSearchInput) boardSearchInput.addEventListener("input", renderBoards);
  if (boardFilterSelect) boardFilterSelect.addEventListener("change", renderBoards);

  if (boardViewToggles.length && boardViews.length) {
    boardViewToggles.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-board-view");
        if (!key) return;
        boardViewToggles.forEach((b) => {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        boardViews.forEach((panel) => {
          const isActive = panel.getAttribute("data-board-view") === key;
          panel.classList.toggle("is-active", isActive);
        });
        if (key === "threads") renderBoards();
        if (key === "replies") renderBoardReplies();
      });
    });
  }

  const flattenBoardReplies = (threads) => {
    const out = [];
    const walk = (list, thread) => {
      if (!Array.isArray(list)) return;
      list.forEach((r) => {
        const item = ccNormalizeBoardReply(r, "");
        const replyId = String(item.id || r?.id || r?.reply_id || "").trim();
        out.push({
          replyId,
          body: item.body,
          authorName: item.authorName,
          created_at: item.created_at,
          threadId: thread?.id || "",
          threadTitle: thread?.title || thread?.body || ""
        });
        if (Array.isArray(r.replies) && r.replies.length) walk(r.replies, thread);
      });
    };
    threads.forEach((thread) => {
      walk(thread?.replies, thread);
    });
    return out;
  };

  const matchesReplyQuery = (reply, query) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const hay = [
      reply?.body,
      reply?.authorName
    ].map((v) => String(v || "").toLowerCase()).join(" ");
    return hay.includes(q);
  };

  const renderBoardReplies = () => {
    if (!replyListEl) return;
    const query = String(replySearchInput?.value || "").trim();
    const filter = String(replyFilterSelect?.value || "all");
    const threadKey = String(replyThreadInput?.value || "").trim();
    const threads = ccGetBoardThreads({ includeHidden: true });
    const replies = flattenBoardReplies(threads).filter((reply) => reply.replyId);
    const filtered = replies.filter((reply) => {
      const hidden = ccIsBoardReplyHidden(reply.replyId);
      const pending = pendingBoardReplies[reply.replyId] || {};
      const effectiveHidden = typeof pending.hidden === "boolean" ? pending.hidden : hidden;
      if (!matchesReplyQuery(reply, query)) return false;
      if (threadKey && String(reply.threadId || "").indexOf(threadKey) === -1) return false;
      if (filter === "active" && effectiveHidden) return false;
      if (filter === "hidden" && !effectiveHidden) return false;
      return true;
    });

    if (replyCountEl) replyCountEl.textContent = String(filtered.length);
    if (!filtered.length) {
      replyListEl.innerHTML = `<div class="admin-empty">該当する返信はありません。</div>`;
      return;
    }

    replyListEl.innerHTML = filtered.map((reply) => {
      const replyId = String(reply.replyId || "");
      const hidden = ccIsBoardReplyHidden(replyId);
      const pending = pendingBoardReplies[replyId] || {};
      const hasPending = Object.prototype.hasOwnProperty.call(pendingBoardReplies, replyId);
      const effectiveHidden = typeof pending.hidden === "boolean" ? pending.hidden : hidden;
      const statusLabel = effectiveHidden ? "非表示" : "公開中";
      const statusClass = effectiveHidden ? "admin-status-hidden" : "admin-status-public";
      const actionLabel = effectiveHidden ? "復帰" : "非表示にする";
      const actionKey = effectiveHidden ? "show" : "hide";
      const createdAt = formatDateTimeSeconds(reply.created_at);
      const body = String(reply.body || "");
      const preview = body.length > 60 ? `${body.slice(0, 60)}…` : body || "—";
      const openHref = reply.threadId
        ? `board_detail.html?thread=${encodeURIComponent(reply.threadId)}#reply-${encodeURIComponent(replyId)}`
        : "";
      return `
        <article class="admin-reply-card" data-reply-id="${escapeHtml(replyId)}">
          <div class="admin-reply-main">
            <div class="admin-reply-title">${escapeHtml(preview)}</div>
            <div class="admin-reply-meta">
              <span>スレッド：${escapeHtml(String(reply.threadTitle || reply.threadId || "—"))}</span>
              <span>投稿者：${escapeHtml(String(reply.authorName || "—"))}</span>
              <span>投稿日：${escapeHtml(createdAt)}</span>
            </div>
          </div>
          <div class="admin-reply-actions">
            <span class="admin-status ${statusClass}">${escapeHtml(statusLabel)}</span>
            ${hasPending ? `<span class="admin-pending">未保存</span>` : ""}
            <button class="btn btn-secondary admin-btn" type="button" data-reply-action="${actionKey}">${escapeHtml(actionLabel)}</button>
            ${openHref ? `<a class="admin-link admin-open-link" href="${openHref}">開く</a>` : `<span class="admin-link is-disabled" aria-disabled="true">開く</span>`}
          </div>
        </article>
      `;
    }).join("");
  };

  if (replyListEl) {
    replyListEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-reply-action]");
      if (!btn) return;
      const card = btn.closest(".admin-reply-card");
      const replyId = card ? card.getAttribute("data-reply-id") || "" : "";
      if (!replyId) return;
      const action = btn.getAttribute("data-reply-action");
      const message = action === "hide"
        ? "この返信を非表示にしますか？"
        : "この返信を復帰しますか？";
      openGlobalConfirmModal({
        id: "cc-admin-reply-action-modal",
        title: "操作の確認",
        message,
        confirmText: action === "hide" ? "非表示にする" : "復帰する",
        cancelText: "キャンセル",
        onConfirm: () => {
          pendingBoardReplies[replyId] = { hidden: action === "hide" };
          renderBoardReplies();
        }
      });
    });
    replyListEl.addEventListener("click", (e) => {
      const link = e.target.closest("a.admin-open-link");
      if (!link) return;
      e.preventDefault();
      navigateAdminWithGuard(link.getAttribute("href"));
    });
  }

  const savePendingBoardReplies = () => {
    if (!assertAdmin()) return;
    const keys = Object.keys(pendingBoardReplies);
    if (!keys.length) return;
    const adminEmail = actor();
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    keys.forEach((replyId) => {
      const currentHidden = ccIsBoardReplyHidden(replyId);
      const pending = pendingBoardReplies[replyId] || {};
      const nextHidden = typeof pending.hidden === "boolean" ? pending.hidden : currentHidden;
      if (nextHidden !== currentHidden) {
        ccSetBoardReplyHidden(replyId, nextHidden, { hidden_by: adminEmail, hidden_at: now });
        ccAddAdminAudit({
          at: now,
          admin_email: adminEmail,
          action: nextHidden ? "board_reply_hide" : "board_reply_unhide",
          target: replyId,
          before: { hidden: currentHidden },
          after: { hidden: nextHidden }
        });
      }
    });
    keys.forEach((k) => { delete pendingBoardReplies[k]; });
    renderBoardReplies();
    renderLogs();
  };

  if (replySearchInput) replySearchInput.addEventListener("input", renderBoardReplies);
  if (replyFilterSelect) replyFilterSelect.addEventListener("change", renderBoardReplies);
  if (replyThreadInput) replyThreadInput.addEventListener("input", renderBoardReplies);

  const savePendingPosts = () => {
    if (!assertAdmin()) return;
    const keys = Object.keys(pendingPosts);
    if (!keys.length) return;
    const adminEmail = actor();
    const now = new Date().toISOString();
    keys.forEach((postKey) => {
      const current = buildPostStatus(postKey);
      const pending = pendingPosts[postKey] || {};
      const nextHidden = typeof pending.hidden === "boolean" ? pending.hidden : current.hidden;
      const nextDeleted = typeof pending.deleted === "boolean" ? pending.deleted : current.deleted;
      if (nextHidden !== current.hidden) {
        ccSetPostHidden(postKey, nextHidden, { hidden_by: adminEmail, hidden_at: now });
        ccAddAdminAudit({
          at: now,
          admin_email: adminEmail,
          action: nextHidden ? "post_hide" : "post_unhide",
          target: postKey,
          before: { hidden: current.hidden, deleted: current.deleted },
          after: { hidden: nextHidden, deleted: nextDeleted }
        });
        const post = ccGetPostByKey(postKey, { includeHidden: true });
        const ownerName = String(post?.author || post?.author_name || "").trim();
        if (ownerName) {
          addNotice({
            userId: ownerName,
            category: "post",
            type: "post_visibility",
            title: nextHidden ? "投稿が非公開になりました" : "投稿が公開されました",
            body: `『${post?.title || "投稿"}』が${nextHidden ? "非公開" : "公開"}に変更されました`,
            link: postKey ? `detail.html?post=${encodeURIComponent(String(postKey))}` : "mypage.html?tab=posts",
            createdAt: now,
            readAt: null,
            hiddenAt: null
          });
        }
      }
      if (nextDeleted !== current.deleted) {
        if (!assertAdmin()) return;
        ccSetPostDeleted(postKey, nextDeleted);
        ccAddAdminAudit({
          at: now,
          admin_email: adminEmail,
          action: nextDeleted ? "post_delete" : "post_restore",
          target: postKey,
          before: { hidden: current.hidden, deleted: current.deleted },
          after: { hidden: nextHidden, deleted: nextDeleted }
        });
      }
    });
    keys.forEach((k) => { delete pendingPosts[k]; });
    renderPosts();
    renderLogs();
  };

  const discardPendingPosts = () => {
    Object.keys(pendingPosts).forEach((k) => { delete pendingPosts[k]; });
    renderPosts();
  };

  if (postSaveBtn) postSaveBtn.addEventListener("click", savePendingPosts);
  if (postDiscardBtn) postDiscardBtn.addEventListener("click", discardPendingPosts);

  if (postSearchInput) postSearchInput.addEventListener("input", renderPosts);
  if (postFilterSelect) postFilterSelect.addEventListener("change", renderPosts);

  const renderReports = () => {
    if (!reportListEl) return;
    const adminAssignees = getAdminAssignees();
    const assigneeMap = new Map(adminAssignees.map((u) => [u.email, u.label]));
    const posts = ccGetPosts({ includeHidden: true });
    const postTitleMap = new Map(posts.map((post) => [String(post?.key || ""), ccGetPostDisplayTitle(post, "")]));
    const boardThreads = ccGetBoardThreads({ includeHidden: true });
    const boardThreadMap = new Map(boardThreads.map((thread) => [String(thread?.id || ""), ccGetBoardDisplayTitle(thread, "")]));
    const replyMap = new Map();
    flattenBoardReplies(boardThreads).forEach((reply) => {
      if (!reply.replyId) return;
      replyMap.set(String(reply.replyId), reply);
    });
    const inquiryThreads = ccLoadInquiryThreads();
    const inquiryMap = new Map();
    inquiryThreads.forEach((thread) => {
      const id = ccGetInquiryThreadId(thread?.threadId || "");
      if (!id) return;
      inquiryMap.set(id, thread);
    });
    const query = String(reportSearchInput?.value || "").trim().toLowerCase();
    const statusFilter = String(reportStatusSelect?.value || "all");
    const typeFilter = String(reportTypeSelect?.value || "all");
    const sortOrder = String(reportSortSelect?.value || "newest");
    const getReportTimeValue = (report) => {
      if (typeof report?.reported_at_epoch_ms === "number") return report.reported_at_epoch_ms;
      const iso = report?.reported_at_iso || report?.created_at || report?.createdAt || "";
      const t = Date.parse(iso);
      return Number.isNaN(t) ? 0 : t;
    };
    const reports = ccLoadReports().slice().sort((a, b) => {
      const diff = getReportTimeValue(b) - getReportTimeValue(a);
      return sortOrder === "oldest" ? -diff : diff;
    });
    const filtered = reports.filter((report) => {
      const id = String(report.report_id || "");
      const pending = pendingReports[id] || {};
      const status = normalizeReportStatus(Object.prototype.hasOwnProperty.call(pending, "status") ? pending.status : report.status);
      const type = normalizeReportType(report.target_type);
      const target = String(report.target_key || "");
      const reporter = String(report.reporter_email || "");
      if (statusFilter !== "all" && statusFilter !== "unassigned" && status !== statusFilter) return false;
      if (typeFilter !== "all" && type !== typeFilter) return false;
      const assigned = Object.prototype.hasOwnProperty.call(pending, "assigned_to")
        ? pending.assigned_to
        : resolveReportAssigned(report);
      const note = Object.prototype.hasOwnProperty.call(pending, "internal_note")
        ? pending.internal_note
        : resolveReportNote(report);
      const priority = normalizeReportPriority(Object.prototype.hasOwnProperty.call(pending, "priority")
        ? pending.priority
        : report.priority);
      const dueAt = Object.prototype.hasOwnProperty.call(pending, "due_at_iso")
        ? pending.due_at_iso
        : (report.due_at_iso || report.due_at);
      if (statusFilter === "unassigned" && String(assigned || "").trim()) return false;
      if (!query) return true;
      const hay = [id, target, reporter, report.reason, assigned, note, priority, dueAt]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return hay.includes(query);
    });

    if (reportCountEl) reportCountEl.textContent = String(filtered.length);
    if (!filtered.length) {
      reportListEl.innerHTML = `<div class="admin-empty">通報はありません。</div>`;
      updateAdminTabBadges();
      return;
    }

    reportListEl.innerHTML = filtered.map((report) => {
      const reportId = String(report.report_id || "");
      const pending = pendingReports[reportId] || {};
      const status = normalizeReportStatus(Object.prototype.hasOwnProperty.call(pending, "status") ? pending.status : report.status);
      const assigned = Object.prototype.hasOwnProperty.call(pending, "assigned_to")
        ? pending.assigned_to
        : resolveReportAssigned(report);
      const assignedLabel = assigned ? (assigneeMap.get(normalizeEmail(assigned)) || assigned) : "";
      const note = Object.prototype.hasOwnProperty.call(pending, "internal_note")
        ? pending.internal_note
        : resolveReportNote(report);
      const priority = normalizeReportPriority(Object.prototype.hasOwnProperty.call(pending, "priority")
        ? pending.priority
        : report.priority);
      const priorityMeta = getReportPriorityMeta(priority);
      const dueAt = Object.prototype.hasOwnProperty.call(pending, "due_at_iso")
        ? pending.due_at_iso
        : (report.due_at_iso || report.due_at || "");
      const dueTs = getDueTimestamp(dueAt);
      const isOverdue = dueTs !== null && Date.now() > dueTs && !["resolved", "dismissed"].includes(status);
      const noteEmpty = !String(note || "").trim();
      const resolvedHint = status === "resolved" && noteEmpty
        ? `<span class="admin-report-hint">メモ推奨</span>`
        : "";
      const dismissedHint = status === "dismissed" && noteEmpty
        ? `<span class="admin-report-hint is-danger">メモ必須</span>`
        : "";
      const hasPending = Object.prototype.hasOwnProperty.call(pendingReports, reportId);
      const targetKey = String(report.target_key || "");
      const type = String(report.target_type || "");
      const typeKey = type.toLowerCase();
      const statusMeta = getReportStatusMeta(status);
      const isInquiryReport = isInquiryReportType(type);
      const threadId = isInquiryReport ? resolveInquiryThreadId(report) : "";
      if (isInquiryReport && !threadId && !reportMissingThread.has(reportId)) {
        console.warn("[admin-report] thread_id missing", report);
        reportMissingThread.add(reportId);
      }
      let targetLink = escapeHtml(targetKey || "—");
      if (type === "post" && targetKey) {
        targetLink = `<a class="admin-link" href="detail.html?post=${encodeURIComponent(targetKey)}" target="_blank" rel="noreferrer">${escapeHtml(targetKey)}</a>`;
      } else if (typeKey === "board_post" && targetKey) {
        targetLink = `<a class="admin-link" href="board_detail.html?thread=${encodeURIComponent(targetKey)}" target="_blank" rel="noreferrer">${escapeHtml(targetKey)}</a>`;
      } else if (typeKey === "board_reply" && targetKey) {
        targetLink = `<span class="admin-link">${escapeHtml(targetKey)}</span>`;
      } else if (isInquiryReport && targetKey) {
        targetLink = `<span class="admin-link">${escapeHtml(targetKey)}</span>`;
      }
      const boardPostKey = String(report.board_post_key || report.post_key || "");
      const replyKey = String(report.reply_key || report.target_key || "");
      let openHref = "";
      let openLabel = "開く";
      let summary = "";
      if (typeKey === "post" && targetKey) {
        openHref = `detail.html?post=${encodeURIComponent(targetKey)}`;
        openLabel = "開く";
        summary = postTitleMap.get(targetKey) || "";
      } else if (typeKey === "board_post") {
        const key = boardPostKey || targetKey;
        if (key) openHref = `board_detail.html?thread=${encodeURIComponent(key)}`;
        openLabel = "開く";
        summary = boardThreadMap.get(key) || "";
      } else if (typeKey === "board_reply") {
        const key = boardPostKey;
        if (key) {
          openHref = `board_detail.html?thread=${encodeURIComponent(key)}`;
          if (replyKey) openHref += `#reply-${encodeURIComponent(replyKey)}`;
        }
        openLabel = "開く";
        const reply = replyMap.get(replyKey || "");
        const body = reply ? String(reply.body || "") : "";
        summary = body ? `返信: ${body}` : "";
      } else if (isInquiryReport && threadId) {
        openHref = `inquiry-thread.html?thread=${encodeURIComponent(threadId)}&from=report`;
        openLabel = "開く";
        const thread = inquiryMap.get(threadId);
        summary = thread
          ? ccGetPostDisplayTitle({ title: thread?.postTitle, key: thread?.postId, isMock: thread?.isMock, source: thread?.source }, "")
          : "";
      }
      if (!openHref && (typeKey === "board_post" || typeKey === "board_reply" || isInquiryReport)) {
        console.warn("[admin-report] open link missing", report);
      }
      const openLabelText = typeKey === "board_reply" ? "開く（返信）" : openLabel;
      const openLink = openHref
        ? `<a class="admin-link admin-report-open" href="${openHref}">${escapeHtml(openLabelText)}</a>`
        : `<span class="admin-link is-disabled" aria-disabled="true">遷移先不明</span>`;
      const reportedAtText = formatDateTimeSeconds(report.reported_at_iso || report.created_at || report.createdAt || report.reported_at_epoch_ms);
      const assigneeOptions = [
        `<option value="" ${assigned ? "" : "selected"}>未割当</option>`,
        ...adminAssignees.map((user) => {
          const selected = normalizeEmail(assigned) === normalizeEmail(user.email);
          const label = user.label || user.email;
          return `<option value="${escapeHtml(user.email)}" ${selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
        })
      ].join("");
      return `
        <article class="admin-report-card" data-report-id="${escapeHtml(reportId)}">
          <div class="admin-report-main">
            <div class="admin-report-title">通報ID：${escapeHtml(reportId)}</div>
            <div class="admin-report-meta">
              <span>対象：${targetLink}</span>
              <span>種別：${escapeHtml(String(report.target_type || ""))}</span>
              <span>理由：${escapeHtml(String(report.reason || ""))}</span>
              <span>通報者：${escapeHtml(String(report.reporter_email || ""))}</span>
              <span>通報日時：${escapeHtml(reportedAtText)}</span>
              ${assignedLabel ? `<span>担当：${escapeHtml(assignedLabel)}</span>` : ""}
              ${dueAt ? `<span>期限：${escapeHtml(String(dueAt))}</span>` : ""}
              ${summary ? `<span>概要：${escapeHtml(summary.length > 60 ? `${summary.slice(0, 60)}…` : summary)}</span>` : ""}
            </div>
          </div>
          <div class="admin-report-actions">
            <span class="admin-status ${escapeHtml(statusMeta.className)}">${escapeHtml(statusMeta.label)}</span>
            <span class="admin-status ${escapeHtml(priorityMeta.className)}">優先:${escapeHtml(priorityMeta.label)}</span>
            ${isOverdue ? `<span class="admin-status admin-status-overdue">期限切れ</span>` : ""}
            ${hasPending ? `<span class="admin-pending">未保存</span>` : ""}
            <div class="cc-dropdown cc-select admin-inline-select">
              <button class="cc-dd-toggle" type="button" aria-haspopup="listbox" aria-expanded="false">
                <span class="cc-dd-value"></span>
              </button>
              <div class="cc-dd-menu" role="listbox"></div>
              <select class="cc-hidden-select" data-report-field="status">
                <option value="new" ${status === "new" ? "selected" : ""} disabled>新規</option>
                <option value="investigating" ${status === "investigating" ? "selected" : ""}>対応中</option>
                <option value="resolved" ${status === "resolved" ? "selected" : ""}>対応済</option>
                <option value="dismissed" ${status === "dismissed" ? "selected" : ""}>却下</option>
              </select>
            </div>
            <div class="cc-dropdown cc-select admin-inline-select">
              <button class="cc-dd-toggle" type="button" aria-haspopup="listbox" aria-expanded="false">
                <span class="cc-dd-value"></span>
              </button>
              <div class="cc-dd-menu" role="listbox"></div>
              <select class="cc-hidden-select" data-report-field="priority">
                <option value="low" ${priority === "low" ? "selected" : ""}>優先:低</option>
                <option value="normal" ${priority === "normal" ? "selected" : ""}>優先:中</option>
                <option value="high" ${priority === "high" ? "selected" : ""}>優先:高</option>
              </select>
            </div>
            <div class="cc-dropdown cc-select admin-inline-select">
              <button class="cc-dd-toggle" type="button" aria-haspopup="listbox" aria-expanded="false">
                <span class="cc-dd-value"></span>
              </button>
              <div class="cc-dd-menu" role="listbox"></div>
              <select class="cc-hidden-select" data-report-field="assigned_to">
                ${assigneeOptions}
              </select>
            </div>
            <input class="admin-inline-input" type="text" data-report-field="due_at_iso" placeholder="期限 YYYY-MM-DD" value="${escapeHtml(String(dueAt || ""))}" />
            <textarea class="admin-inline-input admin-inline-textarea" data-report-field="internal_note" placeholder="運営メモ">${escapeHtml(String(note || ""))}</textarea>
            ${dismissedHint || resolvedHint}
            ${openLink}
          </div>
        </article>
      `;
    }).join("");
    ccInitSelectDropdowns(reportListEl);
    updateAdminTabBadges();
  };

  if (reportListEl) {
    const handleReportInput = (e) => {
      const field = e.target.closest("[data-report-field]");
      if (!field) return;
      const card = field.closest(".admin-report-card");
      const reportId = card ? card.getAttribute("data-report-id") || "" : "";
      if (!reportId) return;
      const pending = pendingReports[reportId] || {};
      const key = field.getAttribute("data-report-field");
      if (key === "status") {
        pending.status = field.value;
      }
      if (key === "assigned_to") {
        pending.assigned_to = field.value;
      }
      if (key === "priority") {
        pending.priority = field.value;
      }
      if (key === "due_at_iso") {
        pending.due_at_iso = field.value;
      }
      if (key === "internal_note") {
        pending.internal_note = field.value;
      }
      pendingReports[reportId] = pending;
      const actions = card ? card.querySelector(".admin-report-actions") : null;
      if (actions && !actions.querySelector(".admin-pending")) {
        const badge = document.createElement("span");
        badge.className = "admin-pending";
        badge.textContent = "未保存";
        actions.prepend(badge);
      }
    };
    reportListEl.addEventListener("input", handleReportInput);
    reportListEl.addEventListener("change", handleReportInput);
    reportListEl.addEventListener("click", (e) => {
      const link = e.target.closest("a.admin-report-open");
      if (!link) return;
      if (link.classList.contains("is-disabled")) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      navigateAdminWithGuard(link.getAttribute("href"));
    });
  }

  if (boardListEl) {
    boardListEl.addEventListener("click", (e) => {
      const link = e.target.closest("a.admin-open-link");
      if (!link) return;
      e.preventDefault();
      navigateAdminWithGuard(link.getAttribute("href"));
    });
  }

  const savePendingReports = () => {
    if (!assertAdmin()) return;
    const keys = Object.keys(pendingReports);
    if (!keys.length) return;
    const adminEmail = actor();
    const list = ccLoadReports();
    const now = new Date().toISOString();
    const invalid = keys.find((id) => {
      const idx = list.findIndex((r) => String(r.report_id || "") === id);
      if (idx < 0) return false;
      const current = list[idx];
      const pending = pendingReports[id] || {};
      const status = normalizeReportStatus(Object.prototype.hasOwnProperty.call(pending, "status") ? pending.status : current.status);
      const note = Object.prototype.hasOwnProperty.call(pending, "internal_note")
        ? pending.internal_note
        : resolveReportNote(current);
      const dueInput = Object.prototype.hasOwnProperty.call(pending, "due_at_iso")
        ? pending.due_at_iso
        : (current.due_at_iso || current.due_at || "");
      if (dueInput && !normalizeDueDate(dueInput)) {
        return true;
      }
      return status === "dismissed" && !String(note || "").trim();
    });
    if (invalid) {
      openGlobalConfirmModal({
        id: "cc-admin-report-note-required",
        title: "メモが必要です",
        message: "却下にする場合は運営メモの入力が必要です。期限は YYYY-MM-DD 形式で入力してください。",
        confirmText: "OK",
        cancelText: "OK"
      });
      return;
    }
    keys.forEach((id) => {
      const idx = list.findIndex((r) => String(r.report_id || "") === id);
      if (idx < 0) return;
      const before = Object.assign({}, list[idx]);
      const pending = pendingReports[id] || {};
      const beforeStatus = normalizeReportStatus(before.status);
      const beforeAssigned = resolveReportAssigned(before);
      const beforeNote = resolveReportNote(before);
      const beforePriority = normalizeReportPriority(before.priority);
      const beforeDue = String(before.due_at_iso || before.due_at || "");
      const nextStatus = normalizeReportStatus(Object.prototype.hasOwnProperty.call(pending, "status") ? pending.status : beforeStatus);
      const nextAssigned = Object.prototype.hasOwnProperty.call(pending, "assigned_to") ? pending.assigned_to : beforeAssigned;
      const nextNote = Object.prototype.hasOwnProperty.call(pending, "internal_note") ? pending.internal_note : beforeNote;
      const nextPriority = normalizeReportPriority(Object.prototype.hasOwnProperty.call(pending, "priority") ? pending.priority : beforePriority);
      const nextDueRaw = Object.prototype.hasOwnProperty.call(pending, "due_at_iso") ? pending.due_at_iso : beforeDue;
      const nextDue = normalizeDueDate(nextDueRaw);
      const next = Object.assign({}, list[idx], pending);
      next.status = nextStatus;
      next.assigned_to = nextAssigned;
      next.internal_note = nextNote;
      next.priority = nextPriority;
      next.due_at_iso = nextDue;
      next.handled_by = adminEmail;
      next.handled_at = now;
      list[idx] = next;
      const statusChanged = beforeStatus !== nextStatus;
      const assignedChanged = String(beforeAssigned || "") !== String(nextAssigned || "");
      const noteChanged = String(beforeNote || "") !== String(nextNote || "");
      if (statusChanged || assignedChanged || noteChanged) {
        ccAddAdminAudit({
          at: now,
          admin_email: adminEmail,
          action: "report_update",
          target: id,
          before: { status: beforeStatus, assigned_to: beforeAssigned, internal_note: beforeNote },
          after: { status: nextStatus, assigned_to: nextAssigned, internal_note: nextNote }
        });
      }
      if (beforePriority !== nextPriority) {
        ccAddAdminAudit({
          at: now,
          admin_email: adminEmail,
          action: "priority_update",
          target: id,
          before: { priority: beforePriority },
          after: { priority: nextPriority }
        });
      }
      if (beforeDue !== nextDue) {
        ccAddAdminAudit({
          at: now,
          admin_email: adminEmail,
          action: "due_update",
          target: id,
          before: { due_at_iso: beforeDue },
          after: { due_at_iso: nextDue }
        });
      }
    });
    ccSaveReports(list);
    keys.forEach((k) => { delete pendingReports[k]; });
    renderReports();
    renderLogs();
  };

  const discardPendingReports = () => {
    Object.keys(pendingReports).forEach((k) => { delete pendingReports[k]; });
    renderReports();
  };

  if (reportSaveBtn) reportSaveBtn.addEventListener("click", savePendingReports);
  if (reportDiscardBtn) reportDiscardBtn.addEventListener("click", discardPendingReports);

  if (reportSearchInput) reportSearchInput.addEventListener("input", renderReports);
  if (reportStatusSelect) reportStatusSelect.addEventListener("change", renderReports);
  if (reportTypeSelect) reportTypeSelect.addEventListener("change", renderReports);
  if (reportSortSelect) reportSortSelect.addEventListener("change", renderReports);

  const getValueSize = (value) => {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === "object") return Object.keys(value).length;
    if (value === null || typeof value === "undefined") return 0;
    return 1;
  };

  const buildAdminExportPayload = () => {
    const now = new Date();
    const nowIso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const nowEpoch = now.getTime();
    const data = {};
    CC_ADMIN_DATA_KEYS.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      try {
        data[key] = JSON.parse(raw);
      } catch (e) {
        data[key] = raw;
      }
    });
    const counts = {};
    Object.keys(data).forEach((key) => {
      counts[key] = getValueSize(data[key]);
    });
    const manifest = {
      exported_at_iso: nowIso,
      exported_at_epoch_ms: nowEpoch,
      app_name: "CanadaClassi",
      schema_version: 1,
      keys: CC_ADMIN_DATA_KEYS.slice(),
      counts,
      note: ""
    };
    return {
      __cc_manifest__: manifest,
      exported_at_iso: nowIso,
      app_version: "local-prototype",
      data
    };
  };

  const loadAdminBackup = () => {
    const raw = localStorage.getItem(CC_ADMIN_DATA_BACKUP_KEY);
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw);
      return payload && typeof payload === "object" ? payload : null;
    } catch (e) {
      return null;
    }
  };

  const updateAdminBackupUI = () => {
    if (!dataBackupLabel || !dataRestoreBtn) return;
    const backup = loadAdminBackup();
    const backupAt = formatDateForView(backup?.__cc_manifest__?.exported_at_iso || backup?.exported_at_iso || "", { withTime: true, withSeconds: true });
    if (!backup || !backupAt) {
      dataBackupLabel.textContent = "バックアップなし";
      dataRestoreBtn.disabled = true;
      return;
    }
    dataBackupLabel.textContent = `最終バックアップ: ${backupAt}`;
    dataRestoreBtn.disabled = false;
  };

  const storeAdminBackup = () => {
    const payload = buildAdminExportPayload();
    try {
      localStorage.setItem(CC_ADMIN_DATA_BACKUP_KEY, JSON.stringify(payload));
    } catch (e) { }
    updateAdminBackupUI();
    return payload;
  };

  const formatExportFilename = (dateObj) => {
    const pad = (num) => String(num).padStart(2, "0");
    const y = dateObj.getFullYear();
    const m = pad(dateObj.getMonth() + 1);
    const d = pad(dateObj.getDate());
    const hh = pad(dateObj.getHours());
    const mm = pad(dateObj.getMinutes());
    const ss = pad(dateObj.getSeconds());
    return `canadaclassi_admin_export_${y}${m}${d}_${hh}${mm}${ss}.json`;
  };

  const updateExportHint = () => {
    if (!dataExportHint) return;
    const now = new Date();
    dataExportHint.textContent = `ファイル名の目安: ${formatExportFilename(now)}`;
  };

  const updateImportPolicy = () => {
    if (!dataImportPolicy) return;
    const mode = String(dataModeSelect?.value || "overwrite");
    dataImportPolicy.textContent = mode === "merge"
      ? "マージは既存データを優先します。"
      : "上書きは既存データを置換します。";
  };

  const renderManifestInfo = (payload) => {
    if (!dataManifestInfo) return;
    const manifest = payload?.__cc_manifest__;
    if (!manifest) {
      dataManifestInfo.textContent = "manifest: なし（旧形式）";
      return;
    }
    const at = formatDateForView(manifest.exported_at_iso || "", { withTime: true, withSeconds: true });
    const keyCount = Array.isArray(manifest.keys) ? manifest.keys.length : 0;
    dataManifestInfo.textContent = `manifest: ${at} / keys: ${keyCount}`;
  };

  const readStoredJson = (key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  const buildSeedPayload = () => {
    const now = new Date();
    const nowIso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const nowEpoch = now.getTime();
    const data = {};
    const includeAdmins = !!seedAdminEl?.checked;
    const includeUsers = !!seedUsersEl?.checked;
    const includePosts = !!seedPostsEl?.checked;
    const includeBoard = !!seedBoardEl?.checked;
    const includeBoardReplies = !!seedBoardRepliesEl?.checked;
    const includeInquiry = !!seedInquiryEl?.checked;
    const includeReports = !!seedReportsEl?.checked;
    const includeModeration = !!seedModerationEl?.checked;
    const includeRules = !!seedRulesEl?.checked;

    if (includeAdmins || includeUsers) {
      const users = getMockUsersDB();
      const filtered = users.filter((user) => {
        const role = normalizeUserRole(user?.role);
        if (role === "admin") return includeAdmins;
        return includeUsers;
      });
      data["mock_users"] = filtered;
    }

    if (includePosts) {
      const posts = readStoredJson(CC_USER_POSTS_KEY);
      if (Array.isArray(posts)) data[CC_USER_POSTS_KEY] = posts;
    }

    if (includeBoard) {
      const rawBoard = readStoredJson(CC_BOARD_KEY) || readStoredJson(CC_BOARD_KEY_LEGACY);
      if (Array.isArray(rawBoard)) {
        const list = includeBoardReplies
          ? rawBoard
          : rawBoard.map((thread) => Object.assign({}, thread, { replies: [] }));
        data[CC_BOARD_KEY] = list;
      }
    }

    if (includeInquiry) {
      const threads = readStoredJson(CC_INQUIRY_THREADS_KEY);
      if (Array.isArray(threads)) data[CC_INQUIRY_THREADS_KEY] = threads;
    }

    if (includeReports) {
      const reports = readStoredJson(CC_REPORTS_KEY);
      if (Array.isArray(reports)) data[CC_REPORTS_KEY] = reports;
      const inquiryReports = readStoredJson(CC_INQUIRY_REPORTS_KEY);
      if (Array.isArray(inquiryReports)) data[CC_INQUIRY_REPORTS_KEY] = inquiryReports;
    }

    if (includeModeration) {
      const keys = [
        CC_POST_HIDDEN_KEY,
        CC_POST_DELETED_KEY,
        CC_BOARD_HIDDEN_KEY,
        CC_BOARD_REPLY_HIDDEN_KEY,
        CC_CONVERSATION_FLAGS_KEY,
        CC_ADMIN_AUDIT_KEY
      ];
      keys.forEach((key) => {
        const value = readStoredJson(key);
        if (value !== null) data[key] = value;
      });
    }

    if (includeRules) {
      const keys = [CC_ANNOUNCEMENTS_KEY, CC_NG_WORDS_KEY, CC_REPORT_REASONS_KEY];
      keys.forEach((key) => {
        const value = readStoredJson(key);
        if (value !== null) data[key] = value;
      });
    }

    const counts = {};
    Object.keys(data).forEach((key) => {
      counts[key] = getValueSize(data[key]);
    });
    const manifest = {
      exported_at_iso: nowIso,
      exported_at_epoch_ms: nowEpoch,
      app_name: "CanadaClassi",
      schema_version: 1,
      keys: Object.keys(data),
      counts,
      note: "seed"
    };
    return {
      __cc_manifest__: manifest,
      exported_at_iso: nowIso,
      app_version: "local-prototype",
      data
    };
  };

  const updateSeedKeys = () => {
    if (!seedKeysEl) return;
    const payload = buildSeedPayload();
    const keys = Object.keys(payload.data || {});
    const line = keys.length
      ? keys.map((key) => `${key}(${payload.__cc_manifest__?.counts?.[key] ?? 0})`).join(", ")
      : "—";
    seedKeysEl.textContent = `seed keys: ${line}`;
  };

  const renderPostSourceStatus = () => {
    if (!postSourceStatusEl) return;
    const posts = ccReadUserPostsRaw();
    const total = Array.isArray(posts) ? posts.length : 0;
    const mockCount = Array.isArray(posts)
      ? posts.filter((post) => ccIsMockPostKey(post?.key) || post?.isMock === true || post?.source === "mock").length
      : 0;
    const manualCount = Math.max(total - mockCount, 0);
    let minTs = null;
    let maxTs = null;
    if (Array.isArray(posts)) {
      posts.forEach((post) => {
        const t = Date.parse(post?.created_at);
        if (!Number.isFinite(t)) return;
        if (minTs === null || t < minTs) minTs = t;
        if (maxTs === null || t > maxTs) maxTs = t;
      });
    }
    const minLabel = minTs ? formatDateForView(new Date(minTs).toISOString(), { withTime: true, withSeconds: true }) : "—";
    const maxLabel = maxTs ? formatDateForView(new Date(maxTs).toISOString(), { withTime: true, withSeconds: true }) : "—";
    postSourceStatusEl.innerHTML = `
      <div class="admin-data-preview-row"><strong>CC_USER_POSTS_KEY</strong><span>件数: ${total}</span></div>
      <div class="admin-data-preview-row"><strong>mock件数</strong><span>${mockCount}</span></div>
      <div class="admin-data-preview-row"><strong>手動件数</strong><span>${manualCount}</span></div>
      <div class="admin-data-preview-row"><strong>最古</strong><span>${escapeHtml(minLabel)}</span></div>
      <div class="admin-data-preview-row"><strong>最新</strong><span>${escapeHtml(maxLabel)}</span></div>
    `;
  };

  const seedAllowedKeys = new Set(CC_SEED_KEYS_BASE);
  seedAllowedKeys.add("mock_users");

  const getSeedCounts = (data) => {
    const counts = {};
    Object.keys(data || {}).forEach((key) => {
      counts[key] = getValueSize(data[key]);
    });
    return counts;
  };

  const renderSeedPreview = (payload) => {
    if (seedPreviewEl) seedPreviewEl.innerHTML = "";
    if (!seedManifestEl) return;
    if (!payload || typeof payload !== "object") {
      seedManifestEl.textContent = "manifest: なし";
      return;
    }
    const manifest = payload.__cc_manifest__;
    if (!manifest) {
      seedManifestEl.textContent = "manifest: なし";
    } else {
      const at = formatDateForView(manifest.exported_at_iso || "", { withTime: true, withSeconds: true });
      seedManifestEl.textContent = `manifest: ${at} / keys: ${Array.isArray(manifest.keys) ? manifest.keys.length : 0}`;
    }
    const data = payload.data && typeof payload.data === "object" ? payload.data : {};
    const counts = getSeedCounts(data);
    if (seedPreviewEl) {
      const rows = Object.keys(counts).map((key) => {
        return `<div class="admin-data-preview-row"><strong>${escapeHtml(key)}</strong><span>件数: ${counts[key]}</span></div>`;
      }).join("");
      seedPreviewEl.innerHTML = rows || `<div class="admin-data-preview-note">対象データがありません。</div>`;
    }
  };

  let seedImportPayload = null;

  const applySeedImport = () => {
    if (!seedImportPayload || typeof seedImportPayload !== "object") {
      showGlobalToast("Seedデータが読み込まれていません。");
      return;
    }
    const data = seedImportPayload.data;
    if (!data || typeof data !== "object") {
      showGlobalToast("Seedデータが不正です。");
      return;
    }
    const beforeCounts = {};
    const afterCounts = {};
    const importedKeys = [];
    const seedNow = Date.now();
    Object.keys(data).forEach((key) => {
      if (!seedAllowedKeys.has(key)) return;
      const before = readStoredJson(key);
      beforeCounts[key] = getValueSize(before);
      try {
        const nextValue = (key === CC_USER_POSTS_KEY)
          ? ccMergeSeedPosts(before, data[key], seedNow)
          : data[key];
        localStorage.setItem(key, JSON.stringify(nextValue));
        importedKeys.push(key);
        afterCounts[key] = getValueSize(nextValue);
      } catch (e) { }
    });
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    ccAddAdminAudit({
      at: nowIso,
      admin_email: getUserEmail() || getAccountName() || "admin",
      action: "seed_import",
      target: "seed",
      before: { counts: beforeCounts },
      after: { counts: afterCounts, keys: importedKeys }
    });
    renderLogs();
    openGlobalConfirmModal({
      id: "cc-seed-import-reload",
      title: "Seed取り込み完了",
      message: "反映のため再読み込みをおすすめします。",
      confirmText: "再読み込み",
      cancelText: "閉じる",
      onConfirm: () => window.location.reload()
    });
  };

  const triggerAdminExport = () => {
    if (!assertAdmin()) return;
    const payload = buildAdminExportPayload();
    const filename = `cc_admin_backup_${payload.exported_at_iso.replace(/[:T]/g, "-").replace("Z", "")}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    ccAddAdminAudit({
      at: payload.exported_at_iso,
      admin_email: actor(),
      action: "data_export",
      target: "admin_data",
      after: {
        keys: Object.keys(payload.data || {}),
        counts: payload.__cc_manifest__?.counts || {}
      }
    });
    renderLogs();
  };

  const buildImportDiff = (payload, mode) => {
    const rows = [];
    const data = payload?.data || {};
    CC_ADMIN_DATA_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(data, key)) return;
      const incoming = data[key];
      const hasCurrent = localStorage.getItem(key) !== null;
      const currentValue = hasCurrent ? (() => {
        try {
          return JSON.parse(localStorage.getItem(key));
        } catch (e) {
          return localStorage.getItem(key);
        }
      })() : null;
      const incomingSize = getValueSize(incoming);
      const currentSize = hasCurrent ? getValueSize(currentValue) : 0;
      let add = 0;
      let update = 0;
      let del = 0;
      if (mode === "merge" && hasCurrent) {
        add = 0;
        update = 0;
        del = 0;
      } else if (mode === "merge" && !hasCurrent) {
        add = incomingSize;
      } else {
        add = Math.max(incomingSize - currentSize, 0);
        del = Math.max(currentSize - incomingSize, 0);
        update = Math.min(currentSize, incomingSize);
      }
      rows.push({ key, add, update, del, skipped: mode === "merge" && hasCurrent });
    });
    return rows;
  };

  const buildManifestSummaryHtml = (payload) => {
    const manifest = payload?.__cc_manifest__;
    if (!manifest) {
      return `<div class="admin-data-preview-note">manifest: なし（旧形式）</div>`;
    }
    const keyCount = Array.isArray(manifest.keys) ? manifest.keys.length : 0;
    const exportedAt = formatDateForView(manifest.exported_at_iso || "", { withTime: true, withSeconds: true });
    return `
      <div class="admin-data-preview-note">manifest: ${escapeHtml(exportedAt)} / keys: ${escapeHtml(String(keyCount))}</div>
    `;
  };

  const renderImportDiffHtml = (rows, mode, payload) => {
    if (!rows.length) {
      return `<p>対象データが見つかりませんでした。</p>`;
    }
    const note = mode === "merge"
      ? "マージ（既存優先）のため、既存キーは変更されません。"
      : "上書きのため、削除件数が表示されます。";
    const summary = rows.reduce((acc, row) => {
      acc.keys += 1;
      acc.add += row.add;
      acc.update += row.update;
      acc.del += row.del;
      return acc;
    }, { keys: 0, add: 0, update: 0, del: 0 });
    const hasDeletion = summary.del > 0;
    const summaryHtml = `
      <div class="admin-data-summary">
        <div class="admin-data-summary-row"><strong>対象キー数</strong><span>${summary.keys}</span></div>
        <div class="admin-data-summary-row"><strong>追加</strong><span>${summary.add}</span></div>
        <div class="admin-data-summary-row"><strong>更新</strong><span>${summary.update}</span></div>
        <div class="admin-data-summary-row"><strong>削除</strong><span>${summary.del}</span></div>
        ${hasDeletion ? `<div class="admin-data-warning-badge">削除が発生します</div>` : ""}
      </div>
    `;
    const rowsHtml = rows.map((row) => {
      const title = row.skipped ? `${row.key}（既存のためスキップ）` : row.key;
      return `
        <div class="admin-data-preview-row">
          <strong>${escapeHtml(title)}</strong>
          <span>追加: ${row.add}</span>
          <span>更新: ${row.update}</span>
          <span>削除: ${row.del}</span>
        </div>
      `;
    }).join("");
    return `
      ${summaryHtml}
      ${buildManifestSummaryHtml(payload)}
      <div class="admin-data-preview">${rowsHtml}</div>
      <div class="admin-data-preview-note">${escapeHtml(note)}</div>
      <div class="admin-data-preview-note">実行前に自動バックアップを作成します。</div>
    `;
  };

  const applyAdminImport = (payload, mode) => {
    if (!payload || typeof payload !== "object" || !payload.data || typeof payload.data !== "object") {
      showGlobalToast("インポートデータが不正です。");
      return false;
    }
    const data = payload.data;
    const importedKeys = [];
    CC_ADMIN_DATA_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(data, key)) return;
      if (mode === "merge" && localStorage.getItem(key) !== null) return;
      try {
        localStorage.setItem(key, JSON.stringify(data[key]));
        importedKeys.push(key);
      } catch (e) { }
    });
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    ccAddAdminAudit({
      at: nowIso,
      admin_email: actor(),
      action: "data_import",
      target: "admin_data",
      after: { mode, keys: importedKeys }
    });
    renderLogs();
    return true;
  };

  const applyAdminRestore = (payload) => {
    if (!payload || typeof payload !== "object" || !payload.data || typeof payload.data !== "object") {
      showGlobalToast("復元データが不正です。");
      return false;
    }
    const data = payload.data;
    const restoredKeys = [];
    CC_ADMIN_DATA_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(data, key)) return;
      try {
        localStorage.setItem(key, JSON.stringify(data[key]));
        restoredKeys.push(key);
      } catch (e) { }
    });
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    ccAddAdminAudit({
      at: nowIso,
      admin_email: actor(),
      action: "data_restore",
      target: "admin_data",
      after: {
        keys: restoredKeys,
        counts: payload.__cc_manifest__?.counts || {}
      }
    });
    renderLogs();
    return true;
  };

  const handleAdminImport = () => {
    if (!assertAdmin()) return;
    if (!dataFileInput) return;
    const file = dataFileInput.files && dataFileInput.files[0];
    if (!file) {
      showGlobalToast("JSONファイルを選択してください。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      let payload = null;
      try {
        payload = JSON.parse(reader.result || "{}");
      } catch (e) {
        showGlobalToast("JSONの読み込みに失敗しました。");
        return;
      }
      const mode = String(dataModeSelect?.value || "overwrite");
      const modeLabel = mode === "merge" ? "マージ（既存優先）" : "上書き";
      const diffRows = buildImportDiff(payload, mode);
      const previewHtml = renderImportDiffHtml(diffRows, mode, payload);
      ccOpenModal({
        title: "インポートプレビュー",
        bodyHtml: previewHtml,
        buttons: [
          {
            label: "インポートする",
            className: "btn btn-primary",
            onClick: () => {
              storeAdminBackup();
              const ok = applyAdminImport(payload, mode);
              if (!ok) return;
              openGlobalConfirmModal({
                id: "cc-admin-data-import-reload",
                title: "インポート完了",
                message: "反映のため再読み込みをおすすめします。",
                confirmText: "再読み込み",
                cancelText: "閉じる",
                onConfirm: () => window.location.reload()
              });
            }
          },
          {
            label: "キャンセル",
            className: "btn btn-secondary"
          }
        ]
      });
    };
    reader.readAsText(file);
  };

  if (dataSelectBtn && dataFileInput) {
    dataSelectBtn.addEventListener("click", () => dataFileInput.click());
  }
  if (dataFileInput) {
    dataFileInput.addEventListener("change", () => {
      const file = dataFileInput.files && dataFileInput.files[0];
      if (dataFileName) dataFileName.textContent = file ? file.name : "未選択";
      if (!file) {
        renderManifestInfo(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(reader.result || "{}");
          renderManifestInfo(payload);
        } catch (e) {
          renderManifestInfo(null);
        }
      };
      reader.readAsText(file);
    });
  }
  if (dataModeSelect) {
    dataModeSelect.addEventListener("change", updateImportPolicy);
  }
  if (dataExportBtn) {
    dataExportBtn.addEventListener("click", () => {
      runAdminDataAction(triggerAdminExport);
    });
  }
  if (dataRestoreBtn) {
    dataRestoreBtn.addEventListener("click", () => {
      runAdminDataAction(() => {
        const backup = loadAdminBackup();
        if (!backup) {
          showGlobalToast("復元できるバックアップがありません。");
          return;
        }
        const backupAt = formatDateForView(backup.__cc_manifest__?.exported_at_iso || backup.exported_at_iso || "", { withTime: true, withSeconds: true });
        const message = backupAt
          ? `最終バックアップ（${backupAt}）に戻します。続行しますか？`
          : "直前のバックアップに戻します。続行しますか？";
        openGlobalConfirmModal({
          id: "cc-admin-data-restore-modal",
          title: "復元の確認",
          message,
          confirmText: "復元する",
          cancelText: "キャンセル",
          onConfirm: () => {
            const ok = applyAdminRestore(backup);
            if (!ok) return;
            openGlobalConfirmModal({
              id: "cc-admin-data-restore-reload",
              title: "復元完了",
              message: "反映のため再読み込みをおすすめします。",
              confirmText: "再読み込み",
              cancelText: "閉じる",
              onConfirm: () => window.location.reload()
            });
          }
        });
      });
    });
  }
  if (dataImportBtn) {
    dataImportBtn.addEventListener("click", () => {
      runAdminDataAction(handleAdminImport);
    });
  }
  if (seedExportBtn) {
    seedExportBtn.addEventListener("click", () => {
      runAdminDataAction(() => {
        if (!assertAdmin()) return;
        const payload = buildSeedPayload();
        const ts = formatAuditExportTimestamp();
        const filename = `canadaclassi_seed_${ts}.json`;
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        ccAddAdminAudit({
          at: payload.exported_at_iso,
          admin_email: getUserEmail() || getAccountName() || "admin",
          action: "seed_export",
          target: "seed",
          after: { keys: Object.keys(payload.data || {}) }
        });
        renderLogs();
      });
    });
  }
  if (seedSelectBtn && seedFileInput) {
    seedSelectBtn.addEventListener("click", () => seedFileInput.click());
  }
  if (seedFileInput) {
    seedFileInput.addEventListener("change", () => {
      const file = seedFileInput.files && seedFileInput.files[0];
      if (seedFileName) seedFileName.textContent = file ? file.name : "未選択";
      if (!file) {
        seedImportPayload = null;
        renderSeedPreview(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          seedImportPayload = JSON.parse(reader.result || "{}");
        } catch (e) {
          seedImportPayload = null;
        }
        renderSeedPreview(seedImportPayload);
      };
      reader.readAsText(file);
    });
  }
  if (seedImportBtn) {
    seedImportBtn.addEventListener("click", () => {
      runAdminDataAction(() => {
        if (!seedImportPayload) {
          showGlobalToast("Seed JSON を選択してください。");
          return;
        }
        openGlobalConfirmModal({
          id: "cc-seed-import-confirm",
          title: "Seed取り込み",
          message: "上書きでSeedを取り込みます。続行しますか？",
          confirmText: "取り込む",
          cancelText: "キャンセル",
          onConfirm: () => {
            applySeedImport();
            renderPostSourceStatus();
          }
        });
      });
    });
  }
  if (mockRegenerateBtn) {
    mockRegenerateBtn.addEventListener("click", () => {
      runAdminDataAction(() => {
        openGlobalConfirmModal({
          id: "cc-mock-regenerate-confirm",
          title: "モック投稿を復元",
          message: "不足しているモック投稿だけを追加します。手動投稿は保持されます。",
          confirmText: "復元",
          cancelText: "キャンセル",
          onConfirm: () => {
            ccRestoreMockPosts();
            renderPostSourceStatus();
            showGlobalToast("モック投稿を復元しました。");
          }
        });
      });
    });
  }
  if (postsResetBtn) {
    postsResetBtn.addEventListener("click", () => {
      runAdminDataAction(() => {
        openGlobalConfirmModal({
          id: "cc-posts-reset-confirm",
          title: "全投稿リセット",
          message: "手動投稿も含めて全投稿を削除し、モック投稿のみ再投入します。よろしいですか？",
          confirmText: "全投稿を削除する",
          cancelText: "キャンセル",
          onConfirm: () => {
            ccResetAllPosts();
            renderPostSourceStatus();
            showGlobalToast("全投稿をリセットしました。");
          }
        });
      });
    });
  }
  [
    seedAdminEl,
    seedUsersEl,
    seedPostsEl,
    seedBoardEl,
    seedBoardRepliesEl,
    seedInquiryEl,
    seedReportsEl,
    seedModerationEl,
    seedRulesEl
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", updateSeedKeys);
  });
  updateExportHint();
  updateImportPolicy();
  renderManifestInfo(null);
  updateAdminBackupUI();
  updateSeedKeys();
  renderPostSourceStatus();

  const renderUsers = () => {
    if (!userListEl) return;
    const query = String(userSearchInput?.value || "").trim().toLowerCase();
    const filter = String(userFilterSelect?.value || "all");
    const users = getMockUsersDB();
    const filtered = users.filter((user) => {
      const status = normalizeUserStatus(user?.status);
      if (filter !== "all" && status !== filter) return false;
      if (!query) return true;
      const hay = [user?.email, user?.account_name].map((v) => String(v || "").toLowerCase()).join(" ");
      return hay.includes(query);
    });

    if (userCountEl) userCountEl.textContent = String(filtered.length);
    if (!filtered.length) {
      userListEl.innerHTML = `<div class="admin-empty">ユーザーが見つかりません。</div>`;
      updateAdminTabBadges();
      return;
    }

    userListEl.innerHTML = filtered.map((user) => {
      const email = String(user?.email || "");
      const pending = pendingUsers[email] || {};
      const hasPending = Object.prototype.hasOwnProperty.call(pendingUsers, email);
      const status = typeof pending.status === "string" ? pending.status : normalizeUserStatus(user?.status);
      const statusLabel = status === "banned" ? "停止" : "有効";
      const statusClass = status === "banned" ? "admin-status-deleted" : "admin-status-public";
      const actionLabel = status === "banned" ? "解除" : "BAN";
      const actionKey = status === "banned" ? "unban" : "ban";
      return `
        <article class="admin-user-card" data-user-email="${escapeHtml(email)}">
          <div class="admin-user-main">
            <div class="admin-user-title">${escapeHtml(user?.account_name || "—")}</div>
            <div class="admin-user-meta">
              <span>メール：${escapeHtml(email)}</span>
              <span>状態：${escapeHtml(statusLabel)}</span>
            </div>
          </div>
          <div class="admin-user-actions">
            <span class="admin-status ${statusClass}">${escapeHtml(statusLabel)}</span>
            ${hasPending ? `<span class="admin-pending">未保存</span>` : ""}
            <button class="btn btn-secondary admin-btn" type="button" data-user-action="${actionKey}">${escapeHtml(actionLabel)}</button>
          </div>
        </article>
      `;
    }).join("");
    updateAdminTabBadges();
  };

  if (userListEl) {
    userListEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-user-action]");
      if (!btn) return;
      const card = btn.closest(".admin-user-card");
      const email = card ? card.getAttribute("data-user-email") || "" : "";
      if (!email) return;
      const action = btn.getAttribute("data-user-action");
      const message = action === "ban"
        ? `${email} を停止しますか？`
        : `${email} の停止を解除しますか？`;
      openGlobalConfirmModal({
        id: "cc-admin-user-action-modal",
        title: "操作の確認",
        message,
        confirmText: action === "ban" ? "停止する" : "解除する",
        cancelText: "キャンセル",
        onConfirm: () => {
          pendingUsers[email] = { status: action === "ban" ? "banned" : "active" };
          renderUsers();
        }
      });
    });
  }

  const savePendingUsers = () => {
    if (!assertAdmin()) return;
    const keys = Object.keys(pendingUsers);
    if (!keys.length) return;
    const list = getMockUsersDB();
    const adminEmail = actor();
    const now = new Date().toISOString();
    keys.forEach((email) => {
      const idx = list.findIndex((u) => normalizeEmail(u?.email) === normalizeEmail(email));
      if (idx < 0) return;
      const beforeStatus = normalizeUserStatus(list[idx]?.status);
      const nextStatus = normalizeUserStatus(pendingUsers[email]?.status);
      list[idx].status = nextStatus;
      if (nextStatus === "banned") {
        list[idx].banned_at = now;
        list[idx].banned_by = adminEmail;
      } else {
        list[idx].banned_at = "";
        list[idx].banned_by = "";
      }
      if (beforeStatus !== nextStatus) {
        ccAddAdminAudit({
          at: now,
          admin_email: adminEmail,
          action: nextStatus === "banned" ? "user_ban" : "user_unban",
          target: email,
          before: { status: beforeStatus },
          after: { status: nextStatus }
        });
      }
    });
    saveMockUsersDB(list);
    keys.forEach((k) => { delete pendingUsers[k]; });
    renderUsers();
    renderLogs();
  };

  const discardPendingUsers = () => {
    Object.keys(pendingUsers).forEach((k) => { delete pendingUsers[k]; });
    renderUsers();
  };

  if (userSaveBtn) userSaveBtn.addEventListener("click", savePendingUsers);
  if (userDiscardBtn) userDiscardBtn.addEventListener("click", discardPendingUsers);

  if (userSearchInput) userSearchInput.addEventListener("input", renderUsers);
  if (userFilterSelect) userFilterSelect.addEventListener("change", renderUsers);

  const buildConversationReportMap = () => {
    const map = {};
    const inquiryReports = ccLoadInquiryReports();
    inquiryReports.forEach((r) => {
      const id = ccGetInquiryThreadId(r.threadId || r.thread_id || "");
      if (!id) return;
      map[id] = (map[id] || 0) + 1;
    });
    const adminReports = ccLoadReports();
    adminReports.forEach((r) => {
      const type = String(r?.target_type || "");
      if (type !== "inquiry" && type !== "thread") return;
      const id = ccGetInquiryThreadId(r.target_key || r.thread_id || r.threadId || "");
      if (!id) return;
      map[id] = (map[id] || 0) + 1;
    });
    return map;
  };

  const renderConversations = () => {
    if (!convoListEl) return;
    const query = String(convoSearchInput?.value || "").trim().toLowerCase();
    const filter = String(convoFilterSelect?.value || "all");
    const threads = ccLoadInquiryThreads();
    const reportMap = buildConversationReportMap();
    const sorted = threads.slice().sort((a, b) => {
      const ta = Date.parse(a.updatedAt || a.lastBuyerMessageAt || a.lastSellerMessageAt || a.createdAt || "") || 0;
      const tb = Date.parse(b.updatedAt || b.lastBuyerMessageAt || b.lastSellerMessageAt || b.createdAt || "") || 0;
      return tb - ta;
    });

    const filtered = sorted.filter((thread) => {
      const threadId = ccGetInquiryThreadId(thread?.threadId || "");
      const postKey = String(thread?.postId || "");
      const postTitle = String(thread?.postTitle || "");
      const buyer = String(thread?.buyerName || thread?.buyerEmail || "");
      const seller = String(thread?.sellerName || "");
      const currentFrozen = ccIsConversationFrozen(threadId);
      const pending = pendingConversations[threadId] || {};
      const effectiveFrozen = typeof pending.frozen === "boolean" ? pending.frozen : currentFrozen;
      const statusKey = effectiveFrozen ? "frozen 凍結" : "open 公開";
      const hay = [threadId, postKey, postTitle, buyer, seller, statusKey].join(" ").toLowerCase();
      if (query && !hay.includes(query)) return false;
      const reportCount = reportMap[threadId] || 0;
      if (filter === "frozen" && !effectiveFrozen) return false;
      if (filter === "reported" && reportCount === 0) return false;
      return true;
    });

    if (convoCountEl) convoCountEl.textContent = String(filtered.length);
    if (!filtered.length) {
      convoListEl.innerHTML = `<div class="admin-empty">会話はありません。</div>`;
      updateAdminTabBadges();
      return;
    }

    convoListEl.innerHTML = filtered.map((thread) => {
      const threadId = ccGetInquiryThreadId(thread?.threadId || "");
      const pending = pendingConversations[threadId] || {};
      const hasPending = Object.prototype.hasOwnProperty.call(pendingConversations, threadId);
      const currentFrozen = ccIsConversationFrozen(threadId);
      const currentFlag = ccGetConversationFlag(threadId) || {};
      const effectiveFrozen = typeof pending.frozen === "boolean" ? pending.frozen : currentFrozen;
      const note = Object.prototype.hasOwnProperty.call(pending, "note")
        ? pending.note
        : (currentFlag.note || "");
      const noteEmpty = !String(note || "").trim();
      const noteHint = effectiveFrozen && noteEmpty
        ? `<span class="admin-report-hint is-danger">凍結理由を入力</span>`
        : "";
      const statusLabel = effectiveFrozen ? "凍結中" : "公開中";
      const statusClass = effectiveFrozen ? "admin-status-hidden" : "admin-status-public";
      const actionLabel = effectiveFrozen ? "解除" : "凍結";
      const actionKey = effectiveFrozen ? "unfreeze" : "freeze";
      const postKey = String(thread?.postId || "");
      const postTitle = ccGetPostDisplayTitle({ title: thread?.postTitle, key: thread?.postId, isMock: thread?.isMock, source: thread?.source }, "—");
      const postLink = postKey
        ? `<a class="admin-link" href="detail.html?post=${encodeURIComponent(postKey)}" target="_blank" rel="noreferrer">${escapeHtml(postTitle)}</a>`
        : escapeHtml(postTitle);
      const buyer = String(thread?.buyerName || thread?.buyerEmail || "—");
      const seller = String(thread?.sellerName || "—");
      const lastAt = thread?.updatedAt || thread?.lastBuyerMessageAt || thread?.lastSellerMessageAt || thread?.createdAt || "";
      const lastLabel = lastAt ? formatDateTimeSeconds(lastAt) : "—";
      const reportCount = reportMap[threadId] || 0;
      const threadLink = threadId
        ? `<a class="admin-link" href="inquiry-thread.html?thread=${encodeURIComponent(threadId)}" target="_blank" rel="noreferrer">${escapeHtml(threadId)}</a>`
        : "—";
      const openHref = threadId ? `inquiry-thread.html?thread=${encodeURIComponent(threadId)}` : "";
      return `
        <article class="admin-convo-card" data-thread-id="${escapeHtml(threadId)}">
          <div class="admin-convo-main">
            <div class="admin-convo-title">スレッド：${threadLink}</div>
            <div class="admin-convo-meta">
              <span>投稿：${postLink}</span>
              <span>参加者：${escapeHtml(buyer)} / ${escapeHtml(seller)}</span>
              <span>最終更新：${escapeHtml(lastLabel)}</span>
              <span>通報：${escapeHtml(String(reportCount))}件</span>
            </div>
          </div>
          <div class="admin-convo-actions">
            <span class="admin-status ${statusClass}">${escapeHtml(statusLabel)}</span>
            ${hasPending ? `<span class="admin-pending">未保存</span>` : ""}
            <button class="btn btn-secondary admin-btn" type="button" data-convo-action="${actionKey}">${escapeHtml(actionLabel)}</button>
            <textarea class="admin-inline-input admin-inline-textarea" data-convo-field="note" placeholder="凍結理由（必須）">${escapeHtml(String(note || ""))}</textarea>
            ${noteHint}
            ${openHref ? `<a class="admin-link admin-open-link" href="${openHref}">開く</a>` : `<span class="admin-link is-disabled" aria-disabled="true">開く</span>`}
          </div>
        </article>
      `;
    }).join("");
    updateAdminTabBadges();
  };

  if (convoListEl) {
    const handleConvoInput = (e) => {
      const field = e.target.closest("[data-convo-field]");
      if (!field) return;
      const card = field.closest(".admin-convo-card");
      const threadId = card ? card.getAttribute("data-thread-id") || "" : "";
      if (!threadId) return;
      const pending = pendingConversations[threadId] || {};
      const key = field.getAttribute("data-convo-field");
      if (key === "note") {
        pending.note = field.value;
      }
      pendingConversations[threadId] = pending;
      const actions = card ? card.querySelector(".admin-convo-actions") : null;
      if (actions && !actions.querySelector(".admin-pending")) {
        const badge = document.createElement("span");
        badge.className = "admin-pending";
        badge.textContent = "未保存";
        actions.prepend(badge);
      }
    };
    convoListEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-convo-action]");
      if (!btn) return;
      const card = btn.closest(".admin-convo-card");
      const threadId = card ? card.getAttribute("data-thread-id") || "" : "";
      if (!threadId) return;
      const action = btn.getAttribute("data-convo-action");
      const message = action === "freeze"
        ? "この会話を凍結しますか？"
        : "この会話の凍結を解除しますか？";
      openGlobalConfirmModal({
        id: "cc-admin-convo-action-modal",
        title: "操作の確認",
        message,
        confirmText: action === "freeze" ? "凍結する" : "解除する",
        cancelText: "キャンセル",
        onConfirm: () => {
          const next = pendingConversations[threadId] || {};
          next.frozen = action === "freeze";
          pendingConversations[threadId] = next;
          renderConversations();
        }
      });
    });
    convoListEl.addEventListener("input", handleConvoInput);
    convoListEl.addEventListener("change", handleConvoInput);
    convoListEl.addEventListener("click", (e) => {
      const link = e.target.closest("a.admin-open-link");
      if (!link) return;
      e.preventDefault();
      navigateAdminWithGuard(link.getAttribute("href"));
    });
  }

  const savePendingConversations = () => {
    if (!assertAdmin()) return;
    const keys = Object.keys(pendingConversations);
    if (!keys.length) return;
    const adminEmail = actor();
    const now = new Date().toISOString();
    const invalid = keys.find((threadId) => {
      const pending = pendingConversations[threadId] || {};
      const currentFlag = ccGetConversationFlag(threadId) || {};
      const currentFrozen = ccIsConversationFrozen(threadId);
      const nextFrozen = typeof pending.frozen === "boolean" ? pending.frozen : currentFrozen;
      const note = Object.prototype.hasOwnProperty.call(pending, "note")
        ? pending.note
        : (currentFlag.note || "");
      return nextFrozen && !String(note || "").trim();
    });
    if (invalid) {
      openGlobalConfirmModal({
        id: "cc-admin-convo-note-required",
        title: "凍結理由が必要です",
        message: "凍結する場合は理由を入力してください。",
        confirmText: "OK",
        cancelText: "OK"
      });
      return;
    }
    keys.forEach((threadId) => {
      const pending = pendingConversations[threadId] || {};
      const currentFlag = ccGetConversationFlag(threadId) || {};
      const currentFrozen = ccIsConversationFrozen(threadId);
      const nextFrozen = typeof pending.frozen === "boolean" ? pending.frozen : currentFrozen;
      const nextNote = Object.prototype.hasOwnProperty.call(pending, "note")
        ? pending.note
        : (currentFlag.note || "");
      if (nextFrozen !== currentFrozen) {
        ccSetConversationFrozen(threadId, nextFrozen, { frozen_by: adminEmail, frozen_at: now, note: nextNote });
        ccAddAdminAudit({
          at: now,
          admin_email: adminEmail,
          action: nextFrozen ? "conversation_freeze" : "conversation_unfreeze",
          target: threadId,
          before: { frozen: currentFrozen, note: currentFlag.note || "" },
          after: { frozen: nextFrozen, note: nextNote || "" }
        });
      } else if (nextFrozen && String(nextNote || "") !== String(currentFlag.note || "")) {
        ccSetConversationFrozen(threadId, true, { frozen_by: adminEmail, frozen_at: now, note: nextNote });
        ccAddAdminAudit({
          at: now,
          admin_email: adminEmail,
          action: "conversation_freeze",
          target: threadId,
          before: { frozen: currentFrozen, note: currentFlag.note || "" },
          after: { frozen: true, note: nextNote || "" }
        });
      }
    });
    keys.forEach((k) => { delete pendingConversations[k]; });
    renderConversations();
    renderLogs();
  };

  const discardPendingConversations = () => {
    Object.keys(pendingConversations).forEach((k) => { delete pendingConversations[k]; });
    renderConversations();
  };

  if (convoSaveBtn) convoSaveBtn.addEventListener("click", savePendingConversations);
  if (convoDiscardBtn) convoDiscardBtn.addEventListener("click", discardPendingConversations);
  if (convoSearchInput) convoSearchInput.addEventListener("input", renderConversations);
  if (convoClearBtn && convoSearchInput) {
    convoClearBtn.addEventListener("click", () => {
      convoSearchInput.value = "";
      renderConversations();
    });
  }
  if (convoFilterSelect) convoFilterSelect.addEventListener("change", renderConversations);

  const cloneSettings = (obj) => {
    try {
      return JSON.parse(JSON.stringify(obj || {}));
    } catch (e) {
      return {};
    }
  };

  const cloneList = (list) => {
    try {
      return JSON.parse(JSON.stringify(list || []));
    } catch (e) {
      return [];
    }
  };

  const initSettingsState = () => {
    settingsBase = {
      ng: ccLoadNgWords(),
      reasons: ccLoadReportReasons()
    };
    settingsDraft = cloneSettings(settingsBase);
    settingsDirty = false;
  };

  const updateSettingsPending = () => {
    if (settingsPendingEl) {
      settingsPendingEl.textContent = settingsDirty ? "あり" : "なし";
    }
  };

  const markSettingsDirty = () => {
    settingsDirty = true;
    updateSettingsPending();
  };

  const renderSettings = () => {
    if (!settingsDraft) return;
    const ng = settingsDraft.ng || {};
    const reasons = settingsDraft.reasons || {};


    if (ngEnabledEl) ngEnabledEl.checked = !!ng.enabled;
    document.querySelectorAll("[data-ng-target]").forEach((el) => {
      const key = el.getAttribute("data-ng-target");
      el.checked = !!(ng.targets && ng.targets[key]);
    });
    if (ngListEl) {
      const words = Array.isArray(ng.words) ? ng.words : [];
      ngListEl.innerHTML = words.length
        ? words.map((w) => `
          <span class="admin-tag" data-ng-word="${escapeHtml(w)}">
            ${escapeHtml(w)}
            <button type="button" aria-label="削除" data-ng-remove="1">×</button>
          </span>
        `).join("")
        : '<div class="admin-empty">未登録です。</div>';
    }

    if (reasonEnabledEl) reasonEnabledEl.checked = !!reasons.enabled;
    if (reasonListEl) {
      const list = Array.isArray(reasons.reasons) ? reasons.reasons : [];
      reasonListEl.innerHTML = list.length
        ? list.map((r) => `
          <span class="admin-tag" data-reason-id="${escapeHtml(String(r.id || ""))}">
            ${escapeHtml(String(r.label || ""))}
            <button type="button" aria-label="削除" data-reason-remove="1">×</button>
          </span>
        `).join("")
        : '<div class="admin-empty">未登録です。</div>';
    }

    updateSettingsPending();
  };

  const ensureSettingsDraft = () => {
    if (!settingsDraft) initSettingsState();
  };

  if (ngEnabledEl) {
    ngEnabledEl.addEventListener("change", () => {
      ensureSettingsDraft();
      settingsDraft.ng.enabled = !!ngEnabledEl.checked;
      markSettingsDirty();
    });
  }

  document.querySelectorAll("[data-ng-target]").forEach((el) => {
    el.addEventListener("change", () => {
      ensureSettingsDraft();
      const key = el.getAttribute("data-ng-target");
      settingsDraft.ng.targets = Object.assign({}, settingsDraft.ng.targets, { [key]: !!el.checked });
      markSettingsDirty();
    });
  });

  if (ngAddBtn && ngInputEl) {
    ngAddBtn.addEventListener("click", () => {
      ensureSettingsDraft();
      const raw = String(ngInputEl.value || "").trim();
      if (!raw) return;
      const words = Array.isArray(settingsDraft.ng.words) ? settingsDraft.ng.words : [];
      const exists = words.some((w) => String(w).toLowerCase() === raw.toLowerCase());
      if (!exists) words.push(raw);
      settingsDraft.ng.words = words;
      ngInputEl.value = "";
      markSettingsDirty();
      renderSettings();
    });
  }

  if (ngListEl) {
    ngListEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ng-remove]");
      if (!btn) return;
      const tag = btn.closest("[data-ng-word]");
      const word = tag ? tag.getAttribute("data-ng-word") : "";
      if (!word) return;
      ensureSettingsDraft();
      settingsDraft.ng.words = (settingsDraft.ng.words || []).filter((w) => String(w) !== String(word));
      markSettingsDirty();
      renderSettings();
    });
  }

  if (reasonEnabledEl) {
    reasonEnabledEl.addEventListener("change", () => {
      ensureSettingsDraft();
      settingsDraft.reasons.enabled = !!reasonEnabledEl.checked;
      markSettingsDirty();
    });
  }

  if (reasonAddBtn && reasonInputEl) {
    reasonAddBtn.addEventListener("click", () => {
      ensureSettingsDraft();
      const raw = String(reasonInputEl.value || "").trim();
      if (!raw) return;
      const list = Array.isArray(settingsDraft.reasons.reasons) ? settingsDraft.reasons.reasons : [];
      const exists = list.some((r) => String(r.label || "").toLowerCase() === raw.toLowerCase());
      if (!exists) {
        list.push({ id: `reason_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, label: raw });
      }
      settingsDraft.reasons.reasons = list;
      reasonInputEl.value = "";
      markSettingsDirty();
      renderSettings();
    });
  }

  if (reasonListEl) {
    reasonListEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-reason-remove]");
      if (!btn) return;
      const tag = btn.closest("[data-reason-id]");
      const id = tag ? tag.getAttribute("data-reason-id") : "";
      if (!id) return;
      ensureSettingsDraft();
      settingsDraft.reasons.reasons = (settingsDraft.reasons.reasons || []).filter((r) => String(r.id || "") !== String(id));
      markSettingsDirty();
      renderSettings();
    });
  }

  const initAnnouncementsState = () => {
    announcementsBase = ccLoadAnnouncements();
    announcementsDraft = cloneList(announcementsBase);
    announcementsDirty = false;
    updateAnnouncementsPending();
  };

  const updateAnnouncementsPending = () => {
    if (announcePendingEl) {
      announcePendingEl.textContent = announcementsDirty ? "あり" : "なし";
    }
  };

  const markAnnouncementsDirty = () => {
    announcementsDirty = true;
    updateAnnouncementsPending();
  };

  const ensureAnnouncementsDraft = () => {
    if (!announcementsDraft) initAnnouncementsState();
  };

  const renderAnnouncementsAdmin = () => {
    if (!announceListEl) return;
    ensureAnnouncementsDraft();
    const list = Array.isArray(announcementsDraft) ? announcementsDraft : [];
    const baseList = Array.isArray(announcementsBase) ? announcementsBase : [];
    const baseMap = new Map(baseList.map((item) => [String(item?.id || ""), item]));
    const sorted = list.slice().sort((a, b) => {
      const ta = Date.parse(a?.created_at || "") || 0;
      const tb = Date.parse(b?.created_at || "") || 0;
      return tb - ta;
    });

    if (!sorted.length) {
      announceListEl.innerHTML = '<div class="admin-empty">お知らせはありません。</div>';
      return;
    }

    announceListEl.innerHTML = sorted.map((item) => {
      const id = String(item?.id || "");
      const title = String(item?.title || "");
      const body = String(item?.body || "");
      const createdAt = item?.created_at ? formatDateTimeSeconds(item.created_at) : "—";
      const visible = !!item?.visible;
      const statusLabel = visible ? "表示中" : "非表示";
      const statusClass = visible ? "admin-status-public" : "admin-status-hidden";
      const toggleLabel = visible ? "非表示にする" : "表示する";
      const baseItem = baseMap.get(id);
      const hasPending = JSON.stringify(baseItem || {}) !== JSON.stringify(item || {});
      return `
        <div class="admin-announce-card" data-announce-id="${escapeHtml(id)}">
          <div class="admin-announce-meta">作成日：${escapeHtml(createdAt)}</div>
          <input class="admin-inline-input" type="text" data-announce-field="title" value="${escapeHtml(title)}" placeholder="タイトル" />
          <textarea class="admin-inline-input admin-inline-textarea" data-announce-field="body" placeholder="本文">${escapeHtml(body)}</textarea>
          <div class="admin-announce-actions">
            <span class="admin-status ${statusClass}">${escapeHtml(statusLabel)}</span>
            ${hasPending ? `<span class="admin-pending">未保存</span>` : ""}
            <button class="btn btn-secondary admin-btn" type="button" data-announce-action="toggle">${escapeHtml(toggleLabel)}</button>
            <button class="btn btn-secondary admin-btn" type="button" data-announce-action="delete">削除</button>
          </div>
        </div>
      `;
    }).join("");
  };

  if (announceAddBtn && announceTitleEl && announceBodyEl) {
    announceAddBtn.addEventListener("click", () => {
      ensureAnnouncementsDraft();
      const title = String(announceTitleEl.value || "").trim();
      const body = String(announceBodyEl.value || "").trim();
      if (!title && !body) return;
      const visible = announceVisibleEl ? !!announceVisibleEl.checked : true;
      const list = Array.isArray(announcementsDraft) ? announcementsDraft : [];
      list.unshift({
        id: `announce_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: title || "お知らせ",
        body,
        visible,
        created_at: new Date().toISOString()
      });
      announcementsDraft = list;
      announceTitleEl.value = "";
      announceBodyEl.value = "";
      if (announceVisibleEl) announceVisibleEl.checked = true;
      markAnnouncementsDirty();
      renderAnnouncementsAdmin();
    });
  }

  if (announceListEl) {
    const handleAnnounceInput = (e) => {
      const field = e.target.closest("[data-announce-field]");
      if (!field) return;
      const card = field.closest("[data-announce-id]");
      const id = card ? card.getAttribute("data-announce-id") || "" : "";
      if (!id) return;
      ensureAnnouncementsDraft();
      const list = Array.isArray(announcementsDraft) ? announcementsDraft : [];
      const idx = list.findIndex((item) => String(item?.id || "") === id);
      if (idx < 0) return;
      const key = field.getAttribute("data-announce-field");
      if (key === "title" || key === "body") {
        list[idx][key] = field.value;
      }
      announcementsDraft = list;
      markAnnouncementsDirty();
      const actions = card ? card.querySelector(".admin-announce-actions") : null;
      if (actions && !actions.querySelector(".admin-pending")) {
        const badge = document.createElement("span");
        badge.className = "admin-pending";
        badge.textContent = "未保存";
        actions.insertBefore(badge, actions.querySelector(".admin-btn"));
      }
    };
    const handleAnnounceClick = (e) => {
      const btn = e.target.closest("[data-announce-action]");
      if (!btn) return;
      const card = btn.closest("[data-announce-id]");
      const id = card ? card.getAttribute("data-announce-id") || "" : "";
      if (!id) return;
      const action = btn.getAttribute("data-announce-action");
      ensureAnnouncementsDraft();
      const list = Array.isArray(announcementsDraft) ? announcementsDraft : [];
      const idx = list.findIndex((item) => String(item?.id || "") === id);
      if (idx < 0) return;
      if (action === "toggle") {
        list[idx].visible = !list[idx].visible;
        announcementsDraft = list;
        markAnnouncementsDirty();
        renderAnnouncementsAdmin();
        return;
      }
      if (action === "delete") {
        openGlobalConfirmModal({
          id: "cc-admin-announce-delete-modal",
          title: "削除の確認",
          message: "このお知らせを削除しますか？",
          confirmText: "削除する",
          cancelText: "キャンセル",
          onConfirm: () => {
            announcementsDraft = list.filter((item) => String(item?.id || "") !== id);
            markAnnouncementsDirty();
            renderAnnouncementsAdmin();
          }
        });
      }
    };
    announceListEl.addEventListener("input", handleAnnounceInput);
    announceListEl.addEventListener("change", handleAnnounceInput);
    announceListEl.addEventListener("click", handleAnnounceClick);
  }

  const savePendingAnnouncements = () => {
    ensureAnnouncementsDraft();
    if (!announcementsDirty) return;
    const adminEmail = actor();
    const now = new Date().toISOString();
    const baseList = Array.isArray(announcementsBase) ? announcementsBase : [];
    const nextList = Array.isArray(announcementsDraft) ? announcementsDraft : [];
    if (JSON.stringify(baseList) !== JSON.stringify(nextList)) {
      ccSaveAnnouncements(nextList);
      ccAddAdminAudit({
        at: now,
        admin_email: adminEmail,
        action: "announcements_update",
        target: "announcements",
        before: baseList,
        after: nextList
      });
    }
    announcementsBase = cloneList(nextList);
    announcementsDirty = false;
    updateAnnouncementsPending();
    renderAnnouncementsAdmin();
    renderLogs();
  };

  const discardPendingAnnouncements = () => {
    initAnnouncementsState();
    renderAnnouncementsAdmin();
  };

  if (announceSaveBtn) announceSaveBtn.addEventListener("click", savePendingAnnouncements);
  if (announceDiscardBtn) announceDiscardBtn.addEventListener("click", discardPendingAnnouncements);

  const initStaticPagesState = () => {
    staticPagesDraft = ccLoadStaticPages();
    staticPagesHistory = ccLoadStaticPagesHistory();
    try {
      const raw = sessionStorage.getItem("cc_static_page_drafts");
      staticPagesDrafts = raw ? JSON.parse(raw) : {};
    } catch (e) {
      staticPagesDrafts = {};
    }
    staticPagesDirty = false;
    staticBaselineByType = {};
    window.__ccStaticDirty = false;
    if (staticStatusEl) staticStatusEl.textContent = "—";
  };

  const updateStaticPagesStatus = (message) => {
    if (!staticStatusEl) return;
    if (message) {
      staticStatusEl.textContent = message;
      return;
    }
    staticStatusEl.textContent = staticPagesDirty ? "未保存" : "—";
  };

  const normalizeStaticHtml = (value) => String(value || "").replace(/\r\n/g, "\n").trim();

  const getEditorHtml = () => normalizeStaticHtml(staticBodyEl?.value || "");

  const setEditorHtml = (html) => {
    if (!staticBodyEl) return;
    isProgrammaticSet = true;
    staticBodyEl.value = html || "";
    isProgrammaticSet = false;
    updateStaticDirtyState();
  };

  const setBaseline = (type, html) => {
    if (!type) return;
    staticBaselineByType[type] = normalizeStaticHtml(html);
    updateStaticDirtyState();
  };

  const isStaticDirty = () => {
    const type = getStaticPageType();
    return getEditorHtml() !== (staticBaselineByType[type] ?? "");
  };

  const updateStaticDirtyState = (message) => {
    staticPagesDirty = isStaticDirty();
    window.__ccStaticDirty = staticPagesDirty;
    updateStaticPagesStatus(message);
  };

  const ensureStaticPagesDraft = () => {
    if (!staticPagesDraft) initStaticPagesState();
  };

  const getStaticPageType = () => String(staticTypeSelect?.value || "post-guide");

  const staticPageLabels = {
    "post-guide": "投稿・取引ガイド",
    scam: "詐欺などのご注意",
    school: "学校情報",
    links: "外部リンク",
    guide: "ご利用ガイド",
    terms: "利用規約",
    privacy: "プライバシーポリシー"
  };

  const updateStaticPreviewLink = () => {
    if (!staticPreviewLink) return;
    const type = getStaticPageType();
    staticPreviewLink.setAttribute("href", `static.html?type=${encodeURIComponent(type)}`);
  };

  const getStaticEntryContent = (entry) => {
    if (!entry || typeof entry !== "object") return "";
    return String(entry.contentHtml || entry.html || entry.body || "").trim();
  };

  const getStaticCurrentHtml = (type) => {
    const entry = staticPagesDraft?.[type] || null;
    const override = getStaticEntryContent(entry);
    if (override) return override;
    return ccGetStaticDefaultBodyHtml(type);
  };

  const updateStaticHistorySelect = () => {
    if (!staticHistorySelect) return;
    const type = getStaticPageType();
    const list = Array.isArray(staticPagesHistory?.[type]) ? staticPagesHistory[type] : [];
    staticHistorySelect.innerHTML = list.length
      ? list.map((item, idx) => {
        const label = item?.savedAt ? formatDateTimeSeconds(item.savedAt) : `履歴${idx + 1}`;
        return `<option value="${idx}">${escapeHtml(label)}</option>`;
      }).join("")
      : '<option value="">履歴なし</option>';
    ccResetSelectDropdown(staticHistorySelect);
    const wrap = staticHistorySelect.closest(".cc-dropdown");
    if (wrap) ccInitSelectDropdowns(wrap);
  };

  const saveStaticDrafts = () => {
    try {
      sessionStorage.setItem("cc_static_page_drafts", JSON.stringify(staticPagesDrafts || {}));
    } catch (e) { }
  };

  const clearStaticPreviewDraft = (type) => {
    if (!type) return;
    try {
      const raw = localStorage.getItem(CC_STATIC_DRAFTS_KEY);
      const data = raw ? JSON.parse(raw) : {};
      if (data && Object.prototype.hasOwnProperty.call(data, type)) {
        delete data[type];
        localStorage.setItem(CC_STATIC_DRAFTS_KEY, JSON.stringify(data));
      }
    } catch (e) { }
  };

  const renderStaticPageEditor = () => {
    if (!staticTypeSelect || !staticBodyEl) return;
    ensureStaticPagesDraft();
    const type = getStaticPageType();
    const entry = staticPagesDraft[type] || {};
    const currentHtml = getStaticCurrentHtml(type);
    if (staticCurrentEl) staticCurrentEl.value = currentHtml || "（現在のHTMLが見つかりません）";
    const draft = staticPagesDrafts && Object.prototype.hasOwnProperty.call(staticPagesDrafts, type)
      ? staticPagesDrafts[type]
      : "";
    if (draft && draft === currentHtml) {
      delete staticPagesDrafts[type];
      saveStaticDrafts();
    }
    setBaseline(type, currentHtml);
    setEditorHtml(currentHtml);
    staticTypeSelect.setAttribute("data-prev", type);
    updateStaticPreviewLink();
    updateStaticDirtyState();
    updateStaticHistorySelect();
  };

  const updateStaticPageDraft = () => {
    if (!staticTypeSelect || !staticBodyEl) return;
    if (isProgrammaticSet) return;
    const type = getStaticPageType();
    staticPagesDrafts = staticPagesDrafts || {};
    staticPagesDrafts[type] = String(staticBodyEl.value || "");
    saveStaticDrafts();
    updateStaticDirtyState();
  };

  const pushStaticHistory = (type, contentHtml) => {
    if (!type || !contentHtml) return;
    const history = staticPagesHistory || {};
    const list = Array.isArray(history[type]) ? history[type] : [];
    list.unshift({ savedAt: new Date().toISOString(), contentHtml });
    history[type] = list.slice(0, 10);
    staticPagesHistory = history;
    ccSaveStaticPagesHistory(history);
  };

  const savePendingStaticPages = () => {
    if (!isStaticDirty()) return;
    ensureStaticPagesDraft();
    const type = getStaticPageType();
    const prevHtml = getStaticCurrentHtml(type);
    if (prevHtml) pushStaticHistory(type, prevHtml);
    const entry = staticPagesDraft[type] || { type };
    entry.type = type;
    entry.contentHtml = String(staticBodyEl?.value || "");
    delete entry.title;
    delete entry.body;
    entry.updatedAt = new Date().toISOString();
    staticPagesDraft[type] = entry;
    ccSaveStaticPages(staticPagesDraft);
    setBaseline(type, entry.contentHtml || "");
    if (staticPagesDrafts && Object.prototype.hasOwnProperty.call(staticPagesDrafts, type)) {
      delete staticPagesDrafts[type];
      saveStaticDrafts();
    }
    clearStaticPreviewDraft(type);
    updateStaticPagesStatus("保存しました");
    if (staticStatusEl) {
      setTimeout(() => updateStaticPagesStatus(), 1500);
    }
    renderStaticPageEditor();
  };

  const discardPendingStaticPages = () => {
    initStaticPagesState();
    renderStaticPageEditor();
  };

  const ensureStaticPreviewModal = () => {
    let modal = document.getElementById("admin-static-preview-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "admin-static-preview-modal";
    modal.className = "modal-overlay admin-static-preview-overlay";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="modal admin-static-preview-modal">
        <div class="modal-head">
          <h3>表示確認（未保存）</h3>
          <button class="modal-close" type="button" aria-label="閉じる">×</button>
        </div>
        <div class="modal-body">
          <div class="admin-static-preview-note">この内容は未保存です。</div>
          <div class="admin-static-preview-loading" hidden>読み込み中…</div>
          <div class="admin-static-preview-meta">
            <span class="admin-static-preview-url-label">preview URL:</span>
            <a class="admin-static-preview-url" href="#" target="_blank" rel="noopener">-</a>
          </div>
          <div class="admin-static-preview-frame-wrap"></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" type="button" data-preview-close>閉じる</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const closeBtns = modal.querySelectorAll("[data-preview-close], .modal-close");
    closeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        modal.hidden = true;
        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
        const type = modal.dataset.previewType || getStaticPageType();
        clearStaticPreviewDraft(type);
      });
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.hidden = true;
        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
        const type = modal.dataset.previewType || getStaticPageType();
        clearStaticPreviewDraft(type);
      }
    });
    return modal;
  };

  const openStaticPreview = (event) => {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (!staticBodyEl) return;
    const modal = ensureStaticPreviewModal();
    const frameWrap = modal.querySelector(".admin-static-preview-frame-wrap");
    const loadingEl = modal.querySelector(".admin-static-preview-loading");
    const previewUrlEl = modal.querySelector(".admin-static-preview-url");
    if (!frameWrap) return;
    const rawHtml = String(staticBodyEl.value || "").trim();
    const html = rawHtml ? rawHtml : "";
    const type = getStaticPageType();
    const params = new URLSearchParams();
    params.set("type", type);
    params.set("preview", "1");
    params.set("embed", "1");
    params.set("ts", String(Date.now()));
    try {
      const lang = localStorage.getItem(KEY_LANG);
      if (lang) params.set("lang", String(lang));
    } catch (e) { }
    try {
      const city = localStorage.getItem("mock_default_city");
      if (city) params.set("city", String(city));
    } catch (e) { }
    const previewUrl = `static.html?${params.toString()}`;
    modal.hidden = false;
    modal.dataset.previewType = type;
    document.documentElement.classList.add("modal-open");
    document.body.classList.add("modal-open");
    frameWrap.innerHTML = "";
    if (loadingEl) {
      loadingEl.hidden = false;
      loadingEl.textContent = "読み込み中…";
    }
    if (previewUrlEl) {
      previewUrlEl.textContent = previewUrl;
      previewUrlEl.setAttribute("href", previewUrl);
    }
    if (!html) {
      frameWrap.innerHTML = '<div class="admin-static-preview-empty">プレビューする内容がありません。</div>';
      if (loadingEl) loadingEl.hidden = true;
      return;
    }
    try {
      const draftsRaw = localStorage.getItem(CC_STATIC_DRAFTS_KEY);
      const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
      drafts[type] = { contentHtml: html, savedAt: new Date().toISOString() };
      localStorage.setItem(CC_STATIC_DRAFTS_KEY, JSON.stringify(drafts));
    } catch (e) { }
    const iframe = document.createElement("iframe");
    iframe.className = "admin-static-preview-frame";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.setAttribute("title", "未保存プレビュー");
    iframe.src = previewUrl;
    iframe.addEventListener("load", () => {
      if (loadingEl) loadingEl.hidden = true;
    });
    frameWrap.appendChild(iframe);
    setTimeout(() => {
      if (!loadingEl || loadingEl.hidden) return;
      loadingEl.textContent = "プレビューを描画できませんでした。URLを再生成して再試行してください。";
    }, 2500);
  };

  const confirmStaticSave = () => {
    updateStaticDirtyState();
    if (!staticPagesDirty) {
      updateStaticPagesStatus("変更がありません");
      if (staticStatusEl) setTimeout(() => updateStaticPagesStatus(), 1200);
      return;
    }
    const type = getStaticPageType();
    const label = staticPageLabels[type] || type;
    openGlobalConfirmModal({
      id: "cc-admin-static-save-confirm",
      title: "保存の確認",
      message: `${label}（${type}）を保存します。updatedAt が更新されます。`,
      confirmText: "保存する",
      cancelText: "キャンセル",
      onConfirm: () => {
        savePendingStaticPages();
      }
    });
  };

  const confirmStaticReset = () => {
    const type = getStaticPageType();
    const label = staticPageLabels[type] || type;
    openGlobalConfirmModal({
      id: "cc-admin-static-reset-confirm",
      title: "初期状態に戻す",
      message: `${label}（${type}）を初期状態に戻します。`,
      confirmText: "戻す",
      cancelText: "キャンセル",
      onConfirm: () => {
        const prevHtml = getStaticCurrentHtml(type);
        if (prevHtml) pushStaticHistory(type, prevHtml);
        if (staticPagesDraft && staticPagesDraft[type]) {
          delete staticPagesDraft[type];
          ccSaveStaticPages(staticPagesDraft);
        }
        if (staticPagesDrafts && Object.prototype.hasOwnProperty.call(staticPagesDrafts, type)) {
          delete staticPagesDrafts[type];
          saveStaticDrafts();
        }
        clearStaticPreviewDraft(type);
        updateStaticPagesStatus("初期状態に戻しました");
        if (staticStatusEl) setTimeout(() => updateStaticPagesStatus(), 1500);
        renderStaticPageEditor();
      }
    });
  };

  if (staticTypeSelect) {
    staticTypeSelect.addEventListener("change", () => {
      const nextType = getStaticPageType();
      const prevType = staticTypeSelect.getAttribute("data-prev") || nextType;
      if (!isStaticDirty()) {
        renderStaticPageEditor();
        staticTypeSelect.setAttribute("data-prev", nextType);
        return;
      }
      openGlobalConfirmModal({
        id: "cc-admin-static-type-change",
        title: "未保存の変更があります",
        message: "変更を破棄してページを切り替えますか？",
        confirmText: "破棄して切り替え",
        cancelText: "キャンセル",
        onConfirm: () => {
          if (staticPagesDrafts && Object.prototype.hasOwnProperty.call(staticPagesDrafts, prevType)) {
            delete staticPagesDrafts[prevType];
            saveStaticDrafts();
          }
          renderStaticPageEditor();
          staticTypeSelect.setAttribute("data-prev", nextType);
        },
        onCancel: () => {
          staticTypeSelect.value = prevType;
          ccResetSelectDropdown(staticTypeSelect);
          const wrap = staticTypeSelect.closest(".cc-dropdown");
          if (wrap) ccInitSelectDropdowns(wrap);
        }
      });
    });
  }
  if (staticBodyEl) staticBodyEl.addEventListener("input", updateStaticPageDraft);
  if (staticSaveBtn) staticSaveBtn.addEventListener("click", confirmStaticSave);
  if (staticPreviewBtn) staticPreviewBtn.addEventListener("click", openStaticPreview);
  if (staticResetBtn) staticResetBtn.addEventListener("click", confirmStaticReset);
  if (staticRestoreBtn && staticHistorySelect) {
    staticRestoreBtn.addEventListener("click", () => {
      const type = getStaticPageType();
      const list = Array.isArray(staticPagesHistory?.[type]) ? staticPagesHistory[type] : [];
      const idx = Number(staticHistorySelect.value || "");
      const entry = Number.isFinite(idx) ? list[idx] : null;
      if (!entry || !entry.contentHtml) return;
      const label = staticPageLabels[type] || type;
      const savedAt = entry?.savedAt ? formatDateTimeSeconds(entry.savedAt) : "選択中の履歴";
      openGlobalConfirmModal({
        id: "cc-admin-static-restore-confirm",
        title: "編集前に戻す",
        message: `${label}（${type}）を「${savedAt}」の状態に戻します。`,
        confirmText: "戻す",
        cancelText: "キャンセル",
        onConfirm: () => {
          staticPagesDrafts = staticPagesDrafts || {};
          staticPagesDrafts[type] = entry.contentHtml;
          saveStaticDrafts();
          setEditorHtml(entry.contentHtml);
          updateStaticDirtyState("未保存");
        }
      });
    });
  }

  const savePendingSettings = () => {
    ensureSettingsDraft();
    if (!settingsDirty) return;
    const adminEmail = actor();
    const now = new Date().toISOString();
    const baseNg = settingsBase ? settingsBase.ng : null;
    const baseReasons = settingsBase ? settingsBase.reasons : null;

    if (JSON.stringify(baseNg || {}) !== JSON.stringify(settingsDraft.ng || {})) {
      ccSaveNgWords(settingsDraft.ng || {});
      ccAddAdminAudit({
        at: now,
        admin_email: adminEmail,
        action: "ng_words_update",
        target: "ng_words",
        before: baseNg || {},
        after: settingsDraft.ng || {}
      });
    }
    if (JSON.stringify(baseReasons || {}) !== JSON.stringify(settingsDraft.reasons || {})) {
      ccSaveReportReasons(settingsDraft.reasons || {});
      ccAddAdminAudit({
        at: now,
        admin_email: adminEmail,
        action: "report_reasons_update",
        target: "report_reasons",
        before: baseReasons || {},
        after: settingsDraft.reasons || {}
      });
    }
    settingsBase = cloneSettings(settingsDraft);
    settingsDirty = false;
    updateSettingsPending();
    renderSettings();
    renderLogs();
  };

  const discardPendingSettings = () => {
    initSettingsState();
    renderSettings();
  };

  if (settingsSaveBtn) settingsSaveBtn.addEventListener("click", savePendingSettings);
  if (settingsDiscardBtn) settingsDiscardBtn.addEventListener("click", discardPendingSettings);

  initSettingsState();
  renderSettings();
  initAnnouncementsState();
  renderAnnouncementsAdmin();
  initStaticPagesState();
  renderStaticPageEditor();
  renderBoards();
  renderBoardReplies();
  const saveAllPending = () => {
    savePendingPosts();
    savePendingBoards();
    savePendingBoardReplies();
    savePendingReports();
    savePendingUsers();
    savePendingConversations();
    savePendingAnnouncements();
    savePendingSettings();
    savePendingStaticPages();
  };

  const discardAllPending = () => {
    discardPendingPosts();
    discardPendingBoards();
    Object.keys(pendingBoardReplies).forEach((k) => { delete pendingBoardReplies[k]; });
    discardPendingReports();
    discardPendingUsers();
    discardPendingConversations();
    discardPendingAnnouncements();
    discardPendingSettings();
    discardPendingStaticPages();
  };

  const guardAdminSwitch = (next, meta) => {
    const current = getActiveAdminTab();
    if (!next || next === current) return true;
    if (!hasAdminPending()) return true;
    openAdminUnsavedModal({
      onSave: () => {
        saveAllPending();
        switchAdminTab(next);
      },
      onDiscard: () => {
        discardAllPending();
        switchAdminTab(next);
      },
      onCancel: () => {
        if (meta && meta.source === "hash") {
          try {
            history.replaceState(null, "", `#${current}`);
          } catch (e) { }
        }
      }
    });
    return false;
  };

  initAdminTabs({ onBeforeSwitch: guardAdminSwitch });

  document.addEventListener("click", (e) => {
    const link = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    const href = String(link.getAttribute("href") || "");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    if (!hasAdminPending()) return;
    e.preventDefault();
    openAdminUnsavedModal({
      onSave: () => {
        saveAllPending();
        window.location.href = href;
      },
      onDiscard: () => {
        discardAllPending();
        window.location.href = href;
      },
      onCancel: () => { }
    });
  });

  let adminNavBypass = null;
  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("button.account-menu-item") : null;
    if (!btn) return;
    if (adminNavBypass === btn) {
      adminNavBypass = null;
      return;
    }
    if (!hasAdminPending()) return;
    e.preventDefault();
    e.stopPropagation();
    openAdminUnsavedModal({
      onSave: () => {
        saveAllPending();
        adminNavBypass = btn;
        btn.click();
      },
      onDiscard: () => {
        discardAllPending();
        adminNavBypass = btn;
        btn.click();
      },
      onCancel: () => { }
    });
  }, true);

  window.addEventListener("beforeunload", (e) => {
    if (!hasAdminPending()) return;
    e.preventDefault();
    e.returnValue = "";
  });

  function renderLogs() {
    if (!logListEl) return;
    const query = String(logSearchInput?.value || "").trim().toLowerCase();
    const filter = String(logFilterSelect?.value || "all");
    const range = String(logRangeSelect?.value || "all");
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const rangeStart = range === "today"
      ? startOfToday.getTime()
      : (range === "7" ? now - (7 * 24 * 60 * 60 * 1000)
        : (range === "30" ? now - (30 * 24 * 60 * 60 * 1000) : null));
    const logs = ccLoadAdminAudit().slice().sort((a, b) => {
      const ta = Date.parse(a.at || "") || 0;
      const tb = Date.parse(b.at || "") || 0;
      return tb - ta;
    });
    const filtered = logs.filter((log) => {
      const action = String(log.action || "");
      const effectiveFilter = activeLogQuick !== "all" ? activeLogQuick : filter;
      if (effectiveFilter !== "all" && action !== effectiveFilter) return false;
      if (rangeStart !== null) {
        const t = Date.parse(log.at || "");
        if (!Number.isNaN(t) && t < rangeStart) return false;
      }
      if (!query) return true;
      const hay = [log.target, log.admin_email].map((v) => String(v || "").toLowerCase()).join(" ");
      return hay.includes(query);
    });

    if (logCountEl) logCountEl.textContent = String(filtered.length);
    const totalEl = document.getElementById("admin-log-total");
    if (totalEl) totalEl.textContent = String(logs.length);
    if (!filtered.length) {
      logListEl.innerHTML = `<div class="admin-empty">ログはありません。</div>`;
      return;
    }

    logListEl.innerHTML = filtered.map((log, idx) => {
      const action = String(log.action || "");
      const timeText = formatDateTimeSeconds(log.at_epoch_ms || log.at || "");
      return `
        <article class="admin-log-card" data-log-index="${idx}">
          <div class="admin-log-main">
            <div class="admin-log-title">${escapeHtml(action)}</div>
            <div class="admin-log-meta">
              <span>対象：${escapeHtml(String(log.target || ""))}</span>
              <span>管理者：${escapeHtml(String(log.admin_email || ""))}</span>
              <span>日時：${escapeHtml(timeText)}</span>
            </div>
          </div>
        </article>
      `;
    }).join("");
    logListEl._ccLogs = filtered;
  }

  if (logSearchInput) logSearchInput.addEventListener("input", renderLogs);
  if (logFilterSelect) logFilterSelect.addEventListener("change", () => {
    activeLogQuick = "all";
    logQuickBtns.forEach((btn) => btn.classList.remove("is-active"));
    renderLogs();
  });
  if (logRangeSelect) logRangeSelect.addEventListener("change", renderLogs);
  if (logQuickBtns.length) {
    logQuickBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        activeLogQuick = btn.getAttribute("data-log-quick") || "all";
        logQuickBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
        renderLogs();
      });
    });
  }
  if (logListEl) {
    const getAuditSummary = (log, changedKeys) => {
      const baseSummary = String(log.summary || "").trim();
      if (baseSummary) return baseSummary;
      const action = String(log.action || "");
      if (action === "priority_update") return "優先度を更新";
      if (action === "due_update") return "期限を更新";
      if (action === "report_update") {
        if (changedKeys.includes("reason")) return "通報理由を更新";
        if (changedKeys.includes("detail") || changedKeys.includes("internal_note")) return "通報詳細を更新";
        if (changedKeys.includes("status")) return "通報ステータスを更新";
        if (changedKeys.includes("assigned_to")) return "通報担当を更新";
        return "通報を更新";
      }
      if (action === "report_create") return "通報を作成";
      if (action === "inquiry_thread_view_for_report") return "通報対応でスレッドを閲覧";
      const parts = [];
      if (action) parts.push(action);
      if (log.target) parts.push(String(log.target));
      const keys = Array.isArray(changedKeys) ? changedKeys.filter(Boolean) : [];
      if (keys.length) parts.push(keys.slice(0, 3).join(", "));
      return parts.join(" / ") || "—";
    };
    logListEl.addEventListener("click", (e) => {
      const card = e.target.closest(".admin-log-card");
      if (!card) return;
      const idx = Number(card.getAttribute("data-log-index"));
      const list = logListEl._ccLogs || [];
      const log = list[idx];
      if (!log) return;
      const timeText = formatDateTimeSeconds(log.at_epoch_ms || log.at || "");
      const before = log.before || {};
      const after = log.after || {};
      const keys = Array.from(new Set(Object.keys(before).concat(Object.keys(after))));
      const changed = keys.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
      const ordered = changed.concat(keys.filter((key) => !changed.includes(key)));
      const summary = getAuditSummary(log, changed);
      const renderValue = (value) => {
        if (value === null || value === undefined) return "";
        if (typeof value === "string") return value;
        try { return JSON.stringify(value); } catch (e) { return String(value); }
      };
      const rows = ordered.map((key) => {
        const b = renderValue(before[key]);
        const a = renderValue(after[key]);
        if (!b && !a) return "";
        return `<div class="admin-log-kv-row"><span class="admin-log-kv-key">${escapeHtml(key)}</span><span class="admin-log-kv-before">${escapeHtml(b || "—")}</span><span class="admin-log-kv-after">${escapeHtml(a || "—")}</span></div>`;
      }).filter(Boolean).join("");
      const bodyHtml = `
        <dl class="admin-log-detail">
          <dt>action</dt><dd>${escapeHtml(String(log.action || ""))}</dd>
          <dt>target</dt><dd>${escapeHtml(String(log.target || ""))}</dd>
          <dt>admin</dt><dd>${escapeHtml(String(log.admin_email || ""))}</dd>
          <dt>at</dt><dd>${escapeHtml(timeText)}</dd>
          <dt>summary</dt><dd>${escapeHtml(summary || "—")}</dd>
          <dt>changed_keys</dt><dd>${escapeHtml(changed.join(", ") || "—")}</dd>
        </dl>
        <div class="admin-log-kv">
          <div class="admin-log-kv-row admin-log-kv-head">
            <span>key</span><span>before</span><span>after</span>
          </div>
          ${rows || `<div class="admin-log-kv-empty">差分はありません。</div>`}
        </div>
      `;
      ccOpenModal({
        title: "ログ詳細",
        bodyHtml,
        buttons: [{ label: "閉じる", className: "btn btn-secondary" }]
      });
    });
  }

  const formatAuditExportTimestamp = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  };

  const toCsvValue = (value) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };

  const exportAuditLogs = (format) => {
    if (!assertAdmin()) return;
    const list = logListEl?._ccLogs || [];
    const ts = formatAuditExportTimestamp();
    const filename = `cc_audit_${ts}.${format === "json" ? "json" : "csv"}`;
    let payload = "";
    if (format === "json") {
      payload = JSON.stringify(list, null, 2);
    } else {
      const header = ["at", "action", "target", "admin_email", "before", "after"];
      const rows = list.map((log) => {
        return [
          formatDateTimeSeconds(log.at_epoch_ms || log.at || ""),
          log.action || "",
          log.target || "",
          log.admin_email || "",
          JSON.stringify(log.before || {}),
          JSON.stringify(log.after || {})
        ].map(toCsvValue).join(",");
      });
      payload = [header.join(","), ...rows].join("\n");
    }
    const blob = new Blob([payload], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    ccAddAdminAudit({
      at: nowIso,
      admin_email: getUserEmail() || getAccountName() || "admin",
      action: "audit_export",
      target: "admin_audit",
      after: {
        format,
        count: list.length,
        filter: String(logFilterSelect?.value || "all"),
        range: String(logRangeSelect?.value || "all"),
        quick: String(activeLogQuick || "all"),
        query: String(logSearchInput?.value || "")
      }
    });
    renderLogs();
  };

  if (logExportCsvBtn) logExportCsvBtn.addEventListener("click", () => exportAuditLogs("csv"));
  if (logExportJsonBtn) logExportJsonBtn.addEventListener("click", () => exportAuditLogs("json"));

  if (smokeCopyBtn && smokeText) {
    smokeCopyBtn.addEventListener("click", async () => {
      const text = smokeText.value || "";
      if (!text) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          showGlobalToast("チェックリストをコピーしました。");
          return;
        }
      } catch (e) { }
      smokeText.focus();
      smokeText.select();
      showGlobalToast("選択しました。コピーしてください。");
    });
  }

  renderPosts();
  renderReports();
  renderUsers();
  renderConversations();
  renderLogs();
}

function applyRelativeTimesToCards() {
  if (!document.body.classList.contains("mypage-page")) return;
  document.querySelectorAll(".card[data-created-at]").forEach((card) => {
    const ts = card.getAttribute("data-created-at");
    const timeEl = card.querySelector(".card-meta .time");
    if (timeEl) timeEl.textContent = formatDateForView(ts, { mode: "public" });
  });
}

function formatAreaText(post) {
  const CITY_EN = {
    vancouver: "Vancouver",
    victoria: "Victoria",
    whistler: "Whistler",
    kelowna: "Kelowna",
    calgary: "Calgary",
    banff: "Banff",
    edmonton: "Edmonton",
    winnipeg: "Winnipeg",
    ottawa: "Ottawa",
    toronto: "Toronto",
    montreal: "Montreal",
    halifax: "Halifax",
    japan: "Japan",
    canada_all: "All Canada"
  };
  const CITY_EN_PROV = {
    vancouver: "Vancouver, BC",
    victoria: "Victoria, BC",
    whistler: "Whistler, BC",
    kelowna: "Kelowna, BC",
    calgary: "Calgary, AB",
    banff: "Banff, AB",
    edmonton: "Edmonton, AB",
    winnipeg: "Winnipeg, MB",
    ottawa: "Ottawa, ON",
    toronto: "Toronto, ON",
    montreal: "Montreal, QC",
    halifax: "Halifax, NS",
    whitehorse: "Whitehorse, YT",
    abbotsford: "Abbotsford, BC",
    burnaby: "Burnaby, BC",
    kamloops: "Kamloops, BC",
    nanaimo: "Nanaimo, BC",
    prince_george: "Prince George, BC",
    richmond: "Richmond, BC",
    surrey: "Surrey, BC",
    kananaskis: "Kananaskis, AB",
    canmore: "Canmore, AB",
    fort_mcmurray: "Fort McMurray, AB",
    medicine_hat: "Medicine Hat, AB",
    lake_louise: "Lake Louise, AB",
    red_deer: "Red Deer, AB",
    lethbridge: "Lethbridge, AB",
    regina: "Regina, SK",
    saskatoon: "Saskatoon, SK",
    brandon: "Brandon, MB",
    oakville: "Oakville, ON",
    oshawa: "Oshawa, ON",
    kingston: "Kingston, ON",
    kitchener: "Kitchener, ON",
    guelph: "Guelph, ON",
    sudbury: "Sudbury, ON",
    thunder_bay: "Thunder Bay, ON",
    niagara_falls: "Niagara Falls, ON",
    barrie: "Barrie, ON",
    hamilton: "Hamilton, ON",
    mississauga: "Mississauga, ON",
    markham: "Markham, ON",
    vaughan: "Vaughan, ON",
    london_on: "London, ON",
    waterloo: "Waterloo, ON",
    windsor: "Windsor, ON",
    gatineau: "Gatineau, QC",
    laval: "Laval, QC",
    longueuil: "Longueuil, QC",
    quebec_city: "Quebec City, QC",
    fredericton: "Fredericton, NB",
    moncton: "Moncton, NB",
    saint_john: "Saint John, NB",
    charlottetown: "Charlottetown, PE",
    sydney_ns: "Sydney, NS",
    st_johns: "St. John's, NL"
  };

  const toTitleCaseFromKey = (key) => String(key || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (m) => m.toUpperCase());

  const cityKeyToEnglish = (key, areaRaw) => {
    const k = String(key || "").trim().toLowerCase();
    if (CITY_EN_PROV[k]) return CITY_EN_PROV[k];
    if (CITY_EN[k]) return CITY_EN[k];
    if (areaRaw && /^[A-Za-z]/.test(areaRaw)) {
      return String(areaRaw).split(",")[0].trim();
    }
    return k ? toTitleCaseFromKey(k) : "";
  };

  const cityKey = String(post?.city || "");
  const areaRaw = String(post?.area || "").trim();
  const detail = String(post?.address || "").trim();
  const cityName = cityKeyToEnglish(cityKey, areaRaw);
  let cityLabel = cityName || areaRaw || "";
  if (areaRaw && areaRaw.includes(",") && (!cityName || !cityName.includes(","))) {
    cityLabel = areaRaw;
  }
  if (detail && cityLabel) return `${detail}, ${cityLabel}`;
  if (detail) return detail;
  return cityLabel || "—";
}

function formatCardPrice(raw, catKey) {
  const val = String(raw || "").trim();
  if (!val || val === "-" || val === "—") return "";
  if (/無料|free/i.test(val)) return "無料";
  const lower = val.toLowerCase();
  const hasYen = val.includes("JP¥") || val.includes("¥");
  const hasDollar = val.includes("CA$") || val.includes("$");
  const symbol = hasYen ? "¥" : "$";
  const numMatch = val.match(/\d+(?:\.\d+)?/);
  const num = numMatch ? parseFloat(numMatch[0]) : null;
  const amount = Number.isFinite(num) ? num.toFixed(2) : val;
  const needsMonth = String(catKey || "") === "housing";
  const needsHour = String(catKey || "") === "jobs";
  const hasMonth = lower.includes("/month");
  const hasHour = lower.includes("/hour");
  const unitFromRaw = hasMonth ? " /month" : (hasHour ? " /hour" : "");
  const suffix = unitFromRaw || (needsMonth ? " /month" : (needsHour ? " /hour" : ""));
  if (!Number.isFinite(num)) return val;
  if (!hasDollar && !hasYen) return `${symbol} ${amount}${suffix}`;
  return `${symbol} ${amount}${suffix}`;
}

function getPostCategoryKey(post) {
  if (!post) return "";
  return ccNormalizeCategoryKey(
    post.cat
    || post.category
    || post.catKey
    || post.cat_key
    || post.categoryKey
    || post.category_key
    || post.type
  );
}

function formatPostPriceForDisplay(post) {
  if (!post) return "";
  const catKey = getPostCategoryKey(post);
  const unit = String(post?.priceUnit || "").trim().toLowerCase();
  if (unit === "month" || unit === "hour") {
    const base = formatCardPrice(post?.price, "");
    if (!base) return "";
    return `${base}${unit === "month" ? " /month" : " /hour"}`;
  }
  return formatCardPrice(post?.price, catKey);
}

function applyPriceFormatToCards() {
  if (!document.body.classList.contains("mypage-page")) return;
  document.querySelectorAll(".card").forEach((card) => {
    const priceEl = card.querySelector(".post-price");
    if (!priceEl) return;
    const raw = priceEl.textContent;
    let catKey = "";
    const dataCat = String(card.getAttribute("data-cat") || "").trim();
    if (dataCat) catKey = dataCat;
    const catEl = card.querySelector(".post-cat");
    if (catEl) {
      if (catEl.classList.contains("cat-housing")) catKey = "housing";
      else if (catEl.classList.contains("cat-jobs")) catKey = "jobs";
      else {
        const catText = catEl.textContent || "";
        if (/求人/.test(catText)) catKey = "jobs";
        if (/住まい/.test(catText)) catKey = "housing";
      }
    }
    if (!catKey) {
      const titleEl = card.querySelector(".card-title");
      const titleText = titleEl ? titleEl.textContent : "";
      if (/Housekeeping|求人/.test(titleText || "")) catKey = "jobs";
    }
    const next = formatCardPrice(raw, catKey);
    if (next) priceEl.textContent = next;
    if (catKey === "jobs" && !/\/hour/i.test(priceEl.textContent || "")) {
      priceEl.textContent = (priceEl.textContent || raw).trim() + " /hour";
    }
  });
}

function applyMypageDealButtons() {
  if (!document.body.classList.contains("mypage-page")) return;
  document.querySelectorAll(".myposts-panel .card").forEach((card) => {
    const link = card.querySelector('a[href*="detail.html?post="]');
    if (!link) return;
    const href = String(link.getAttribute("href") || "");
    const match = href.match(/post=([^&]+)/);
    if (!match) return;
    const postKey = decodeURIComponent(match[1]);
    const post = ccGetPostByKey(postKey);
    if (!post) return;
    const labels = ccGetStatusLabels(post.cat);
    const primaryBtn = card.querySelector(".mypage-actions .btn.btn-primary");
    if (!primaryBtn) return;
    if (primaryBtn.textContent.includes("再掲載")) return;
    primaryBtn.textContent = `${labels.completed}にする`;
  });
}

function formatEventRange(post) {
  const date = ccNormalizeYMD(post?.event_date || "");
  const start = String(post?.event_start || "").trim();
  const end = String(post?.event_end || "").trim();
  if (!date && !start && !end) return "";
  const dateLabel = date ? formatDateForView(date, { withTime: false }) : "";
  if (start && end) return `${dateLabel} ${start} - ${end}`.trim();
  if (start) return `${dateLabel} ${start}`.trim();
  return dateLabel;
}

function ccExtractPriceNumber(raw) {
  const text = String(raw || "").replace(/[,¥$]/g, " ").trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

function sanitizePriceForStorage(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (/無料|free/i.test(text)) return "無料";
  const stripped = text.replace(/\s*\/\s*(month|hour)\s*$/i, "").trim();
  const match = stripped.replace(/[,¥$]/g, " ").match(/\d+(?:\.\d+)?/);
  return match ? match[0] : "";
}

function sanitizePriceForInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (/無料|free/i.test(text)) return "無料";
  const stripped = text.replace(/\s*\/\s*(month|hour)\s*$/i, "").trim();
  const match = stripped.replace(/[,¥$]/g, " ").match(/\d+(?:\.\d+)?/);
  return match ? match[0] : "";
}

function ccIsPostAuthorBanned(post) {
  const email = String(post?.author_email || post?.authorEmail || "").trim();
  if (!email) return false;
  const user = getUserRecordByEmail(email);
  if (!user) return false;
  return normalizeUserStatus(user?.status) === "banned";
}

function initDetailPage() {
  const titleEl = document.getElementById("post-title");
  if (!titleEl) return;

  let post = null;
  try {
    const params = new URLSearchParams(location.search);
    const key = params.get("post") || params.get("id") || "";
    if (key && ccIsPostHidden(key) && !isAdmin()) {
      openGlobalConfirmModal({
        id: "cc-post-hidden-modal",
        title: "アクセスできません",
        message: "この投稿は非表示です。",
        confirmText: "戻る",
        cancelText: "戻る",
        onConfirm: () => {
          try {
            if (history.length > 1) history.back();
            else window.location.href = "list.html";
          } catch (e) {
            window.location.href = "list.html";
          }
        }
      });
      return;
    }
    if (key && ccIsPostDeleted(key)) {
      openGlobalConfirmModal({
        id: "cc-post-deleted-modal",
        title: "投稿は削除されました",
        message: "投稿は削除されました。前の画面に戻ります。",
        confirmText: "OK",
        cancelText: "OK",
        onConfirm: () => {
          try {
            if (history.length > 1) history.back();
            else window.location.href = "list.html";
          } catch (e) {
            window.location.href = "list.html";
          }
        }
      });
      return;
    }
    post = ccGetPostByKey(key, key && ccIsPostHidden(key) ? { includeHidden: true } : undefined);
  } catch (e) { }

  if (!post) {
    const all = ccGetPosts();
    post = all.length ? all[0] : null;
  }
  if (!post) return;

  const postKey = String(post?.key || "");
  const favButtons = [
    document.getElementById("detail-favorite-button"),
    document.getElementById("detail-favorite-button-mobile")
  ].filter(Boolean);

  if (postKey && favButtons.length) {
    const applyFavoriteState = (active) => {
      favButtons.forEach((btn) => {
        btn.classList.toggle("detail-favorite", true);
        btn.classList.toggle("is-favorite", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        const icon = btn.querySelector("i");
        if (icon) {
          icon.classList.toggle("fa-solid", active);
          icon.classList.toggle("fa-regular", !active);
        }
      });
    };
    applyFavoriteState(ccIsFavorite(postKey));
    favButtons.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const active = ccToggleFavorite(postKey);
        applyFavoriteState(active);
        initMypageFavorites();
      });
    });
  }

  const areaText = post.area || getDisplayAreaName(post.city) || "—";
  const formatDetailPrice = (raw) => {
    const formatted = formatPostPriceForDisplay(post);
    if (formatted) return formatted;
    const val = String(raw || "").trim();
    if (!val || val === "-" || val === "—") return "お問い合わせください。";
    if (/無料|free/i.test(val)) return "無料";
    return val;
  };
  const detailLabelMap = {
    default: {
      price: "価格",
      condition: "状態",
      delivery: "受け渡し方法",
      contact: "連絡方法",
      desc: "説明",
      location: "場所",
      eventTitle: "開催情報",
      eventDate: "開催日",
      eventStart: "開始時間",
      eventEnd: "終了時間",
      eventPlace: "開催場所",
      eventFormat: "形式",
      eventCapacity: "定員"
    },
    housing: {
      price: "家賃",
      condition: "お部屋の状態",
      delivery: "内見・内覧",
      desc: "お部屋の紹介",
      location: "エリア（住まい）"
    },
    jobs: {
      price: "給料",
      condition: "雇用の形態",
      delivery: "勤務時間",
      desc: "仕事内容等",
      location: "勤務地"
    },
    sell: {
      price: "価格",
      condition: "商品の状態",
      delivery: "受け渡し方法",
      desc: "商品の説明",
      location: "受け渡し場所"
    },
    help: {
      price: "謝礼",
      condition: "お願いの状況",
      delivery: "やりとり方法",
      desc: "お願い内容",
      location: "対応エリア"
    },
    services: {
      price: "料金の目安",
      condition: "事前申し込み",
      delivery: "受け方",
      desc: "サービス内容",
      location: "提供エリア"
    },
    community: {
      price: "参加の目安",
      condition: "事前申し込み",
      delivery: "参加のしかた",
      desc: "募集内容",
      location: "集合エリア"
    },
    events: {
      price: "参加費",
      condition: "事前申し込み",
      delivery: "参加のしかた",
      desc: "イベントの説明",
      location: "開催エリア",
      eventTitle: "イベント情報"
    },
    school: {
      price: "受講料",
      condition: "事前申し込み",
      delivery: "受講のしかた",
      desc: "スクールの説明",
      location: "開催エリア",
      eventTitle: "スクール情報",
      eventFormat: "受講形式"
    }
  };
  const labels = Object.assign({}, detailLabelMap.default, detailLabelMap[String(post.cat || "")] || {});
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const getProfileField = (key) => {
    try {
      const isPublic = String(localStorage.getItem(`cc_profile_${key}_public`) || "").toLowerCase();
      if (!["1", "true", "yes", "public"].includes(isPublic)) return "非公開";
      const raw = String(localStorage.getItem(`cc_profile_${key}`) || "").trim();
      if (raw) return raw;
    } catch (e) { }
    return "未入力";
  };
  const dateSource = post.created_at;
  const dateMeta = dateSource ? formatPostCreatedAtForPublicMeta(dateSource) : { text: "—", absolute: "", isRelative: false };
  const dateText = dateMeta.text || "—";

  titleEl.textContent = ccGetPostDisplayTitle(post, "—");
  const dateEl = document.getElementById("post-date");
  if (dateEl) {
    dateEl.textContent = dateText;
    if (dateMeta.isRelative && dateMeta.absolute) {
      dateEl.title = dateMeta.absolute;
    } else {
      dateEl.removeAttribute("title");
    }
  }
  const breadcrumbEl = document.getElementById("post-breadcrumb");
  if (breadcrumbEl) {
    const catKey = String(post.cat || "");
    const catLabel = ccGetCategoryLabel(catKey) || "クラシファイド";
    const subLabel = post.sub || post.subcategory || "未選択";
    const cityKey = String(post.city || "");
    const cityLabel = getDisplayAreaName(post.city) || areaText;
    const catUrl = `list.html?cat=${encodeURIComponent(catKey)}`;
    const subUrl = `list.html?cat=${encodeURIComponent(catKey)}&sub=${encodeURIComponent(subLabel)}&city=${encodeURIComponent(cityKey)}`;
    breadcrumbEl.innerHTML = `
      <a href="list.html">クラシファイド</a>＞<a href="${catUrl}">${escapeHtml(catLabel)}</a>＞<a href="${subUrl}">${escapeHtml(subLabel)}（${escapeHtml(cityLabel)}）</a>
    `;
  }
  const locationAreaEl = document.getElementById("location-area");
  if (locationAreaEl) locationAreaEl.textContent = areaText;
  const locationAddressEl = document.getElementById("location-address");
  if (locationAddressEl) locationAddressEl.textContent = post.address || "未入力";
  const statusInfo = ccGetPostStatusInfo(post);
  const statusLabels = statusInfo.labels;
  const currentStatus = statusInfo.status;

  setText("detail-desc-title", labels.desc);
  const descEl = document.getElementById("post-description");
  if (descEl) {
    const desc = post.desc || post.description || "";
    if (desc) {
      descEl.hidden = false;
      descEl.innerHTML = `<p>${escapeHtml(desc).replace(/\n/g, "<br>")}</p>`;
    } else {
      descEl.hidden = false;
      descEl.innerHTML = `<p>説明文がまだありません。</p>`;
    }
  }

  const photoWrap = document.getElementById("main-photo");
  if (photoWrap) {
    const imgs = Array.isArray(post.images) ? post.images.slice(0, 5) : [];
    if (imgs.length) {
      let detailPhotoIndex = 0;
      const modal = document.getElementById("detail-photo-modal");
      const modalImg = document.getElementById("detail-photo-modal-image");
      const modalThumbs = document.getElementById("detail-photo-modal-thumbs");
      const modalClose = document.getElementById("detail-photo-close");
      const main = imgs[0];
      const thumbs = imgs.length > 1 ? `
        <div class="detail-photo-thumbs">
          ${imgs.map((src) => `<img src="${escapeHtml(src)}" alt="" />`).join("")}
        </div>
      ` : "";
      const statusBadge = currentStatus === "completed"
        ? `<span class="status-badge detail-status-badge">${escapeHtml(statusLabels.completed)}</span>`
        : "";
      photoWrap.innerHTML = `
        <div class="detail-photo-main">
          ${statusBadge}
          <img src="${escapeHtml(main)}" alt="" />
        </div>
        ${thumbs}
      `;
      const mainImg = photoWrap.querySelector(".detail-photo-main img");
      const thumbImgs = photoWrap.querySelectorAll(".detail-photo-thumbs img");
      if (thumbImgs.length && mainImg) {
        thumbImgs[0].classList.add("is-active");
        thumbImgs.forEach((imgEl) => {
          imgEl.addEventListener("click", () => {
            const idx = Array.prototype.indexOf.call(thumbImgs, imgEl);
            if (idx >= 0) detailPhotoIndex = idx;
            mainImg.src = imgEl.src;
            thumbImgs.forEach((i) => i.classList.remove("is-active"));
            imgEl.classList.add("is-active");
          });
        });
      }
      const renderModalThumbs = () => {
        if (!modalThumbs) return;
        modalThumbs.innerHTML = imgs.map((src, idx) => (
          `<img src="${escapeHtml(src)}" alt="" data-modal-index="${idx}" class="${idx === detailPhotoIndex ? "is-active" : ""}" />`
        )).join("");
      };
      const openModal = () => {
        if (!modal || !modalImg) return;
        modalImg.src = imgs[detailPhotoIndex];
        renderModalThumbs();
        modal.hidden = false;
      };
      if (mainImg) {
        mainImg.addEventListener("click", openModal);
      }
      if (modal) {
        modal.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target === modal) modal.hidden = true;
          const prev = target.closest(".preview-prev");
          const next = target.closest(".preview-next");
          if (prev) {
            detailPhotoIndex = (detailPhotoIndex - 1 + imgs.length) % imgs.length;
            if (modalImg) modalImg.src = imgs[detailPhotoIndex];
            renderModalThumbs();
            return;
          }
          if (next) {
            detailPhotoIndex = (detailPhotoIndex + 1) % imgs.length;
            if (modalImg) modalImg.src = imgs[detailPhotoIndex];
            renderModalThumbs();
            return;
          }
          const thumb = target.closest("[data-modal-index]");
          if (thumb) {
            const idx = Number(thumb.getAttribute("data-modal-index"));
            if (!Number.isNaN(idx)) {
              detailPhotoIndex = idx;
              if (modalImg) modalImg.src = imgs[detailPhotoIndex];
              renderModalThumbs();
            }
          }
        });
      }
      if (modalClose) {
        modalClose.addEventListener("click", () => {
          if (modal) modal.hidden = true;
        });
      }
    } else {
      photoWrap.innerHTML = `<div class="detail-photo-main"></div>`;
    }
  }

  setText("detail-location-title", labels.location);
  setText("detail-map-title", labels.location);
  setText("detail-price-title-mobile", labels.price);
  const priceEl = document.getElementById("post-price");
  const priceMobileEl = document.getElementById("post-price-mobile");
  if (priceEl) {
    priceEl.textContent = formatDetailPrice(post.price);
  }
  if (priceMobileEl) {
    priceMobileEl.textContent = formatDetailPrice(post.price);
  }

  const priceTitle = document.querySelector("#detail-side-price-block .section-title");
  if (priceTitle) {
    priceTitle.textContent = labels.price;
  }

  const eventBlock = document.getElementById("post-event-datetime");
  const eventText = document.getElementById("event-datetime-text");
  const isEventLike = post.cat === "events" || post.cat === "school";
  if (eventBlock) {
    if (isEventLike) {
      const range = formatEventRange(post);
      if (eventText) eventText.textContent = range || "日時は本文をご確認ください。";
      eventBlock.hidden = false;
    } else {
      eventBlock.hidden = true;
    }
  }

  const infoBlock = document.getElementById("event-info-block");
  if (infoBlock) {
    if (isEventLike) {
      const date = ccNormalizeYMD(post.event_date || "");
      const start = String(post.event_start || "").trim();
      const end = String(post.event_end || "").trim();
      const timeRange = start && end ? `${start} - ${end}` : (start || "—");
      const place = post.place || areaText || "—";
      const fee = String(post.price || "").trim();
      const normalizeField = (v) => {
        const s = String(v || "").trim();
        return (!s || s === "-" || s === "—") ? "" : s;
      };
      const format = normalizeField(post.format || post.event_format || "");
      const capacity = normalizeField(post.capacity || post.event_capacity || "");

      const dateEl = document.getElementById("event-info-date");
      const startEl = document.getElementById("event-info-start");
      const endEl = document.getElementById("event-info-end");
      const placeEl = document.getElementById("event-info-place");
      const feeLabelEl = document.getElementById("event-info-fee-label");
      const feeEl = document.getElementById("event-info-fee");
      const formatLabelEl = document.getElementById("event-info-format-label");
      const formatEl = document.getElementById("event-info-format");
      const capacityEl = document.getElementById("event-info-capacity");
      setText("event-info-title", labels.eventTitle);
      setText("event-info-date-label", labels.eventDate);
      setText("event-info-start-label", labels.eventStart);
      setText("event-info-end-label", labels.eventEnd);
      setText("event-info-place-label", labels.eventPlace);
      setText("event-info-capacity-label", labels.eventCapacity);

      if (dateEl) dateEl.textContent = date ? formatDateForView(date, { withTime: false }) : "未入力";
      if (startEl) startEl.textContent = start || "未入力";
      if (endEl) endEl.textContent = end || "未入力";
      if (placeEl) placeEl.textContent = place || "未入力";
      const feeValue = normalizeField(fee);
      if (feeLabelEl) feeLabelEl.textContent = labels.price;
      if (feeEl) feeEl.textContent = feeValue ? formatDetailPrice(feeValue) : formatDetailPrice("");
      if (formatLabelEl) formatLabelEl.textContent = labels.eventFormat;
      if (formatEl) formatEl.textContent = format || "未入力";
      if (capacityEl) capacityEl.textContent = capacity || "未入力";

      infoBlock.hidden = false;
    } else {
      infoBlock.hidden = true;
    }
  }

  const tradeBlock = document.getElementById("trade-info-block");
  const tradeMobileBlock = document.getElementById("trade-info-block-mobile");
  const hideHelpFields = String(post.cat || "") === "help";
  if (tradeBlock) {
    tradeBlock.hidden = false;
    const conditionLabel = document.getElementById("trade-condition-label");
    const conditionVal = document.getElementById("trade-condition");
    const deliveryVal = document.getElementById("trade-delivery");
    const contactVal = document.getElementById("trade-contact");
    if (conditionLabel) conditionLabel.textContent = labels.condition;
    setText("trade-delivery-label", labels.delivery);
    setText("trade-contact-label", labels.contact);
    setText("trade-info-title", "条件・連絡");
    if (conditionVal) conditionVal.textContent = post.condition || "未入力";
    if (deliveryVal) deliveryVal.textContent = post.delivery || "未入力";
    if (contactVal) contactVal.textContent = post.contact || "未入力";
    if (conditionLabel) conditionLabel.parentElement.style.display = hideHelpFields ? "none" : "";
    if (deliveryVal) deliveryVal.parentElement.style.display = hideHelpFields ? "none" : "";
  }
  if (tradeMobileBlock) {
    tradeMobileBlock.hidden = false;
    setText("trade-info-title-mobile", "条件・連絡");
    setText("trade-condition-label-mobile", labels.condition);
    setText("trade-delivery-label-mobile", labels.delivery);
    setText("trade-contact-label-mobile", labels.contact);
    const condMobile = document.getElementById("trade-condition-mobile");
    const delMobile = document.getElementById("trade-delivery-mobile");
    const conMobile = document.getElementById("trade-contact-mobile");
    if (condMobile) condMobile.textContent = post.condition || "未入力";
    if (delMobile) delMobile.textContent = post.delivery || "未入力";
    if (conMobile) conMobile.textContent = post.contact || "未入力";
    if (condMobile) condMobile.parentElement.style.display = hideHelpFields ? "none" : "";
    if (delMobile) delMobile.parentElement.style.display = hideHelpFields ? "none" : "";
  }

  const mapBlock = document.getElementById("post-map");
  if (mapBlock) {
    const title = mapBlock.querySelector(".section-title");
    const mapPlaceholder = mapBlock.querySelector(".map-placeholder");
    if (title) title.textContent = labels.location;
    if (mapPlaceholder) {
      const placeText = post.place || areaText || "Google Map（プロトタイプ）";
      mapPlaceholder.textContent = placeText;
    }
  }

  const sellerEl = document.getElementById("seller-name");
  if (sellerEl) {
    sellerEl.textContent = post.author || "—";
    const sellerId = String(post.author_key || post.author_id || post.authorId || "").trim();
    if (sellerId) sellerEl.setAttribute("data-seller-id", sellerId);
    if (sellerEl.tagName === "A") {
      const name = String(post.author || "").trim();
      const postKey = String(post.key || post.post_key || post.post_id || "").trim();
      sellerEl.setAttribute("href", name ? ccBuildProfileLinkWithContext(name, { from: "detail", post: postKey }) : "profile-view.html");
    }
  }
  const avatarEl = document.getElementById("seller-avatar");
  if (avatarEl) {
    const name = String(post.author || "").trim();
    const avatarSrc = ccGetAvatarForPost(post) || ccGetProfileIconByName(name);
    if (avatarSrc) {
      ccSetAvatarBackground(avatarEl, avatarSrc);
      avatarEl.textContent = "";
    } else {
      ccSetAvatarBackground(avatarEl, "");
      avatarEl.textContent = name ? name.charAt(0).toUpperCase() : "—";
    }
  }
  const ratingEl = document.getElementById("seller-rating");
  if (ratingEl) ratingEl.textContent = "★★★★★ (12)";
  const genderEl = document.getElementById("seller-gender");
  if (genderEl) genderEl.textContent = getProfileField("gender");
  const cityEl = document.getElementById("seller-city");
  if (cityEl) cityEl.textContent = getProfileField("city");

  const dealsEl = document.getElementById("seller-deals");
  const responseEl = document.getElementById("seller-response");
  if (dealsEl) dealsEl.textContent = "23件";
  if (responseEl) responseEl.textContent = "24時間以内";

  const sellerElMobile = document.getElementById("seller-name-mobile");
  if (sellerElMobile) {
    sellerElMobile.textContent = post.author || "—";
    const sellerId = String(post.author_key || post.author_id || post.authorId || "").trim();
    if (sellerId) sellerElMobile.setAttribute("data-seller-id", sellerId);
    if (sellerElMobile.tagName === "A") {
      const name = String(post.author || "").trim();
      const postKey = String(post.key || post.post_key || post.post_id || "").trim();
      sellerElMobile.setAttribute("href", name ? ccBuildProfileLinkWithContext(name, { from: "detail", post: postKey }) : "profile-view.html");
    }
  }
  const avatarElMobile = document.getElementById("seller-avatar-mobile");
  if (avatarElMobile) {
    const name = String(post.author || "").trim();
    const avatarSrc = ccGetAvatarForPost(post) || ccGetProfileIconByName(name);
    if (avatarSrc) {
      ccSetAvatarBackground(avatarElMobile, avatarSrc);
      avatarElMobile.textContent = "";
    } else {
      ccSetAvatarBackground(avatarElMobile, "");
      avatarElMobile.textContent = name ? name.charAt(0).toUpperCase() : "—";
    }
  }
  const ratingElMobile = document.getElementById("seller-rating-mobile");
  if (ratingElMobile) ratingElMobile.textContent = "★★★★★ (12)";
  const genderElMobile = document.getElementById("seller-gender-mobile");
  if (genderElMobile) genderElMobile.textContent = getProfileField("gender");
  const cityElMobile = document.getElementById("seller-city-mobile");
  if (cityElMobile) cityElMobile.textContent = getProfileField("city");
  const dealsElMobile = document.getElementById("seller-deals-mobile");
  const responseElMobile = document.getElementById("seller-response-mobile");
  if (dealsElMobile) dealsElMobile.textContent = "23件";
  if (responseElMobile) responseElMobile.textContent = "24時間以内";

  const dealTitleEl = document.getElementById("deal-status-title");
  const dealEl = document.getElementById("deal-status");
  const dealTitleMobile = document.getElementById("deal-status-title-mobile");
  const dealMobile = document.getElementById("deal-status-mobile");
  const statusTitle = statusLabels.kind + "状況";
  const statusText = currentStatus === "completed"
    ? statusLabels.completed
    : (currentStatus === "cancelled" ? statusLabels.cancelled : statusLabels.active);
  if (dealTitleEl) dealTitleEl.textContent = statusTitle;
  if (dealTitleMobile) dealTitleMobile.textContent = statusTitle;
  if (dealEl) dealEl.textContent = statusText;
  if (dealMobile) dealMobile.textContent = statusText;

  const inquiryBtn = document.getElementById("detail-inquiry-button");
  const inquiryBtnMobile = document.getElementById("detail-inquiry-button-mobile");
  const buildInquiryHref = () => {
    const params = new URLSearchParams();
    const postKey = String(post.key || post.post_key || post.post_id || "").trim();
    const sellerId = String(post.author_key || post.author_id || post.authorId || "").trim();
    if (postKey) params.set("post", postKey);
    if (post.title) params.set("title", String(post.title));
    if (post.price) params.set("price", String(formatDetailPrice(post.price)));
    if (areaText) params.set("city", String(areaText));
    if (post.author) params.set("seller", String(post.author));
    if (post.cat) params.set("cat", String(post.cat));
    if (sellerId) params.set("sellerId", sellerId);
    const query = params.toString();
    return query ? `inquiry.html?${query}` : "inquiry.html";
  };
  const applyInquiryHref = (btn) => {
    if (!btn) return;
    const href = buildInquiryHref();
    btn.setAttribute("href", href);
    const sellerId = String(post.author_key || post.author_id || post.authorId || "").trim();
    if (sellerId) btn.setAttribute("data-seller-id", sellerId);
  };
  applyInquiryHref(inquiryBtn);
  applyInquiryHref(inquiryBtnMobile);
  const applyInquiryState = (btn) => {
    if (!btn) return;
    if (currentStatus === "completed" || currentStatus === "cancelled") {
      btn.setAttribute("aria-disabled", "true");
      btn.classList.add("is-disabled");
      btn.textContent = currentStatus === "cancelled"
        ? "キャンセル済みのため受付不可"
        : `${statusLabels.completed}のため受付不可`;
    } else {
      btn.removeAttribute("aria-disabled");
      btn.classList.remove("is-disabled");
      btn.innerHTML = '<i class="fa-solid fa-paper-plane btn-icon" aria-hidden="true"></i>投稿者に問い合わせ';
    }
  };
  applyInquiryState(inquiryBtn);
  applyInquiryState(inquiryBtnMobile);

  const applyBanState = (btn) => {
    if (!btn) return;
    if (!isCurrentUserBanned()) return;
    btn.setAttribute("aria-disabled", "true");
    btn.classList.add("is-disabled");
    btn.textContent = "アカウント停止中のため利用不可";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      assertNotBanned();
    });
  };
  applyBanState(inquiryBtn);
  applyBanState(inquiryBtnMobile);

  const reportBtn = document.getElementById("detail-report-button");
  const reportBtnMobile = document.getElementById("detail-report-button-mobile");
  const bindReport = (btn) => {
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!getLoggedInFlag() && !getUserEmail()) {
        window.location.href = "login.html?from=detail";
        return;
      }
      if (!assertNotBanned()) return;
      openPostReportModal(post);
    });
  };
  bindReport(reportBtn);
  bindReport(reportBtnMobile);

  const relatedSection = document.getElementById("detail-related-section");
  const relatedGrid = document.getElementById("detail-related-list");
  const relatedDebug = document.getElementById("detail-related-debug");
  if (relatedSection && relatedGrid) {
    const debugEnabled = (() => {
      const params = new URLSearchParams(location.search || "");
      return isAdmin() || params.get("debug") === "1";
    })();
    const debugExcluded = {
      hidden: 0,
      deleted: 0,
      self: 0,
      banned: 0,
      closed: 0,
      author_limit: 0
    };
    const debugSelected = [];
    const debugNotes = [];
    const normalizeKey = (v) => String(v || "").trim().toLowerCase();
    const currentKey = String(post?.key || "").trim();
    const currentCat = String(post?.cat || "").trim();
    const currentCity = normalizeAreaKey(post?.city || "");
    const currentArea = normalizeKey(post?.area || "");
    const currentSub = normalizeKey(post?.sub || post?.subcategory || "");
    const currentPrice = ccExtractPriceNumber(post?.price);
    const currentName = normalizeKey(getAccountName());
    const currentEmail = normalizeKey(getUserEmail());
    const currentProfile = ccLoadCurrentProfile();
    const currentAuthorKey = normalizeKey(currentProfile?.user_key || "");

    const isOwnPost = (p) => {
      const authorName = normalizeKey(p?.author || p?.author_name || "");
      const authorEmail = normalizeKey(p?.author_email || p?.authorEmail || "");
      const authorKey = normalizeKey(p?.author_key || p?.authorKey || "");
      if (currentAuthorKey && authorKey && currentAuthorKey === authorKey) return true;
      if (currentEmail && authorEmail && currentEmail === authorEmail) return true;
      if (currentName && authorName && currentName === authorName) return true;
      return false;
    };

    const getCreatedTs = (p) => {
      const ts = Date.parse(p?.created_at || "");
      return Number.isFinite(ts) ? ts : 0;
    };

    const isFresh = (p) => {
      const ts = getCreatedTs(p);
      if (!ts) return false;
      return (Date.now() - ts) <= (7 * 24 * 60 * 60 * 1000);
    };

    const getKeywordSet = (p) => {
      const set = new Set();
      const pushToken = (v) => {
        const s = normalizeKey(v);
        if (s) set.add(s);
      };
      const addTokens = (text) => {
        const tokens = String(text || "").toLowerCase().match(/[a-z0-9]{2,}/g) || [];
        tokens.forEach((t) => set.add(t));
      };
      if (Array.isArray(p?.tags)) {
        p.tags.forEach((t) => pushToken(t));
      } else if (typeof p?.tags === "string") {
        p.tags.split(",").forEach((t) => pushToken(t));
      }
      addTokens(p?.title || "");
      pushToken(p?.sub || p?.subcategory || "");
      return set;
    };

    const currentKeywords = getKeywordSet(post);

    const candidates = ccGetPosts({ includeHidden: true }).filter((p) => p && String(p?.key || "").trim());
    const openCandidates = [];
    const closedCandidates = [];

    candidates.forEach((p) => {
      const key = String(p?.key || "").trim();
      if (!key || key === currentKey) return;
      if (ccIsPostHidden(key)) {
        debugExcluded.hidden += 1;
        return;
      }
      if (ccIsPostDeleted(key)) {
        debugExcluded.deleted += 1;
        return;
      }
      if (ccIsPostAuthorBanned(p)) {
        debugExcluded.banned += 1;
        return;
      }
      if (isOwnPost(p)) {
        debugExcluded.self += 1;
        return;
      }
      if (ccIsPostClosed(p)) {
        closedCandidates.push(p);
        return;
      }
      openCandidates.push(p);
    });

    const buildScored = (list) => list.map((p) => {
      let score = 0;
      const cat = String(p?.cat || "").trim();
      const city = normalizeAreaKey(p?.city || "");
      const area = normalizeKey(p?.area || "");
      const sub = normalizeKey(p?.sub || p?.subcategory || "");
      const price = ccExtractPriceNumber(p?.price);
      const reasons = [];

      if (cat && cat === currentCat) { score += 50; reasons.push("同カテゴリ"); }
      if (city && city === currentCity) { score += 20; reasons.push("同地域"); }
      if (area && currentArea && area === currentArea) { score += 8; reasons.push("同エリア"); }
      if (sub && currentSub && sub === currentSub) { score += 12; reasons.push("同サブカテゴリ"); }

      if (Number.isFinite(price) && Number.isFinite(currentPrice) && currentPrice) {
        const diff = Math.abs(price - currentPrice);
        const ratio = diff / Math.max(currentPrice, 1);
        if (ratio <= 0.2) { score += 10; reasons.push("価格近い"); }
        else if (ratio <= 0.5) { score += 5; reasons.push("価格近い"); }
      }

      const keywords = getKeywordSet(p);
      let overlap = 0;
      currentKeywords.forEach((k) => {
        if (keywords.has(k)) overlap += 1;
      });
      if (overlap) {
        score += Math.min(overlap, 3) * 4;
        reasons.push("キーワード一致");
      }

      const ts = getCreatedTs(p);
      if (ts) {
        const days = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
        score += Math.max(0, 4 - Math.floor(days / 7));
      }
      if (isFresh(p)) { score += 6; reasons.push("新着"); }

      return { post: p, score, ts: getCreatedTs(p), reasons };
    }).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.ts - a.ts;
    });

    const scoredOpen = buildScored(openCandidates);
    const scoredClosed = buildScored(closedCandidates);

    const picked = [];
    const pickedKeys = new Set();
    const authorCounts = new Map();
    let closedFallbackUsed = false;

    const canPick = (p) => {
      const authorKey = String(p?.author_key || p?.author_email || p?.author || p?.author_name || "").trim().toLowerCase() || "unknown";
      const count = authorCounts.get(authorKey) || 0;
      if (count >= 2) return false;
      return true;
    };

    const addPick = (p, meta = {}) => {
      const key = String(p?.key || "").trim();
      if (!key || pickedKeys.has(key)) return false;
      if (!canPick(p)) {
        debugExcluded.author_limit += 1;
        return false;
      }
      const authorKey = String(p?.author_key || p?.author_email || p?.author || p?.author_name || "").trim().toLowerCase() || "unknown";
      authorCounts.set(authorKey, (authorCounts.get(authorKey) || 0) + 1);
      picked.push(Object.assign({}, p, meta));
      pickedKeys.add(key);
      return true;
    };

    for (const item of scoredOpen) {
      if (!isFresh(item.post)) continue;
      if (picked.length >= 2) break;
      if (addPick(item.post)) {
        debugSelected.push({ key: item.post?.key, reasons: item.reasons });
      }
    }

    for (const item of scoredOpen) {
      if (picked.length >= 6) break;
      if (addPick(item.post)) {
        debugSelected.push({ key: item.post?.key, reasons: item.reasons });
      }
    }

    if (picked.length < 6 && scoredClosed.length) {
      const item = scoredClosed.find((entry) => canPick(entry.post));
      if (item) {
        closedFallbackUsed = true;
        addPick(item.post, { __ccClosedFallback: true });
        debugExcluded.closed += Math.max(0, scoredClosed.length - 1);
        debugSelected.push({ key: item.post?.key, reasons: item.reasons.concat(["受付終了枠"]) });
      } else {
        debugExcluded.closed += scoredClosed.length;
      }
    } else if (scoredClosed.length) {
      debugExcluded.closed += scoredClosed.length;
    }

    if (!picked.length) {
      relatedSection.hidden = true;
    } else {
      const catIconMap = {
        housing: "fa-house",
        jobs: "fa-briefcase",
        sell: "fa-tag",
        help: "fa-handshake",
        services: "fa-wand-magic-sparkles",
        community: "fa-people-group",
        events: "fa-calendar-days",
        school: "fa-graduation-cap"
      };
      relatedSection.hidden = false;
      relatedGrid.innerHTML = picked.slice(0, 6).map((p) => ccBuildListingCardHtml(p)).join("");

      if (debugEnabled && relatedDebug) {
        const excludeLines = [
          `hidden: ${debugExcluded.hidden}`,
          `deleted: ${debugExcluded.deleted}`,
          `self: ${debugExcluded.self}`,
          `banned: ${debugExcluded.banned}`,
          `closed: ${debugExcluded.closed}`,
          `author_limit: ${debugExcluded.author_limit}`
        ].join(" / ");
        const selectedLines = debugSelected.map((entry) => {
          const key = String(entry.key || "—");
          const reasons = Array.isArray(entry.reasons) ? entry.reasons.filter(Boolean) : [];
          return `${key}: ${reasons.join(", ") || "—"}`;
        });
        if (closedFallbackUsed) debugNotes.push("受付終了を1件だけ補完表示しています。");
        relatedDebug.hidden = false;
        relatedDebug.innerHTML = `
          <div class="detail-related-debug-title">関連投稿デバッグ</div>
          <div class="detail-related-debug-row">除外: ${escapeHtml(excludeLines)}</div>
          ${debugNotes.length ? `<div class="detail-related-debug-row">${escapeHtml(debugNotes.join(" "))}</div>` : ""}
          ${selectedLines.length ? `<div class="detail-related-debug-list">${selectedLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>` : ""}
        `;
      } else if (relatedDebug) {
        relatedDebug.hidden = true;
      }
    }
  }
}

// ダミーイベントDB（旧：互換/フォールバック用）
// ※本命は「クラシファイド投稿（cat=events）」から生成する
const todayLocal = new Date();
const y = todayLocal.getFullYear();
const m = String(todayLocal.getMonth() + 1).padStart(2, "0");
const d = String(todayLocal.getDate()).padStart(2, "0");
const todayStr = `${y}-${m}-${d}`;

const LEGACY_EVENT_DB = {
  [todayStr]: [{ title: "★ 今日のイベント: 夏祭り", url: "detail.html" }],
  "2024-06-01": [{ title: "Japan Market Summer", url: "detail.html" }]
};

// 現在の都市に応じたイベントDBを返す（UIは変えず、データ元だけ統一）
function getEventDBForArea(areaKey) {
  const k = normalizeAreaKey(areaKey) || ccGetSelectedCity() || "canada_all";
  try {
    const db = ccBuildEventDBFromPosts(k);
    // イベントは「クラシファイド投稿（cat=events）」が唯一の参照元
    // 選択都市にイベントが無い場合は空（= 強調なし）
    if (db && typeof db === "object") return db;
  } catch (e) { }
  // 例外時のみ旧互換（デモが真っ白にならないため）
  return LEGACY_EVENT_DB;
}

function ccSafeInit(label, fn) {
  try {
    if (typeof fn === "function") fn();
  } catch (e) {
    console.error(`[init:${label}]`, e);
  }
}

let currentAreaKey = "canada_all";
let currentTimeZone = "America/Toronto";
let calendarDate = new Date();

document.addEventListener("DOMContentLoaded", () => {
  try {
    const isPostPage = document.body?.classList?.contains("post-page")
      || document.body?.dataset?.ccPage === "post"
      || /post\.html/i.test(String(location.pathname || ""));
    if (isPostPage && !window.__ccPostStorageGuard) {
      window.__ccPostStorageGuard = true;
      const allowLocal = (key) => {
        if (!key) return false;
        if (key === "cc_post_draft_v1") return true;
        if (key.startsWith("cc_post_")) return true;
        return false;
      };
      const origLocalSet = localStorage.setItem.bind(localStorage);
      const origLocalRemove = localStorage.removeItem.bind(localStorage);
      const origLocalClear = localStorage.clear.bind(localStorage);
      localStorage.setItem = (k, v) => {
        const key = String(k || "");
        if (!allowLocal(key)) return;
        return origLocalSet(k, v);
      };
      localStorage.removeItem = (k) => {
        const key = String(k || "");
        if (!allowLocal(key)) return;
        return origLocalRemove(k);
      };
      localStorage.clear = () => { };

      const blockedSession = new Set([KEY_TEMP_AREA, KEY_TEMP_AREA_NAME, KEY_TEMP_AREA_TZ]);
      const origSessionSet = sessionStorage.setItem.bind(sessionStorage);
      const origSessionRemove = sessionStorage.removeItem.bind(sessionStorage);
      const origSessionClear = sessionStorage.clear.bind(sessionStorage);
      sessionStorage.setItem = (k, v) => {
        if (blockedSession.has(String(k || ""))) return;
        return origSessionSet(k, v);
      };
      sessionStorage.removeItem = (k) => {
        if (blockedSession.has(String(k || ""))) return;
        return origSessionRemove(k);
      };
      sessionStorage.clear = () => { };
    }
  } catch (e) { }

  ccSafeInit("ccMigrateMockSeedIfNeeded", ccMigrateMockSeedIfNeeded);
  ccSafeInit("restoreLoginFromWindowName", restoreLoginFromWindowName);
  ccSafeInit("normalizeMockLoginState", normalizeMockLoginState);
  ccSafeInit("normalizeDefaultCityStorage", normalizeDefaultCityStorage);
  ccSafeInit("initCityOptionMasters", initCityOptionMasters);
  ccSafeInit("ccInitI18nBoot", ccInitI18nBoot);
  ccSafeInit("initHeaderSafe", initHeaderSafe);
  ccSafeInit("initNavActive", initNavActive);
  ccSafeInit("initNoticeDropdown", initNoticeDropdown);
  ccSafeInit("updateChatUnreadFlag", updateChatUnreadFlag);
  ccSafeInit("seedTestAccountIfNeeded", seedTestAccountIfNeeded);
  ccSafeInit("ccEnsureSeedPosts", ccEnsureSeedPosts);
  ccSafeInit("ccSeedPostStatusMock", ccSeedPostStatusMock);
  ccSafeInit("ccSeedBoardThreads", ccSeedBoardThreads);
  ccSafeInit("initDebugOverlay", initDebugOverlay);
  ccSafeInit("attachLoginFormHook", attachLoginFormHook);
  ccSafeInit("initForgotPage", initForgotPage);
  ccSafeInit("initResetPage", initResetPage);
  ccSafeInit("initTestBadge", initTestBadge);
  ccSafeInit("guardAuthPages", guardAuthPages);
  ccSafeInit("guardAdminPage", guardAdminPage);
  ccSafeInit("guardBannedPages", guardBannedPages);
  ccSafeInit("initFormValidationHints", initFormValidationHints);
  ccSafeInit("ccResetAuthValidationStates", ccResetAuthValidationStates);

  ccSafeInit("attachAreaSelectListeners", attachAreaSelectListeners);
  ccSafeInit("ccInitSelectDropdowns", ccInitSelectDropdowns);
  ccSafeInit("applyPostDefaultCityAfterInit", () => {
    if (window.requestAnimationFrame) {
      requestAnimationFrame(() => applyPostDefaultCity(true));
    } else {
      setTimeout(() => applyPostDefaultCity(true), 0);
    }
  });

  // カテゴリ→ジャンル(詳細) 連動（list.html用）
  const catSelect = document.getElementById("category-select");
  const subSelect = document.getElementById("subcategory-select");
  if (catSelect && subSelect) {
    catSelect.addEventListener("change", function () {
      updateSubCategories(this.value, subSelect);
    });
    ccSafeInit("updateSubCategories", () => updateSubCategories(catSelect.value, subSelect));
  }

  // カレンダー
  if (document.getElementById("calendar-grid")) {
    const prevBtn = document.getElementById("prev-month");
    const nextBtn = document.getElementById("next-month");
    if (prevBtn) prevBtn.addEventListener("click", () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
    if (nextBtn) nextBtn.addEventListener("click", () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });

    ccSafeInit("renderCalendar", renderCalendar);

    document.addEventListener("click", (e) => {
      const popup = document.getElementById("event-popup");
      if (!popup) return;
      if (popup.classList.contains("hidden")) return;
      const cal = document.querySelector(".calendar-wrapper");
      if (cal && cal.contains(e.target)) return;
      popup.classList.add("hidden");
    });
  }

  // NEW既読（助け合い）
  ccSafeInit("applyNewReadStatus", applyNewReadStatus);

  // 時計
  ccSafeInit("updateClock", updateClock);
  setInterval(() => ccSafeInit("updateClock", updateClock), 1000);

  // チャット（プロトタイプ）
  ccSafeInit("initChatPrototype", initChatPrototype);
  ccSafeInit("initInquiryStartHook", initInquiryStartHook);
  ccSafeInit("initInquiryForm", initInquiryForm);
  ccSafeInit("initReplyForm", initReplyForm);
  ccSafeInit("initInquiryHistory", initInquiryHistory);
  ccSafeInit("initInquiryThreadPage", initInquiryThreadPage);
  ccSafeInit("setGlobalNavActiveByPage", setGlobalNavActiveByPage);
  ccSafeInit("initDetailPage", initDetailPage);
  ccSafeInit("initMypage", initMypage);
  ccSafeInit("initMypageSectionTabs", initMypageSectionTabs);
  ccSafeInit("initMypageNoticeCenter", initMypageNoticeCenter);
  ccSafeInit("initAdminPage", initAdminPage);
  ccSafeInit("initBoardBanGuard", initBoardBanGuard);
  ccSafeInit("applyRelativeTimesToCards", applyRelativeTimesToCards);
  ccSafeInit("applyPriceFormatToCards", applyPriceFormatToCards);
  ccSafeInit("applyMypageDealButtons", applyMypageDealButtons);
  const favKpi = document.getElementById("mypage-kpi-favorites");
  if (favKpi) {
    ccSafeInit("updateMypageFavoritesKpi", () => {
      const favSet = ccLoadFavorites();
      const posts = ccGetPosts();
      const count = posts.filter((post) => favSet.has(ccNormalizeFavKey(post?.key)) && !ccIsPostDeleted(post?.key)).length;
      favKpi.textContent = String(count);
    });
  }
  ccSafeInit("initMypageSettings", () => {
    if (!document.body || !document.body.classList.contains("mypage-page")) return;
    if (typeof window.initMypageSettings === "function") return window.initMypageSettings();
    if (typeof window.initMypageSettingsUI === "function") return window.initMypageSettingsUI();
    if (typeof window.initMypage === "function") return window.initMypage();
  });
  ccSafeInit("initDetailRecommendLayout", () => {
    const isDetail = /detail\.html/i.test(String(location.pathname || "")) || document.body?.classList?.contains("detail-page");
    if (!isDetail) return;
    if (typeof window.initDetailRecommendLayout === "function") {
      window.initDetailRecommendLayout();
    }
  });
});

// --------------------------------------------
// 横カテゴリ（global-nav）の active を「ページ名」で確実に決める
// ・index.html では「ホーム」だけ active
// ・list/detail/inquiry では「クラシファイド」だけ active
// ・他ページは index.html を既定（崩れ防止）
// ※HTML側のアイコン（fa-tags 等）は触らない。active の付け替えだけ行う。
// --------------------------------------------
function setGlobalNavActiveByPage() {
  try {
    // ----
    // 0) ページ側で明示されている場合はそれを最優先
    //    <body data-cc-page="home|classified"> を想定
    // ----
    const forced = String(document.body?.dataset?.ccPage || "").trim().toLowerCase();
    const forcedMode = (forced === "classified") ? "classified" : (forced === "home" ? "home" : "");
    const forcedNav = String(document.body?.dataset?.ccNavTarget || "").trim().toLowerCase();

    const nav = document.querySelector(".global-nav");
    if (!nav) return;

    const items = Array.from(nav.querySelectorAll("a.nav-item"));
    if (!items.length) return;

    // ----
    // 1) 現在ページの判定（file:// でも確実に）
    //    location.pathname がディレクトリ扱いになるケースがあるため、href からも抽出する
    // ----
    const href = String(location.href || "").toLowerCase();
    const path = String(location.pathname || "").toLowerCase();

    // href から最優先で判定（? # を除去して末尾の .html を拾う）
    const hrefNoQ = href.split("?")[0].split("#")[0];
    const m = hrefNoQ.match(/\b(index|list|detail|inquiry|inquiry-thread|reply|login|mypage|post|static)\.html\b/i);
    let file = (m && m[0]) ? String(m[0]).toLowerCase() : "";

    // pathname からのフォールバック
    if (!file) {
      const p = path.split("?")[0].split("#")[0];
      const last = p.split("/").filter(Boolean).pop() || "";
      if (/\.html$/.test(last)) file = last;
    }

    // それでも分からない場合はホーム扱い
    if (!file) file = "index.html";

    // classified / home の判定を“ファイル名”で固定
    const classifiedFiles = new Set(["list.html", "detail.html", "inquiry.html", "inquiry-thread.html", "reply.html"]);
    const homeFiles = new Set(["index.html", "login.html", "mypage.html", "post.html", "static.html"]);

    let targetMode = forcedMode;
    if (!targetMode) {
      if (classifiedFiles.has(file)) targetMode = "classified";
      else if (homeFiles.has(file)) targetMode = "home";
      else targetMode = "home";
    }

    // ----
    // 2) active を必ず 1つだけにする
    // ----
    items.forEach((a) => {
      a.classList.remove("active");
      a.removeAttribute("aria-current");
    });

    // ----
    // 3) 「ホーム」「クラシファイド」を“テキスト優先”で確実に特定
    //    （href の揺れや # を使っているケースでも壊れない）
    // ----
    const textOf = (a) => String(a.textContent || "").replace(/\s+/g, "").trim();
    const hrefFileOf = (a) => {
      const hrefRaw = String(a.getAttribute("href") || "").toLowerCase();
      if (!hrefRaw) return "";
      const clean = hrefRaw.split("?")[0].split("#")[0];
      const last = clean.split("/").filter(Boolean).pop() || "";
      return last;
    };

    const homeEl = items.find((a) => /ホーム/.test(textOf(a))) || items.find((a) => hrefFileOf(a) === "index.html") || null;
    const classifiedEl = items.find((a) => /クラシファイド/.test(textOf(a))) || items.find((a) => hrefFileOf(a) === "list.html") || (items.length >= 2 ? items[1] : null);
    const schoolEl = items.find((a) => /学校情報/.test(textOf(a))) || items.find((a) => /type=school/.test(a.getAttribute("href") || ""));
    const boardEl = items.find((a) => /掲示板/.test(textOf(a))) || items.find((a) => hrefFileOf(a) === "board.html");
    const linksEl = items.find((a) => /外部リンク/.test(textOf(a))) || items.find((a) => /type=links/.test(a.getAttribute("href") || ""));
    const tipsEl = items.find((a) => /お役立ち情報/.test(textOf(a))) || items.find((a) => /type=tips/.test(a.getAttribute("href") || ""));

    if (forcedNav) {
      const map = {
        home: homeEl,
        classified: classifiedEl,
        school: schoolEl,
        board: boardEl,
        links: linksEl,
        tips: tipsEl
      };
      const target = map[forcedNav];
      if (target) {
        target.classList.add("active");
        target.setAttribute("aria-current", "page");
        return;
      }
    }

    const activeEl = (targetMode === "classified") ? classifiedEl : homeEl;
    if (activeEl) {
      activeEl.classList.add("active");
      activeEl.setAttribute("aria-current", "page");
    }

    // ----
    // 4) アイコン統一：クラシファイドは常に fa-tags
    //    （HTML側が崩れても見た目を一定に保つ）
    // ----
    if (classifiedEl) {
      const icon = classifiedEl.querySelector("i");
      if (icon) {
        // fa-solid は維持しつつ、fa-tags へ寄せる
        icon.classList.remove("fa-list", "fa-table-list", "fa-th-list", "fa-rectangle-list", "fa-folder", "fa-folder-open", "fa-box", "fa-boxes-stacked");
        if (!icon.classList.contains("fa-solid")) icon.classList.add("fa-solid");
        icon.classList.add("fa-tags");
      }
    }
  } catch (e) { }
}

// --------------------------------------------
// ログインボタン（アカウント名表示＋マイページ/ログアウトメニュー）
// --------------------------------------------
function initAuthMenu() {
  const btn = document.getElementById("login-button") || document.querySelector(".btn-login");
  if (!btn) return;

  const accountNameRaw = getAccountName();
  const isLoggedIn = getLoggedInFlag() || !!getUserEmail();
  const postBtn = document.getElementById("post-button");

  if (postBtn && isCurrentUserBanned()) {
    postBtn.classList.add("is-disabled");
    postBtn.setAttribute("aria-disabled", "true");
    postBtn.addEventListener("click", (e) => {
      e.preventDefault();
      assertNotBanned("アカウントが停止されているため投稿できません。");
    });
  }

  // ログイン中：初回は「一時選択」をクリアしてアカウント既定へ戻す
  if (isLoggedIn) {
    if (window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/") || window.location.pathname.endsWith("mypage.html")) {
      clearTempAreaKey();
    }

    const accountDefault = getAccountDefaultAreaKey();
    if (accountDefault) {
      syncAllAreaSelects(accountDefault);
      try { changeArea(accountDefault); } catch (e) { }
    }
  }

  if (!isLoggedIn || !accountNameRaw) {
    btn.innerHTML = `<i class="fa-regular fa-circle-user"></i><span>ログイン・新規登録</span>`;
    btn.setAttribute("href", "login.html");
    btn.classList.remove("is-account");
    removeAuthDropdown();
    return;
  }

  const display = truncateForButton(accountNameRaw, 18);
  btn.innerHTML = `<i class="fa-solid fa-user-check"></i><span>${escapeHtml(display)}</span>`;
  btn.setAttribute("href", "#");
  btn.classList.add("is-account");

  btn.style.whiteSpace = "nowrap";
  btn.style.overflow = "hidden";
  btn.style.textOverflow = "ellipsis";

  let menu = document.getElementById("account-menu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "account-menu";
    menu.className = "account-menu";
    const session = authAdapter.getSession();
    const canSeeAdmin = session && isAdminEmail(session.email);
    const adminLink = canSeeAdmin
      ? `<a class="account-menu-item admin-link" id="menu-admin" href="admin.html">管理画面へ</a>`
      : "";
    menu.innerHTML = `
      <button type="button" class="account-menu-item" id="menu-mypage">マイページ</button>
      ${adminLink}
      <button type="button" class="account-menu-item" id="menu-logout">ログアウト</button>
    `;

    const wrapper = btn.parentElement;
    if (wrapper) wrapper.style.position = "relative";
    btn.parentNode.insertBefore(menu, btn.nextSibling);

    menu.style.position = "absolute";
    menu.style.top = "calc(100% + 8px)";
    menu.style.right = "0";
    menu.style.minWidth = "160px";
    menu.style.background = "#fff";
    menu.style.border = "1px solid rgba(0,0,0,.12)";
    menu.style.borderRadius = "12px";
    menu.style.boxShadow = "0 12px 30px rgba(0,0,0,.12)";
    menu.style.padding = "8px";
    menu.style.zIndex = "9999";
    menu.style.display = "none";

    const items = menu.querySelectorAll(".account-menu-item");
    items.forEach(it => {
      it.style.width = "100%";
      it.style.textAlign = "left";
      it.style.border = "0";
      it.style.background = "transparent";
      it.style.padding = "10px 12px";
      it.style.borderRadius = "10px";
      it.style.fontSize = "14px";
      it.style.cursor = "pointer";
      it.addEventListener("mouseenter", () => { it.style.background = "rgba(211,47,47,.08)"; });
      it.addEventListener("mouseleave", () => { it.style.background = "transparent"; });
    });

    const mypageBtn = document.getElementById("menu-mypage");
    const adminBtn = document.getElementById("menu-admin");
    const logoutBtn = document.getElementById("menu-logout");

    if (mypageBtn) {
      mypageBtn.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "mypage.html";
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        openGlobalConfirmModal({
          id: "cc-logout-modal",
          title: "ログアウトの確認",
          message: "ログアウトしますか？",
          confirmText: "ログアウトする",
          cancelText: "キャンセル",
          onConfirm: () => {
            clearLoginState();
            window.location.href = "index.html";
          }
        });
      });
    }

    document.addEventListener("click", () => {
      const m = document.getElementById("account-menu");
      if (m) m.style.display = "none";
    });

    menu.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const m = document.getElementById("account-menu");
    if (!m) return;
    m.style.display = (m.style.display === "block") ? "none" : "block";
  };

  const nameSpan = document.getElementById("mypage-account-name");
  if (nameSpan) nameSpan.textContent = accountNameRaw;

  // マイページの「デフォルト都市」は、ヘッダー一時選択ではなく“アカウント既定”を表示
  const citySpan = document.getElementById("mypage-default-city");
  if (citySpan) {
    const accountDefault = getAccountDefaultAreaKey() || "canada_all";
    citySpan.textContent = getDisplayAreaName(accountDefault);
  }

  const heroAvatar = document.querySelector(".hero-avatar");
  if (heroAvatar) {
    const profile = ccLoadCurrentProfile();
    const avatarSrc = (profile && profile.icon) ? String(profile.icon || "") : ccGetProfileIconByName(accountNameRaw);
    if (avatarSrc) {
      ccSetAvatarBackground(heroAvatar, avatarSrc);
      heroAvatar.classList.remove("is-empty");
      heroAvatar.innerHTML = "";
    } else {
      ccSetAvatarBackground(heroAvatar, "");
      heroAvatar.classList.add("is-empty");
      heroAvatar.innerHTML = '<i class="fa-regular fa-user"></i>';
    }
  }
}

// --------------------------------------------
// Header safe init (lang/area/account)
// --------------------------------------------
function initHeaderSafe() {
  const fallbackAuth = () => {
    const btn = document.getElementById("login-button") || document.querySelector(".btn-login");
    if (!btn) return;
    btn.innerHTML = `<i class="fa-regular fa-circle-user"></i><span>ログイン・新規登録</span>`;
    btn.setAttribute("href", "login.html");
    btn.classList.remove("is-account");
    removeAuthDropdown();
  };

  const getSelectedText = (selectEl) => {
    if (!selectEl) return "";
    const opt = selectEl.options[selectEl.selectedIndex];
    return opt ? (opt.textContent || "").trim() : "";
  };

  let areaKey = "canada_all";
  let langKey = "jp";
  try {
    let stored = "";
    try { stored = localStorage.getItem(KEY_LANG) || ""; } catch (e) { }
    langKey = normalizeLangKey(stored || "jp");
  } catch (e) { }

  try { initLangMenu(); } catch (e) { console.error("[init:header:lang]", e); }
  try { initAuthMenu(); } catch (e) { console.error("[init:header:auth]", e); fallbackAuth(); }
  try {
    const isPostPage = document.body?.classList?.contains("post-page")
      || document.body?.dataset?.ccPage === "post"
      || /post\.html/i.test(String(location.pathname || ""));
    areaKey = isPostPage ? (getDefaultCityKey() || areaKey) : (getInitialAreaKey() || areaKey);
  } catch (e) { console.error("[init:header:area-key]", e); }
  try { syncAllAreaSelects(areaKey); } catch (e) { console.error("[init:header:area-sync]", e); }
  try {
    const isPostPage = document.body?.classList?.contains("post-page")
      || document.body?.dataset?.ccPage === "post"
      || /post\.html/i.test(String(location.pathname || ""));
    if (!isPostPage) changeArea(areaKey);
  } catch (e) { console.error("[init:header:area-change]", e); }
  try { initHeaderCustomDropdowns(); } catch (e) { console.error("[init:header:dropdowns]", e); }

  const areaValue = document.querySelector('[data-cc-dd-value="area"]');
  const langValue = document.querySelector('[data-cc-dd-value="lang"]');
  const areaSelect = document.getElementById("area-select");
  const langSelect = document.getElementById("lang-select");
  if (areaValue) {
    const text = getSelectedText(areaSelect) || getDisplayAreaName(areaKey) || "全カナダ";
    areaValue.textContent = text;
  }
  if (langValue) {
    const text = getSelectedText(langSelect) || (langKey === "jp" ? "JP" : langKey.toUpperCase());
    langValue.textContent = text;
  }
}

function initNavActive() {
  const navItems = Array.from(document.querySelectorAll(".global-nav .nav-item"));
  if (!navItems.length) return;
  navItems.forEach((item) => {
    item.classList.remove("active");
    item.removeAttribute("aria-current");
  });

  const bodyTarget = document.body?.dataset?.ccNavTarget;
  let target = bodyTarget ? String(bodyTarget) : "";
  if (!target) {
    const path = String(window.location.pathname || "").toLowerCase();
    if (path.includes("board")) target = "board";
    else if (path.includes("list") || path.includes("detail") || path.includes("post")) target = "list";
    else if (path.includes("static")) {
      const type = String(new URL(window.location.href).searchParams.get("type") || "");
      if (type === "school") target = "school";
      else if (type === "links") target = "links";
      else if (type === "tips") target = "tips";
      else target = "school";
    } else target = "home";
  }

  const matchByHref = (needle) => navItems.find((item) => String(item.getAttribute("href") || "").includes(needle));
  let activeItem = null;
  if (target === "home") activeItem = matchByHref("index.html");
  if (target === "list") activeItem = matchByHref("list.html");
  if (target === "board") activeItem = matchByHref("board.html");
  if (target === "school") activeItem = matchByHref("static.html?type=school");
  if (target === "links") activeItem = matchByHref("static.html?type=links");
  if (target === "tips") activeItem = matchByHref("static.html?type=tips");
  if (activeItem) {
    activeItem.classList.add("active");
    activeItem.setAttribute("aria-current", "page");
  }
}

function initFormValidationHints() {
  const forms = document.querySelectorAll("form.cc-validate");
  if (!forms.length) return;
  forms.forEach((form) => {
    if (form.dataset.ccValidateBound === "1") return;
    form.dataset.ccValidateBound = "1";
    const fields = Array.from(form.querySelectorAll("input, select, textarea"));
    const getRow = (el) => el.closest(".form-row") || el.closest(".field") || el.parentElement;
    form.classList.remove("is-submitted");
    fields.forEach((field) => {
      const row = getRow(field);
      if (row) row.classList.remove("is-invalid", "is-touched");
    });
    const updateField = (el) => {
      const row = getRow(el);
      if (!row) return;
      const invalid = !el.checkValidity();
      row.classList.toggle("is-invalid", invalid && (row.classList.contains("is-touched") || form.classList.contains("is-submitted")));
    };
    fields.forEach((field) => {
      field.addEventListener("blur", () => {
        const row = getRow(field);
        if (row) row.classList.add("is-touched");
        updateField(field);
      });
      field.addEventListener("input", () => updateField(field));
      field.addEventListener("change", () => updateField(field));
    });
    form.addEventListener("submit", () => {
      form.classList.add("is-submitted");
      fields.forEach((field) => updateField(field));
    });
  });
}

function ccResetAuthValidationStates() {
  const forms = [
    document.getElementById("login-form"),
    document.getElementById("signup-form"),
    document.getElementById("forgot-form")
  ].filter(Boolean);
  forms.forEach((form) => {
    form.classList.remove("is-submitted");
    form.querySelectorAll(".form-row, .field").forEach((row) => {
      row.classList.remove("is-invalid", "is-touched");
    });
    form.querySelectorAll(".field-error, .cc-form-error").forEach((el) => {
      const textEl = el.querySelector(".cc-error-text");
      if (textEl) textEl.textContent = "";
      else el.textContent = "";
      el.hidden = true;
    });
    form.querySelectorAll(".warn-icon, .cc-warn, .cc-warn-icon, [data-warn]").forEach((el) => {
      el.hidden = true;
      el.style.display = "none";
    });
  });
}

// --------------------------------------------
// ジャンル(詳細) 更新
// --------------------------------------------
function updateSubCategories(catKey, subSelectElement) {
  if (!subSelectElement) return;
  subSelectElement.innerHTML = "";
  const placeholderText = subSelectElement.dataset.placeholder || "ジャンルを選択";

  const normalized = String(catKey || "").toLowerCase();
  if (!categories[catKey] && !categories[normalized]) {
    const op = document.createElement("option");
    op.textContent = "カテゴリを選択してください";
    op.value = "";
    subSelectElement.appendChild(op);
    subSelectElement.disabled = true;
    ccResetSelectDropdown(subSelectElement);
    const emptyWrap = subSelectElement.closest(".cc-select");
    if (emptyWrap) ccInitSelectDropdowns(emptyWrap);
    return;
  }
  const key = categories[catKey] ? catKey : normalized;
  const base = document.createElement("option");
  base.value = "";
  base.textContent = placeholderText;
  base.disabled = true;
  base.selected = true;
  subSelectElement.appendChild(base);
  (categories[key].subs || []).forEach((sub) => {
    const op = document.createElement("option");
    op.value = sub;
    op.textContent = sub;
    subSelectElement.appendChild(op);
  });
  subSelectElement.disabled = false;
  ccResetSelectDropdown(subSelectElement);
  const wrap = subSelectElement.closest(".cc-select");
  if (wrap) ccInitSelectDropdowns(wrap);
}

// --------------------------------------------
// エリア切替（重要：保存ルールを分離）
// --------------------------------------------
function changeArea(areaKey, opts = {}) {
  const normalizedKey = normalizeAreaKey(areaKey) || areaKey || "canada_all";

  currentAreaKey = normalizedKey;
  currentTimeZone = getAreaTimeZone(normalizedKey);

  syncAllAreaSelects(normalizedKey);
  syncAreaHierarchyUI(normalizedKey);
  syncTimeZoneSelect(normalizedKey);
  syncHeaderAreaOptionLabel();

  const label = document.getElementById("current-area-title");
  if (label) {
    const storedName = getStoredCustomAreaName() || "";
    if (normalizedKey === "other_custom" || normalizedKey === "free" || normalizedKey === "other") {
      label.textContent = storedName || getDisplayAreaName(normalizedKey);
    } else {
      label.textContent = getDisplayAreaName(normalizedKey);
    }
  }

  const clockBadge = document.getElementById("clock-area");
  if (clockBadge) clockBadge.textContent = (normalizedKey === "other_custom") ? "CUSTOM" : (normalizedKey || "canada_all").toUpperCase();

  const isPostPage = document.body?.classList?.contains("post-page")
    || document.body?.dataset?.ccPage === "post"
    || /post\.html/i.test(String(location.pathname || ""));
  const shouldPersist = opts.persist !== false && !isPostPage;
  if (shouldPersist) {
    const isLoggedInNow = getLoggedInFlag() || !!getUserEmail();
    if (isLoggedInNow) {
      setTempAreaKey(normalizedKey);
      if (normalizedKey === "other_custom") {
        setTempCustomArea(getStoredCustomAreaName(), getStoredCustomAreaTZ());
      } else {
        clearTempCustomArea();
      }
    } else {
      setGuestAreaKey(normalizedKey);
      if (normalizedKey === "other_custom") {
        setGuestCustomArea(getStoredCustomAreaName(), getStoredCustomAreaTZ());
      }
    }
  }

  updateClock();
  if (document.getElementById("calendar-grid")) renderCalendar();
  filterListings(normalizedKey);
}

// --------------------------------------------
// 時計（TZ略称）
// --------------------------------------------
function getTZShortName(timeZone) {
  if (timeZone === "Asia/Tokyo") return "JST";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
      hour12: false
    }).formatToParts(new Date());
    const tzPart = parts.find(p => p.type === "timeZoneName");
    if (tzPart && tzPart.value) return tzPart.value.replace("GMT", "UTC");
  } catch (e) { }
  return "";
}

function updateClock() {
  const clockTime = document.getElementById("clock-time");
  const clockDate = document.getElementById("clock-date");
  if (!clockTime) return;

  const now = new Date();

  if (currentAreaKey === "canada_all" || currentAreaKey === "other" || currentAreaKey === ADMIN_ALL_AREA_KEY) {
    const baseTZ = "America/Toronto";
    const tzLabel = getTZShortName(baseTZ);
    clockTime.innerHTML = `--:-- <span class="tz-abbr">${tzLabel}</span>`;
    if (clockDate) {
      const dateStr = new Intl.DateTimeFormat("en-US", {
        timeZone: baseTZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short"
      }).format(now);
      clockDate.textContent = dateStr;
    }
    return;
  }

  const tzLabel = getTZShortName(currentTimeZone);
  const timeStr = new Intl.DateTimeFormat("ja-JP", {
    timeZone: currentTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);

  clockTime.innerHTML = `${timeStr} <span class="tz-abbr">${tzLabel}</span>`;

  if (clockDate) {
    const dateStr = new Intl.DateTimeFormat("en-US", {
      timeZone: currentTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    }).format(now);
    clockDate.textContent = dateStr;
  }
}

// --------------------------------------------
// カレンダー
// --------------------------------------------
function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  if (!grid) return;

  grid.innerHTML = "";

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const title = document.getElementById("calendar-title");
  if (title) title.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const baseTZ = (currentAreaKey === "canada_all" || currentAreaKey === "other" || currentAreaKey === ADMIN_ALL_AREA_KEY) ? "America/Toronto" : currentTimeZone;
  const now = new Date();
  const nowYMD = new Intl.DateTimeFormat("en-CA", {
    timeZone: baseTZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("div");
    blank.className = "cal-blank";
    grid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "cal-day";
    cell.textContent = String(day);

    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (dateStr === nowYMD) cell.classList.add("today");

    const db = getEventDBForArea(currentAreaKey);
    if (db[dateStr] && db[dateStr].length) {
      // ドットは使わず「薄い強調」だけで表現（CSS側で cal-day に効く想定）
      cell.classList.add("has-event");
      cell.addEventListener("click", (e) => {
        e.stopPropagation();
        showEventPopup(db[dateStr], dateStr);
      });
    }
    grid.appendChild(cell);
  }
}

function showEventPopup(events, dateStr) {
  const popup = document.getElementById("event-popup");
  const container = document.getElementById("event-details");
  if (!popup || !container) return;

  const ymd = ccNormalizeYMD(dateStr);

  container.innerHTML = "";
  (events || []).forEach((evt, i) => {
    const link = document.createElement("a");
    // file:// でも確実に解決するよう相対パスを明示
    link.href = `./static.html?type=event&date=${encodeURIComponent(ymd)}&i=${encodeURIComponent(String(i))}`;
    link.className = "event-link";
    link.textContent = String(evt?.title || "");
    container.appendChild(link);
  });

  popup.classList.remove("hidden");
}

// --------------------------------------------
// NEW既読（助け合い）
// --------------------------------------------
function applyNewReadStatus() {
  const helpLink = document.getElementById("link-help");
  const helpBadge = document.getElementById("badge-help");
  if (!helpLink || !helpBadge) return;

  const count = helpBadge.getAttribute("data-count") || "38";

  const lastSeen = parseInt(localStorage.getItem("help_last_seen_version") || "0", 10);
  const newAvailable = lastSeen < HELP_FEED_VERSION;

  if (newAvailable) {
    helpLink.classList.add("has-new");
    helpBadge.textContent = "New";
    helpBadge.classList.remove("count");
    helpBadge.classList.add("badge-new");
  } else {
    helpLink.classList.remove("has-new");
    helpBadge.textContent = count;
    helpBadge.classList.remove("badge-new");
    helpBadge.classList.add("count");
  }

  helpLink.addEventListener("click", (e) => {
    if (newAvailable) {
      localStorage.setItem("help_last_seen_version", String(HELP_FEED_VERSION));
      e.preventDefault();
      window.location.href = "list.html?cat=help&onlyNew=1";
    }
  });
}

// --------------------------------------------
// ホームカード表示フィルタ
// --------------------------------------------
function filterListings(areaKey) {
  const cards = document.querySelectorAll(".card");
  if (!cards || !cards.length) return;

  cards.forEach(card => {
    const cardArea = card.getAttribute("data-area");
    if (!cardArea) return;

    if ((areaKey === ADMIN_ALL_AREA_KEY && isAdmin()) || areaKey === "canada_all" || areaKey === "other") {
      if (areaKey === ADMIN_ALL_AREA_KEY && isAdmin()) {
        card.style.display = "block";
        return;
      }
      card.style.display = (cardArea !== "japan") ? "block" : "none";
      return;
    }
    if (areaKey === "japan") {
      card.style.display = (cardArea === "japan") ? "block" : "none";
      return;
    }
    card.style.display = (cardArea === areaKey) ? "block" : "none";
  });
}

// --------------------------------------------
// チャット（プロトタイプ）
// --------------------------------------------
function initChatPrototype() {
  const list = document.querySelector(".conversation-list");
  const windowPane = document.querySelector(".chat-window-pane");
  const messagesEl = document.querySelector(".chat-messages");
  const inputBox = document.querySelector(".chat-input-box textarea");
  const sendBtn = document.querySelector(".chat-input-box .btn-send");

  if (!list || !windowPane || !messagesEl || !inputBox || !sendBtn) return;

  // ----
  // タブUI（自分の投稿 / 問い合わせた投稿）
  // ----
  const KEY_CHAT = "cc_chat_threads_v1";
  const KEY_ACTIVE_TAB = "cc_chat_active_tab"; // sessionStorage

  const KEY_POST_DEAL = "cc_post_deal_status_v1"; // localStorage: { [postKey]: { done: boolean, updated_at: iso } }
  const KEY_CHAT_ARCHIVE = CC_CHAT_ARCHIVE_KEY;

  function loadArchiveDB() {
    try {
      const raw = localStorage.getItem(KEY_CHAT_ARCHIVE);
      const db = raw ? JSON.parse(raw) : {};
      return (db && typeof db === "object") ? db : {};
    } catch (e) {
      return {};
    }
  }

  function saveArchiveDB(db) {
    try { localStorage.setItem(KEY_CHAT_ARCHIVE, JSON.stringify(db || {})); } catch (e) { }
  }

  function isArchived(convoId) {
    if (!convoId) return false;
    const db = loadArchiveDB();
    return !!(db[convoId] || db[String(convoId).toLowerCase()]);
  }

  function setArchived(convoId, archived) {
    if (!convoId) return;
    const db = loadArchiveDB();
    if (archived) {
      db[convoId] = true;
      db[String(convoId).toLowerCase()] = true;
    } else {
      delete db[convoId];
      delete db[String(convoId).toLowerCase()];
    }
    saveArchiveDB(db);
  }

  let showArchived = false;
  let currentChatKey = "";

  function safeKey(v) {
    return String(v || "").trim().toLowerCase();
  }

  function loadPostDealDB() {
    try {
      const raw = localStorage.getItem(KEY_POST_DEAL);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === "object") ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function savePostDealDB(db) {
    try { localStorage.setItem(KEY_POST_DEAL, JSON.stringify(db || {})); } catch (e) { }
  }

  function setPostDealDone(postKey, done) {
    const raw = String(postKey || "").trim();
    if (!raw) return;
    const k = safeKey(raw);
    const db = loadPostDealDB();
    db[raw] = { done: !!done, updated_at: new Date().toISOString() };
    db[k] = { done: !!done, updated_at: new Date().toISOString() };
    savePostDealDB(db);
    try {
      localStorage.setItem(`${CC_POST_STATUS_KEY_PREFIX}${raw}`, done ? "completed" : "active");
      localStorage.setItem(`${CC_POST_STATUS_KEY_PREFIX}${k}`, done ? "completed" : "active");
    } catch (e) { }
    try {
      const list = ccLoadUserPosts();
      const idx = list.findIndex(p => String(p?.key || "") === raw);
      if (idx >= 0) {
        list[idx] = Object.assign({}, list[idx], {
          status: done ? "completed" : "active",
          completed_at: done ? new Date().toISOString() : ""
        });
        ccSaveUserPosts(list);
      }
    } catch (e) { }
  }

  function isPostDealDone(postKey) {
    const raw = String(postKey || "").trim();
    if (!raw) return false;
    const k = safeKey(raw);
    const db = loadPostDealDB();
    return !!(db?.[raw]?.done || db?.[k]?.done);
  }

  function stripRefPrefix(ref) {
    const r = String(ref || "").trim();
    return r.replace(/^（[^）]+）\s*/g, "");
  }

  function resolvePostKeyByTitle(rawTitle) {
    const title = String(rawTitle || "").trim().toLowerCase();
    if (!title) return "";
    const dev = window.CanadaClassiDev || {};
    const posts = (dev.ccGetPosts && dev.ccGetPosts()) || [];
    const exact = posts.find(p => String(p?.title || "").trim().toLowerCase() === title);
    if (exact && exact.key) return String(exact.key);
    const partial = posts.find(p => {
      const t = String(p?.title || "").trim().toLowerCase();
      return t.includes(title) || title.includes(t);
    });
    return partial && partial.key ? String(partial.key) : "";
  }

  function buildPostKeyFromMeta(meta, roleForKey) {
    // post_key があれば最優先
    const directRaw = String(meta?.post_key || "").trim();
    if (directRaw) {
      const dev = window.CanadaClassiDev || {};
      const directPost = (dev.ccGetPostByKey && dev.ccGetPostByKey(directRaw)) || null;
      if (directPost && directPost.key) return String(directPost.key);
    }

    const titleRaw = stripRefPrefix(meta?.ref || "");
    const matched = resolvePostKeyByTitle(titleRaw);
    if (matched) return matched;

    const title = safeKey(titleRaw);
    if (!title) return "";

    // owner側は「自分の投稿」なので、ログインユーザーで束ねる（同名タイトル衝突の緩和）
    const role = normalizeRole(roleForKey || meta?.role) || "owner";
    if (role === "owner") {
      const me = safeKey(getUserEmail());
      return me ? `owner:${me}|t:${title}` : `owner:me|t:${title}`;
    }

    // inquiry側は seller 名も入れる（同タイトルの衝突緩和）
    const seller = safeKey(meta?.name || "");
    return seller ? `inq:s:${seller}|t:${title}` : `inq:t:${title}`;
  }

  // draft（メッセージ未送信の新規問い合わせ）
  function isDraftThread(thread) {
    if (!thread) return false;
    if (thread.draft === true) return true;
    const msgs = Array.isArray(thread.messages) ? thread.messages : [];
    return msgs.length === 0;
  }

  function deleteThreadById(convoId) {
    if (!convoId) return;
    const db = loadDB();
    if (db && db[convoId]) {
      delete db[convoId];
      saveDB(db);
    }

    // DOMからも消す
    const el = list.querySelector(`.convo-item[data-convo-id="${convoId}"]`) || list.querySelector(`.convo-item[data-convoId="${convoId}"]`) || list.querySelector(`.convo-item[data-convo-id='${convoId}']`) || list.querySelector(`.convo-item[data-convoId='${convoId}']`);
    if (el && el.parentNode) el.parentNode.removeChild(el);

    // index も掃除（問い合わせ側のみ）
    try {
      const KEY_INQ_INDEX = "cc_inquiry_index_v1";
      const rawIdx = localStorage.getItem(KEY_INQ_INDEX);
      const idx = rawIdx ? JSON.parse(rawIdx) : {};
      if (idx && typeof idx === "object") {
        Object.keys(idx).forEach(k => {
          if (idx[k] === convoId) delete idx[k];
        });
        localStorage.setItem(KEY_INQ_INDEX, JSON.stringify(idx));
      }
    } catch (e) { }
  }

  // 外部ページから遷移してきた場合の戻り先
  function getChatReturnUrl() {
    try {
      const u = new URL(location.href);
      const r = u.searchParams.get("return");
      return r ? String(r) : "";
    } catch (e) {
      return "";
    }
  }

  // スレッドに保存されている戻り先（最優先）
  function getReturnUrlFromThread(thread) {
    try {
      const u = String(thread?.meta?.return_url || thread?.meta?.returnUrl || "").trim();
      return u;
    } catch (e) {
      return "";
    }
  }

  // 遷移元URLを解決（thread.meta.return_url > URL param return > fallback）
  function resolveReturnUrl(thread) {
    const fromThread = getReturnUrlFromThread(thread);
    if (fromThread) return fromThread;
    const fromParam = getChatReturnUrl();
    if (fromParam) return fromParam;
    return "detail.html";
  }

  // popstate 対策用：現在ページに留まるための state を積む
  function pushStayStateOnce() {
    try {
      const cur = history.state || {};
      if (cur && cur.__cc_stay === true) return;
      history.pushState({ ...(cur || {}), __cc_stay: true }, "", location.href);
    } catch (e) { }
  }

  function ensureTabsUI() {
    if (document.getElementById("cc-chat-tabs")) return;

    const tabs = document.createElement("div");
    tabs.id = "cc-chat-tabs";
    tabs.className = "cc-chat-tabs";
    tabs.innerHTML = `
      <button type="button" class="cc-chat-tab" data-role="owner" id="cc-tab-owner">自分の投稿</button>
      <button type="button" class="cc-chat-tab" data-role="inquiry" id="cc-tab-inquiry">問い合わせた投稿</button>
    `;

    tabs.style.display = "flex";
    tabs.style.gap = "8px";
    tabs.style.padding = "10px 10px 6px";
    tabs.style.borderBottom = "1px solid rgba(0,0,0,.08)";

    const btns = Array.from(tabs.querySelectorAll(".cc-chat-tab"));
    btns.forEach((b) => {
      b.style.flex = "1";
      b.style.border = "1px solid rgba(0,0,0,.10)";
      b.style.borderRadius = "999px";
      b.style.padding = "8px 10px";
      b.style.background = "#fff";
      b.style.cursor = "pointer";
      b.style.fontSize = "13px";
      b.style.lineHeight = "1";
      b.style.whiteSpace = "nowrap";
    });

    const host = document.getElementById("cc-post-tabs");
    if (host) {
      host.appendChild(tabs);
    } else {
      list.insertBefore(tabs, list.firstChild);
    }
  }

  function setTabActiveStyles(activeRole) {
    const ownerBtn = document.getElementById("cc-tab-owner");
    const inquiryBtn = document.getElementById("cc-tab-inquiry");
    const makeActive = (btn, active) => {
      if (!btn) return;
      if (active) {
        btn.style.background = "rgba(211,47,47,.10)";
        btn.style.borderColor = "rgba(211,47,47,.35)";
        btn.style.color = "#b71c1c";
        btn.style.fontWeight = "700";
      } else {
        btn.style.background = "#fff";
        btn.style.borderColor = "rgba(0,0,0,.10)";
        btn.style.color = "";
        btn.style.fontWeight = "600";
      }
    };

    makeActive(ownerBtn, activeRole === "owner");
    makeActive(inquiryBtn, activeRole === "inquiry");
  }

  function updateArchiveTabsUI() {
    const buttons = document.querySelectorAll("[data-cc-archive-toggle]");
    buttons.forEach((btn) => {
      const mode = btn.getAttribute("data-cc-archive-toggle");
      const active = (mode === "archived") === showArchived;
      btn.classList.toggle("is-active", active);
    });
  }

  let activePostKey = "";
  let activeConvoId = "";

  function getPostEntriesByRole(role) {
    const db = loadDB();
    const entries = [];
    const seen = new Set();
    const dev = window.CanadaClassiDev || {};
    if (role === "owner") {
      const all = (dev.ccGetPosts && dev.ccGetPosts()) || [];
      const me = (typeof getAccountName === "function" && getAccountName()) ? String(getAccountName()) : "";
      const ownerThreadKeys = new Set();
      Object.keys(db || {}).forEach((cid) => {
        const th = db[cid];
        const r = normalizeRole(th?.meta?.role) || "owner";
        if (r !== "owner") return;
        const key = buildPostKeyFromMeta(th?.meta || {}, r);
        if (key) ownerThreadKeys.add(String(key));
      });

      all.forEach((post) => {
        const postKey = post?.key ? String(post.key) : "";
        if (!postKey || seen.has(postKey)) return;
        if (ccIsPostHidden(postKey) && !isAdmin()) return;
        if (ccIsPostDeleted(postKey)) return;
        const isOwner = me && String(post?.author || "").trim() === me;
        const hasThread = ownerThreadKeys.has(postKey);
        if (!isOwner && !hasThread) return;
        const info = (dev.ccGetPostStatusInfo && dev.ccGetPostStatusInfo(post)) || null;
        if (info && info.status === "cancelled") return;
        seen.add(postKey);
        const title = ccGetPostDisplayTitle(post);
        const price = formatPostPrice(post);
        const area = formatAreaText(post);
  const catKey = ccNormalizeCategoryKey(post?.cat);
        const catLabel = ccGetCategoryLabel(post?.cat) || "";
        const catIconMap = {
          housing: "fa-house",
          jobs: "fa-briefcase",
          sell: "fa-tag",
          help: "fa-handshake",
          services: "fa-wand-magic-sparkles",
          community: "fa-people-group",
          events: "fa-calendar-days",
          school: "fa-graduation-cap"
        };
        const catIcon = catIconMap[String(catKey || "").toLowerCase()] || "fa-tag";
        const dateText = post?.created_at ? formatDateForView(post.created_at, { mode: "public" }) : "";
        const meta = catLabel || "";
        const statusKey = info?.status || "active";
        const status = info
          ? (info.status === "completed" ? info.labels.completed : info.labels.active)
          : "受付中";
        const thumb = (Array.isArray(post?.images) && post.images[0]) ? post.images[0] : "";
        entries.push({ key: postKey, title, meta, status, statusKey, price, dateText, thumb, created_at: post?.created_at || "", catIcon, area });
      });
      return entries.sort((a, b) => {
        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
    }

    Object.keys(db || {}).forEach((convoId) => {
      const th = db[convoId];
      if (!th) return;
      const r = normalizeRole(th?.meta?.role) || "owner";
      if (r !== role) return;
      const postKey = buildPostKeyFromMeta(th.meta || {}, r);
      if (!postKey || seen.has(postKey)) return;
      if (ccIsPostHidden(postKey) && !isAdmin()) return;
      seen.add(postKey);
      const post = (dev.ccGetPostByKey && dev.ccGetPostByKey(postKey)) || null;
      if (post && ccIsPostDeleted(post?.key)) return;
      const title = post
        ? ccGetPostDisplayTitle(post)
        : ccGetPostDisplayTitle({ title: stripRefPrefix(th?.meta?.ref || ""), key: postKey, isMock: ccIsThreadMock(th), source: th?.source }, "");
      const fallbackCat = th?.meta?.category || th?.meta?.cat || "";
      const fallbackCity = th?.meta?.city || th?.meta?.area || "";
      const fallbackPrice = th?.meta?.price || "";
      const fallbackDate = th?.meta?.created_at || th?.created_at || "";
      const price = post ? formatPostPriceForDisplay(post) : (fallbackPrice ? formatCardPrice(fallbackPrice, fallbackCat) : "");
      const area = post ? formatAreaText(post) : (getDisplayAreaName(fallbackCity) || fallbackCity || "");
      const catLabel = (post && ccGetCategoryLabel(post.cat))
        ? ccGetCategoryLabel(post.cat)
        : (ccGetCategoryLabel(fallbackCat) || "");
      const catIconMap = {
        housing: "fa-house",
        jobs: "fa-briefcase",
        sell: "fa-tag",
        help: "fa-handshake",
        services: "fa-wand-magic-sparkles",
        community: "fa-people-group",
        events: "fa-calendar-days",
        school: "fa-graduation-cap"
      };
      const catIcon = catIconMap[String((post?.cat || fallbackCat) || "").toLowerCase()] || "fa-tag";
      const dateText = post?.created_at
        ? formatDateForView(post.created_at, { mode: "public" })
        : (fallbackDate ? formatDateForView(fallbackDate, { mode: "public" }) : "");
      const meta = catLabel || "";
      const info = post ? ccGetPostStatusInfo(post) : null;
      const statusInfo = info || null;
      const statusKey = statusInfo?.status || "active";
      const status = statusInfo
        ? (statusInfo.status === "completed" ? statusInfo.labels.completed : statusInfo.labels.active)
        : (th?.meta?.status_label || "受付中");
      if (statusInfo && statusInfo.status === "cancelled") return;
      const thumb = (post && Array.isArray(post.images) && post.images[0]) ? post.images[0] : (th?.meta?.image || "");
      entries.push({ key: postKey, title, meta, status, statusKey, price, dateText, thumb, created_at: post?.created_at || fallbackDate || "", catIcon, area });
    });
    return entries.sort((a, b) => {
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }

  function getUnreadPostKeySet(role) {
    const db = loadDB();
    const targetRole = (role === "inquiry") ? "inquiry" : "owner";
    const set = new Set();

    Object.keys(db || {}).forEach((convoId) => {
      const th = db[convoId];
      if (!th || isDraftThread(th) || !th.unread) return;
      const r = normalizeRole(th?.meta?.role) || "owner";
      if (r !== targetRole) return;
      const postKey = buildPostKeyFromMeta(th?.meta || {}, r);
      if (postKey) set.add(safeKey(postKey));
    });

    return set;
  }

  function renderPostList(role) {
    const listEl = document.getElementById("cc-post-list");
    if (!listEl) return;
    const entries = getPostEntriesByRole(role);
    const unreadSet = getUnreadPostKeySet(role);
    if (!entries.length) {
      const emptyText = role === "inquiry"
        ? "問い合わせ中の投稿はありません。"
        : "メッセージ受付中の投稿はありません。";
      listEl.innerHTML = `<div class="post-item post-empty">${emptyText}</div>`;
      activePostKey = "";
      activeConvoId = "";
      setChatEmptyState(true);
      return;
    }
    if (!activePostKey || !entries.some(e => safeKey(e.key) === safeKey(activePostKey))) {
      activePostKey = entries[0].key;
    }
    listEl.innerHTML = entries.map((entry) => {
      const active = safeKey(entry.key) === safeKey(activePostKey);
      const hasUnread = unreadSet.has(safeKey(entry.key));
      const thumb = entry.thumb ? `style="background-image:url('${escapeHTML(entry.thumb)}')"` : "";
      const statusClass = entry.statusKey === "completed" ? "is-completed" : "";
      return `
        <button class="post-item ${active ? "active" : ""} ${hasUnread ? "has-unread" : ""}" type="button" data-post-key="${escapeHTML(entry.key)}">
          <div class="post-item-thumb" ${thumb}></div>
          <div class="post-item-body">
            <div class="post-item-title">${escapeHTML(entry.title || "投稿")}</div>
            <div class="post-item-meta">
              <span class="post-item-cat"><i class="fa-solid ${escapeHTML(entry.catIcon || "fa-tag")}" aria-hidden="true"></i><span>${escapeHTML(entry.meta || "")}</span></span>
            </div>
            <div class="post-item-sub">
              <span class="post-item-location"><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>${escapeHTML(entry.area || "—")}</span></span>
              <span class="post-item-price"><i class="fa-solid fa-tag" aria-hidden="true"></i><span>${escapeHTML(entry.price || "—")}</span></span>
            </div>
            <div class="post-item-status-row">
              <span class="post-item-status ${statusClass}">${escapeHTML(entry.status)}</span>
              <span class="post-item-date"><i class="fa-regular fa-clock" aria-hidden="true"></i><span>${escapeHTML(entry.dateText || "—")}</span></span>
            </div>
          </div>
        </button>
      `;
    }).join("");

    listEl.querySelectorAll(".post-item[data-post-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activePostKey = btn.getAttribute("data-post-key") || "";
        listEl.querySelectorAll(".post-item").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        getAllConvoEls().forEach((el) => el.classList.remove("active"));
        activeConvoId = "";
        setChatEmptyState(true);
        applyPostFilter(role);
        renderSelectedPostHeaderOnly();
        syncChatEmptyState();
        scrollToPaneIfMobile("#chat-convo-pane");
      });
    });
  }

  function refreshPostUnreadBadges(role) {
    const unreadSet = getUnreadPostKeySet(role);
    const items = document.querySelectorAll("#cc-post-list .post-item[data-post-key]");
    items.forEach((el) => {
      const key = el.getAttribute("data-post-key") || "";
      el.classList.toggle("has-unread", unreadSet.has(safeKey(key)));
    });
  }

  const CHAT_EMPTY_DEFAULT = "投稿とメッセージ相手を選択してください";
  function setChatEmptyState(isEmpty, message) {
    const overlay = document.getElementById("chat-empty-overlay");
    if (windowPane) {
      windowPane.classList.toggle("is-empty", !!isEmpty);
    }
    if (overlay) {
      overlay.textContent = message || CHAT_EMPTY_DEFAULT;
      overlay.hidden = !isEmpty;
    }
    if (windowPane) {
      const planBtn = windowPane.querySelector(".btn-deal-plan");
      if (planBtn) planBtn.style.display = isEmpty ? "none" : "";
      const exitBtn = windowPane.querySelector(".btn-deal-exit");
      const activeEl = getActiveConvoEl();
      const archived = activeEl ? isArchived(activeEl.dataset.convoId) : false;
      if (exitBtn) exitBtn.style.display = (isEmpty || (showArchived && archived)) ? "none" : "";
      const restoreBtn = windowPane.querySelector(".btn-deal-restore");
      if (restoreBtn) restoreBtn.style.display = isEmpty ? "none" : "";
    }
    if (isEmpty && windowPane) {
      const dealLink = windowPane.querySelector(".deal-link");
      const dealBrief = windowPane.querySelector(".deal-brief");
      const dealStatus = windowPane.querySelector(".deal-summary .deal-status");
      if (dealLink) dealLink.textContent = "投稿を選択してください";
      if (dealBrief) dealBrief.textContent = "";
      if (dealStatus) dealStatus.textContent = "";
    }
  }

  function getActivePostKeyFromDOM() {
    const btn = document.querySelector("#cc-post-list .post-item.active[data-post-key]");
    return btn ? String(btn.getAttribute("data-post-key") || "") : "";
  }

  function syncChatEmptyState() {
    const domPostKey = getActivePostKeyFromDOM();
    if (domPostKey && safeKey(domPostKey) !== safeKey(activePostKey)) {
      activePostKey = domPostKey;
    }
    const hasPost = !!safeKey(domPostKey || activePostKey);
    const activeEl = list.querySelector(".convo-item.active");
    const hasConvo = !!(activeEl && activeEl.style.display !== "none");
    setChatEmptyState(!(hasPost && hasConvo));
  }

  function applyPostFilter(role) {
    const activeRole = (role === "inquiry") ? "inquiry" : "owner";
    const convos = getAllConvoEls();
    const hasActivePost = !!safeKey(activePostKey);
    convos.forEach((el) => {
      const db = loadDB();
      const meta = db?.[el.dataset.convoId]?.meta || {};
      const r = normalizeRole(el.dataset.role) || normalizeRole(meta?.role) || "owner";
      const postKey = buildPostKeyFromMeta(meta, r);
      const matchRole = r === activeRole;
      const matchPost = hasActivePost && safeKey(postKey) === safeKey(activePostKey);
      el.style.display = (matchRole && matchPost) ? "" : "none";
      try { el.dataset.role = r; } catch (e) { }
    });
    const selected = list.querySelector(".convo-item.active");
    if (selected && selected.style.display === "none") {
      selected.classList.remove("active");
      activeConvoId = "";
    }
    const current = list.querySelector(".convo-item.active");
    if (current && current.style.display !== "none") {
      activeConvoId = current.dataset.convoId || activeConvoId;
    } else {
      convos.forEach(el => el.classList.remove("active"));
      activeConvoId = "";
    }
    if (hasActivePost) {
      renderSelectedPostHeaderOnly();
    }
    syncChatEmptyState();
  }

  function scrollToPaneIfMobile(selector) {
    if (!window.matchMedia || !window.matchMedia("(max-width: 900px)").matches) return;
    const target = document.querySelector(selector);
    if (target && target.scrollIntoView) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function getSavedActiveTab() {
    try {
      const v = String(sessionStorage.getItem(KEY_ACTIVE_TAB) || "owner");
      return (v === "inquiry") ? "inquiry" : "owner";
    } catch (e) {
      return "owner";
    }
  }

  function saveActiveTab(role) {
    try { sessionStorage.setItem(KEY_ACTIVE_TAB, role); } catch (e) { }
  }

  // ----
  // DB helpers
  // ----
  function loadDB() {
    try {
      const raw = localStorage.getItem(KEY_CHAT);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === "object") ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function saveDB(db) {
    try { localStorage.setItem(KEY_CHAT, JSON.stringify(db || {})); } catch (e) { }
  }

  function nowHHMM() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function todayJP() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }

  function escapeHTML(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ----
  // role判定（owner=自分の投稿 / inquiry=問い合わせた投稿）
  // ----
  function normalizeRole(v) {
    const s = String(v || "").trim().toLowerCase();
    if (s === "owner" || s === "mine" || s === "my" || s === "poster") return "owner";
    if (s === "inquiry" || s === "buyer" || s === "guest" || s === "asked") return "inquiry";
    return "";
  }

  function getConvoRoleFromDOM(convoEl) {
    const d1 = normalizeRole(convoEl?.dataset?.role);
    if (d1) return d1;
    const d2 = normalizeRole(convoEl?.getAttribute?.("data-role"));
    if (d2) return d2;

    const cls = String(convoEl?.className || "");
    if (/\bowner\b|\bmine\b|\bmy-post\b/i.test(cls)) return "owner";
    if (/\binquiry\b|\basked\b|\bmy-inquiry\b/i.test(cls)) return "inquiry";

    return "";
  }

  function getConvoMeta(convoEl, fallbackRole = "") {
    const nameEl = convoEl.querySelector(".convo-name");
    const refEl = convoEl.querySelector(".convo-ref");
    const msgEl = convoEl.querySelector(".convo-msg");

    const name = nameEl ? nameEl.textContent.trim() : "";
    const ref = refEl ? refEl.textContent.trim() : "";
    const preview = msgEl ? msgEl.textContent.trim() : "";

    const roleDom = getConvoRoleFromDOM(convoEl);
    const role = roleDom || normalizeRole(fallbackRole) || "owner";

    return { name, ref, preview, role };
  }

  function resolveChatAvatarSrc(name) {
    const clean = String(name || "").trim();
    const direct = ccGetChatAvatarByName(clean);
    if (direct) return direct;
    return ccPickFallbackAvatar(clean || "chat");
  }

  // ----
  // 左リスト：DBに存在する会話がDOMに無い場合は自動で生成
  // （問い合わせ開始で新規スレッドが増えるため）
  // ----
  function createConvoItem(convoId, meta, lastMsg, lastTime, unread) {
    const nameText = String(meta?.name || "");
    const avatarText = nameText.trim().charAt(0) || "?";
    const timeText = String(lastTime || "");
    const previewText = String(lastMsg || "");
    const pinText = unread ? "返信待ち" : "開封済み";
    const pinClass = unread ? "convo-pin is-unread" : "convo-pin is-read";

    const template = list.querySelector(".convo-item");
    let item;

    if (template && template.querySelector(".convo-msg") && template.querySelector(".convo-time")) {
      item = template.cloneNode(true);
      item.classList.remove("active");
      item.dataset.convoId = convoId;
      item.dataset.role = normalizeRole(meta?.role) || "owner";

      const nameEl = item.querySelector(".convo-name");
      const timeEl = item.querySelector(".convo-time");
      const msgEl = item.querySelector(".convo-msg");
      const avatarEl = item.querySelector(".convo-avatar");
      const pinEl = item.querySelector(".convo-pin");

      if (nameEl) nameEl.textContent = nameText;
      if (timeEl) timeEl.textContent = timeText;
      if (msgEl) msgEl.textContent = previewText;
      if (avatarEl) {
        const avatarSrc = resolveChatAvatarSrc(nameText);
        if (avatarSrc) {
          ccSetAvatarBackground(avatarEl, avatarSrc);
          avatarEl.textContent = "";
        } else {
          ccSetAvatarBackground(avatarEl, "");
          avatarEl.textContent = avatarText;
        }
      }
      if (pinEl) {
        pinEl.textContent = pinText;
        pinEl.className = pinClass;
      }

      if (unread) item.classList.add("unread");
      else item.classList.remove("unread");

      const fresh = item.cloneNode(true);
      item = fresh;
    } else {
      item = document.createElement("div");
      item.className = "convo-item";
      item.dataset.convoId = convoId;
      item.dataset.role = normalizeRole(meta?.role) || "owner";
      item.innerHTML = `
        <div class="convo-avatar" aria-hidden="true">${escapeHTML(avatarText)}</div>
        <div class="convo-main">
          <div class="convo-name">${escapeHTML(nameText)}</div>
          <div class="convo-preview">
            <i class="fa-regular fa-message"></i>
            <span class="convo-msg">${escapeHTML(previewText)}</span>
          </div>
        </div>
        <div class="convo-meta">
          <div class="convo-time">${escapeHTML(timeText)}</div>
          <span class="${pinClass}">${pinText}</span>
        </div>
      `;
      if (unread) item.classList.add("unread");
      const avatarEl = item.querySelector(".convo-avatar");
      if (avatarEl) {
        const avatarSrc = resolveChatAvatarSrc(nameText);
        if (avatarSrc) {
          ccSetAvatarBackground(avatarEl, avatarSrc);
          avatarEl.textContent = "";
        } else {
          ccSetAvatarBackground(avatarEl, "");
        }
      }
    }

    // tabsの直下に揃える（tabsの後ろに入れる）
    const tabs = document.getElementById("cc-chat-tabs");
    if (tabs && tabs.parentNode === list) {
      list.insertBefore(item, tabs.nextSibling);
    } else {
      list.appendChild(item);
    }

    return item;
  }

  function updateConvoUnreadState(convoId, unread) {
    const el = list.querySelector(`.convo-item[data-convo-id="${convoId}"]`) ||
      list.querySelector(`.convo-item[data-convoId="${convoId}"]`) ||
      list.querySelector(`.convo-item[data-convo-id='${convoId}']`) ||
      list.querySelector(`.convo-item[data-convoId='${convoId}']`);
    if (!el) return;
    if (unread) el.classList.add("unread");
    else el.classList.remove("unread");

    const pin = el.querySelector(".convo-pin");
    if (pin) {
      pin.textContent = unread ? "返信待ち" : "開封済み";
      pin.className = unread ? "convo-pin is-unread" : "convo-pin is-read";
    }

    const chip = el.querySelector(".unread-chip");
    if (unread) {
      if (!chip) {
        const topRow = el.querySelector(".convo-top");
        if (topRow) {
          const nextChip = document.createElement("span");
          nextChip.className = "unread-chip";
          nextChip.textContent = "返信待ち";
          topRow.appendChild(nextChip);
        }
      }
    } else if (chip && chip.parentNode) {
      chip.parentNode.removeChild(chip);
    }
  }

  function ensureDOMItemsFromDB() {
    const db = loadDB();
    const existing = new Set(Array.from(list.querySelectorAll(".convo-item")).map(el => el.dataset.convoId));

    Object.keys(db || {}).forEach((convoId) => {
      if (showArchived && !isArchived(convoId)) return;
      if (!showArchived && isArchived(convoId)) return;
      if (existing.has(convoId)) return;
      const th = db[convoId];
      const meta = th?.meta || { name: "", ref: "", role: "owner" };
      const msgs = Array.isArray(th?.messages) ? th.messages : [];
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      const lastMsg = last ? last.text : (meta.preview || "");
      const lastTime = last ? last.time : "";
      const unread = !!th?.unread;
      createConvoItem(convoId, meta, lastMsg, lastTime, unread);
    });
  }

  function rebuildConvoList() {
    const existing = Array.from(list.querySelectorAll(".convo-item"));
    existing.forEach((el) => el.remove());
    ensureDOMItemsFromDB();
  }

  // ----
  // 初期モック（DBが空のときだけ投入）※現在は無効化
  // ----
  function seedChatMockDataIfEmpty() {
    return;
  }

  function ensureActiveOwnerThread() {
    return;
  }

  function ensureThread(convoId, meta) {
    const db = loadDB();
    if (!db[convoId]) {
      db[convoId] = {
        meta,
        deal_done: false,
        messages: []
      };
      saveDB(db);
    } else {
      const prev = db[convoId].meta || {};
      const role = normalizeRole(meta.role) || normalizeRole(prev.role) || "owner";
      const keepPostKey = safeKey(prev.post_key) ? prev.post_key : meta.post_key;
      db[convoId].meta = { ...prev, ...meta, role, post_key: keepPostKey || prev.post_key || meta.post_key || "" };
      // 既存の created_at / draft は維持
      if (!db[convoId].created_at) db[convoId].created_at = new Date().toISOString();
      if (typeof db[convoId].draft !== "boolean") db[convoId].draft = false;
      saveDB(db);
    }
    return db[convoId];
  }

  function getAllConvoEls() {
    return Array.from(list.querySelectorAll(".convo-item"));
  }

  function getActiveConvoEl() {
    return list.querySelector(".convo-item.active") || getAllConvoEls()[0] || null;
  }

  function getVisibleConvosByRole(role) {
    const r = (role === "inquiry") ? "inquiry" : "owner";
    const convos = getAllConvoEls();
    return convos.filter((el) => {
      const domRole = normalizeRole(el.dataset.role) || getConvoRoleFromDOM(el);
      const db = loadDB();
      const fromDB = normalizeRole(db?.[el.dataset.convoId]?.meta?.role);
      const finalRole = domRole || fromDB || "owner";
      return finalRole === r;
    });
  }

  function applyTabFilter(role) {
    const activeRole = (role === "inquiry") ? "inquiry" : "owner";

    if (getAllConvoEls().length === 0) {
      rebuildConvoList();
    }

    const convos = getAllConvoEls();
    convos.forEach((el) => {
      const domRole = normalizeRole(el.dataset.role) || getConvoRoleFromDOM(el);
      const db = loadDB();
      const fromDB = normalizeRole(db?.[el.dataset.convoId]?.meta?.role);
      const finalRole = domRole || fromDB || "owner";
      el.style.display = (finalRole === activeRole) ? "" : "none";
      try { el.dataset.role = finalRole; } catch (e) { }
    });

    setTabActiveStyles(activeRole);
    saveActiveTab(activeRole);

    renderPostList(activeRole);
    applyPostFilter(activeRole);
  }

  // ----
  // 取引ステータス権限：投稿者（owner）タブのみ
  // ----
  function canCurrentUserChangeDealStatus(convoId) {
    try {
      const db = loadDB();
      const role = normalizeRole(db?.[convoId]?.meta?.role) || "owner";
      return role === "owner";
    } catch (e) {
      return false;
    }
  }

  const PLAN_ACTION_LABELS = {
    sell: "受け渡し予定者にする",
    housing: "入居予定者にする",
    jobs: "面接予定者にする",
    help: "お願いする",
    services: "サービス予約者にする",
    community: "参加予定者にする",
    events: "参加予定者にする",
    school: "受講予定者にする"
  };
  const PLAN_STATUS_LABELS = {
    sell: "受け渡し予定者",
    housing: "入居予定者",
    jobs: "面接予定者",
    help: "お願い済み",
    services: "サービス予約者",
    community: "参加予定者",
    events: "参加予定者",
    school: "受講予定者"
  };
  const PLAN_CONFIRM_LABELS = {
    sell: "取引予定者にしますか？",
    housing: "入居予定者にしますか？",
    jobs: "面談予定者にしますか？",
    help: "対応予定者に追加しますか？",
    services: "予約予定者に追加しますか？",
    community: "参加予定者に追加しますか？",
    events: "参加予定者に追加しますか？",
    school: "受講予定者に追加しますか？"
  };
  function resolvePostCategory(meta) {
    const dev = window.CanadaClassiDev || {};
    const postKey = buildPostKeyFromMeta(meta, meta?.role) || activePostKey;
    const post = (postKey && dev.ccGetPostByKey) ? dev.ccGetPostByKey(postKey) : null;
    return post?.cat || meta?.category || meta?.cat || "";
  }

  function getPlanLabels(meta) {
    const cat = resolvePostCategory(meta);
    return {
      action: PLAN_ACTION_LABELS[cat] || "予定者にする",
      status: PLAN_STATUS_LABELS[cat] || "予定者",
      confirm: PLAN_CONFIRM_LABELS[cat] || "予定者にしますか？",
      category: cat
    };
  }

  function getPlanConfirmText(meta, labels) {
    const name = meta?.name || "相手";
    if (labels.category === "help") {
      return `${name}に${labels.confirm}`;
    }
    return `${name}を${labels.confirm}`;
  }

  function getSelectedPostInfo() {
    const dev = window.CanadaClassiDev || {};
    if (!activePostKey) return null;
    const post = (dev.ccGetPostByKey && dev.ccGetPostByKey(activePostKey)) || null;
    if (!post) return null;
    const title = String(post.title || "").trim();
    const price = formatPostPriceForDisplay(post);
    const area = formatAreaText(post);
    const statusInfo = (dev.ccGetPostStatusInfo && dev.ccGetPostStatusInfo(post)) || null;
    const statusLabel = statusInfo
      ? (statusInfo.status === "completed" ? statusInfo.labels.completed : statusInfo.labels.active)
      : "受付中";
    return { title, price, area, statusLabel, key: post.key };
  }

  function buildChatProfileHref(name, postKey) {
    const clean = String(name || "").trim();
    if (!clean) return "profile-view.html";
    let href = `profile-view.html?from=chat&chat=${encodeURIComponent(clean)}`;
    if (postKey) href += `&post=${encodeURIComponent(String(postKey))}`;
    return href;
  }

  function setRecipientHeaderTarget(name, postKey) {
    const nameTarget = windowPane.querySelector(".recipient-name");
    if (nameTarget) {
      const rating = nameTarget.querySelector(".rating");
      nameTarget.innerHTML = `<a class="recipient-link" id="cc-recipient-profile-link" href="${escapeHTML(buildChatProfileHref(name, postKey))}">${escapeHTML(name || "相手未選択")}</a>`;
      if (rating) nameTarget.appendChild(rating);
    }
    const headerAvatar = windowPane.querySelector(".convo-avatar.small");
    if (headerAvatar) {
      const nameText = String(name || "").trim();
      const avatarSrc = resolveChatAvatarSrc(nameText);
      if (avatarSrc) {
        ccSetAvatarBackground(headerAvatar, avatarSrc);
        headerAvatar.textContent = "";
      } else {
        ccSetAvatarBackground(headerAvatar, "");
        headerAvatar.textContent = nameText ? nameText.charAt(0) : "H";
      }
    }
  }

  function renderSelectedPostHeaderOnly() {
    const info = getSelectedPostInfo();
    if (!info || !windowPane) return;
    const nameTarget = windowPane.querySelector(".recipient-name");
    const dealLink = windowPane.querySelector(".deal-link");
    const dealBrief = windowPane.querySelector(".deal-brief");
    const statusTarget = windowPane.querySelector(".deal-summary .deal-status");
    const headerAvatar = windowPane.querySelector(".convo-avatar.small");

    if (nameTarget) {
      const rating = nameTarget.querySelector(".rating");
      nameTarget.innerHTML = `<a class="recipient-link" id="cc-recipient-profile-link" href="${escapeHTML(buildChatProfileHref(currentChatKey, info.key))}">${escapeHTML(currentChatKey || "相手未選択")}</a>`;
      if (rating) nameTarget.appendChild(rating);
    }
    if (headerAvatar) {
      ccSetAvatarBackground(headerAvatar, "");
      headerAvatar.textContent = currentChatKey ? String(currentChatKey).trim().charAt(0) : "H";
    }
    if (dealLink) {
      dealLink.textContent = info.title || "投稿を選択してください";
      if (info.key) dealLink.setAttribute("href", `detail.html?post=${encodeURIComponent(info.key)}`);
    }
    if (dealBrief) {
      dealBrief.innerHTML = formatDealBriefHTML(info.price, info.area);
    }
    if (statusTarget) {
      statusTarget.textContent = info.statusLabel || "";
    }
  }

  function formatDealBriefHTML(price, area) {
    const parts = [];
    if (price) {
      parts.push(`<span class="deal-brief-item"><i class="fa-solid fa-tag" aria-hidden="true"></i>${escapeHTML(price)}</span>`);
    }
    if (area) {
      parts.push(`<span class="deal-brief-item"><i class="fa-solid fa-location-dot" aria-hidden="true"></i>${escapeHTML(area)}</span>`);
    }
    return parts.join("");
  }

  function renderHeader(meta, done, thread) {
    const nameTarget = windowPane.querySelector(".recipient-name");
    const dealLink = windowPane.querySelector(".deal-link");
    const dealBrief = windowPane.querySelector(".deal-brief");
    const statusTarget = windowPane.querySelector(".deal-summary .deal-status");
    const headerAvatar = windowPane.querySelector(".convo-avatar.small");

    // 追加: post_keyのグローバル取引完了状態
    const postKey = buildPostKeyFromMeta(meta, meta.role);
    const globallyDone = isPostDealDone(postKey);
    const isDeleted = postKey && ccIsPostDeleted(postKey);
    const postForStatus = (postKey && window.CanadaClassiDev && window.CanadaClassiDev.ccGetPostByKey)
      ? window.CanadaClassiDev.ccGetPostByKey(postKey)
      : null;
    const statusInfo = (postForStatus && window.CanadaClassiDev && window.CanadaClassiDev.ccGetPostStatusInfo)
      ? window.CanadaClassiDev.ccGetPostStatusInfo(postForStatus)
      : null;
    const isStatusCompleted = statusInfo && statusInfo.status === "completed";
    const finalDone = !!(globallyDone || done || isStatusCompleted);
    const selectedPostInfo = getSelectedPostInfo();
    const resolvedStatus = statusInfo
      ? (statusInfo.status === "completed"
        ? statusInfo.labels.completed
        : (statusInfo.status === "cancelled" ? statusInfo.labels.cancelled : statusInfo.labels.active))
      : null;
    const statusLabel = selectedPostInfo?.statusLabel || resolvedStatus || "受付中";
    const planLabels = getPlanLabels(meta || {});
    const planDone = !!(thread && thread.plan_done);
    if (statusTarget) {
      statusTarget.textContent = isDeleted
        ? "削除済み"
        : ((planDone && !finalDone) ? planLabels.status : statusLabel);
    }

    if (nameTarget) {
      const rating = nameTarget.querySelector(".rating");
      nameTarget.innerHTML = `<a class="recipient-link" id="cc-recipient-profile-link" href="${escapeHTML(buildChatProfileHref(meta.name || "", selectedPostInfo?.key))}">${escapeHTML(meta.name || "")}</a>`;
      if (rating) nameTarget.appendChild(rating);
    }
    if (headerAvatar) {
      const nameText = String(meta?.name || "").trim();
      const avatarSrc = resolveChatAvatarSrc(nameText);
      if (avatarSrc) {
        ccSetAvatarBackground(headerAvatar, avatarSrc);
        headerAvatar.textContent = "";
      } else {
        ccSetAvatarBackground(headerAvatar, "");
        headerAvatar.textContent = nameText ? nameText.charAt(0) : "H";
      }
    }

    if (dealLink || dealBrief) {
      const title = selectedPostInfo?.title || meta.ref || "";
      const price = selectedPostInfo?.price || "";
      const area = selectedPostInfo?.area || "";
      if (dealLink) {
        if (isDeleted) {
          dealLink.textContent = "投稿は削除されています";
          dealLink.removeAttribute("href");
        } else {
          dealLink.textContent = title;
          if (selectedPostInfo?.key) {
            dealLink.setAttribute("href", `detail.html?post=${encodeURIComponent(selectedPostInfo.key)}`);
          }
        }
      }
      if (dealBrief) {
        dealBrief.innerHTML = isDeleted ? "" : formatDealBriefHTML(price, area);
      }
    }

    const planBtn = windowPane.querySelector(".btn-deal-plan");
    const exitBtn = windowPane.querySelector(".btn-deal-exit");
    const restoreBtn = windowPane.querySelector(".btn-deal-restore");
    const canChange = (meta.role === "owner");
    const labelSet = statusInfo && statusInfo.labels
      ? statusInfo.labels
      : { active: "受付中", completed: "受付終了" };

    if (planBtn) {
      if (finalDone) {
        planBtn.textContent = labelSet.completed;
        planBtn.setAttribute("aria-pressed", "true");
        planBtn.disabled = true;
        planBtn.classList.add("is-done");
        planBtn.style.background = "#e5e7eb";
        planBtn.style.color = "#111827";
        planBtn.style.border = "1px solid rgba(0,0,0,.08)";
        planBtn.style.cursor = "default";
        planBtn.style.opacity = "1";
        planBtn.dataset.mode = "done";
      } else if (!canChange) {
        planBtn.textContent = planDone ? planLabels.status : `受付状況：${labelSet.active}`;
        planBtn.setAttribute("aria-pressed", "false");
        planBtn.disabled = true;
        planBtn.classList.remove("is-done");
        planBtn.style.background = "#f3f4f6";
        planBtn.style.color = "#374151";
        planBtn.style.border = "1px solid rgba(0,0,0,.06)";
        planBtn.style.cursor = "default";
        planBtn.style.opacity = "0.85";
        planBtn.dataset.mode = planDone ? "done" : "plan";
      } else if (planDone) {
        planBtn.textContent = "受付終了にする";
        planBtn.setAttribute("aria-pressed", "false");
        planBtn.disabled = false;
        planBtn.classList.remove("is-done");
        planBtn.style.background = "";
        planBtn.style.color = "";
        planBtn.style.border = "";
        planBtn.style.cursor = "pointer";
        planBtn.style.opacity = "1";
        planBtn.dataset.mode = "done";
      } else {
        planBtn.textContent = planLabels.action;
        planBtn.setAttribute("aria-pressed", "false");
        planBtn.disabled = false;
        planBtn.classList.remove("is-done");
        planBtn.style.background = "";
        planBtn.style.color = "";
        planBtn.style.border = "";
        planBtn.style.cursor = "pointer";
        planBtn.style.opacity = "1";
        planBtn.dataset.mode = "plan";
      }
      if (isDeleted) {
        planBtn.textContent = "削除済み";
        planBtn.disabled = true;
        planBtn.setAttribute("aria-pressed", "false");
        planBtn.classList.add("is-done");
        planBtn.style.background = "#f3f4f6";
        planBtn.style.color = "#6b7280";
        planBtn.style.border = "1px solid rgba(0,0,0,.08)";
        planBtn.style.cursor = "default";
        planBtn.style.opacity = "0.9";
      }
    }
    const activeEl = getActiveConvoEl();
    const archived = activeEl ? isArchived(activeEl.dataset.convoId) : false;
    if (exitBtn) exitBtn.style.display = (showArchived && archived) ? "none" : "";
    if (restoreBtn) {
      const showRestore = showArchived && archived;
      restoreBtn.hidden = !showRestore;
      restoreBtn.style.display = showRestore ? "" : "none";
    }

    const inputEl = windowPane.querySelector(".chat-input-box textarea");
    const sendBtn = windowPane.querySelector(".chat-input-box .btn-send");
    const attachInput = windowPane.querySelector(".chat-input-box .attach-input");
    const attachBtn = windowPane.querySelector(".chat-input-box .btn-attach");
    const disableInput = !!isDeleted || (showArchived && archived);
    if (inputEl) inputEl.disabled = disableInput;
    if (sendBtn) sendBtn.disabled = disableInput;
    if (attachInput) attachInput.disabled = disableInput;
    if (attachBtn) attachBtn.disabled = disableInput;
    if (planBtn && showArchived && archived) {
      planBtn.disabled = true;
      planBtn.style.opacity = "0.7";
      planBtn.dataset.mode = "archived";
    }
  }

  function renderMessages(thread, meta) {
    messagesEl.innerHTML = "";

    const dateDiv = document.createElement("div");
    dateDiv.className = "msg-date";
    dateDiv.textContent = todayJP();
    messagesEl.appendChild(dateDiv);

    const nameText = String(meta?.name || "").trim();
    const initial = nameText.charAt(0) || "H";
    const avatarSrc = resolveChatAvatarSrc(nameText);

    const applyChatAvatar = (el, fallbackLetter) => {
      if (!el) return;
      if (avatarSrc) {
        ccSetAvatarBackground(el, avatarSrc);
        el.textContent = "";
      } else {
        ccSetAvatarBackground(el, "");
        el.textContent = fallbackLetter || initial || "H";
      }
    };

    applyChatAvatar(windowPane.querySelector(".convo-avatar.small"), "H");
    applyChatAvatar(list.querySelector(".convo-item.active .convo-avatar"), initial);
    (thread.messages || []).forEach(msg => {
      if (msg && msg.kind === "system") {
        const sys = document.createElement("div");
        sys.className = "msg-system";
        if (msg.owner) {
          const ownerText = escapeHTML(String(msg.owner || ""));
          const restText = escapeHTML(String(msg.text || ""));
          sys.innerHTML = `<strong>${ownerText}</strong> ${restText}`;
        } else {
          sys.textContent = String(msg.text || "");
        }
        messagesEl.appendChild(sys);
        return;
      }

      const row = document.createElement("div");
      row.className = "msg-row " + (msg.dir === "out" ? "outgoing" : "incoming");

      const bubble = document.createElement("div");
      bubble.className = "msg-bubble";

      const safeTextWithBreaks = escapeHTML(msg.text).replace(/\n/g, "<br>");
      bubble.innerHTML = `${safeTextWithBreaks}<span class=\"msg-meta\">${escapeHTML(msg.time || "")}</span>`;

      if (msg.dir !== "out") {
        const avatar = document.createElement("div");
        avatar.className = "msg-avatar";
        avatar.innerHTML = `
          <span class="msg-avatar-letter">${escapeHTML(initial)}</span>
          <span class="msg-avatar-bubble"><i class="fa-regular fa-comment-dots"></i></span>
        `;
        if (avatarSrc) {
          ccSetAvatarBackground(avatar, avatarSrc);
        }
        row.appendChild(avatar);
      }
      row.appendChild(bubble);
      messagesEl.appendChild(row);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
    setChatLastSeen(Date.now());
    updateChatUnreadFlag();
  }

  function updateConvoStatusLabels() {
    const db = loadDB();
    const items = getAllConvoEls();
    items.forEach((el) => {
      const convoId = el.dataset.convoId || el.dataset.threadId || el.getAttribute("data-thread-id") || "";
      const meta = db?.[convoId]?.meta;
      if (!meta) return;
      const postKey = buildPostKeyFromMeta(meta, meta.role);
      if (!postKey) return;
      const post = (window.CanadaClassiDev && window.CanadaClassiDev.ccGetPostByKey)
        ? window.CanadaClassiDev.ccGetPostByKey(postKey)
        : null;
      if (!post) return;
      const info = (window.CanadaClassiDev && window.CanadaClassiDev.ccGetPostStatusInfo)
        ? window.CanadaClassiDev.ccGetPostStatusInfo(post)
        : null;
      if (!info) return;
      const label = info.status === "completed"
        ? info.labels.completed
        : (info.status === "cancelled" ? info.labels.cancelled : info.labels.active);
      const statusEl = el.querySelector(".deal-status");
      if (statusEl) statusEl.textContent = label;
    });
  }

  function setActive(convoEl) {
    const convos = getAllConvoEls();
    convos.forEach(el => el.classList.remove("active"));
    convoEl.classList.add("active");
    setChatEmptyState(false);

    const convoId = convoEl.dataset.convoId;
    activeConvoId = convoId || "";

    const db = loadDB();
    const role = normalizeRole(convoEl.dataset.role) || normalizeRole(db?.[convoId]?.meta?.role) || "owner";

    const meta = getConvoMeta(convoEl, role);
    const thread = ensureThread(convoId, meta);
    const metaPostKey = buildPostKeyFromMeta(thread?.meta || meta || {}, role);
    if (metaPostKey) activePostKey = metaPostKey;
    currentChatKey = String(meta?.name || "").trim();

    // ----
    // 自動あいさつ送信の禁止（過去に誤って自動送信された場合も除去）
    // ----
    try {
      const AUTO_GREETING = "はじめまして。投稿を見て連絡しました。";
      const db2 = loadDB();
      const th2 = db2?.[convoId];
      if (th2 && Array.isArray(th2.messages)) {
        const beforeLen = th2.messages.length;
        th2.messages = th2.messages.filter(m => String(m?.text || "").trim() !== AUTO_GREETING);
        if (th2.messages.length !== beforeLen) {
          // メッセージが空になったらドラフト扱いに戻す
          if (th2.messages.length === 0) th2.draft = true;
          db2[convoId] = th2;
          saveDB(db2);
        }
      }
    } catch (e) { }

    renderHeader(meta, !!thread.deal_done, thread);
    renderMessages(thread, meta);
  }

  // ----
  // 初期化
  // ----
  ensureTabsUI();
  if (CC_SEED_MODE === "mock") seedChatMockDataIfEmpty();
  ensureActiveOwnerThread();
  ensureDOMItemsFromDB();
  updateArchiveTabsUI();

  document.querySelectorAll("[data-cc-archive-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-cc-archive-toggle");
      showArchived = mode === "archived";
      updateArchiveTabsUI();
      rebuildConvoList();
      applyPostFilter(getSavedActiveTab());
      const first = Array.from(list.querySelectorAll(".convo-item")).find(el => el.style.display !== "none");
      if (first) {
        setActive(first);
        syncChatEmptyState();
      } else {
        setChatEmptyState(true, showArchived ? "アーカイブに会話がありません。" : CHAT_EMPTY_DEFAULT);
      }
    });
  });

  // タブクリック
  const tabs = document.getElementById("cc-chat-tabs");
  if (tabs) {
    tabs.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest(".cc-chat-tab") : null;
      if (!btn) return;
      const role = (btn.dataset.role === "inquiry") ? "inquiry" : "owner";
      applyTabFilter(role);
    });
  }

  // URLパラメータ（?tab=inquiry&open=convoId）
  let initialTab = getSavedActiveTab();
  let openId = "";
  let chatTarget = "";
  try {
    const u = new URL(location.href);
    const t = normalizeRole(u.searchParams.get("tab"));
    if (t) initialTab = t;
    openId = String(u.searchParams.get("open") || "");
    chatTarget = String(u.searchParams.get("to") || "").trim();
  } catch (e) { }

  if (chatTarget && !openId) {
    const db = loadDB();
    const hitId = Object.keys(db || {}).find((id) => {
      const name = String(db?.[id]?.meta?.name || "").trim();
      return name === chatTarget;
    }) || "";
    if (hitId) {
      openId = hitId;
      const role = normalizeRole(db?.[hitId]?.meta?.role) || "owner";
      initialTab = role;
      const postKey = buildPostKeyFromMeta(db?.[hitId]?.meta || {}, role);
      if (postKey) activePostKey = postKey;
    }
  }

  if (openId) {
    const db = loadDB();
    const th = db?.[openId] || null;
    const role = normalizeRole(th?.meta?.role) || "owner";
    initialTab = role;
    const postKey = buildPostKeyFromMeta(th?.meta || {}, role);
    if (postKey) activePostKey = postKey;
    if (isArchived(openId)) {
      showArchived = true;
      updateArchiveTabsUI();
      rebuildConvoList();
    }
  }

  applyTabFilter(initialTab);

  // 初期：open指定があれば該当スレッドのみ選択（post選択後に表示）
  if (openId) {
    const convosAfter = getAllConvoEls();
    const target = convosAfter.find(el => el.dataset.convoId === openId) || null;
    if (target && target.style.display !== "none") {
      setActive(target);
      syncChatEmptyState();
    } else {
      setChatEmptyState(true);
    }
  } else if (chatTarget) {
    currentChatKey = chatTarget;
    setRecipientHeaderTarget(chatTarget, "");
    setChatEmptyState(true);
  } else {
    setChatEmptyState(true);
  }
  updateConvoStatusLabels();

  // 左の会話クリック
  list.addEventListener("click", (e) => {
    const el = e.target && e.target.closest ? e.target.closest(".convo-item") : null;
    if (!el) return;
    if (el.style.display === "none") return;
    if (!activePostKey) return;
    setActive(el);
    updateConvoStatusLabels();
    syncChatEmptyState();
    scrollToPaneIfMobile("#chat-message-pane");
  });

  // ----
  // 送信
  // ----
  function sendCurrent() {
    const text = (inputBox.value || "").trim();
    if (!text) return;

    const active = getActiveConvoEl();
    if (!active || active.style.display === "none") return;

    const convoId = active.dataset.convoId;

    const db = loadDB();
    const role = normalizeRole(active.dataset.role) || normalizeRole(db?.[convoId]?.meta?.role) || "owner";
    const meta = getConvoMeta(active, role);

    const thread = db[convoId] || { meta, deal_done: false, messages: [] };

    const msg = { dir: "out", text, time: nowHHMM(), ts: Date.now() };
    thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
    thread.messages.push(msg);
    thread.unread = false;
    // draft だった場合は、最初の送信で正式化
    if (thread.draft === true) thread.draft = false;
    thread.meta = meta;

    db[convoId] = thread;
    saveDB(db);

    const previewEl = active.querySelector(".convo-msg");
    if (previewEl) previewEl.textContent = text;
    const timeEl = active.querySelector(".convo-time");
    if (timeEl) timeEl.textContent = nowHHMM();
    updateConvoUnreadState(convoId, false);
    refreshPostUnreadBadges(role);

    renderMessages(thread, meta);
    inputBox.value = "";
    autoResizeInput();
    inputBox.focus();

  }

  sendBtn.addEventListener("click", sendCurrent);
  const autoResizeInput = () => {
    inputBox.style.height = "auto";
    inputBox.style.height = `${inputBox.scrollHeight}px`;
  };
  inputBox.addEventListener("input", autoResizeInput);
  autoResizeInput();
  inputBox.addEventListener("keydown", (e) => {
    if (e.isComposing || e.keyCode === 229) return;

    // 送信は Ctrl+Enter / Cmd+Enter のみ
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendCurrent();
      return;
    }

    // Enter単体 / Shift+Enter は textarea のデフォルト（改行/確定）に任せる
  });

  // ----
  // 取引完了ボタン（イベント委譲）
  // ----
  function openDealDoneModal(onConfirm, message) {
    const modal = document.getElementById("cc-deal-done-modal");
    if (!modal) {
      openGlobalConfirmModal({
        id: "cc-deal-done-modal-fallback",
        title: "取引の確認",
        message: message || "取引を完了にしますか？",
        confirmText: "完了にする",
        cancelText: "キャンセル",
        onConfirm: () => {
          if (typeof onConfirm === "function") onConfirm();
        }
      });
      return;
    }

    if (!modal.dataset.bound) {
      const closeBtn = modal.querySelector("[data-modal-close]");
      const cancelBtn = modal.querySelector("[data-modal-cancel]");
      const confirmBtn = modal.querySelector("[data-modal-confirm]");
      const hide = () => {
        modal.hidden = true;
        modal._ccConfirm = null;
      };
      if (closeBtn) closeBtn.addEventListener("click", hide);
      if (cancelBtn) cancelBtn.addEventListener("click", hide);
      if (confirmBtn) {
        confirmBtn.addEventListener("click", () => {
          const fn = modal._ccConfirm;
          hide();
          if (typeof fn === "function") fn();
        });
      }
      modal.addEventListener("click", (e) => {
        if (e.target === modal) hide();
      });
      modal.dataset.bound = "true";
    }

    modal._ccConfirm = onConfirm;
    const body = modal.querySelector("#cc-deal-done-message");
    if (body && message) body.textContent = message;
    modal.hidden = false;
  }

  function openPlanModal(onConfirm, message) {
    openDealDoneModal(onConfirm, message || "予定者にしますか？");
  }

  function openDraftLeaveModal(onConfirm, onCancel) {
    const modal = document.getElementById("cc-draft-leave-modal");
    if (!modal) {
      openGlobalConfirmModal({
        id: "cc-draft-leave-modal-fallback",
        title: "問い合わせの確認",
        message: "問い合わせを取り消しますか？",
        confirmText: "取り消す",
        cancelText: "キャンセル",
        onConfirm: () => {
          if (typeof onConfirm === "function") onConfirm();
        },
        onCancel: () => {
          if (typeof onCancel === "function") onCancel();
        }
      });
      return;
    }

    if (!modal.dataset.bound) {
      const closeBtn = modal.querySelector("[data-draft-modal-close]");
      const cancelBtn = modal.querySelector("[data-draft-modal-cancel]");
      const confirmBtn = modal.querySelector("[data-draft-modal-confirm]");
      const hide = () => {
        modal.hidden = true;
        modal._ccConfirm = null;
        modal._ccCancel = null;
      };
      if (closeBtn) closeBtn.addEventListener("click", () => {
        const fn = modal._ccCancel;
        hide();
        if (typeof fn === "function") fn();
      });
      if (cancelBtn) cancelBtn.addEventListener("click", () => {
        const fn = modal._ccCancel;
        hide();
        if (typeof fn === "function") fn();
      });
      if (confirmBtn) {
        confirmBtn.addEventListener("click", () => {
          const fn = modal._ccConfirm;
          hide();
          if (typeof fn === "function") fn();
        });
      }
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          const fn = modal._ccCancel;
          hide();
          if (typeof fn === "function") fn();
        }
      });
      modal.dataset.bound = "true";
    }

    modal._ccConfirm = onConfirm;
    modal._ccCancel = onCancel;
    modal.hidden = false;
  }

  function openChatExitModal(onConfirm, onCancel) {
    const modal = document.getElementById("cc-chat-exit-modal");
    if (!modal) {
      openGlobalConfirmModal({
        id: "cc-chat-exit-modal-fallback",
        title: "退出の確認",
        message: "会話を退出しますか？",
        confirmText: "退出する",
        cancelText: "キャンセル",
        onConfirm: () => {
          if (typeof onConfirm === "function") onConfirm();
        },
        onCancel: () => {
          if (typeof onCancel === "function") onCancel();
        }
      });
      return;
    }

    if (!modal.dataset.bound) {
      const closeBtn = modal.querySelector("[data-chat-exit-close]");
      const cancelBtn = modal.querySelector("[data-chat-exit-cancel]");
      const confirmBtn = modal.querySelector("[data-chat-exit-confirm]");
      const hide = () => {
        modal.hidden = true;
        modal._ccConfirm = null;
        modal._ccCancel = null;
      };
      if (closeBtn) closeBtn.addEventListener("click", () => {
        const fn = modal._ccCancel;
        hide();
        if (typeof fn === "function") fn();
      });
      if (cancelBtn) cancelBtn.addEventListener("click", () => {
        const fn = modal._ccCancel;
        hide();
        if (typeof fn === "function") fn();
      });
      if (confirmBtn) {
        confirmBtn.addEventListener("click", () => {
          const fn = modal._ccConfirm;
          hide();
          if (typeof fn === "function") fn();
        });
      }
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          const fn = modal._ccCancel;
          hide();
          if (typeof fn === "function") fn();
        }
      });
      modal.dataset.bound = "true";
    }

    modal._ccConfirm = onConfirm;
    modal._ccCancel = onCancel;
    modal.hidden = false;
  }

  document.addEventListener("click", (e) => {
    const planBtn = e.target && e.target.closest ? e.target.closest(".btn-deal-plan") : null;
    if (!planBtn) return;

    const isChatNow = !!document.querySelector(".chat-window-pane");
    if (!isChatNow) return;

    const active = getActiveConvoEl();
    if (!active || active.style.display === "none") return;

    const convoId = active.dataset.convoId;

    // 投稿者（owner）タブのみ変更可
    if (!canCurrentUserChangeDealStatus(convoId)) return;

    const db = loadDB();
    const role = normalizeRole(active.dataset.role) || normalizeRole(db?.[convoId]?.meta?.role) || "owner";
    const meta = getConvoMeta(active, role);

    const thread = db[convoId] || { meta, deal_done: false, messages: [] };

    if (planBtn.dataset.mode === "done") {
      if (thread.deal_done) return;
      const labels = getPlanLabels(meta || {});
      const name = meta?.name || "相手";
      const confirmText = thread.plan_done
        ? `${name}（${labels.status}）との取引を完了し、受付終了にしますか？`
        : `${labels.status}を設定していませんが受付終了してもよろしいですか？`;
      openDealDoneModal(() => {
        thread.deal_done = true;
        // 投稿単位の取引完了を保存（同じ投稿に紐づく他スレッドにも反映させる）
        const postKey = buildPostKeyFromMeta(thread.meta || meta, "owner");
        if (postKey) setPostDealDone(postKey, true);

        // 同じ投稿キーを持つスレッドの表示も更新（このページ内の見た目）
        try {
          const dbAll = loadDB();
          Object.keys(dbAll || {}).forEach((cid) => {
            const th = dbAll[cid];
            const pk = buildPostKeyFromMeta(th?.meta || {}, th?.meta?.role);
            if (pk && safeKey(pk) === safeKey(postKey)) {
              th.deal_done = true;
              dbAll[cid] = th;
            }
          });
          saveDB(dbAll);
        } catch (e2) { }

        thread.meta = meta;
        db[convoId] = thread;
        saveDB(db);

        renderHeader(meta, true, thread);
        updateConvoStatusLabels();
      }, confirmText);
      return;
    }

    if (thread.plan_done) return;
    const labels = getPlanLabels(meta || {});
    const confirmText = getPlanConfirmText(meta || {}, labels);
    openPlanModal(() => {
      const ownerName = (typeof getAccountName === "function" && getAccountName()) ? String(getAccountName()) : "投稿者";
      const noticeText = `${meta?.name || "相手"}を${labels.status}に設定しました。`;

      thread.plan_done = true;
      thread.plan_label = labels.status;
      thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
      thread.messages.push({ kind: "system", owner: ownerName, text: noticeText, time: nowHHMM(), ts: Date.now() });
      thread.meta = meta;
      db[convoId] = thread;
      saveDB(db);

      renderHeader(meta, !!thread.deal_done, thread);
      renderMessages(thread, meta);
    }, confirmText);
    return;
  });

  document.addEventListener("click", (e) => {
    const exitBtn = e.target && e.target.closest ? e.target.closest(".btn-deal-exit") : null;
    const restoreBtn = e.target && e.target.closest ? e.target.closest(".btn-deal-restore") : null;
    if (!exitBtn && !restoreBtn) return;

    const isChatNow = !!document.querySelector(".chat-window-pane");
    if (!isChatNow) return;

    const active = getActiveConvoEl();
    if (!active || active.style.display === "none") return;
    const convoId = active.dataset.convoId;

    if (restoreBtn) {
      setArchived(convoId, false);
      rebuildConvoList();
      applyPostFilter(getSavedActiveTab());
      const first = Array.from(list.querySelectorAll(".convo-item")).find(el => el.style.display !== "none");
      if (first) {
        setActive(first);
        syncChatEmptyState();
      } else {
        setChatEmptyState(true, "アーカイブに会話がありません。");
      }
      return;
    }

    openChatExitModal(() => {
      setArchived(convoId, true);
      rebuildConvoList();
      applyPostFilter(getSavedActiveTab());
      const next = Array.from(list.querySelectorAll(".convo-item")).find(el => el.style.display !== "none");
      if (next) {
        setActive(next);
        syncChatEmptyState();
      } else {
        setChatEmptyState(true, "会話を退出しました。");
      }
    });
  });

  // ----
  // 問い合わせドラフト（未送信）からの離脱確認
  // ----
  function getActiveThreadIdAndData() {
    const active = getActiveConvoEl();
    const db = loadDB();
    if (active && active.style.display !== "none") {
      const convoId = active.dataset.convoId;
      return { id: convoId, thread: db?.[convoId] || null };
    }
    try {
      const u = new URL(location.href);
      const openId = String(u.searchParams.get("open") || "");
      if (openId && db?.[openId]) {
        return { id: openId, thread: db?.[openId] || null };
      }
    } catch (e) { }
    return { id: "", thread: null };
  }

  function handleDraftLeave(nextUrl) {
    const { id, thread } = getActiveThreadIdAndData();
    if (!id || !thread) return false;

    // inquiry タブで作成された新規問い合わせ（draft）のみ対象
    const role = normalizeRole(thread?.meta?.role);
    if (role !== "inquiry") return false;

    if (!isDraftThread(thread)) return false;

    openDraftLeaveModal(() => {
      deleteThreadById(id);
      const ret = resolveReturnUrl(thread);
      try {
        window.location.href = ret;
      } catch (e) {
        window.location.href = "detail.html";
      }
    });
    return true;
  }

  // aタグクリックによる遷移を捕捉
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

    // 新規タブや修飾キーの場合は除外
    if (a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    // 同一ページ内のアンカーは除外
    if (href.startsWith("#")) return;

    // ドラフト離脱の確認
    const intercepted = handleDraftLeave(href);
    if (intercepted) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ブラウザの戻る/進むでもドラフト離脱を防ぐ
  // 初回に「留まる用 state」を積んでおく（戻るで popstate が発火するように）
  pushStayStateOnce();

  window.addEventListener("popstate", (e) => {
    const { id, thread } = getActiveThreadIdAndData();
    if (!id || !thread) return;

    const role = normalizeRole(thread?.meta?.role);
    if (role !== "inquiry") return;
    if (!isDraftThread(thread)) return;

    openDraftLeaveModal(() => {
      try {
        deleteThreadById(id);
      } catch (e2) { }
      const ret = resolveReturnUrl(thread);
      try {
        window.location.href = ret;
      } catch (e3) {
        window.location.href = "detail.html";
      }
    }, () => {
      pushStayStateOnce();
    });
  });

  // リロード/タブ閉じも捕捉（ブラウザ標準の確認）
  window.addEventListener("beforeunload", (e) => {
    const { thread } = getActiveThreadIdAndData();
    if (!thread) return;
    const role = normalizeRole(thread?.meta?.role);
    if (role !== "inquiry") return;
    if (!isDraftThread(thread)) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

function ccLoadInquiryThreads() {
  try {
    const raw = localStorage.getItem(CC_INQUIRY_THREADS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    let touched = false;
    const cleaned = list.filter((thread) => {
      const threadId = String(thread?.threadId || "");
      const postId = String(thread?.postId || "");
      if (ccIsLegacySeedKey(threadId) || ccIsLegacySeedKey(postId)) {
        touched = true;
        return false;
      }
      if (thread?.source === "demo" || thread?.isDemo === true) {
        touched = true;
        return false;
      }
      return true;
    }).map((thread) => {
      const next = Object.assign({}, thread);
      const postId = String(next.postId || "");
      const isMock = next.isMock === true || next.source === "mock" || ccIsMockPostKey(postId);
      if (next.isMock !== isMock) touched = true;
      next.isMock = isMock;
      const nextSource = isMock ? "mock" : "user";
      if (next.source !== nextSource) touched = true;
      next.source = nextSource;
      return next;
    });
    if (touched) ccSaveInquiryThreads(cleaned);
    return cleaned;
  } catch (e) {
    return [];
  }
}

function ccSaveInquiryThreads(list) {
  try {
    localStorage.setItem(CC_INQUIRY_THREADS_KEY, JSON.stringify(list || []));
  } catch (e) { }
}

function ccLoadInquiryTokens() {
  try {
    const raw = localStorage.getItem(CC_INQUIRY_TOKENS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    const cleaned = list.filter((token) => {
      const threadId = String(token?.threadId || "");
      if (ccIsLegacySeedKey(threadId)) return false;
      if (token?.source === "demo" || token?.isDemo === true) return false;
      return true;
    });
    if (cleaned.length !== list.length) ccSaveInquiryTokens(cleaned);
    return cleaned;
  } catch (e) {
    return [];
  }
}

function ccSaveInquiryTokens(list) {
  try {
    localStorage.setItem(CC_INQUIRY_TOKENS_KEY, JSON.stringify(list || []));
  } catch (e) { }
}

function ccLoadInquiryListings() {
  try {
    const raw = localStorage.getItem(CC_INQUIRY_LISTINGS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (!data || typeof data !== "object") return {};
    let touched = false;
    Object.keys(data).forEach((key) => {
      if (ccIsLegacySeedKey(key)) {
        delete data[key];
        touched = true;
      }
    });
    if (touched) ccSaveInquiryListings(data);
    return data;
  } catch (e) {
    return {};
  }
}

function ccSaveInquiryListings(data) {
  try {
    localStorage.setItem(CC_INQUIRY_LISTINGS_KEY, JSON.stringify(data || {}));
  } catch (e) { }
}

function ccLoadInquiryBlocked() {
  try {
    const raw = localStorage.getItem(CC_INQUIRY_BLOCKED_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch (e) {
    return {};
  }
}

function ccSaveInquiryBlocked(data) {
  try {
    localStorage.setItem(CC_INQUIRY_BLOCKED_KEY, JSON.stringify(data || {}));
  } catch (e) { }
}

function ccLoadInquiryReports() {
  try {
    const raw = localStorage.getItem(CC_INQUIRY_REPORTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function ccSaveInquiryReports(list) {
  try {
    localStorage.setItem(CC_INQUIRY_REPORTS_KEY, JSON.stringify(list || []));
  } catch (e) { }
}

function ccFormatDateTime(iso) {
  return formatDateForView(iso, { withTime: true, withSeconds: false });
}

function ccMaskContactText(text) {
  const raw = String(text || "");
  const maskedMail = raw.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "***@***");
  const maskedPhone = maskedMail.replace(/\b\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}\b/g, "***-***-****");
  return maskedPhone;
}

function ccCreateInquiryThread(payload) {
  const nowIso = new Date().toISOString();
  const threadId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const buyerName = payload.buyerName || "ログインユーザー";
  const buyerId = payload.buyerId || buyerName;
  const buyerEmail = payload.buyerEmail || "";
  const buyerIcon = payload.buyerIcon || "";
  const bodyParts = [String(payload.body || "").trim()];
  if (payload.desiredDate) bodyParts.push(`\n希望受け渡し日時: ${payload.desiredDate}`);
  if (payload.note) bodyParts.push(`\n希望連絡事項: ${payload.note}`);
  const fullBody = bodyParts.filter(Boolean).join("\n").trim();
  const postId = String(payload.postId || "");
  let isMock = ccIsMockPostKey(postId);
  if (!isMock && postId) {
    const post = ccGetPostByKey(postId, { includeHidden: true });
    if (post && ccIsMockPost(post)) isMock = true;
  }

  const thread = {
    threadId,
    postId: postId,
    postTitle: payload.postTitle || "",
    postPrice: payload.postPrice || "",
    postCity: payload.postCity || "",
    postCategory: payload.postCategory || "",
    sellerName: payload.sellerName || "投稿者",
    sellerId: payload.sellerId || payload.sellerName || "seller_unknown",
    buyerName,
    buyerId,
    buyerEmail,
    buyerIcon,
    status: "open",
    createdAt: nowIso,
    updatedAt: nowIso,
    lastSellerMessageAt: "",
    lastBuyerMessageAt: nowIso,
    isMock: isMock,
    source: isMock ? "mock" : "user",
    messages: [
      {
        messageId,
        senderType: "buyer",
        body: fullBody,
        createdAt: nowIso
      }
    ]
  };

  const token = {
    tokenId: `tok_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    threadId,
    token: Math.random().toString(36).slice(2, 10),
    sellerName: thread.sellerName,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastUsedAt: "",
    createdAt: nowIso
  };

  const threads = ccLoadInquiryThreads();
  threads.push(thread);
  ccSaveInquiryThreads(threads);

  const tokens = ccLoadInquiryTokens();
  tokens.push(token);
  ccSaveInquiryTokens(tokens);

  const listings = ccLoadInquiryListings();
  const listingKey = thread.postId || thread.threadId;
  const existing = listings[listingKey];
  if (!existing) {
    listings[listingKey] = {
      postId: thread.postId || listingKey,
      category: thread.postCategory || "sell",
      plannedUsers: [],
      capacity: payload.capacity ?? null,
      publicStatus: "active",
      scheduledCounterpartyUserId: ""
    };
  } else {
    if (!existing.category) existing.category = thread.postCategory || "sell";
    if (!Array.isArray(existing.plannedUsers)) existing.plannedUsers = [];
    if (!existing.publicStatus) existing.publicStatus = "active";
    if (!existing.scheduledCounterpartyUserId) existing.scheduledCounterpartyUserId = "";
  }
  ccSaveInquiryListings(listings);

  const sellerNoticeUser = String(thread.sellerName || "").trim();
  if (sellerNoticeUser) {
    addNotice({
      userId: sellerNoticeUser,
      category: "trade",
      type: "inquiry_received",
      title: "問い合わせを受信しました",
      body: `『${thread.postTitle || "投稿"}』に問い合わせが届きました`,
      link: thread.threadId ? `inquiry-thread.html?thread=${encodeURIComponent(thread.threadId)}` : "mypage.html?tab=inquiries",
      createdAt: nowIso,
      readAt: null,
      hiddenAt: null
    });
  }

  return { thread, token };
}

function ccLoadSellerInquiries() {
  try {
    const raw = localStorage.getItem(CC_SELLER_INQUIRIES_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (!data || typeof data !== "object") return {};
    let touched = false;
    Object.keys(data).forEach((key) => {
      if (ccIsLegacySeedKey(key)) {
        delete data[key];
        touched = true;
      }
    });
    if (touched) ccSaveSellerInquiries(data);
    return data;
  } catch (e) {
    return {};
  }
}

function ccSaveSellerInquiries(data) {
  try {
    localStorage.setItem(CC_SELLER_INQUIRIES_KEY, JSON.stringify(data || {}));
  } catch (e) { }
}

function ccSeedSellerInquiryMock() {
  return;
}

function ccSeedSellerInquiryForUserPosts() {
  const me = getAccountName() || "まうす";
  const posts = ccLoadUserPosts();
  if (!posts.length) return;
  const data = ccLoadSellerInquiries();
  let touched = false;
  posts.forEach((post) => {
    const title = String(post?.title || "");
    const author = String(post?.author || "");
    const key = String(post?.key || "");
    if (!key || !title) return;
    if (author && author !== me) return;
    if (!/test/i.test(title)) return;
    if (data[key]) return;
    data[key] = {
      count: 1,
      lastAt: new Date().toISOString(),
      preview: "テスト投稿への問い合わせです。詳細を教えてください。"
    };
    touched = true;
  });
  if (touched) ccSaveSellerInquiries(data);
}

function applySellerInquiryCounts() {
  const data = ccLoadSellerInquiries();
  const cards = document.querySelectorAll(".mypage-panel .card[data-post-key]");
  cards.forEach((card) => {
    const key = String(card.dataset.postKey || "").trim();
    if (!key || !data[key]) return;
    const count = Number(data[key].count || 0);
    const msgSpan = card.querySelector(".myposts-stats span:last-child");
    if (msgSpan) {
      msgSpan.innerHTML = `<i class="fa-regular fa-message"></i> ${count}`;
    }
  });
}

function ccSeedInquiryHistoryMock() {
  return;
}

function initInquiryForm() {
  const form = document.getElementById("inquiry-form");
  if (!form) return;

  const params = new URLSearchParams(location.search || "");
  const postId = params.get("post") || "";
  const postTitle = params.get("title") || "";
  const postPrice = params.get("price") || "";
  const postCity = params.get("city") || "";
  const sellerName = params.get("seller") || "";
  const sellerId = params.get("sellerId") || params.get("seller_id") || "";
  const postCategory = params.get("cat") || params.get("category") || "";

  const titleEl = document.getElementById("inquiry-post-title");
  const priceEl = document.getElementById("inquiry-post-price");
  const cityEl = document.getElementById("inquiry-post-city");
  const sellerEl = document.getElementById("inquiry-post-seller");
  const idEl = document.getElementById("inquiry-post-id");
  const isMockPost = ccIsMockPostKey(postId);
  if (titleEl) titleEl.textContent = ccGetPostDisplayTitle({ title: postTitle, key: postId, isMock: isMockPost }, "—");
  if (priceEl) priceEl.textContent = postPrice || "—";
  if (cityEl) cityEl.textContent = postCity || "—";
  if (sellerEl) sellerEl.textContent = ccGetDisplayNameWithMock(sellerName || "投稿者", isMockPost);
  if (idEl) idEl.textContent = postId || "—";

  const noteEl = document.getElementById("inquiry-submit-note");
  const submitBtn = document.getElementById("inquiry-submit");
  const success = document.getElementById("inquiry-success");
  const devLinkWrap = document.getElementById("inquiry-dev-link");
  const replyLink = document.getElementById("inquiry-reply-link");
  const bodyInput = document.getElementById("inquiry-body");
  const dateInput = document.getElementById("inquiry-date");
  const noteInput = document.getElementById("inquiry-note");

  if (isCurrentUserBanned()) {
    if (bodyInput) bodyInput.disabled = true;
    if (dateInput) dateInput.disabled = true;
    if (noteInput) noteInput.disabled = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-disabled", "true");
    }
    if (noteEl) noteEl.textContent = "アカウントが停止されているため送信できません。";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (submitBtn && submitBtn.disabled) return;
    if (!assertNotBanned("アカウントが停止されているため送信できません。")) return;

    const body = String(document.getElementById("inquiry-body")?.value || "").trim();
    const desiredDate = String(document.getElementById("inquiry-date")?.value || "").trim();
    const note = String(document.getElementById("inquiry-note")?.value || "").trim();
    if (!ccCheckNgWords([body, note].join(" "), "inquiry")) return;

    if (!sellerId) {
      if (noteEl) noteEl.textContent = "相手情報の取得に失敗しました。ページを再読み込みしてください。";
      return;
    }

    if (!body) {
      if (noteEl) noteEl.textContent = "問い合わせ本文を入力してください。";
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (noteEl) noteEl.textContent = "送信中...";

    try {
      const buyerName = getAccountName() || getUserEmail() || "ログインユーザー";
      const buyerId = getAccountName() || buyerName;
      const buyerEmail = getUserEmail() || "";
      const result = ccCreateInquiryThread({
        postId,
        postTitle,
        postPrice,
        postCity,
        postCategory,
        sellerName,
        sellerId,
        buyerName,
        buyerId,
        buyerEmail,
        body,
        desiredDate,
        note
      });

      form.hidden = true;
      if (success) success.hidden = false;
      if (noteEl) noteEl.textContent = "";

      if (result && result.token && devLinkWrap && replyLink) {
        replyLink.href = `reply.html?thread=${encodeURIComponent(result.thread.threadId)}&token=${encodeURIComponent(result.token.token)}`;
        devLinkWrap.hidden = false;
      }
    } catch (e2) {
      if (noteEl) noteEl.textContent = "送信に失敗しました。時間をおいて再度お試しください。";
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function initBoardBanGuard() {
  if (!isCurrentUserBanned()) return;
  const stop = (el, message) => {
    if (!el) return;
    el.setAttribute("aria-disabled", "true");
    if (el.tagName === "BUTTON" || el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.disabled = true;
    }
    el.classList.add("is-disabled");
    el.addEventListener("click", (e) => {
      e.preventDefault();
      assertNotBanned(message || "アカウントが停止されているため操作できません。");
    });
  };

  stop(document.querySelector(".board-post-btn"), "アカウントが停止されているため投稿できません。");
  stop(document.getElementById("board-submit"), "アカウントが停止されているため投稿できません。");
  stop(document.getElementById("board-title"), "アカウントが停止されているため投稿できません。");
  stop(document.getElementById("board-body"), "アカウントが停止されているため投稿できません。");
  stop(document.getElementById("board-anon-toggle"), "アカウントが停止されているため投稿できません。");
  stop(document.getElementById("reply-submit"), "アカウントが停止されているため返信できません。");
  stop(document.getElementById("reply-body"), "アカウントが停止されているため返信できません。");
  stop(document.getElementById("reply-anon-toggle"), "アカウントが停止されているため返信できません。");
}

function initReplyForm() {
  const form = document.getElementById("reply-form");
  if (!form) return;

  const params = new URLSearchParams(location.search || "");
  const tokenValue = params.get("token") || "";
  const threadId = params.get("thread") || "";

  const errorWrap = document.getElementById("reply-error");
  const errorText = document.getElementById("reply-error-text");
  const noteEl = document.getElementById("reply-submit-note");
  const submitBtn = document.getElementById("reply-submit");
  const success = document.getElementById("reply-success");

  const showError = (msg) => {
    if (errorText) errorText.textContent = msg;
    if (errorWrap) errorWrap.hidden = false;
    form.hidden = true;
  };

  if (!tokenValue || !threadId) {
    showError("リンクが無効です。再度メールのリンクをご確認ください。");
    return;
  }

  const threads = ccLoadInquiryThreads();
  const tokens = ccLoadInquiryTokens();
  const tokenRec = tokens.find((t) => t.token === tokenValue && t.threadId === threadId);
  const thread = threads.find((t) => t.threadId === threadId);

  if (!tokenRec || !thread) {
    showError("リンクが無効です。再度メールのリンクをご確認ください。");
    return;
  }

  if (tokenRec.sellerName && tokenRec.sellerName !== thread.sellerName) {
    showError("リンクが無効です。再度メールのリンクをご確認ください。");
    return;
  }

  if (tokenRec.expiresAt && Date.now() > Date.parse(tokenRec.expiresAt)) {
    showError("リンクの有効期限が切れています。");
    return;
  }

  const titleEl = document.getElementById("reply-post-title");
  const idEl = document.getElementById("reply-post-id");
  const excerptEl = document.getElementById("reply-inquiry-excerpt");
  if (titleEl) {
    titleEl.textContent = ccGetPostDisplayTitle({
      title: thread.postTitle,
      key: thread.postId,
      isMock: thread.isMock,
      source: thread.source
    }, "—");
  }
  if (idEl) idEl.textContent = thread.postId || "—";

  const buyerMessages = (thread.messages || []).filter((m) => m.senderType === "buyer");
  const lastBuyer = buyerMessages.length ? buyerMessages[buyerMessages.length - 1] : null;
  const rawExcerpt = lastBuyer ? String(lastBuyer.body || "") : "";
  const trimmedExcerpt = rawExcerpt.replace(/\n/g, " ").slice(0, 100);
  if (excerptEl) excerptEl.textContent = ccMaskContactText(trimmedExcerpt || "—");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (submitBtn && submitBtn.disabled) return;

    const body = String(document.getElementById("reply-body")?.value || "").trim();
    if (!body) {
      if (noteEl) noteEl.textContent = "返信本文を入力してください。";
      return;
    }

    const now = Date.now();
    const lastTokenUse = tokenRec.lastUsedAt ? Date.parse(tokenRec.lastUsedAt) : 0;
    const lastSeller = thread.lastSellerMessageAt ? Date.parse(thread.lastSellerMessageAt) : 0;
    if ((lastTokenUse && now - lastTokenUse < CC_INQUIRY_RATE_LIMIT_MS) || (lastSeller && now - lastSeller < CC_INQUIRY_RATE_LIMIT_MS)) {
      if (noteEl) noteEl.textContent = "短時間での連続送信はできません。時間をおいて再度お試しください。";
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (noteEl) noteEl.textContent = "送信中...";

    const nowIso = new Date().toISOString();
    thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
    thread.messages.push({
      messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderType: "seller",
      body,
      createdAt: nowIso
    });
    thread.updatedAt = nowIso;
    thread.lastSellerMessageAt = nowIso;
    tokenRec.lastUsedAt = nowIso;

    ccSaveInquiryThreads(threads);
    ccSaveInquiryTokens(tokens);

    const buyerNoticeUser = String(thread.buyerId || thread.buyerName || "").trim();
    if (buyerNoticeUser) {
      addNotice({
        userId: buyerNoticeUser,
        category: "trade",
        type: "inquiry_replied",
        title: "問い合わせに返信が届きました",
        body: `『${thread.postTitle || "投稿"}』への返信を確認してください`,
        link: thread.threadId ? `inquiry-thread.html?thread=${encodeURIComponent(thread.threadId)}` : "mypage.html?tab=inquiries",
        createdAt: nowIso,
        readAt: null,
        hiddenAt: null
      });
    }

    form.hidden = true;
    if (success) success.hidden = false;
    if (noteEl) noteEl.textContent = "";
  });
}

function initInquiryHistory() {
  const listEl = document.getElementById("inquiry-history-list");
  const detailEl = document.getElementById("inquiry-history-detail");
  if (!listEl || !detailEl) return;

  if (CC_SEED_MODE === "mock") ccSeedInquiryHistoryMock();
  const searchEl = document.getElementById("inquiry-search");
  const searchBtn = document.getElementById("inquiry-search-btn");
  const sortSelect = document.getElementById("inquiry-sort-select");
  let sortValue = sortSelect ? (sortSelect.value || "new") : "new";
  const filterBtns = Array.from(document.querySelectorAll("[data-inquiry-filter]"));

  const threads = ccLoadInquiryThreads();
  let listings = ccLoadInquiryListings();
  const currentUserId = getAccountName() || getUserEmail() || "guest";
  const blockedMap = ccLoadInquiryBlocked();
  const blockedSet = new Set(blockedMap[currentUserId] || []);
  if (!threads.length) {
    listEl.innerHTML = '<div class="cc-inbox-empty">問い合わせはまだありません。<div><a class="btn btn-secondary" href="list.html">投稿を探す</a></div></div>';
  }

  let activeThreadId = "";
  let currentQuery = "";

  const getLastMessage = (thread) => {
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    return messages.length ? messages[messages.length - 1] : null;
  };

  const getStatusInfo = (thread) => {
    const last = getLastMessage(thread);
    if (!last || last.senderType === "buyer") return { label: "返信待ち", className: "is-waiting" };
    return { label: "返信済み", className: "is-replied" };
  };

  const PLAN_ALLOWED = new Set(["housing", "jobs", "sell", "help", "services", "community", "events", "school"]);
  const PLAN_SINGLE = new Set(["housing", "jobs", "sell"]);
  const PLAN_ACTION_LABELS = {
    sell: "取引予定者にする",
    housing: "入居予定者にする",
    jobs: "面談予定者にする",
    help: "対応予定者に追加",
    services: "予約予定者に追加",
    community: "参加予定者に追加",
    events: "参加予定者に追加",
    school: "受講予定者に追加"
  };
  const PLAN_STATUS_LABELS = {
    sell: "取引予定者",
    housing: "入居予定者",
    jobs: "面談予定者",
    help: "対応予定",
    services: "予約予定",
    community: "参加予定",
    events: "参加予定",
    school: "受講予定"
  };
  const PLAN_CONFIRM_LABELS = {
    sell: "取引予定者にしますか？",
    housing: "入居予定者にしますか？",
    jobs: "面談予定者にしますか？",
    help: "対応予定者に追加しますか？",
    services: "予約予定者に追加しますか？",
    community: "参加予定者に追加しますか？",
    events: "参加予定者に追加しますか？",
    school: "受講予定者に追加しますか？"
  };

  const normalizeCategory = (cat) => String(cat || "").trim().toLowerCase();

  const ensureListing = (thread) => {
    const listingKey = thread.postId || thread.threadId;
    let listing = listings[listingKey];
    if (!listing) {
      listing = {
        postId: thread.postId || listingKey,
        category: thread.postCategory || "sell",
        plannedUsers: [],
        capacity: null,
        publicStatus: "active",
        scheduledCounterpartyUserId: ""
      };
      listings[listingKey] = listing;
      ccSaveInquiryListings(listings);
    } else {
      if (!listing.category) listing.category = thread.postCategory || "sell";
      if (!Array.isArray(listing.plannedUsers)) listing.plannedUsers = [];
      if (!listing.publicStatus) listing.publicStatus = "active";
      if (!listing.scheduledCounterpartyUserId) listing.scheduledCounterpartyUserId = "";
    }
    return listing;
  };

  const getPlanConfig = (cat) => {
    const key = normalizeCategory(cat);
    if (!PLAN_ALLOWED.has(key)) return null;
    const limit = PLAN_SINGLE.has(key) ? 1 : Infinity;
    return {
      key,
      limit,
      isSingle: PLAN_SINGLE.has(key),
      actionLabel: PLAN_ACTION_LABELS[key] || "予定者にする",
      statusLabel: PLAN_STATUS_LABELS[key] || "予定者",
      confirmLabel: PLAN_CONFIRM_LABELS[key] || "予定者にしますか？"
    };
  };

  const getOtherUser = (thread, isSellerView) => {
    if (isSellerView) {
      const name = thread.buyerName || "問い合わせ者";
      return { id: thread.buyerId || name, name };
    }
    const name = thread.sellerName || "投稿者";
    return { id: thread.sellerId || name, name };
  };

  const isThreadHidden = (thread) => {
    const hiddenBy = thread && thread.hiddenBy ? thread.hiddenBy : {};
    return !!hiddenBy[currentUserId];
  };

  const saveListings = () => {
    ccSaveInquiryListings(listings);
  };

  const ensureConfirmModal = () => {
    let modal = document.getElementById("cc-inbox-confirm");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "cc-inbox-confirm";
    modal.className = "cc-inbox-modal";
    modal.innerHTML = `
      <div class="cc-inbox-modal-dialog" role="dialog" aria-modal="true">
        <div class="cc-inbox-modal-title">確認</div>
        <div class="cc-inbox-modal-message"></div>
        <div class="cc-inbox-modal-actions">
          <button type="button" class="btn btn-secondary" data-modal-cancel>キャンセル</button>
          <button type="button" class="btn btn-primary" data-modal-ok>OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const reasonEl = modal.querySelector("#cc-report-reason");
    ccApplyReportReasonsToSelect(reasonEl);
    ccResetSelectDropdown(reasonEl);
    ccInitSelectDropdowns(modal);
    return modal;
  };

  const ensureReportModal = () => {
    let modal = document.getElementById("cc-inbox-report");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "cc-inbox-report";
    modal.className = "cc-inbox-modal";
    modal.innerHTML = `
      <div class="cc-inbox-modal-dialog" role="dialog" aria-modal="true">
        <div class="cc-inbox-modal-title">通報する</div>
        <div class="cc-modal-form">
          <div class="cc-modal-field">
            <label class="cc-modal-label" for="cc-report-reason">理由</label>
            <div class="cc-dropdown cc-select admin-inline-select">
              <button class="cc-dd-toggle" type="button" aria-haspopup="listbox" aria-expanded="false">
                <span class="cc-dd-value"></span>
              </button>
              <div class="cc-dd-menu" role="listbox"></div>
              <select id="cc-report-reason" class="cc-hidden-select"></select>
            </div>
          </div>
          <div class="cc-inbox-modal-hint"></div>
          <div class="cc-modal-field">
            <label class="cc-modal-label" for="cc-report-note">メモ（任意）</label>
            <textarea id="cc-report-note" class="cc-modal-input" rows="3" maxlength="500" placeholder="任意のメモを入力"></textarea>
          </div>
        </div>
        <div class="cc-inbox-modal-actions">
          <button type="button" class="btn btn-secondary" data-report-cancel>キャンセル</button>
          <button type="button" class="btn btn-primary" data-report-submit>送信</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  };

  const showToast = (message) => {
    if (!message) return;
    const toast = document.createElement("div");
    toast.className = "cc-inbox-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });
    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  };

  const openReportModal = ({ thread, targetUserId, targetUserName }) => {
    const modal = ensureReportModal();
    const reasonEl = modal.querySelector("#cc-report-reason");
    const noteEl = modal.querySelector("#cc-report-note");
    const submitBtn = modal.querySelector("[data-report-submit]");
    const cancelBtn = modal.querySelector("[data-report-cancel]");
    const hintEl = modal.querySelector(".cc-inbox-modal-hint");
    ccApplyReportReasonsToSelect(reasonEl);
    ccResetSelectDropdown(reasonEl);
    ccInitSelectDropdowns(modal);
    const close = () => {
      modal.classList.remove("is-open");
    };
    const onCancel = () => close();
    const onSubmit = () => {
      const reports = ccLoadInquiryReports();
      const now = Date.now();
      const nowIso = new Date(now).toISOString().replace(/\.\d{3}Z$/, "Z");
      const oneDay = 24 * 60 * 60 * 1000;
      const already = reports.find((r) => String(r.threadId) === String(thread.threadId)
        && String(r.reporterUserId) === String(currentUserId)
        && (now - Date.parse(r.createdAt || "")) < oneDay);
      if (already) {
        showToast("通報済みです（24時間に1回まで）。");
        close();
        return;
      }
      reports.push({
        reporterUserId: currentUserId,
        targetUserId: targetUserId || "",
        targetUserName: targetUserName || "",
        threadId: thread.threadId,
        listingId: thread.postId || "",
        reason: reasonEl ? reasonEl.value : "other",
        note: noteEl ? noteEl.value.trim() : "",
        createdAt: nowIso,
        reported_at_iso: nowIso,
        reported_at_epoch_ms: now
      });
      ccSaveInquiryReports(reports);
      ccAddReport({
        report_id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        target_type: "inquiry_thread",
        target_key: String(thread.threadId || ""),
        reason: reasonEl ? String(reasonEl.value || "other") : "other",
        detail: noteEl ? String(noteEl.value || "").trim() : "",
        reporter_email: getUserEmail() || "",
        reporter_name: getAccountName() || "",
        created_at: nowIso,
        reported_at_iso: nowIso,
        reported_at_epoch_ms: now,
        thread_id: String(thread.threadId || ""),
        post_key: String(thread.postId || ""),
        buyer_email: String(thread.buyerEmail || ""),
        seller_email: String(thread.sellerEmail || ""),
        status: "new",
        assigned_to: "",
        internal_note: "",
        priority: "normal",
        due_at_iso: "",
        handled_by: "",
        handled_at: ""
      });
      showToast("通報を受け付けました。");
      close();
      renderDetail(thread);
    };
    if (hintEl) {
      const reports = ccLoadInquiryReports();
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const already = reports.find((r) => String(r.threadId) === String(thread.threadId)
        && String(r.reporterUserId) === String(currentUserId)
        && (now - Date.parse(r.createdAt || "")) < oneDay);
      hintEl.textContent = already ? "このスレッドは24時間に1回まで通報できます。" : "24時間に1回まで通報できます。";
    }
    if (submitBtn) submitBtn.onclick = onSubmit;
    if (cancelBtn) cancelBtn.onclick = onCancel;
    modal.onclick = (e) => {
      if (e.target === modal) close();
    };
    modal.classList.add("is-open");
  };

  let pendingConfirm = null;
  const openConfirm = ({ title = "確認", message, okText = "OK", cancelText = "キャンセル", onOk }) => {
    const modal = ensureConfirmModal();
    const titleEl = modal.querySelector(".cc-inbox-modal-title");
    const msgEl = modal.querySelector(".cc-inbox-modal-message");
    const okBtn = modal.querySelector("[data-modal-ok]");
    const cancelBtn = modal.querySelector("[data-modal-cancel]");
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message || "";
    if (okBtn) okBtn.textContent = okText;
    if (cancelBtn) {
      cancelBtn.textContent = cancelText;
      cancelBtn.style.display = cancelText ? "inline-flex" : "none";
    }
    pendingConfirm = onOk || null;
    modal.classList.add("is-open");
    const close = () => {
      modal.classList.remove("is-open");
      pendingConfirm = null;
    };
    const onCancel = () => close();
    const onConfirm = () => {
      const cb = pendingConfirm;
      close();
      if (cb) cb();
    };
    if (okBtn) okBtn.onclick = onConfirm;
    if (cancelBtn) cancelBtn.onclick = onCancel;
    modal.onclick = (e) => {
      if (e.target === modal) close();
    };
  };

  const appendSystemMessage = (thread, text) => {
    if (!text) return;
    const nowIso = new Date().toISOString();
    thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
    thread.messages.push({
      messageId: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderType: "system",
      body: text,
      createdAt: nowIso
    });
    thread.updatedAt = nowIso;
  };

  const ensureLightbox = () => {
    let box = document.getElementById("cc-inbox-lightbox");
    if (box) return box;
    box = document.createElement("div");
    box.id = "cc-inbox-lightbox";
    box.className = "cc-inbox-lightbox";
    box.innerHTML = `
      <div class="cc-inbox-lightbox-inner" role="dialog" aria-modal="true">
        <button type="button" class="cc-inbox-lightbox-close" aria-label="閉じる">×</button>
        <img class="cc-inbox-lightbox-img" alt="" />
      </div>
    `;
    document.body.appendChild(box);
    box.addEventListener("click", (e) => {
      if (e.target === box || (e.target && e.target.classList.contains("cc-inbox-lightbox-close"))) {
        box.classList.remove("is-open");
        document.body.style.overflow = "";
      }
    });
    return box;
  };

  const openLightbox = (src, altText) => {
    if (!src) return;
    const box = ensureLightbox();
    const img = box.querySelector(".cc-inbox-lightbox-img");
    if (img) {
      img.src = src;
      img.alt = altText || "preview";
    }
    box.classList.add("is-open");
    document.body.style.overflow = "hidden";
  };

  const renderList = () => {
    const query = String(currentQuery || "").trim().toLowerCase();
    const filter = (filterBtns.find((b) => b.classList.contains("is-active"))?.dataset?.inquiryFilter || "all");
    const mode = sortValue || "new";

    let filtered = threads.slice();
    filtered = filtered.filter((t) => !isThreadHidden(t));
    filtered = filtered.filter((t) => {
      const isSellerView = String(t.sellerName || "") === currentUserId;
      const other = getOtherUser(t, isSellerView);
      return !blockedSet.has(String(other.id));
    });
    if (query) {
      filtered = filtered.filter((t) => {
        const last = getLastMessage(t);
        const body = last ? String(last.body || "") : "";
        return [
          t.postTitle,
          t.postCity,
          t.postId,
          body
        ].some((val) => String(val || "").toLowerCase().includes(query));
      });
    }

    if (filter !== "all") {
      filtered = filtered.filter((t) => {
        const last = getLastMessage(t);
        if (filter === "waiting") return !last || last.senderType === "buyer";
        if (filter === "unread") return !!t.unread;
        return true;
      });
    }

    filtered.sort((a, b) => {
      const ta = Date.parse(a.updatedAt || a.createdAt || "") || 0;
      const tb = Date.parse(b.updatedAt || b.createdAt || "") || 0;
      return mode === "old" ? ta - tb : tb - ta;
    });

    if (!filtered.length) {
      listEl.innerHTML = '<div class="cc-inbox-empty">該当する問い合わせがありません。</div>';
      return;
    }

    const fallbackNames = ["Rina", "Sota", "Yuki", "Hana"];
    listEl.innerHTML = filtered.map((t, idx) => {
      const last = getLastMessage(t);
      let preview = "メッセージがありません。";
      if (last) {
        const hasImage = Array.isArray(last.attachments)
          && last.attachments.some((a) => a && a.type && a.type.startsWith("image/"));
        const hasFile = Array.isArray(last.attachments)
          && last.attachments.some((a) => a && a.type && a.type === "application/pdf");
        if (hasImage && !String(last.body || "").trim()) {
          preview = last.senderType === "buyer" ? "写真を送信しました" : "写真が送信されました";
        } else if (hasFile && !String(last.body || "").trim()) {
          preview = last.senderType === "buyer" ? "PDFを送信しました" : "PDFが送信されました";
        } else {
          preview = String(last.body || "").replace(/\n/g, " ").slice(0, 40);
        }
      }
      const status = getStatusInfo(t);
      const isThreadMock = ccIsThreadMock(t);
      const accountName = getAccountName() || "";
      const isBuyerView = String(t.buyerId || "") === accountName;
      const isSellerView = String(t.sellerName || "") === accountName;
      const rawSender = isBuyerView ? (t.sellerName || "投稿者") : (t.buyerName || "");
      const sender = rawSender && rawSender !== "ログインユーザー"
        ? rawSender
        : fallbackNames[idx % fallbackNames.length];
      const displaySender = ccGetDisplayNameWithMock(sender, isThreadMock);
      const senderIcon = isBuyerView ? "" : String(t.buyerIcon || "");
      const profileHref = sender ? ccBuildProfileLinkWithContext(sender, { from: "mypage", thread: t.threadId }) : "profile-view.html";
      if (!t.sellerId) t.sellerId = "u_seller_001";
      const listing = ensureListing(t);
      const planConfig = getPlanConfig(listing.category || t.postCategory || "");
      const otherUser = getOtherUser(t, isSellerView);
      const hasPlanned = !!(planConfig && isSellerView && (listing.plannedUsers || []).some((u) => String(u.userId) === String(otherUser.id)));
      const planBadge = hasPlanned ? '<span class="cc-inbox-plan-badge">予定者に設定中</span>' : "";
      return `
        <div class="cc-inbox-item${activeThreadId === t.threadId ? " is-active" : ""}" role="button" tabindex="0" data-thread-id="${escapeHtml(String(t.threadId || ""))}">
          <a class="cc-inbox-avatar" href="${escapeHtml(profileHref)}" aria-label="${escapeHtml(String(displaySender))}のプロフィール">
            ${senderIcon ? `<img src="${escapeHtml(senderIcon)}" alt="${escapeHtml(String(displaySender))}" />` : `<span>${escapeHtml(String(displaySender || "？").charAt(0))}</span>`}
          </a>
          <div class="cc-inbox-main">
            <div class="cc-inbox-line">
              <span class="cc-inbox-sender">${escapeHtml(String(displaySender))}</span>
              ${planBadge}
            </div>
            <div class="cc-inbox-title">${escapeHtml(ccGetPostDisplayTitle({ title: t.postTitle, key: t.postId, isMock: isThreadMock, source: t.source }, "（無題）"))}</div>
            <div class="cc-inbox-preview">${escapeHtml(preview)}</div>
          </div>
          <div class="cc-inbox-side">
            <div>${escapeHtml(ccFormatDateTime(t.updatedAt || t.createdAt))}</div>
            <span class="cc-inbox-badge ${status.className}">${escapeHtml(status.label)}</span>
          </div>
        </div>
      `;
    }).join("");

    const items = Array.from(listEl.querySelectorAll(".cc-inbox-item"));
    items.forEach((btn) => {
      const avatarLink = btn.querySelector(".cc-inbox-avatar");
      if (avatarLink) {
        avatarLink.addEventListener("click", (e) => {
          e.stopPropagation();
        });
      }
      btn.addEventListener("click", () => {
        items.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        activeThreadId = btn.dataset.threadId || "";
        const thread = threads.find((t) => String(t.threadId) === String(activeThreadId));
        renderDetail(thread);
      });
    });

    if (!activeThreadId && items[0]) items[0].click();
  };

  const renderDetail = (thread) => {
    if (!thread) return;
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    const status = getStatusInfo(thread);
    const detailLink = thread.postId ? `detail.html?post=${encodeURIComponent(String(thread.postId))}` : "detail.html";
    const isThreadMock = ccIsThreadMock(thread);

    const accountName = getAccountName() || "";
    const isSellerView = String(thread.sellerName || "") === accountName;
    const viewerType = isSellerView ? "seller" : "buyer";
    const counterNameRaw = isSellerView ? (thread.buyerName || "問い合わせ者") : (thread.sellerName || "投稿者");
    const counterName = counterNameRaw === "ログインユーザー" ? "問い合わせ者" : counterNameRaw;
    const counterDisplayName = ccGetDisplayNameWithMock(counterName, isThreadMock);
    const listing = ensureListing(thread);
    const catKey = listing.category || thread.postCategory || "sell";
    const catLabel = ccGetCategoryLabel(catKey) || catKey;
    const catIconMap = {
      sell: "fa-tag",
      housing: "fa-house",
      jobs: "fa-briefcase",
      help: "fa-handshake",
      services: "fa-wand-magic-sparkles",
      community: "fa-people-group",
      events: "fa-calendar-days",
      school: "fa-graduation-cap"
    };
    const catIcon = catIconMap[catKey] || "fa-tag";
    const planConfig = getPlanConfig(catKey);
    const canPlan = !!(planConfig && isSellerView);
    const plannedUsers = Array.isArray(listing.plannedUsers) ? listing.plannedUsers : [];
    const plannedCount = plannedUsers.length;
    const hasPlanned = plannedCount > 0;
    const publicStatus = listing.publicStatus === "completed" ? "completed" : "active";
    const publicStatusLabel = publicStatus === "completed" ? "受付終了" : "受付中";
    const capacity = Number(listing.capacity || 0);
    const planLimit = planConfig
      ? (planConfig.isSingle ? 1 : (capacity > 0 ? capacity : Infinity))
      : 0;
    let plannedInfo = "";
    if (canPlan && hasPlanned) {
      if (planConfig.isSingle) {
        const plannedName = plannedUsers[0]?.userName || plannedUsers[0]?.userId || counterName;
        plannedInfo = `${planConfig.statusLabel}：${ccGetDisplayNameWithMock(plannedName, isThreadMock)}`;
      } else {
        plannedInfo = `参加予定：${counterDisplayName}`;
      }
    }
    let primaryAction = "";
    let secondaryActions = "";
    if (canPlan) {
      const limitReached = Number.isFinite(planLimit) && plannedCount >= planLimit;
      if (publicStatus === "active") {
        if (!hasPlanned) {
          primaryAction = `<button class="btn btn-primary cc-inbox-primary-action" type="button" data-action="plan-add">${escapeHtml(planConfig.actionLabel)}</button>`;
          secondaryActions = `<button class="cc-inbox-secondary-link" type="button" data-action="close">受付終了</button>`;
        } else {
          primaryAction = `<button class="btn btn-primary cc-inbox-primary-action" type="button" data-action="close">受付終了</button>`;
          const secondaryList = [];
          secondaryList.push(`<button class="cc-inbox-secondary-link" type="button" data-action="plan-remove">予定者を解除</button>`);
          secondaryActions = secondaryList.join("");
        }
      } else {
        const secondaryList = [];
        if (!hasPlanned && !limitReached) {
          secondaryList.push(`<button class="cc-inbox-secondary-link" type="button" data-action="plan-add">${escapeHtml(planConfig.actionLabel)}</button>`);
        } else if (hasPlanned) {
          secondaryList.push(`<button class="cc-inbox-secondary-link" type="button" data-action="plan-remove">予定者を解除</button>`);
        }
        secondaryActions = secondaryList.join("");
      }
    }
    let unreadInserted = false;
    const unreadStartIdx = (() => {
      if (!thread.unread) return -1;
      const lastSelfIdx = messages.map((m) => m.senderType).lastIndexOf(viewerType);
      if (lastSelfIdx < 0) {
        return messages.findIndex((m) => m.senderType !== viewerType);
      }
      for (let i = lastSelfIdx + 1; i < messages.length; i += 1) {
        if (messages[i].senderType !== viewerType) return i;
      }
      return -1;
    })();
    const messageHtml = messages.map((m, idx) => {
      const divider = (!unreadInserted && unreadStartIdx === idx)
        ? (unreadInserted = true, '<div class="cc-inbox-unread-divider"><span>未読</span></div>')
        : "";
      if (m.senderType === "system") {
        return `
          ${divider}
          <div class="cc-inbox-system">
            <span>${escapeHtml(String(m.body || ""))}</span>
          </div>
        `;
      }
      const isSelf = m.senderType === viewerType;
      const attachments = Array.isArray(m.attachments) ? m.attachments : [];
      const attachmentsHtml = attachments.length
        ? `<div class="cc-inbox-attachments cc-inbox-bubble-attachments">${attachments.map((a) => {
          const isImage = a && a.type && a.type.startsWith("image/");
          const safeUrl = a && a.previewUrl ? escapeHtml(a.previewUrl) : "";
          if (isImage && safeUrl) {
            return `
                <button type="button" class="cc-inbox-attachment is-image" data-full="${safeUrl}" aria-label="画像を拡大表示">
                  <img src="${safeUrl}" alt="${escapeHtml(a.name || "image")}" />
                  <span class="cc-inbox-attachment-zoom"><i class="fa-solid fa-magnifying-glass"></i></span>
                </button>
              `;
          }
          if (safeUrl) {
            return `
                <a class="cc-inbox-attachment is-file" href="${safeUrl}" download="${escapeHtml(a.name || "file")}" target="_blank" rel="noreferrer">
                  <i class="fa-regular fa-file"></i><span>${escapeHtml(a.name || "file")}</span>
                </a>
              `;
          }
          return `<div class="cc-inbox-attachment is-file"><i class="fa-regular fa-file"></i><span>${escapeHtml(a.name || "file")}</span></div>`;
        }).join("")}</div>`
        : "";
      const bodyText = String(m.body || "");
      const bubbleHtml = bodyText.trim()
        ? `<div class="cc-inbox-bubble"><div class="cc-inbox-bubble-text">${escapeHtml(bodyText)}</div></div>`
        : "";
      const senderName = m.senderType === "buyer" ? (thread.buyerName || "問い合わせ者") : (thread.sellerName || "投稿者");
      const safeSender = senderName === "ログインユーザー" ? "問い合わせ者" : senderName;
      const displaySender = ccGetDisplayNameWithMock(safeSender, isThreadMock);
      const senderIcon = m.senderType === "buyer" ? String(thread.buyerIcon || "") : "";
      const profileHref = ccBuildProfileLinkWithContext(safeSender, { from: "mypage", thread: thread.threadId });
      const avatarHtml = !isSelf
        ? `
          <a class="cc-inbox-msg-avatar" href="${escapeHtml(profileHref)}" aria-label="${escapeHtml(String(displaySender))}のプロフィール">
            ${senderIcon ? `<img src="${escapeHtml(senderIcon)}" alt="${escapeHtml(String(displaySender))}" />` : `<span>${escapeHtml(String(displaySender).charAt(0))}</span>`}
          </a>
        `
        : "";
      return `
        ${divider}
        <div class="cc-inbox-message ${isSelf ? "is-self" : "is-other"}">
          ${isSelf ? "" : `<div class="cc-inbox-message-row">`}
          ${avatarHtml}
          <div class="cc-inbox-message-body">
            ${bubbleHtml}
            ${attachmentsHtml ? `<div class="cc-inbox-message-attachments">${attachmentsHtml}</div>` : ""}
            <div class="cc-inbox-message-time">${escapeHtml(ccFormatDateTime(m.createdAt))}</div>
          </div>
          ${isSelf ? "" : `</div>`}
        </div>
      `;
    }).join("");

    detailEl.innerHTML = `
      <div class="cc-inbox-summary">
        <div class="cc-inbox-summary-main">
          <div class="cc-inbox-summary-title-row">
            <a class="cc-inbox-summary-title-link" href="${detailLink}">${escapeHtml(ccGetPostDisplayTitle({ title: thread.postTitle, key: thread.postId, isMock: isThreadMock, source: thread.source }, "（無題）"))}</a>
            <span class="cc-inbox-public-status ${publicStatus === "completed" ? "is-closed" : "is-open"}">${escapeHtml(publicStatusLabel)}</span>
          </div>
          <div class="cc-inbox-summary-meta">
            ${catKey ? `<span class="cc-inbox-summary-chip"><i class="fa-solid ${escapeHtml(catIcon)}" aria-hidden="true"></i>${escapeHtml(String(catLabel))}</span>` : ""}
            ${plannedInfo ? `<span class="cc-inbox-summary-chip"><i class="fa-solid fa-user-check" aria-hidden="true"></i>${escapeHtml(plannedInfo)}</span>` : ""}
          </div>
        </div>
        <div class="cc-inbox-summary-actions">
          <div class="cc-inbox-summary-actions-main">
            ${primaryAction || ""}
            ${secondaryActions ? `<div class="cc-inbox-secondary-actions">${secondaryActions}</div>` : ""}
          </div>
          <div class="cc-inbox-menu">
            <button class="cc-inbox-menu-button" type="button" aria-haspopup="true" aria-expanded="false">⋯</button>
            <div class="cc-inbox-menu-list" role="menu">
              <button type="button" role="menuitem" data-action="report">通報する</button>
              <button type="button" role="menuitem" data-action="block">この相手をブロック</button>
              <button type="button" role="menuitem" data-action="leave">このスレッドを退出</button>
            </div>
          </div>
        </div>
      </div>
      <div class="cc-inbox-thread">
        <div class="cc-inbox-thread-list">${messageHtml || '<div class="cc-inbox-empty">メッセージがありません。</div>'}</div>
        <a class="cc-inbox-mobile-back" href="#inquiry-inbox-list">一覧に戻る</a>
        <form class="cc-inbox-composer" id="inquiry-history-form">
          <div class="cc-inbox-composer-row">
            <label class="cc-inbox-attach-btn" aria-label="添付">
              <input id="inquiry-history-attach" type="file" accept="image/*,application/pdf" />
              <i class="fa-solid fa-paperclip"></i>
            </label>
            <div class="cc-inbox-textbox">
              <textarea id="inquiry-history-body" rows="1" placeholder="テキストを入力してください。"></textarea>
              <div class="cc-inbox-attach-preview" id="inquiry-history-attachments"></div>
            </div>
            <button class="cc-inbox-send-icon" id="inquiry-history-submit" type="submit" aria-label="送信">
              <i class="fa-solid fa-paper-plane"></i>
            </button>
          </div>
          <p class="form-note" id="inquiry-history-note" role="status" aria-live="polite"></p>
        </form>
      </div>
    `;

    const menuButton = detailEl.querySelector(".cc-inbox-menu-button");
    const menuList = detailEl.querySelector(".cc-inbox-menu-list");
    if (menuButton && menuList) {
      const reports = ccLoadInquiryReports();
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const reportLimited = reports.some((r) => String(r.threadId) === String(thread.threadId)
        && String(r.reporterUserId) === String(currentUserId)
        && (now - Date.parse(r.createdAt || "")) < oneDay);
      if (reportLimited) {
        const reportBtn = menuList.querySelector("[data-action='report']");
        if (reportBtn) {
          reportBtn.textContent = "通報済み（24時間）";
          reportBtn.disabled = true;
          reportBtn.classList.add("is-disabled");
        }
      }
      menuButton.addEventListener("click", () => {
        const isOpen = menuList.classList.toggle("is-open");
        menuButton.setAttribute("aria-expanded", String(isOpen));
      });
      document.addEventListener("click", (e) => {
        if (!menuList.classList.contains("is-open")) return;
        if (menuList.contains(e.target) || menuButton.contains(e.target)) return;
        menuList.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");
      });
    }

    detailEl.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        if (!action) return;
        const listingKey = thread.postId || thread.threadId;
        const current = listings[listingKey] || ensureListing(thread);
        const other = getOtherUser(thread, isSellerView);
        const cfg = getPlanConfig(current.category || thread.postCategory || "sell");
        const cap = Number(current.capacity || 0);
        const limit = cfg ? (cfg.isSingle ? 1 : (cap > 0 ? cap : Infinity)) : 0;
        const planned = Array.isArray(current.plannedUsers) ? current.plannedUsers : [];
        const hasPlannedNow = planned.length > 0;

        if (action === "plan-add" && cfg && isSellerView) {
          const already = planned.some((u) => String(u.userId) === String(other.id));
          if (already) return;
          if (Number.isFinite(limit) && planned.length >= limit) {
            openConfirm({ message: "定員に達しました。", okText: "閉じる", cancelText: "" });
            return;
          }
          openConfirm({
            title: "予定者設定の確認",
            message: `${other.name}を${cfg.confirmLabel}`,
            okText: "設定する",
            cancelText: "キャンセル",
            onOk: () => {
              planned.push({
                userId: other.id,
                userName: other.name,
                threadId: thread.threadId,
                addedAt: new Date().toISOString()
              });
              current.plannedUsers = planned;
              current.scheduledCounterpartyUserId = String(other.id || "");
              listings[listingKey] = current;
              saveListings();
              appendSystemMessage(thread, "予定者に設定しました。");
              const idx = threads.findIndex((t) => String(t.threadId) === String(thread.threadId));
              if (idx >= 0) threads[idx] = thread;
              ccSaveInquiryThreads(threads);
              ccNotifyTxnStatusChange(thread, current, cfg.statusLabel);
              renderList();
              renderDetail(thread);
            }
          });
          return;
        }

        if (action === "plan-remove" && cfg && isSellerView) {
          openConfirm({
            title: "予定者解除の確認",
            message: "予定者を解除してよいですか？",
            okText: "解除する",
            cancelText: "キャンセル",
            onOk: () => {
              current.plannedUsers = planned.filter((u) => String(u.userId) !== String(other.id));
              if (String(current.scheduledCounterpartyUserId || "") === String(other.id)) {
                current.scheduledCounterpartyUserId = "";
              }
              listings[listingKey] = current;
              saveListings();
              appendSystemMessage(thread, "予定者を解除しました。");
              const idx = threads.findIndex((t) => String(t.threadId) === String(thread.threadId));
              if (idx >= 0) threads[idx] = thread;
              ccSaveInquiryThreads(threads);
              renderList();
              renderDetail(thread);
            }
          });
          return;
        }

        if (action === "close" && cfg && isSellerView) {
          const doClose = () => {
            current.publicStatus = "completed";
            listings[listingKey] = current;
            saveListings();
            appendSystemMessage(thread, "受付終了にしました。");
            const idx = threads.findIndex((t) => String(t.threadId) === String(thread.threadId));
            if (idx >= 0) threads[idx] = thread;
            ccSaveInquiryThreads(threads);
            ccNotifyTxnStatusChange(thread, current, "受付終了");
            renderList();
            renderDetail(thread);
          };
          if (!hasPlannedNow) {
            openConfirm({
              title: "受付終了の確認",
              message: "予定者が未設定ですが受付終了にしてよいですか？",
              okText: "受付終了する",
              cancelText: "キャンセル",
              onOk: doClose
            });
            return;
          }
          doClose();
        }

        if (action === "leave") {
          openConfirm({
            title: "退出の確認",
            message: "このスレッドを非表示にします。よろしいですか？",
            okText: "退出する",
            cancelText: "キャンセル",
            onOk: () => {
              const hiddenBy = thread.hiddenBy || {};
              hiddenBy[currentUserId] = true;
              thread.hiddenBy = hiddenBy;
              const idx = threads.findIndex((t) => String(t.threadId) === String(thread.threadId));
              if (idx >= 0) threads[idx] = thread;
              ccSaveInquiryThreads(threads);
              activeThreadId = "";
              renderList();
              const next = listEl.querySelector(".cc-inbox-item");
              if (next) next.click();
              else detailEl.innerHTML = '<div class="cc-inbox-empty"><div>スレッドがありません。</div></div>';
            }
          });
        }

        if (action === "block") {
          openConfirm({
            title: "ブロックの確認",
            message: "この相手をブロックします。送受信はできなくなります。",
            okText: "ブロックする",
            cancelText: "キャンセル",
            onOk: () => {
              const next = new Set(blockedMap[currentUserId] || []);
              next.add(String(other.id));
              blockedMap[currentUserId] = Array.from(next);
              ccSaveInquiryBlocked(blockedMap);
              blockedSet.add(String(other.id));
              const hiddenBy = thread.hiddenBy || {};
              hiddenBy[currentUserId] = true;
              thread.hiddenBy = hiddenBy;
              const idx = threads.findIndex((t) => String(t.threadId) === String(thread.threadId));
              if (idx >= 0) threads[idx] = thread;
              ccSaveInquiryThreads(threads);
              showToast("ブロックしました。");
              activeThreadId = "";
              renderList();
              const nextItem = listEl.querySelector(".cc-inbox-item");
              if (nextItem) nextItem.click();
              else detailEl.innerHTML = '<div class="cc-inbox-empty"><div>スレッドがありません。</div></div>';
            }
          });
        }

        if (action === "report") {
          if (btn.disabled) return;
          openReportModal({
            thread,
            targetUserId: other.id,
            targetUserName: other.name
          });
        }
      });
    });

    detailEl.querySelectorAll(".cc-inbox-attachment.is-image").forEach((btn) => {
      btn.addEventListener("click", () => {
        const full = btn.getAttribute("data-full") || "";
        openLightbox(full, "preview");
      });
    });

    const form = document.getElementById("inquiry-history-form");
    const input = document.getElementById("inquiry-history-body");
    const note = document.getElementById("inquiry-history-note");
    const submit = document.getElementById("inquiry-history-submit");
    const attachInput = document.getElementById("inquiry-history-attach");
    const attachPreview = document.getElementById("inquiry-history-attachments");
    const textbox = document.querySelector(".cc-inbox-textbox");
    let pendingAttachments = [];
    const autoResize = () => {
      if (!input) return;
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight}px`;
    };

    if (input) {
      autoResize();
      input.addEventListener("input", autoResize);
    }

    const renderAttachPreview = () => {
      if (!attachPreview) return;
      if (textbox) textbox.classList.toggle("has-attachments", pendingAttachments.length > 0);
      if (!pendingAttachments.length) {
        attachPreview.innerHTML = "";
        return;
      }
      attachPreview.innerHTML = pendingAttachments.map((a, idx) => {
        const isImage = a.type && a.type.startsWith("image/");
        const safeUrl = a.previewUrl ? escapeHtml(a.previewUrl) : "";
        const thumb = isImage && safeUrl
          ? `
            <button type="button" class="cc-inbox-attach-thumb" data-full="${safeUrl}" aria-label="画像を拡大表示">
              <img src="${safeUrl}" alt="${escapeHtml(a.name || "image")}" />
              <span class="cc-inbox-attachment-zoom"><i class="fa-solid fa-magnifying-glass"></i></span>
            </button>
          `
          : (safeUrl
            ? `<a class="cc-inbox-attach-file" href="${safeUrl}" download="${escapeHtml(a.name || "file")}" target="_blank" rel="noreferrer"><i class="fa-regular fa-file"></i><span>${escapeHtml(a.name || "file")}</span></a>`
            : `<i class="fa-regular fa-file"></i>`);
        return `
          <div class="cc-inbox-attach-chip${isImage ? " is-image" : ""}" data-attach-index="${idx}">
            ${thumb}
            ${isImage ? "" : (safeUrl ? "" : `<span>${escapeHtml(a.name || "file")}</span>`)}
            <button type="button" class="cc-inbox-attach-remove" aria-label="削除">×</button>
          </div>
        `;
      }).join("");

      attachPreview.querySelectorAll(".cc-inbox-attach-remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const chip = e.target.closest(".cc-inbox-attach-chip");
          const idx = chip ? Number(chip.dataset.attachIndex) : -1;
          if (idx >= 0) {
            pendingAttachments.splice(idx, 1);
            renderAttachPreview();
          }
        });
      });

      attachPreview.querySelectorAll(".cc-inbox-attach-thumb").forEach((btn) => {
        btn.addEventListener("click", () => {
          const full = btn.getAttribute("data-full") || "";
          openLightbox(full, "preview");
        });
      });
    };

    if (attachInput) {
      attachInput.addEventListener("change", () => {
        const file = (attachInput.files && attachInput.files[0]) ? attachInput.files[0] : null;
        pendingAttachments = [];
        if (!file) {
          renderAttachPreview();
          return;
        }
        if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
          renderAttachPreview();
          return;
        }
        const item = { name: file.name, type: file.type, previewUrl: "" };
        const reader = new FileReader();
        reader.onload = () => {
          item.previewUrl = String(reader.result || "");
          pendingAttachments = [item];
          renderAttachPreview();
        };
        reader.readAsDataURL(file);
      });
    }

    const other = getOtherUser(thread, isSellerView);
    const isBlocked = blockedSet.has(String(other.id));
    const isBanned = isCurrentUserBanned();
    const isFrozen = ccIsConversationFrozen(thread.threadId);
    if (isBlocked) {
      if (input) input.disabled = true;
      if (attachInput) attachInput.disabled = true;
      if (submit) submit.disabled = true;
      if (note) note.textContent = "この相手をブロック中のため送信できません。";
    } else if (isFrozen) {
      if (input) input.disabled = true;
      if (attachInput) attachInput.disabled = true;
      if (submit) submit.disabled = true;
      if (note) note.textContent = "この会話は運営により凍結されています。";
    } else if (isBanned) {
      if (input) input.disabled = true;
      if (attachInput) attachInput.disabled = true;
      if (submit) submit.disabled = true;
      if (note) note.textContent = "アカウントが停止されているため送信できません。";
    } else {
      if (input) input.disabled = false;
      if (attachInput) attachInput.disabled = false;
      if (submit) submit.disabled = false;
      if (note) note.textContent = "";
    }

    if (!form || !input) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!assertNotBanned("アカウントが停止されているため送信できません。")) return;
      if (!assertConversationNotFrozen(thread.threadId)) return;
      const body = String(input.value || "").trim();
      if (!body && !pendingAttachments.length) {
        if (note) note.textContent = "テキストまたは添付を入力してください。";
        return;
      }
      const now = Date.now();
      const lastBuyer = thread.lastBuyerMessageAt ? Date.parse(thread.lastBuyerMessageAt) : 0;
      if (lastBuyer && now - lastBuyer < CC_INQUIRY_RATE_LIMIT_MS) {
        if (note) note.textContent = "短時間での連続送信はできません。時間をおいて再度お試しください。";
        return;
      }
      if (submit) submit.disabled = true;
      if (note) note.textContent = "送信中...";

      const nowIso = new Date().toISOString();
      thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
      thread.messages.push({
        messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderType: viewerType,
        body,
        createdAt: nowIso,
        attachments: pendingAttachments.slice()
      });
      thread.updatedAt = nowIso;
      if (viewerType === "buyer") thread.lastBuyerMessageAt = nowIso;
      if (viewerType === "seller") thread.lastSellerMessageAt = nowIso;

      const idx = threads.findIndex((t) => String(t.threadId) === String(thread.threadId));
      if (idx >= 0) threads[idx] = thread;
      ccSaveInquiryThreads(threads);
      input.value = "";
      pendingAttachments = [];
      if (attachInput) attachInput.value = "";
      renderAttachPreview();
      if (note) note.textContent = "";
      if (submit) submit.disabled = false;
      renderList();
      renderDetail(thread);
    });
  };

  const applySearch = () => {
    currentQuery = (searchEl && searchEl.value || "").trim();
    if (searchBtn) searchBtn.disabled = !currentQuery;
    renderList();
  };
  if (searchEl) {
    searchEl.addEventListener("input", () => {
      const next = (searchEl.value || "").trim();
      if (searchBtn) searchBtn.disabled = !next;
      if (!next && currentQuery) {
        currentQuery = "";
        renderList();
      }
    });
    searchEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      applySearch();
    });
  }
  if (searchBtn) {
    searchBtn.addEventListener("click", applySearch);
    searchBtn.disabled = !currentQuery;
  }
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      sortValue = sortSelect.value || "new";
      renderList();
    });
  }
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderList();
    });
  });

  renderList();
}

function initInquiryThreadPage() {
  const wrap = document.getElementById("inquiry-thread-page");
  if (!wrap) return;
  if (isCurrentUserBanned()) {
    assertNotBanned("アカウントが停止されているため送信できません。");
    const form = document.getElementById("inquiry-thread-form");
    if (form) form.hidden = true;
    const input = document.getElementById("inquiry-thread-body");
    const submit = document.getElementById("inquiry-thread-submit");
    if (input) input.disabled = true;
    if (submit) {
      submit.disabled = true;
      submit.setAttribute("aria-disabled", "true");
    }
  }

  if (CC_SEED_MODE === "mock") ccSeedInquiryHistoryMock();

  const params = new URLSearchParams(location.search || "");
  const threadId = params.get("thread") || "";
  const titleEl = document.getElementById("inquiry-thread-title");
  const postEl = document.getElementById("inquiry-thread-post");
  const sellerEl = document.getElementById("inquiry-thread-seller");
  const statusEl = document.getElementById("inquiry-thread-status");
  const adminBannerEl = document.getElementById("inquiry-thread-admin-banner");
  const adminNoteEl = document.getElementById("inquiry-thread-admin-note");
  const adminDescEl = document.getElementById("inquiry-thread-admin-desc");
  const listEl = document.getElementById("inquiry-thread-messages");
  const form = document.getElementById("inquiry-thread-form");
  const noteEl = document.getElementById("inquiry-thread-note");
  const errorEl = document.getElementById("inquiry-thread-error");
  const inputEl = document.getElementById("inquiry-thread-body");
  const submitBtn = document.getElementById("inquiry-thread-submit");

  const showError = (msg) => {
    if (errorEl) errorEl.textContent = msg;
    if (errorEl) errorEl.hidden = false;
    if (form) form.hidden = true;
  };

  if (!threadId) {
    showError("スレッドが見つかりません。");
    return;
  }

  const threads = ccLoadInquiryThreads();
  const thread = threads.find((t) => String(t.threadId) === String(threadId));
  if (!thread) {
    showError("スレッドが見つかりません。");
    return;
  }

  const isAdminUser = isAdmin();
  const isFromReport = params.get("from") === "report";
  if (isFromReport && !isAdminUser) {
    showError("権限がありません。");
    return;
  }
  const isAdminReportView = isAdminUser && isFromReport;
  const hasThreadReport = (() => {
    const threadKey = ccGetInquiryThreadId(threadId);
    if (!threadKey) return false;
    const adminReports = ccLoadReports();
    const found = adminReports.some((r) => {
      const type = String(r?.target_type || "").toLowerCase();
      if (!["inquiry", "thread", "inquiry_thread", "inquiry_message", "inquirythread", "inquirymessage"].includes(type)) return false;
      const id = ccGetInquiryThreadId(r.thread_id || r.threadId || r.target_key || "");
      return id && id === threadKey;
    });
    if (found) return true;
    const inquiryReports = ccLoadInquiryReports();
    return inquiryReports.some((r) => String(r.threadId || r.thread_id || "") === threadKey);
  })();
  if (isAdminReportView && !hasThreadReport) {
    showError("通報対象ではありません。");
    return;
  }
  const allowAdminReportView = isAdminReportView && hasThreadReport;

  if (allowAdminReportView && adminBannerEl) {
    adminBannerEl.hidden = false;
  }

  const buyerId = getAccountName() || "";
  const buyerEmail = getUserEmail() || "";
  const threadBuyerId = String(thread.buyerId || "");
  const threadBuyerName = String(thread.buyerName || "");

  if (!threadBuyerId && buyerId && threadBuyerName === buyerId) {
    thread.buyerId = buyerId;
    thread.buyerEmail = thread.buyerEmail || buyerEmail;
    ccSaveInquiryThreads(threads);
  }

  if (!allowAdminReportView) {
    if (!buyerId || (thread.buyerId && String(thread.buyerId || "") !== buyerId)) {
      showError("権限がありません。");
      return;
    }
    if (thread.buyerEmail && buyerEmail && String(thread.buyerEmail) !== String(buyerEmail)) {
      showError("権限がありません。");
      return;
    }
  }

  if (allowAdminReportView && adminNoteEl) {
    adminNoteEl.hidden = false;
  }
  if (allowAdminReportView && adminDescEl) {
    adminDescEl.hidden = false;
  }

  const isFrozen = ccIsConversationFrozen(threadId);
  if (isFrozen) {
    if (noteEl) noteEl.textContent = "この会話は運営により凍結されています。";
    if (inputEl) inputEl.disabled = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-disabled", "true");
    }
  }

  const isThreadMock = ccIsThreadMock(thread);
  if (titleEl) {
    titleEl.textContent = ccGetPostDisplayTitle({
      title: thread.postTitle,
      key: thread.postId,
      isMock: isThreadMock,
      source: thread.source
    }, "—");
  }
  if (postEl) {
    postEl.innerHTML = `
      <span>価格：${escapeHtml(String(thread.postPrice || "—"))}</span>
      <span>都市：${escapeHtml(String(thread.postCity || "—"))}</span>
      <span>投稿ID：${escapeHtml(String(thread.postId || "—"))}</span>
    `;
  }
  if (sellerEl) sellerEl.textContent = ccGetDisplayNameWithMock(thread.sellerName || "投稿者", isThreadMock);

  if (allowAdminReportView) {
    if (form) form.hidden = true;
    if (inputEl) inputEl.disabled = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-disabled", "true");
    }
    if (noteEl) noteEl.textContent = "通報対応のため閲覧のみ可能です。";
    ccAddAdminAudit({
      at: new Date().toISOString(),
      admin_email: getUserEmail() || getAccountName() || "admin",
      action: "inquiry_thread_view_for_report",
      target: threadId,
      after: { source: "report" }
    });
  }

  const hasReply = (thread.messages || []).some((m) => m.senderType === "seller");
  if (statusEl) statusEl.textContent = hasReply ? "返信あり" : "返信待ち";

  const renderMessages = () => {
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    listEl.innerHTML = messages.map((m) => {
      const isBuyer = m.senderType === "buyer";
      const cls = isBuyer ? "is-buyer" : "is-seller";
      const who = isBuyer ? "あなた" : "投稿者";
      return `
        <div class="inquiry-thread-bubble ${cls}">
          <div class="inquiry-thread-bubble-role">${escapeHtml(who)}</div>
          <p>${escapeHtml(String(m.body || ""))}</p>
          <div class="inquiry-thread-bubble-time">${escapeHtml(ccFormatDateTime(m.createdAt))}</div>
        </div>
      `;
    }).join("");
  };

  renderMessages();

  if (!form || !inputEl) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (submitBtn && submitBtn.disabled) return;
    if (!assertNotBanned("アカウントが停止されているため送信できません。")) return;
    if (!assertConversationNotFrozen(threadId)) return;
    const body = String(inputEl.value || "").trim();
    if (!ccCheckNgWords(body, "inquiry")) return;
    if (!body) {
      if (noteEl) noteEl.textContent = "本文を入力してください。";
      return;
    }

    const now = Date.now();
    const lastBuyer = thread.lastBuyerMessageAt ? Date.parse(thread.lastBuyerMessageAt) : 0;
    if (lastBuyer && now - lastBuyer < CC_INQUIRY_RATE_LIMIT_MS) {
      if (noteEl) noteEl.textContent = "短時間での連続送信はできません。時間をおいて再度お試しください。";
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (noteEl) noteEl.textContent = "送信中...";

    const nowIso = new Date().toISOString();
    thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
    thread.messages.push({
      messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderType: "buyer",
      body,
      createdAt: nowIso
    });
    thread.updatedAt = nowIso;
    thread.lastBuyerMessageAt = nowIso;

    const idx = threads.findIndex((t) => String(t.threadId) === String(threadId));
    if (idx >= 0) threads[idx] = thread;
    ccSaveInquiryThreads(threads);

    inputEl.value = "";
    if (noteEl) noteEl.textContent = "";
    if (submitBtn) submitBtn.disabled = false;
    renderMessages();
  });
}

function initInquiryStartHook() {
  document.addEventListener(
    "click",
    (e) => {
      const t = e.target;
      if (!t) return;

      const el = t.closest
        ? t.closest(
          "#contact-seller, .btn-contact-seller, .contact-seller, [data-action='contact-seller'], a[href*='inquiry.html'], button"
        )
        : null;
      if (!el) return;

      const text = String(el.textContent || "").trim();
      const looksLikeContact =
        /投稿者に問い合わせ/.test(text) ||
        el.id === "contact-seller" ||
        el.classList.contains("btn-contact-seller") ||
        el.getAttribute("data-action") === "contact-seller";
      if (!looksLikeContact) return;

      if (el.getAttribute("aria-disabled") === "true" || el.disabled) return;

      e.preventDefault();
      e.stopPropagation();

      const isLoggedIn = getLoggedInFlag() || !!getUserEmail();
      const isDetail = /detail\.html/i.test(location.pathname) || /detail\.html/i.test(location.href);

      function getCurrentPostIdHint() {
        try {
          const u = new URL(location.href);
          const p = u.searchParams;
          return (
            p.get("id") ||
            p.get("post") ||
            p.get("pid") ||
            p.get("item") ||
            p.get("itemId") ||
            document.body?.getAttribute?.("data-post-id") ||
            document.documentElement?.getAttribute?.("data-post-id") ||
            ""
          );
        } catch (e) {
          return "";
        }
      }

      const postId = String(getCurrentPostIdHint() || "").trim();
      if (!isLoggedIn) {
        const from = isDetail ? "detail" : "inquiry";
        let loginUrl = `login.html?from=${encodeURIComponent(from)}`;
        if (postId) loginUrl += `&post=${encodeURIComponent(postId)}`;
        window.location.href = loginUrl;
        return;
      }

      const titleCandidates = [
        document.querySelector(".detail-title"),
        document.querySelector(".card-title"),
        document.querySelector(".item-title"),
        document.querySelector("h1"),
        document.querySelector(".post-title")
      ].filter(Boolean);
      const postTitle = (titleCandidates[0]?.textContent || "").trim();

      const priceCandidates = [
        document.querySelector("#post-price"),
        document.querySelector(".detail-price"),
        document.querySelector(".post-price")
      ].filter(Boolean);
      const postPrice = (priceCandidates[0]?.textContent || "").trim();

      const cityCandidates = [
        document.querySelector("#location-area"),
        document.querySelector("#post-location"),
        document.querySelector(".detail-meta-item"),
        document.querySelector(".card-meta .left span")
      ].filter(Boolean);
      const postCity = (cityCandidates[0]?.textContent || "").trim();

      const sellerCandidates = [
        document.querySelector(".seller-name"),
        document.querySelector(".vendor-name"),
        document.querySelector(".author-name"),
        document.querySelector("[data-seller-name]")
      ].filter(Boolean);
      const seller =
        (sellerCandidates[0]?.textContent || sellerCandidates[0]?.getAttribute?.("data-seller-name") || "").trim();
      const sellerId =
        (sellerCandidates[0]?.getAttribute?.("data-seller-id") ||
          document.body?.getAttribute?.("data-seller-id") ||
          "").trim();

      const params = new URLSearchParams();
      if (postId) params.set("post", postId);
      if (postTitle) params.set("title", postTitle);
      if (postPrice) params.set("price", postPrice);
      if (postCity) params.set("city", postCity);
      if (seller) params.set("seller", seller);
      if (sellerId) params.set("sellerId", sellerId);

      const query = params.toString();
      const target = query ? `inquiry.html?${query}` : "inquiry.html";
      window.location.href = target;
    },
    true
  );
}

// --- Backward compatible aliases (do not remove) ---
if (typeof window !== "undefined") {
  window.initMypageSettings = window.initMypageSettings || function () {
    if (typeof window.initMypageSettingsUI === "function") return window.initMypageSettingsUI();
    if (typeof window.initMypage === "function") return window.initMypage();
  };
  window.updateSelectPlaceholder = window.updateSelectPlaceholder || function (selectEl) {
    if (!selectEl) return;
    const isEmpty = !selectEl.value;
    if (selectEl.classList) selectEl.classList.toggle("is-placeholder", isEmpty);
  };
  window.initDetailRecommendLayout = window.initDetailRecommendLayout || function () { };
}
