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
      // Prompt aprimorado para extrair e descodificar com precisão o slug da URL do Cifra Club
      promptInstrucao = `Analise detalhadamente esta URL oficial do Cifra Club: "${linkOuBusca}".
Extraia rigorosamente o artista e o nome da música a partir dos segmentos da URL (substituindo os hífens por espaços e capitalizando corretamente). 
Com base estritamente nesse artista e nessa música exatos, gere a cifra oficial correspondente. NUNCA substitua por outra música.

REGRAS ABSOLUTAS DE FORMATAÇÃO PARA O CAMPO "CONTEUDO":

0. CABEÇALHO OBRIGATÓRIO NO TOPO:
   - 1ª linha: TÍTULO DA MÚSICA EM LETRAS MAIÚSCULAS
   - 2ª linha: Autor: [Nome correto do artista]
   - 3ª linha: (Linha em branco)
   - Da 4ª linha em diante: A cifra completa.

1. PROIBIDO QUEBRAR LINHAS LONGAS: Mantenha as linhas de texto contínuas como na cifra original.
2. Cada linha de acordes deve manter-se rigorosamente posicionada logo acima da respetiva linha de letra, respeitando o espaçamento horizontal original.
3. SEPARAÇÃO DE RÓTULOS E ACORDES: Nunca coloque rótulos de seção (como [Intro], [Refrão]) na mesma linha que os acordes.
4. SIMPLIFICAÇÃO DE ACORDES: Simplifique acordes complexos (ex: F7M(9) vira F7M).
5. Preserve as seções originais da música.

Retorne exclusivamente em formato JSON puro (sem markdown ou blocos de código), contendo exatamente as chaves:
- "titulo": Nome oficial correto da música identificado na URL
- "artista": Nome oficial do artista identificado na URL
- "tom": Tom principal
- "categoria": Momento litúrgico adequado
- "youtube": ""
- "conteudo": A cifra formatada (incluindo o título em maiúsculas e o autor nas 2 primeiras linhas)
- "fonte": "${linkOuBusca}"`;

    } else {
      promptInstrucao = `Aja como um catalogador musical. Encontre a cifra exata para: "${linkOuBusca}" ${artista ? `do artista "${artista}"` : ''}.

Simplifique acordes excessivamente complexos ou extensões avançadas entre parênteses (como F7M(9) para F7M e Dm7(9) vira Dm7), mantendo acordes básicos e sétimas comuns.

REGRAS DE FORMATAÇÃO:
- Nunca coloque rótulos de seção ou arranjo (como [Intro], [Solo], [Refrão]) na mesma linha que os acordes. Deixe-os em linhas separadas.

Retorne exclusivamente em formato JSON puro, contendo as chaves: "titulo", "artista", "tom", "categoria", "youtube", "conteudo" e "fonte", preservando rigorosamente o layout e as quebras de linha originais da cifra.`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptInstrucao }] }]
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
