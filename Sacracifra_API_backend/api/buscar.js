export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { query, musica, artista } = req.body || {};
  const termoPesquisa = query || musica;

  if (!termoPesquisa) {
    return res.status(400).json({ erro: 'Termo de busca é obrigatório' });
  }

  try {
    const prompt = `Gere os dados completos da música/termo "${termoPesquisa}" ${artista ? `do artista "${artista}"` : ''} preenchendo os campos abaixo em formato JSON puro:
    {
      "titulo": "Nome da Música",
      "artista": "Nome do Artista",
      "tom": "Tom da música (ex: G, C, Am)",
      "categoria": "Litúrgica ou Louvor ou Comum",
      "conteudo": "Letra completa com as cifras entre colchetes ex: [G] [C] Letra..."
    }`;

    const apiKey = process.env.GEMINI_API_KEY;
    
    // Chamada direta via REST API do Gemini com o modelo atualizado
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Erro desconhecido na API do Gemini');
    }

    const textoResposta = data.candidates[0].content.parts[0].text;
    const jsonFinal = JSON.parse(textoResposta.trim());
    return res.status(200).json(jsonFinal);

  } catch (erro) {
    console.error("Erro detalhado:", erro);
    return res.status(500).json({ erro: 'Falha ao gerar música', detalhes: erro.message });
  }
}
