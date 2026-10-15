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
Extraia de lá a cifra oficial da música (título, artista, tom e categoria).

BUSCA OBRIGATÓRIA DO YOUTUBE:
Faça uma pesquisa na web utilizando o operador exato "site:youtube.com" combinado com o título extraído da música e o nome do artista (ex: site:youtube.com [titulo] [artista]). Obtenha o URL direto do vídeo correspondente (ex: https://www.youtube.com/watch?v=...) e preencha o campo "youtube". Se não encontrar nenhum link, deixe a string vazia "".

REGRAS ABSOLUTAS DE FORMATAÇÃO PARA O CAMPO "CONTEUDO":

1. PROIBIDO QUEBRAR LINHAS LONGAS: Copie exatamente como está no site. Se a frase for longa, ela DEVE OBRIGATORIAMENTE manter-se numa única linha contínua, por mais longa que seja. NUNCA divida uma frase de texto em duas linhas.

2. Cada linha de acordes deve manter-se rigorosamente posicionada logo acima da respetiva linha de letra, exatamente como no site de origem, respeitando o espaçamento horizontal original para que os acordes fiquem alinhados com as palavras corretas.

3. SEPARAÇÃO DE RÓTULOS E ACORDES: Nunca coloque rótulos de seção ou indicações de arranjo (como [Intro], [Solo], [Refrão], etc.) na mesma linha que os acordes. O rótulo deve ficar isolado em sua própria linha acima, mantendo a linha de acordes puramente limpa com as notas.

4. SIMPLIFICAÇÃO DE ACORDES: Simplifique acordes excessivamente complexos ou extensões avançadas entre parênteses (como nonas ou trezenas, ex: F7M(9) vira F7M, e Dm7(9) vira Dm7). Preserve acordes básicos, com sétima (7, 7M) e menores (m), para manter compatibilidade com os diagramas visuais do aplicativo.

5. Preserve estritamente as seções originais ([Intro], [Primeira Parte], [Refrão], etc.).

6. Remova tablaturas longas e complexas se houver, focando na cifra limpa para acompanhamento.

Retorne exclusivamente em formato JSON puro (sem markdown, blocos de código ou acentos de formatação), contendo exatamente as chaves:
- "titulo": Nome oficial da música
- "artista": Nome do artista ou banda
- "tom": Tom principal
- "categoria": Momento litúrgico
- "youtube": URL direto do YouTube obtido através da busca com site:youtube.com
- "conteudo": A cifra formatada mantendo rigorosamente a estrutura original de linhas do site e com os rótulos separados dos acordes
- "fonte": "${linkOuBusca}"`;

    } else {
      promptInstrucao = `Aja como um catalogador musical. Encontre na web a cifra exata para: "${linkOuBusca}" ${artista ? `do artista "${artista}"` : ''}.

BUSCA OBRIGATÓRIA DO YOUTUBE:
Faça uma pesquisa na web utilizando o operador "site:youtube.com" junto com o nome da música e do artista para encontrar e retornar o link direto de um vídeo de referência no campo "youtube".

Simplifique acordes excessivamente complexos ou extensões avançadas entre parênteses (como F7M(9) para F7M e Dm7(9) vira Dm7), mantendo acordes básicos e sétimas comuns.

REGRAS DE FORMATAÇÃO:
- Nunca coloque rótulos de seção ou arranjo (como [Intro], [Solo], [Refrão]) na mesma linha que os acordes. Deixe-os em linhas separadas.

Retorne exclusivamente em formato JSON puro, contendo as chaves: "titulo", "artista", "tom", "categoria", "youtube", "conteudo" e "fonte", preservando rigorosamente o layout e as quebras de linha originais da cifra.`;
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
