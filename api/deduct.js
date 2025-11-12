const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

  const { user_id, amount } = req.body;

  if (!user_id || !amount) {
    res.status(400).json({ error: "Missing user_id or amount" });
    return;
  }

  try {
    // Get current balance
    const balanceResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?user_id=eq.${user_id}&select=credits`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
        },
      }
    );

    const balanceData = await balanceResponse.json();

    if (!balanceData || balanceData.length === 0) {
      res.status(400).json({ error: "User not found" });
      return;
    }

    const currentCredits = balanceData[0].credits;

    if (currentCredits < amount) {
      res.status(400).json({
        error: "Insufficient credits",
        currentCredits,
        required: amount,
      });
      return;
    }

    // Deduct credits
    await fetch(`${SUPABASE_URL}/rest/v1/users?user_id=eq.${user_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        credits: currentCredits - amount,
      }),
    });

    const newCredits = currentCredits - amount;

    res.status(200).json({
      success: true,
      previous_credits: currentCredits,
      deducted: amount,
      new_credits: newCredits,
    });
  } catch (error) {
    console.error("Deduct error:", error);
    res.status(500).json({ error: error.message || "Deduction failed" });
  }
};
