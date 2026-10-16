// Динамический TonConnect-манифест: определяет домен сайта, на котором открыто
// приложение, и возвращает манифест с правильными url/iconUrl. Так кошелёк
// корректно подключается и на blago-vote.vercel.app, и на vote.gradosphera.org,
// и на любом другом хосте, где развёрнут фронтенд.
const FALLBACK_ORIGIN = "https://blago-vote.vercel.app";

function resolveOrigin(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 256) {
    return FALLBACK_ORIGIN;
  }
  try {
    const url = new URL(raw);
    const isHttps = url.protocol === "https:";
    const isLocal =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (!isHttps && !isLocal) return FALLBACK_ORIGIN;
    return url.origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

export default function handler(req, res) {
  const origin = resolveOrigin(req.query && req.query.origin);

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
