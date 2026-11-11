require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const data = await response.json();
  return data.access_token;
}

app.post('/api/ai/audit', async (req, res) => {
  const { subscriptions } = req.body;
  const prompt = `Analyze these user subscriptions and provide 3 cost-saving insights in JSON format with keys "insights" (array of strings) and "potentialSavings" (number in USD): ${JSON.stringify(subscriptions)}`;

  // Valid, active model endpoints
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

  for (const modelName of candidateModels) {
    let retries = 2;
    let delay = 1000;

    while (retries > 0) {
      try {
        console.log(`Attempting audit with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const cleanJson = responseText.replace(/```json|```/g, '').trim();
        
        console.log(`Success with ${modelName}!`);
        return res.json(JSON.parse(cleanJson));
      } catch (err) {
        console.warn(`Model ${modelName} failed (${err.message}). Retrying...`);
        if ((err.status === 503 || err.message.includes('503') || err.status === 429) && retries > 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          retries--;
        } else {
          break; // Move to the next model in candidateModels
        }
      }
    }
  }

  res.status(503).json({ error: 'AI models currently unavailable. Please try again shortly.' });
});

app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { amount } = req.body;
    const token = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: amount || '15.00',
          },
        }],
      }),
    });

    const order = await response.json();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderID } = req.body;
    const token = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const captureData = await response.json();
    res.json(captureData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`PayPulse AI Server running on http://localhost:${PORT}`);
  console.log(`Gemini Key Loaded: ${process.env.GEMINI_API_KEY ? 'YES' : 'NO'}`);
});
