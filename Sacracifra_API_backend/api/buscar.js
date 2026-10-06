export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

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

    if (linkOuBusca.startsWith("http://") || linkOuBusca.startsWith("https://")) {
      promptInstrucao = `Acesse e leia o conteúdo exato da página web contida neste link: "${linkOuBusca}".
Extraia de lá a cifra oficial da música. 

REGRAS ABSOLUTAS DE FORMATAÇÃO PARA O CAMPO "CONTEUDO":
1. FORMATO DE LINHAS CURTAS: Quebre os versos e estrofes longas em linhas curtas (máximo de 32 a 38 caracteres por linha de texto). NUNCA deixe frases longas que precisem de quebra automática de tela.
2. Cada linha curta de letra deve ter obrigatoriamente a sua própria linha de acordes logo acima. O padrão final deve ser sempre intercalado: uma linha de acordes e uma linha de letra curta.
3. Preserve estritamente as seções originais ([Intro], [Primeira Parte], [Refrão], etc.).
4. Remova tablaturas longas e complexas se houver, focando na cifra limpa para acompanhamento.

Retorne exclusivamente em formato JSON puro (sem markdown, blocos de código ou acentos de formatação), contendo exatamente as chaves:
- "titulo": Nome oficial da música
- "artista": Nome do artista ou banda
- "tom": Tom principal
- "categoria": Momento litúrgico
- "conteudo": A cifra formatada rigidamente com linhas curtas e acordes emparelhados
- "fonte": "${linkOuBusca}"`;
    } else {
      promptInstrucao = `Aja como um catalogador musical. Encontre na web a cifra exata para: "${linkOuBusca}" ${artista ? `do artista "${artista}"` : ''}.
Retorne exclusivamente em formato JSON puro, contendo as chaves: "titulo", "artista", "tom", "categoria", "conteudo" e "fonte", aplicando a regra de linhas curtas de texto.`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptInstrucao }] }],
        tools: [{ "google_search": {} }]
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
