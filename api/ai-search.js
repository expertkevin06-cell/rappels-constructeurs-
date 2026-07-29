export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Methode non autorisee" });
    return;
  }

  const { query } = req.body || {};
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ error: "Question manquante" });
    return;
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Cle API non configuree sur le serveur" });
    return;
  }

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "Tu es un assistant specialise dans les rappels de vehicules et de produits constructeurs. Reponds en francais, de maniere factuelle et concise. Cite tes sources quand c'est possible. Si tu n'es pas certain qu'un rappel existe, dis-le clairement plutot que d'inventer un numero de campagne.",
          },
          { role: "user", content: query },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: `Erreur API Perplexity: ${errText}` });
      return;
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "Pas de reponse.";
    const citations = data.citations || [];

    res.status(200).json({ answer, citations });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur: " + err.message });
  }
}
