const express = require("express");
const fetch = require("node-fetch"); // npm install node-fetch
const cors = require("cors");
const app = express();

// Environment Variables from Render
const TOKEN_KEY = process.env.API_TOKEN;      // ZapUPI token
const SECRET_KEY = process.env.SECRET_KEY;    // ZapUPI secret
const BASE_URL = "https://api.zapupi.com/api/create-order";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static("public")); // Serve frontend

// API Route to create order
app.post("/api/create-order", async (req, res) => {
  try {
    const { amount, mobile, remark } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ ok:false, error:"Invalid amount" });

    // Generate unique order_id
    const order_id = "BZR" + Date.now();

    // Prepare form data for ZapUPI
    const params = new URLSearchParams();
    params.append("token_key", TOKEN_KEY);
    params.append("secret_key", SECRET_KEY);
    params.append("amount", amount);
    params.append("order_id", order_id);
    if (mobile) params.append("custumer_mobile", mobile);
    if (remark) params.append("remark", remark);

    // Call ZapUPI API
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const data = await response.json();

    if (data.status !== "success") {
      return res.status(400).json({ ok:false, error:data.message || "ZapUPI error" });
    }

    // Success → return payment link & order_id
    res.json({ ok:true, provider: { payment_url:data.payment_url, order_id:data.order_id } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("✅ Server running on port", PORT));
