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
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ erro: 'Configuração incorreta', detalhes: 'GEMINI_API_KEY não está definida nas variáveis de ambiente da Vercel.' });
    }

    const promptCompleto = `Aja como um cifrista profissional e catalogador de cifras musicais para o Brasil. 
O usuário buscou por: "${termoPesquisa}" ${artista ? `do artista "${artista}"` : ''}.

INSTRUÇÃO DE BUSCA:
- O termo buscado pode conter o nome da música, o nome do artista/banda ou um trecho da letra digitado pelo usuário. Use essas pistas para identificar com precisão cirúrgica a versão correta da música.
- Se houver múltiplos homônimos (músicas com o mesmo nome, como "Como És Lindo"), priorize a versão litúrgica/católica tradicional correspondente aos termos ou trechos digitados.
- Retorne estritamente UMA ÚNICA música correspondente.
- Retorne exclusivamente em formato JSON puro (sem markdown, blocos de código ou acentos de formatação), contendo exatamente as chaves: "titulo", "artista", "tom", "categoria" e "conteudo".
- No campo "conteudo", mantenha os acordes alinhados acima da letra ou utilize colchetes nas seções (ex: [Refrão]).`;

    // Usando o modelo gemini-3.8-flash atualizado
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptCompleto }] }]
      })
    });

    const respostaTextoBruto = await response.text();
    
    if (!response.ok) {
      return res.status(500).json({ 
        erro: 'Rejeitado pela API do Google', 
        statusHttp: response.status,
        respostaGoogle: respostaTextoBruto 
      });
    }

    const data = JSON.parse(respostaTextoBruto);
    
    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      return res.status(500).json({ erro: 'Estrutura de resposta inesperada', dados: data });
    }

    let textoResposta = data.candidates[0].content.parts[0].text.trim();
    textoResposta = textoResposta.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");

    const jsonFinal = JSON.parse(textoResposta);
    return res.status(200).json(jsonFinal);

  } catch (erro) {
    return res.status(500).json({ 
      erro: 'Exceção capturada no catch', 
      detalhes: erro.message,
      stack: erro.stack
    });
  }
}
