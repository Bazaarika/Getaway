import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import axios from "axios";
import qs from "qs";

dotenv.config();

const app = express();

// security & parsing
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// health check (Render uses this sometimes)
app.get("/", (req, res) => {
  res.status(200).json({ ok: true, service: "Bazaarika ZapUPI bridge" });
});

// --- IMPORTANT ---
// Set these in Render > Dashboard > your-service > Environment
const { API_TOKEN, SECRET_KEY, BASE_URL } = process.env;

// fallback if ZapUPI base ever changes; keep configurable
const ZAPUPI_API = BASE_URL || "https://api.zapupi.com";

// 1) Create Order: forwards to ZapUPI securely from server-side
app.post("/api/create-order", async (req, res) => {
  try {
    // Expect from frontend (example): { amount: 10, mobile: "9XXXXXXXXX", remark: "Free Fire Entry" }
    const { amount, mobile, remark } = req.body || {};

    if (!API_TOKEN || !SECRET_KEY) {
      return res.status(500).json({ error: "Server not configured: API keys missing" });
    }
    if (!amount) {
      return res.status(400).json({ error: "amount required" });
    }

    // Prepare payload as form-urlencoded (per docs snippet)
    const payload = {
      token: API_TOKEN,         // field names may vary by provider; adjust if docs require different keys
      secret: SECRET_KEY,
      amount: amount,
      mobile: mobile || "",
      remark: remark || "Bazaarika Entry ₹10",
      // Optional: your webhook/callbacks
      webhook_url: `${req.protocol}://${req.get("host")}/webhook/zapupi`,
      callback_url: "" // if you have a success page, put its URL here
    };

    const resp = await axios.post(
      `${ZAPUPI_API}/api/create-order`,
      qs.stringify(payload),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15000 }
    );

    // Return provider response directly to client
    res.status(200).json({ ok: true, provider: resp.data });
  } catch (err) {
    // bubble up useful info but hide secrets
    const status = err.response?.status || 500;
    res.status(status).json({
      ok: false,
      error: err.response?.data || err.message || "create-order failed"
    });
  }
});

// 2) Webhook endpoint (Set this as "Deposit Webhook URL" in ZapUPI dashboard)
app.post("/webhook/zapupi", async (req, res) => {
  try {
    // Tip: If ZapUPI sends a signature header, verify here (HMAC compare).
    // Example pseudo:
    // const signature = req.get("X-ZapUPI-Signature");
    // validateSignature(signature, req.rawBody, SECRET_KEY);

    const event = req.body;
    // TODO: update your DB: mark order paid/failed by event.status, etc.
    console.log("🔔 ZapUPI webhook:", JSON.stringify(event));

    // Always 200 quickly so provider doesn’t retry forever
    res.status(200).json({ received: true });
  } catch (e) {
    // If verification fails, you can return 400
    res.status(400).json({ received: false });
  }
});

// 3) Static hosting for the index.html if you want to serve it from same app
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public"))); // place index.html in /public

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
});
