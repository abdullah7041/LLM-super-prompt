import express from "express";
import "dotenv/config";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
// Allow calls from your GitHub Pages and local file:// or localhost
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl / same-origin
    if (
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /https?:\/\/.*\.github\.io$/.test(origin)
    ) return cb(null, true);
    return cb(null, true); // Allow other origins for development
  },
  methods: ["GET","POST"],
  allowedHeaders: ["Content-Type","Authorization"]
}));
app.use(express.static(".")); // serves index.html when run locally

// Local proxy to OpenAI (GPT-5 Nano)
app.post("/api/gpt5nano", async (req, res) => {
  try {
    const { system, user, config } = req.body || {};
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }
    if (!system || !user) {
      return res.status(400).json({ error: "Missing 'system' or 'user' fields" });
    }

    const payload = {
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: typeof config?.temperature === "number" ? config.temperature : 0.3,
      top_p: typeof config?.top_p === "number" ? config.top_p : 1,
      // Force JSON output contract:
      response_format: { type: "json_object" }
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(r.status).json({ error: "Upstream error", detail: text });
    }

    const data = await r.json();
    // The OpenAI response will have message.content as a JSON string if response_format=json_object.
    // Parse it safely; fall back to {} if anything is off.
    let content = data?.choices?.[0]?.message?.content ?? "{}";
    try { content = JSON.parse(content); } catch { content = { error: "invalid_json_from_model" }; }

    res.json(content);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Local server running on http://localhost:${PORT}`);
});
