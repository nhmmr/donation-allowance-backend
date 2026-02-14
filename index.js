import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";
import querystring from "querystring";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 10000;

/* ------------------------------------------------------------------ */
/* Middleware */
/* ------------------------------------------------------------------ */

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* ------------------------------------------------------------------ */
/* Simple in-memory token store (OK til single shop) */
/* ------------------------------------------------------------------ */

let SHOPIFY_ACCESS_TOKEN = null;

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

function verifyHmac(query) {
  const { hmac, signature, host, ...rest } = query;

  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("&");

  const generatedHash = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(generatedHash, "utf-8"),
    Buffer.from(hmac, "utf-8")
  );
}

async function shopifyGraphQL(query, variables = {}) {
  if (!SHOPIFY_ACCESS_TOKEN) {
    throw new Error("Missing Shopify access token");
  }

  const res = await fetch(
    `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data;
}

/* ------------------------------------------------------------------ */
/* Routes */
/* ------------------------------------------------------------------ */

app.get("/", (req, res) => {
  res.send("Donation Allowance backend is running");
});

/* ------------------------------------------------------------------ */
/* 1️⃣ OAuth – start installation */
/* ------------------------------------------------------------------ */

app.get("/auth", (req, res) => {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const state = crypto.randomBytes(16).toString("hex");

  const installUrl =
    `https://${shop}/admin/oauth/authorize?` +
    querystring.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      scope: process.env.SHOPIFY_SCOPES,
      redirect_uri:
        "https://donation-allowance-backend.onrender.com/auth/callback",
      state,
    });

  res.redirect(installUrl);
});

/* ------------------------------------------------------------------ */
/* 2️⃣ OAuth callback – exchange code for token */
/* ------------------------------------------------------------------ */

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  if (!verifyHmac(req.query)) {
    return res.status(400).send("HMAC validation failed");
  }

  try {
    const tokenRes = await fetch(
      `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code,
        }),
      }
    );

    const data = await tokenRes.json();

    SHOPIFY_ACCESS_TOKEN = data.access_token;

    console.log("✅ SHOPIFY ACCESS TOKEN RECEIVED");
    console.log(data.access_token);

    res.send(
      "App installed successfully. You can close this window and return to Render."
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth failed");
  }
});

/* ------------------------------------------------------------------ */
/* 3️⃣ One-time webhook setup */
/* ------------------------------------------------------------------ */

app.post("/setup/webhooks", async (req, res) => {
  try {
    const webhooks = [
      {
        topic: "PRODUCTS_CREATE",
        path: "/webhooks/product-created",
      },
      {
        topic: "ORDERS_CREATE",
        path: "/webhooks/order-created",
      },
      {
        topic: "FULFILLMENTS_CREATE",
        path: "/webhooks/fulfillment-created",
      },
    ];

    for (const { topic, path } of webhooks) {
      const mutation = `
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
          webhookSubscriptionCreate(
            topic: $topic
            webhookSubscription: {
              callbackUrl: $callbackUrl
              format: JSON
            }
          ) {
            webhookSubscription {
              id
              topic
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const callbackUrl = `https://donation-allowance-backend.onrender.com${path}`;

      const result = await shopifyGraphQL(mutation, {
        topic,
        callbackUrl,
      });

      console.log("🔔 Webhook setup result:", JSON.stringify(result));
    }

    res.json({ ok: true, message: "Webhooks created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------------------------------------------------ */
/* 4️⃣ Webhook receivers (placeholders) */
/* ------------------------------------------------------------------ */

app.post("/webhooks/product-created", (req, res) => {
  console.log("📦 Product created webhook received");
  res.status(200).send("OK");
});

app.post("/webhooks/order-created", (req, res) => {
  console.log("🧾 Order created webhook received");
  res.status(200).send("OK");
});

app.post("/webhooks/fulfillment-created", (req, res) => {
  console.log("🚚 Fulfillment created webhook received");
  res.status(200).send("OK");
});

/* ------------------------------------------------------------------ */
/* Start server */
/* ------------------------------------------------------------------ */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
