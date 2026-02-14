import express from 'express';
import cookieParser from 'cookie-parser';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';

const app = express();
app.use(cookieParser());

const PORT = process.env.PORT || 10000;

if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
  throw new Error('Missing Shopify API credentials');
}

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: [
    'read_customers',
    'write_customers',
    'read_orders',
    'read_fulfillments',
    'write_products',
  ],
  hostName: 'donation-allowance-backend.onrender.com',
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

app.get('/', (req, res) => {
  res.send('Backend is running');
});

/**
 * START OAUTH
 */
app.get('/auth', async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }

  console.log('➡️ Starting OAuth for shop:', shop);

  await shopify.auth.begin({
    shop,
    callbackPath: '/auth/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

/**
 * OAUTH CALLBACK
 */
app.get('/auth/callback', async (req, res) => {
  try {
    console.log('⬅️ OAuth callback received');

    const session = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    console.log('✅ OAuth completed for shop:', session.shop);

    res.send(`
      <h1>OAuth successful</h1>
      <p>Shop: ${session.shop}</p>
    `);
  } catch (error) {
    console.error('❌ OAuth failed:', error);
    res.status(500).send('OAuth failed – see server logs');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
