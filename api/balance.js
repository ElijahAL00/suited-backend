const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { user_id } = req.query;

  if (!user_id) {
    res.status(400).json({ error: "Missing user_id" });
    return;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?user_id=eq.${user_id}&select=credits`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
        },
      }
    );

    const data = await response.json();

    if (!data || data.length === 0) {
      // User doesn't exist, return 0 credits
      res.status(200).json({ credits: 0 });
      return;
    }

    res.status(200).json({ credits: data[0].credits });
  } catch (error) {
    console.error("Balance error:", error);
    res.status(500).json({ error: error.message || "Balance check failed" });
  }
};
