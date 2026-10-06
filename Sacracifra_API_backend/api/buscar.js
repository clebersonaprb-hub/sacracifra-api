export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  // Agora aceita tanto 'url' direta quanto 'query' antiga para retrocompatibilidade
  const { url, query, musica, artista } = req.body || {};
  const linkOuBusca = (url || query || musica || "").trim();

  if (!linkOuBusca) {
    return res.status(400).json({ erro: 'Link ou termo de busca é obrigatório' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ erro: 'Configuração incorreta', detalhes: 'GEMINI_API_KEY não definida.' });
    }

    let promptInstrucao = "";

    // Se o usuário passou uma URL (ex: Cifra Club), usamos a ferramenta de busca para ler o link exato
    if (linkOuBusca.startsWith("http://") || linkOuBusca.startsWith("https://")) {
      promptInstrucao = `Acesse e leia o conteúdo exato da página web contida neste link: "${linkOuBusca}".
Extraia de lá a cifra oficial da música sem alterar acordes, letras ou estrofes.
Retorne exclusivamente em formato JSON puro (sem markdown, blocos de código ou formatação extra), contendo exatamente as chaves:
- "titulo": Nome oficial da música extraído da página
- "artista": Nome do artista ou banda extraído da página
- "tom": Tom principal da música
- "categoria": Momento litúrgico sugerido ou estilo
- "conteudo": A cifra completa da página preservando rigorosamente as seções ([Intro], [Refrão], etc.) e os acordes alinhados acima da letra
- "fonte": "${linkOuBusca}"`;
    } else {
      // Fallback caso ainda mandem texto corrido por engano
      promptInstrucao = `Aja como um catalogador musical. Encontre na web a cifra exata para: "${linkOuBusca}" ${artista ? `do artista "${artista}"` : ''}.
Retorne exclusivamente em formato JSON puro, contendo as chaves: "titulo", "artista", "tom", "categoria", "conteudo" e "fonte".`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptInstrucao }] }],
        tools: [{ "google_search": {} }] // Permite que a IA acesse o link fornecido na web
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
