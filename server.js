const express = require("express");
const fetch = require("node-fetch"); // npm install node-fetch@2
const cors = require("cors");
const path = require("path");
const app = express();

// Environment Variables
const TOKEN_KEY = process.env.API_TOKEN;      // ZapUPI token
const SECRET_KEY = process.env.SECRET_KEY;    // ZapUPI secret
const REDIRECT_URL = process.env.REDIRECT_URL || "https://getaway-zapupi.onrender.com";
const ZAPUPI_URL = "https://api.zapupi.com/api/create-order";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // Serve frontend

// API Route to create order
app.post("/api/create-order", async (req, res) => {
  try {
    const { amount, mobile, remark } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ ok:false, error:"Invalid amount" });

    // Unique order_id
    const order_id = "BZR" + Date.now();

    // Prepare form data for ZapUPI
    const params = new URLSearchParams();
    params.append("token_key", TOKEN_KEY);
    params.append("secret_key", SECRET_KEY);
    params.append("amount", amount);
    params.append("order_id", order_id);
    if (mobile) params.append("custumer_mobile", mobile);
    if (remark) params.append("remark", remark);
    params.append("redirect_url", REDIRECT_URL); // <-- Important: ZapUPI will redirect here after payment

    // Call ZapUPI API
    const response = await fetch(ZAPUPI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    const data = await response.json();

    if (data.status !== "success") {
      return res.status(400).json({ ok:false, error:data.message || "ZapUPI error" });
    }

    res.json({ ok:true, provider: { payment_url:data.payment_url, order_id:data.order_id } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("✅ Server running on port", PORT));
