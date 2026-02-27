chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ANALYZE_PRODUCT") {
    analyzeWithGroq(request.productData, request.apiKey)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  return true;
});

async function analyzeWithGroq(product, apiKey) {
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const prompt = `You are a sustainability expert. Analyze this product and return ONLY valid JSON.

Product: ${product.title}
Brand: ${product.brand}
Description: ${product.description}
Material: ${product.material}
Specifications: ${product.specifications}

Return ONLY this exact JSON structure with no extra text:
{"score":50,"grade":"C","summary":"2-3 sentence summary about this specific product sustainability","greenwash":false,"greenwash_reason":"","certifications_found":[],"breakdown":{"materials":50,"manufacturing":50,"packaging":50,"certifications":50,"carbon_footprint":40},"tips":["tip1","tip2","tip3"]}

Scoring Rules:
- certifications_found: list any certifications like FSC, GOTS, BIS, ISO 14001, B Corp, Fair Trade, Energy Star, OEKO-TEX. Empty array if none.
- materials: bamboo/organic/natural/plant-based/recycled = 85-95, mixed = 50-70, plastic/synthetic = 10-30. Natural products like neem, turmeric, herbs, spices = 90+
- manufacturing: local/ethical/small brand = 65-80, unknown = 50, exploitative = 20-40
- packaging: minimal/eco/recyclable = 70-90, plastic = 10-30, unknown = 50
- certifications: if product is clearly natural or organic by nature even without formal certification give 55-65. Certified = 75-90. No certs and synthetic = 25-40.
- carbon_footprint: natural/plant based products = 60, carbon neutral claims = 80, plastic heavy = 30, default = 40
- score: weighted average where materials counts 40%, packaging 20%, manufacturing 20%, carbon_footprint 10%, certifications 10%. For natural food products like spices, herbs, powders, reduce certifications weight to 5% and increase materials to 45%
- grade: A+ for 90-100, A for 80-89, B+ for 70-79, B for 60-69, C+ for 55-59, C for 45-54, D for below 45
- greenwash: true ONLY if product uses vague claims without ANY supporting evidence`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 512
    })
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Groq API failed");
  }
  const rawText = data.choices?.[0]?.message?.content || "";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Invalid response");
  return JSON.parse(jsonMatch[0]);
}