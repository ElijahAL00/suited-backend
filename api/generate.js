import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function ensureUserExists(userId) {
  // Check if user exists
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
    return; // User already exists
  }

  // Create user with 0 initial credits
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

  const { user_id, prompt, image } = req.body;

  if (!user_id || !prompt || !image) {
    res.status(400).json({ error: "Missing user_id, prompt, or image" });
    return;
  }

  try {
    // Ensure user exists in database
    await ensureUserExists(user_id);

    // Call Replicate API
    console.log(`Generating image for user ${user_id} with prompt: ${prompt}`);

    const output = await replicate.run("google/nano-banana", {
      input: {
        image: image,
        prompt: prompt,
      },
    });

    const imageUrl = output[0] || output;

    console.log(`Generated image: ${imageUrl}`);

    // Log generation to database
    await fetch(`${SUPABASE_URL}/rest/v1/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id,
        prompt,
        image_url: imageUrl,
        credits_deducted: 30,
        status: "success",
      }),
    });

    // Deduct credits
    const deductResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?user_id=eq.${user_id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credits: `credits - 30`,
        }),
      }
    );

    console.log(`✓ Deducted 30 credits for user ${user_id}`);

    res.status(200).json({
      success: true,
      image_url: imageUrl,
    });
  } catch (error) {
    console.error("Generation error:", error);
    res.status(500).json({
      error: error.message || "Generation failed",
    });
  }
};
