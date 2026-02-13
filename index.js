import { jsxs as c, jsx as o, Fragment as W } from "react/jsx-runtime";
import { useState as b, useRef as D, useMemo as R, useCallback as y, useEffect as w } from "react";
import { useOAuth as $, useTheme as q, useSettings as N } from "@mywallpaper/sdk-react";
function A(e) {
  if (!e) return "";
  try {
    const t = e.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(
      atob(t).split("").map((n) => "%" + ("00" + n.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
  } catch {
    return console.error("[EmailParser] Failed to decode base64url"), "";
  }
}
function H(e, t) {
  var n;
  for (const r of e) {
    if (r.parts) {
      H(r.parts, t);
      continue;
    }
    if (!(r.filename && r.filename.length > 0) && (n = r.body) != null && n.data) {
      const i = A(r.body.data);
      r.mimeType === "text/plain" && !t.text ? t.text = i : r.mimeType === "text/html" && !t.html && (t.html = i);
    }
  }
}
function _(e) {
  var n;
  const t = { text: "", html: "" };
  if (!e) return t;
  if ((n = e.body) != null && n.data) {
    const r = A(e.body.data);
    return e.mimeType === "text/html" ? t.html = r : t.text = r, t;
  }
  return e.parts && H(e.parts, t), t;
}
function G(e) {
  if (!e) return "";
  let t = e.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  return t = t.replace(/\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, ""), t = t.replace(/href\s*=\s*["']?javascript:[^"'>]*/gi, 'href="#"'), t;
}
function Y(e) {
  if (!e) return "";
  let t = e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return t = t.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>'
  ), t = t.replace(/\n/g, "<br>"), t;
}
function F(e) {
  if (!e) return { name: "", email: "" };
  const t = e.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
  return t ? {
    name: (t[1] || "").trim(),
    email: (t[2] || "").trim(),
    raw: e
  } : { name: "", email: e.trim(), raw: e };
}
function z(e) {
  return e ? e.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((n) => F(n.trim())).filter((n) => n.email) : [];
}
function V(e) {
  const t = {}, n = ["from", "to", "cc", "bcc", "subject", "date", "reply-to", "message-id"];
  for (const r of e) {
    const i = r.name.toLowerCase();
    n.includes(i) && (t[i] = r.value);
  }
  return t;
}
function j(e, t) {
  var n, r;
  for (const i of e) {
    if (i.parts) {
      j(i.parts, t);
      continue;
    }
    i.filename && i.filename.length > 0 && t.push({
      id: (n = i.body) == null ? void 0 : n.attachmentId,
      filename: i.filename,
      mimeType: i.mimeType,
      size: ((r = i.body) == null ? void 0 : r.size) || 0
    });
  }
}
function X(e) {
  const t = [];
  return e != null && e.parts && j(e.parts, t), t;
}
function B(e) {
  if (!e) return "?";
  if (e.name) {
    const t = e.name.split(/\s+/);
    return t.length >= 2 ? (t[0][0] + t[t.length - 1][0]).toUpperCase() : e.name.substring(0, 2).toUpperCase();
  }
  return e.email ? e.email.split("@")[0].substring(0, 2).toUpperCase() : "?";
}
function Q(e) {
  if (!e || !(e instanceof Date) || isNaN(e.getTime())) return "";
  const t = /* @__PURE__ */ new Date(), n = t.getTime() - e.getTime(), r = 1440 * 60 * 1e3;
  if (n < r && e.getDate() === t.getDate())
    return e.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const i = new Date(t.getTime() - r);
  return e.getDate() === i.getDate() && e.getMonth() === i.getMonth() ? "Hier" : e.getFullYear() === t.getFullYear() ? e.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : e.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function J(e) {
  var i;
  const t = V(((i = e.payload) == null ? void 0 : i.headers) || []), n = _(e.payload), r = e.labelIds || [];
  return {
    id: e.id,
    threadId: e.threadId,
    snippet: e.snippet || "",
    internalDate: parseInt(e.internalDate, 10),
    date: new Date(parseInt(e.internalDate, 10)),
    from: F(t.from),
    to: z(t.to),
    cc: z(t.cc),
    subject: t.subject || "(Sans objet)",
    replyTo: t["reply-to"],
    bodyText: n.text,
    bodyHtml: n.html,
    labels: r,
    isUnread: r.includes("UNREAD"),
    isStarred: r.includes("STARRED"),
    isImportant: r.includes("IMPORTANT"),
    isInbox: r.includes("INBOX"),
    isDraft: r.includes("DRAFT"),
    isSent: r.includes("SENT"),
    isTrash: r.includes("TRASH"),
    isSpam: r.includes("SPAM"),
    attachments: X(e.payload)
  };
}
const K = "/gmail/v1/users/me", U = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.labels"
], Z = [
  "https://www.googleapis.com/auth/gmail.modify"
];
async function I(e, t, n = {}) {
  const r = `${K}${t}`, i = await e.request("google", r, {
    method: n.method || "GET",
    body: n.body,
    requiredScopes: U
  });
  if (i.status >= 400)
    throw new Error(`Gmail API error: ${i.status}`);
  return i.data;
}
async function ee(e, t = {}) {
  const n = new URLSearchParams();
  t.maxResults && n.set("maxResults", String(t.maxResults)), t.query && n.set("q", t.query), t.labelIds && t.labelIds.forEach((s) => n.append("labelIds", s));
  const r = n.toString(), i = `/messages${r ? `?${r}` : ""}`, a = await I(e, i);
  if (!a.messages || a.messages.length === 0)
    return [];
  const f = a.messages.map((s) => s.id);
  return (await Promise.all(
    f.map(
      (s) => I(e, `/messages/${s}?format=full`)
    )
  )).map(J);
}
async function te(e, t) {
  await I(e, `/messages/${t}/modify`, {
    method: "POST",
    body: { removeLabelIds: ["UNREAD"] }
  });
}
async function ne(e) {
  try {
    if (!await e.isConnected("google")) return !1;
    const n = await e.getScopes("google");
    return !n || n.length === 0 ? !1 : n.some(
      (r) => r.includes("gmail.readonly") || r.includes("gmail.labels") || r.includes("gmail.modify")
    );
  } catch {
    return !1;
  }
}
async function re(e) {
  try {
    return await e.requestScopes("google", [...U, ...Z]);
  } catch {
    return !1;
  }
}
function ie(e) {
  return R(() => {
    const t = e === "dark", n = t ? "#f5f5f7" : "#1d1d1f", r = t ? "#98989d" : "#86868b", i = t ? "#636366" : "#aeaeb2", a = t ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", f = t ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)", d = t ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", s = t ? "#1c1c1e" : "#ffffff", h = "#007aff", S = h;
    return {
      isDark: t,
      textPrimary: n,
      textSecondary: r,
      textTertiary: i,
      surface: a,
      surfaceHover: f,
      border: d,
      bg: s,
      accent: h,
      unreadDot: S,
      container: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
        color: n,
        background: s,
        borderRadius: 16,
        overflow: "hidden",
        boxSizing: "border-box"
      },
      centerScreen: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 12,
        textAlign: "center"
      },
      header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: `1px solid ${d}`,
        flexShrink: 0
      },
      headerTitle: {
        fontSize: 15,
        fontWeight: 600,
        color: n,
        margin: 0
      },
      badge: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: 9,
        backgroundColor: h,
        color: "#ffffff",
        fontSize: 11,
        fontWeight: 600,
        marginLeft: 8
      },
      iconBtn: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "none",
        background: "transparent",
        color: r,
        cursor: "pointer",
        fontSize: 16
      },
      list: {
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden"
      },
      emailItem: (p) => ({
        display: "flex",
        alignItems: "flex-start",
        padding: "12px 16px",
        gap: 12,
        cursor: "pointer",
        borderBottom: `1px solid ${d}`,
        background: "transparent",
        transition: "background 0.15s",
        fontWeight: p ? 600 : 400
      }),
      avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: a,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 600,
        color: r,
        flexShrink: 0
      },
      emailBody: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 2
      },
      emailHeaderRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      },
      emailFrom: (p) => ({
        fontSize: 14,
        fontWeight: p ? 600 : 400,
        color: n,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }),
      emailDate: {
        fontSize: 12,
        color: i,
        flexShrink: 0,
        marginLeft: 8
      },
      emailSubject: (p) => ({
        fontSize: 13,
        fontWeight: p ? 600 : 400,
        color: n,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }),
      emailSnippet: {
        fontSize: 12,
        color: r,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        lineHeight: 1.4
      },
      unreadIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: S,
        flexShrink: 0,
        marginTop: 6
      },
      starLabel: {
        color: "#f5a623",
        fontSize: 12,
        marginTop: 2
      },
      // Detail view
      detailContainer: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      },
      detailHeader: {
        padding: "16px",
        borderBottom: `1px solid ${d}`,
        flexShrink: 0
      },
      detailSubject: {
        fontSize: 17,
        fontWeight: 600,
        color: n,
        margin: "0 0 12px 0",
        lineHeight: 1.3
      },
      detailMeta: {
        display: "flex",
        alignItems: "center",
        gap: 10
      },
      detailAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: a,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 15,
        fontWeight: 600,
        color: r,
        flexShrink: 0
      },
      detailFrom: {
        fontSize: 14,
        fontWeight: 600,
        color: n
      },
      detailTo: {
        fontSize: 12,
        color: i
      },
      detailDate: {
        fontSize: 12,
        color: i,
        marginLeft: "auto",
        flexShrink: 0
      },
      detailBody: {
        flex: 1,
        overflowY: "auto",
        padding: 16,
        fontSize: 14,
        lineHeight: 1.6,
        color: n,
        wordBreak: "break-word"
      },
      // Buttons
      primaryBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 24px",
        borderRadius: 12,
        border: "none",
        backgroundColor: h,
        color: "#ffffff",
        fontSize: 15,
        fontWeight: 600,
        cursor: "pointer",
        gap: 8
      },
      secondaryBtn: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 16px",
        borderRadius: 10,
        border: `1px solid ${d}`,
        backgroundColor: "transparent",
        color: r,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer"
      },
      spinner: {
        width: 32,
        height: 32,
        border: `3px solid ${d}`,
        borderTopColor: h,
        borderRadius: "50%",
        animation: "email-hub-spin 0.8s linear infinite"
      },
      emptyIcon: {
        fontSize: 40,
        opacity: 0.3
      },
      errorIcon: {
        fontSize: 40,
        opacity: 0.4,
        color: "#ff3b30"
      },
      messageText: {
        fontSize: 14,
        color: r,
        lineHeight: 1.5
      }
    };
  }, [e]);
}
function oe({ s: e }) {
  return /* @__PURE__ */ c(W, { children: [
    /* @__PURE__ */ o("style", { children: "@keyframes email-hub-spin { to { transform: rotate(360deg); } }" }),
    /* @__PURE__ */ o("div", { style: e.spinner })
  ] });
}
function ae({
  s: e,
  onConnect: t
}) {
  return /* @__PURE__ */ c("div", { style: e.centerScreen, children: [
    /* @__PURE__ */ o("div", { style: { fontSize: 48, opacity: 0.3 }, children: "✉" }),
    /* @__PURE__ */ o("div", { style: { fontSize: 17, fontWeight: 600, color: e.textPrimary }, children: "Email Hub" }),
    /* @__PURE__ */ o("div", { style: e.messageText, children: "Connectez votre compte Gmail pour afficher vos emails." }),
    /* @__PURE__ */ o("button", { style: e.primaryBtn, onClick: t, children: "Connecter Gmail" })
  ] });
}
function le({ s: e }) {
  return /* @__PURE__ */ c("div", { style: e.centerScreen, children: [
    /* @__PURE__ */ o(oe, { s: e }),
    /* @__PURE__ */ o("div", { style: e.messageText, children: "Chargement des emails..." })
  ] });
}
function se({
  s: e,
  onRefresh: t
}) {
  return /* @__PURE__ */ c("div", { style: e.centerScreen, children: [
    /* @__PURE__ */ o("div", { style: e.emptyIcon, children: "📫" }),
    /* @__PURE__ */ o("div", { style: { fontSize: 15, fontWeight: 600, color: e.textPrimary }, children: "Aucun email" }),
    /* @__PURE__ */ o("div", { style: e.messageText, children: "Votre boite de reception est vide." }),
    /* @__PURE__ */ o("button", { style: e.secondaryBtn, onClick: t, children: "Actualiser" })
  ] });
}
function ce({
  s: e,
  message: t,
  onRetry: n
}) {
  return /* @__PURE__ */ c("div", { style: e.centerScreen, children: [
    /* @__PURE__ */ o("div", { style: e.errorIcon, children: "⚠" }),
    /* @__PURE__ */ o("div", { style: { fontSize: 15, fontWeight: 600, color: e.textPrimary }, children: "Erreur" }),
    /* @__PURE__ */ o("div", { style: e.messageText, children: t }),
    /* @__PURE__ */ o("button", { style: e.secondaryBtn, onClick: n, children: "Reessayer" })
  ] });
}
function de({
  email: e,
  s: t,
  showAvatar: n,
  showSnippet: r,
  onClick: i
}) {
  var d, s;
  const [a, f] = b(!1);
  return /* @__PURE__ */ c(
    "div",
    {
      style: {
        ...t.emailItem(e.isUnread),
        background: a ? t.surfaceHover : "transparent"
      },
      onClick: i,
      onMouseEnter: () => f(!0),
      onMouseLeave: () => f(!1),
      children: [
        e.isUnread && /* @__PURE__ */ o("div", { style: t.unreadIndicator }),
        n && /* @__PURE__ */ o("div", { style: t.avatar, children: B(e.from) }),
        /* @__PURE__ */ c("div", { style: t.emailBody, children: [
          /* @__PURE__ */ c("div", { style: t.emailHeaderRow, children: [
            /* @__PURE__ */ o("span", { style: t.emailFrom(e.isUnread), children: ((d = e.from) == null ? void 0 : d.name) || ((s = e.from) == null ? void 0 : s.email) || "Inconnu" }),
            /* @__PURE__ */ o("span", { style: t.emailDate, children: Q(e.date) })
          ] }),
          /* @__PURE__ */ o("div", { style: t.emailSubject(e.isUnread), children: e.subject }),
          r && /* @__PURE__ */ o("div", { style: t.emailSnippet, children: e.snippet }),
          e.isStarred && /* @__PURE__ */ o("span", { style: t.starLabel, children: "★" })
        ] })
      ]
    }
  );
}
function fe({
  emails: e,
  s: t,
  showAvatar: n,
  showSnippet: r,
  onSelect: i
}) {
  return /* @__PURE__ */ o("div", { style: t.list, children: e.map((a) => /* @__PURE__ */ o(
    de,
    {
      email: a,
      s: t,
      showAvatar: n,
      showSnippet: r,
      onClick: () => i(a)
    },
    a.id
  )) });
}
function ue({
  email: e,
  s: t,
  onBack: n
}) {
  var i, a, f;
  const r = R(() => e.bodyHtml ? G(e.bodyHtml) : e.bodyText ? Y(e.bodyText) : "<em>Aucun contenu</em>", [e.bodyHtml, e.bodyText]);
  return /* @__PURE__ */ c("div", { style: t.detailContainer, children: [
    /* @__PURE__ */ c("div", { style: t.header, children: [
      /* @__PURE__ */ o("button", { style: t.iconBtn, onClick: n, title: "Retour", children: "←" }),
      /* @__PURE__ */ o("span", { style: { fontSize: 13, color: t.textSecondary }, children: "Detail" }),
      /* @__PURE__ */ o("div", { style: { width: 32 } })
    ] }),
    /* @__PURE__ */ c("div", { style: t.detailHeader, children: [
      /* @__PURE__ */ o("h2", { style: t.detailSubject, children: e.subject }),
      /* @__PURE__ */ c("div", { style: t.detailMeta, children: [
        /* @__PURE__ */ o("div", { style: t.detailAvatar, children: B(e.from) }),
        /* @__PURE__ */ c("div", { children: [
          /* @__PURE__ */ o("div", { style: t.detailFrom, children: ((i = e.from) == null ? void 0 : i.name) || ((a = e.from) == null ? void 0 : a.email) || "Inconnu" }),
          /* @__PURE__ */ o("div", { style: t.detailTo, children: "a moi" })
        ] }),
        /* @__PURE__ */ o("div", { style: t.detailDate, children: (f = e.date) == null ? void 0 : f.toLocaleString("fr-FR") })
      ] })
    ] }),
    /* @__PURE__ */ o(
      "div",
      {
        style: t.detailBody,
        dangerouslySetInnerHTML: { __html: r }
      }
    )
  ] });
}
function ge() {
  const e = $(), { mode: t } = q(), n = N(), r = ie(t), [i, a] = b("loading"), [f, d] = b([]), [s, h] = b(null), [S, p] = b(""), [T, C] = b(!1), g = D(null), v = R(
    () => f.filter((l) => l.isUnread).length,
    [f]
  ), m = y(async () => {
    C(!0);
    try {
      const l = {
        maxResults: n.maxEmails || 10
      };
      n.labelFilter && n.labelFilter !== "ALL" && (l.labelIds = [n.labelFilter]), n.showUnreadOnly && (l.query = "is:unread");
      const u = await ee(e, l);
      u.length === 0 ? (d([]), a("empty")) : (d(u), a("list"));
    } catch (l) {
      const u = l instanceof Error ? l.message.toLowerCase() : "";
      if (u.includes("not connected") || u.includes("403")) {
        a("connect");
        return;
      }
      u.includes("insufficient_scopes") ? p("Permissions Gmail insuffisantes. Reconnectez-vous.") : p("Impossible de charger les emails"), a("error");
    } finally {
      C(!1);
    }
  }, [e, n.maxEmails, n.labelFilter, n.showUnreadOnly]);
  w(() => {
    let l = !1;
    async function u() {
      a("loading");
      const x = await ne(e);
      l || (x ? await m() : a("connect"));
    }
    return u(), () => {
      l = !0;
    };
  }, []), w(() => {
    g.current && (clearInterval(g.current), g.current = null);
    const l = (n.refreshInterval || 5) * 60 * 1e3;
    return g.current = setInterval(() => {
      s || m();
    }, l), () => {
      g.current && clearInterval(g.current);
    };
  }, [n.refreshInterval, s, m]);
  const E = D({
    label: n.labelFilter,
    unread: n.showUnreadOnly,
    max: n.maxEmails
  });
  w(() => {
    const l = E.current, u = l.label !== n.labelFilter || l.unread !== n.showUnreadOnly || l.max !== n.maxEmails;
    E.current = {
      label: n.labelFilter,
      unread: n.showUnreadOnly,
      max: n.maxEmails
    }, u && (i === "list" || i === "empty") && m();
  }, [n.labelFilter, n.showUnreadOnly, n.maxEmails]);
  const L = y(async () => {
    a("loading"), await re(e) ? await m() : a("connect");
  }, [e, m]), P = y(
    async (l) => {
      if (h(l), a("detail"), l.isUnread)
        try {
          await te(e, l.id), d(
            (u) => u.map(
              (x) => x.id === l.id ? { ...x, isUnread: !1 } : x
            )
          );
        } catch {
        }
    },
    [e]
  ), O = y(() => {
    h(null), a("list");
  }, []), k = y(() => {
    m();
  }, [m]), M = y(() => {
    m();
  }, [m]);
  return /* @__PURE__ */ c("div", { style: r.container, children: [
    i === "list" && /* @__PURE__ */ c("div", { style: r.header, children: [
      /* @__PURE__ */ c("div", { style: { display: "flex", alignItems: "center" }, children: [
        /* @__PURE__ */ o("h1", { style: r.headerTitle, children: "Emails" }),
        v > 0 && /* @__PURE__ */ o("span", { style: r.badge, children: v > 99 ? "99+" : v })
      ] }),
      /* @__PURE__ */ o(
        "button",
        {
          style: {
            ...r.iconBtn,
            opacity: T ? 0.5 : 1
          },
          onClick: k,
          disabled: T,
          title: "Actualiser",
          children: "↻"
        }
      )
    ] }),
    i === "connect" && /* @__PURE__ */ o(ae, { s: r, onConnect: L }),
    i === "loading" && /* @__PURE__ */ o(le, { s: r }),
    i === "empty" && /* @__PURE__ */ o(se, { s: r, onRefresh: k }),
    i === "error" && /* @__PURE__ */ o(ce, { s: r, message: S, onRetry: M }),
    i === "list" && /* @__PURE__ */ o(
      fe,
      {
        emails: f,
        s: r,
        showAvatar: n.showAvatar ?? !0,
        showSnippet: n.showSnippet ?? !0,
        onSelect: P
      }
    ),
    i === "detail" && s && /* @__PURE__ */ o(ue, { email: s, s: r, onBack: O })
  ] });
}
export {
  ge as default
};
