const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Product ID to credits mapping (source of truth for your subscription values)
const PRODUCT_CREDITS = {
  "com.suited.subscription.weekly": 700,
  "com.suited.subscription.monthly": 500,
  "com.suited.subscription.yearly": 3000,
  "suited_premium_30y_3000c": 3000, // Sandbox
};

async function ensureUserExists(userId) {
  const checkResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/users?user_id=eq.${userId}&select=id`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
      },
    }
  );

  const existingUsers = await checkResponse.json();

  if (existingUsers.length > 0) {
    return;
  }

  await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      credits: 0,
    }),
  });
}

export default async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { user_id, transaction_id, product_id } = req.body;

  if (!user_id || !transaction_id || !product_id) {
    res.status(400).json({
      error: "Missing user_id, transaction_id, or product_id",
    });
    return;
  }

  // Check if product is valid
  const creditsToAllocate = PRODUCT_CREDITS[product_id];
  if (!creditsToAllocate) {
    res.status(400).json({
      error: `Unknown product: ${product_id}`,
    });
    return;
  }

  try {
    // Check if transaction already allocated (dedup)
    const existingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/subscription_allocations?transaction_id=eq.${transaction_id}&select=id`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
        },
      }
    );

    const existingAllocations = await existingResponse.json();

    if (existingAllocations && existingAllocations.length > 0) {
      // Already allocated
      console.log(
        `Transaction ${transaction_id} already allocated, skipping`
      );
      res.status(200).json({
        message: "Already allocated",
        credits_allocated: 0,
      });
      return;
    }

    // Ensure user exists
    await ensureUserExists(user_id);

    // Add to subscription_allocations table
    await fetch(`${SUPABASE_URL}/rest/v1/subscription_allocations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id,
        transaction_id,
        product_id,
        credits_allocated: creditsToAllocate,
      }),
    });

    // Add credits to user
    const balanceResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?user_id=eq.${user_id}&select=credits`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
        },
      }
    );

    const userData = await balanceResponse.json();
    const currentCredits = userData[0].credits || 0;
    const newCredits = currentCredits + creditsToAllocate;

    await fetch(`${SUPABASE_URL}/rest/v1/users?user_id=eq.${user_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        credits: newCredits,
      }),
    });

    console.log(
      `✓ Allocated ${creditsToAllocate} credits to user ${user_id}`
    );

    res.status(200).json({
      success: true,
      credits_allocated: creditsToAllocate,
      new_balance: newCredits,
    });
  } catch (error) {
    console.error("Allocation error:", error);
    res.status(500).json({
      error: error.message || "Allocation failed",
    });
  }
};
