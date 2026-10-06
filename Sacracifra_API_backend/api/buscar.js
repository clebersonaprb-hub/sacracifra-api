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
    // Unificamos o comando e as regras de formato de forma clara em um prompt único e robusto
    const promptCompleto = `Aja como um cifrista profissional e catalogador de cifras musicais para o Brasil.
O utilizador procura pela música: "${termoPesquisa}" ${artista ? `do artista "${artista}"` : ''}.

REGRAS OBRIGATÓRIAS:
1. Retorne estritamente UMA ÚNICA música correspondente. Nunca misture versos ou trechos de músicas diferentes.
2. Retorne exclusivamente em formato JSON puro (sem markdown ou blocos de código), contendo exatamente as chaves: "titulo", "artista", "tom", "categoria" e "conteudo".
3. No campo "conteudo", mantenha os acordes alinhados acima da letra ou utilize colchetes nas seções (ex: [Refrão]).`;

    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptCompleto }] }],
        generationConfig: { 
          responseMimeType: "application/json",
          temperature: 0.1
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || JSON.stringify(data));
    }

    let textoResposta = data.candidates[0].content.parts[0].text.trim();
    
    // Limpeza de segurança caso venha com marcação de markdown
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
