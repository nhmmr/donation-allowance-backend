import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// Health check (meget vigtigt for Render)
app.get("/", (req, res) => {
  res.send("Donation Allowance app is running");
});

// === WEBHOOK ENDPOINTS ===

// Product created → default metafields
app.post("/webhooks/product-created", async (req, res) => {
  console.log("Product created webhook received");
  res.sendStatus(200);
});

// Fulfillment created → optjening
app.post("/webhooks/fulfillment-created", async (req, res) => {
  console.log("Fulfillment created webhook received");
  res.sendStatus(200);
});

// Order created → forbrug
app.post("/webhooks/order-created", async (req, res) => {
  console.log("Order created webhook received");
  res.sendStatus(200);
});
import fetch from "node-fetch";

/**
 * Helper: call Shopify Admin API
 */
async function shopifyRequest(query, variables = {}) {
  const res = await fetch(
    `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
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

/**
 * One-time setup: create required webhooks
 */
app.post("/setup/webhooks", async (req, res) => {
  try {
    const topics = [
      { topic: "PRODUCTS_CREATE", path: "/webhooks/product-created" },
      { topic: "ORDERS_CREATE", path: "/webhooks/order-created" },
      { topic: "FULFILLMENTS_CREATE", path: "/webhooks/fulfillment-created" },
    ];

    for (const { topic, path } of topics) {
      const mutation = `
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
          webhookSubscriptionCreate(
            topic: $topic,
            webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }
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

      const result = await shopifyRequest(mutation, {
        topic,
        callbackUrl,
      });

      console.log("Webhook result:", JSON.stringify(result));
    }

    res.json({ ok: true, message: "Webhooks created (or already existed)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
