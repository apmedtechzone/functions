export async function handler(event, context) {
  // GET = verification by Meta
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};
    const mode = params["hub.mode"];
    const token = params["hub.verify_token"];
    const challenge = params["hub.challenge"];

    if (mode === "subscribe" && token === process.env.MY_VERIFY_TOKEN) {
      return { statusCode: 200, body: String(challenge) };
    } else {
      return { statusCode: 403, body: "Verification failed" };
    }
  }

  // POST = incoming WhatsApp message
  if (event.httpMethod === "POST") {
    let data;
    try {
      data = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, body: "Invalid JSON" };
    }

    try {
      const msg = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!msg) return { statusCode: 200, body: "No message" };

      const from = msg.from;
      const text = msg.text?.body || "";

      // CALL OPENAI
      const ai = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: text }]
        })
      });
      const aiJson = await ai.json();
      const reply = aiJson?.choices?.[0]?.message?.content || "Error processing.";

      // SEND REPLY TO WHATSAPP
      await fetch(`https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply }
        })
      });

      return { statusCode: 200, body: "OK" };
    } catch (err) {
      console.error(err);
      return { statusCode: 500, body: "Server error" };
    }
  }

  return { statusCode: 405, body: "Invalid method" };
}
