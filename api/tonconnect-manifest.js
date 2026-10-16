// Динамический TonConnect-манифест: определяет домен сайта, на котором открыто
// приложение, и возвращает манифест с правильными url/iconUrl. Так кошелёк
// корректно подключается и на blago-vote.vercel.app, и на vote.gradosphera.org,
// и на любом другом хосте, где развёрнут фронтенд.
const FALLBACK_ORIGIN = "https://blago-vote.vercel.app";

function resolveOrigin(raw, req) {
  // Try query param first
  if (typeof raw === "string" && raw.length > 0 && raw.length <= 256) {
    try {
      const url = new URL(raw);
      const isHttps = url.protocol === "https:";
      const isLocal =
        url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1");
      if (isHttps || isLocal) return url.origin;
    } catch {}
  }
  // Derive from request headers (works for same-deployment multi-domain)
  try {
    const proto =
      (req.headers["x-forwarded-proto"] || "").split(",")[0].trim() ||
      (req.socket && req.socket.encrypted ? "https" : "http");
    const host =
      (req.headers["x-forwarded-host"] || "").split(",")[0].trim() ||
      req.headers.host;
    if (host) {
      const origin = `${proto}://${host}`;
      const u = new URL(origin);
      const isHttps = u.protocol === "https:";
      const isLocal =
        u.protocol === "http:" &&
        (u.hostname === "localhost" || u.hostname === "127.0.0.1");
      if (isHttps || isLocal) return u.origin;
    }
  } catch {}
  return FALLBACK_ORIGIN;
}

export default function handler(req, res) {
  const origin = resolveOrigin(req.query && req.query.origin, req);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  res.status(200).send(
    JSON.stringify({
      url: origin,
      name: "Голос",
      iconUrl: `${origin}/logo.png`,
    })
  );
}
