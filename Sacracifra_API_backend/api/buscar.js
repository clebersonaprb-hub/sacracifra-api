export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { query, musica, artista } = req.body || {};
  let termoPesquisa = (query || musica || "").trim();

  if (!termoPesquisa) {
    return res.status(400).json({ erro: 'Termo de busca é obrigatório' });
  }

  try {
    const systemInstruction = `Você é um músico profissional, cifrista e catalogador de repertório católico/religioso brasileiro.
Sua tarefa é buscar na sua base de conhecimento a cifra exata solicitada e retorná-la limpa e estruturada.

REGRAS DE FORMATAÇÃO (ESTRITO):
Retorne um objeto JSON puro contendo exatamente estas chaves:
- "titulo": Nome oficial da música (string)
- "artista": Cantor, banda ou ministério (string)
- "tom": Tom principal da música (ex: "D", "G", "A", etc.)
- "categoria": Momento litúrgico sugerido (ex: "Entrada", "Comunhão", "Louvor", etc.)
- "conteudo": A cifra completa contendo as seções ([Intro], [Verso 1], [Refrão], etc.), com os acordes perfeitamente alinhados acima das respectivas linhas de letra.`;

    const userPrompt = `Busque a música: "${termoPesquisa}" ${artista ? `do artista "${artista}"` : ''}.`;

    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { 
          responseMimeType: "application/json",
          temperature: 0.1 // Temperatura baixa para ser extremamente fiel e objetiva
        }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Erro na API do Gemini');

    let textoResposta = data.candidates[0].content.parts[0].text.trim();

    // Limpeza de segurança caso a IA coloque blocos de marcação markdown indesejados
    textoResposta = textoResposta.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");

    const jsonFinal = JSON.parse(textoResposta);
    return res.status(200).json(jsonFinal);

  } catch (erro) {
    return res.status(500).json({ 
      erro: 'Falha ao buscar cifra', 
      detalhes: erro.message 
    });
  }
}
