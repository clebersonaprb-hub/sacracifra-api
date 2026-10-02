export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { query, musica, artista } = req.body || {};
  let termoPesquisa = query || musica;

  if (!termoPesquisa) {
    return res.status(400).json({ erro: 'Termo de busca é obrigatório' });
  }

  // SUPORTE À BARRA: Se o termo contiver '/', dividimos em [Busca/Título] e [Artista Opcional]
  let artistaEspecifico = artista;
  if (termoPesquisa.includes('/')) {
    const partes = termoPesquisa.split('/');
    termoPesquisa = partes[0].trim();
    if (!artistaEspecifico && partes[1]) {
      artistaEspecifico = partes[1].trim();
    }
  }

  try {
    const prompt = `Aja como um cifrista profissional, catalogador e pesquisador oficial de cifras musicais.
O utilizador procura estritamente pela música/trecho: "${termoPesquisa}" ${artistaEspecifico ? `do artista específico "${artistaEspecifico}"` : ''}.

REGRAS ESTRITAS DE PRECISÃO E FORMATO:
1. VALIDAÇÃO RIGOROSA DO ARTISTA: Se o artista foi especificado (ou indicado após a barra), é ESTRITAMENTE OBRIGATÓRIO que a cifra pertença a esse artista exato (ex: Vida Reluz). Nunca traga uma música homónima de outro autor ou banda.
2. VARIANTE LINGUÍSTICA (PT-BR): A letra deve estar 100% na variante do Português do Brasil (PT-BR) oficial e exata da gravação original de estúdio.
3. FONTES OFICIAIS DE REFERÊNCIA: Baseie a busca nas versões reais de portais brasileiros (Cifra Club, Cifras, SuperCifras, Letras.mus.br).
4. PROIBIDO MISTURAR: É proibido misturar versos ou refrões de músicas diferentes. A estrutura deve ser inteiramente coesa e pertencer à mesma obra original.
5. FORMATO CLÁSSICO POR LINHAS: 
   - A cifra deve vir no formato clássico: uma linha contendo apenas os acordes alinhados (sem colchetes) e, logo abaixo, a respetiva linha com a letra exata.
   - Exemplo:
     D       A/C#     Bm
     Que bom, Senhor, ir ao teu encontro
6. ETIQUETAS DE SECÇÃO: Utilize colchetes APENAS para os títulos das secções (ex: [Intro], [Verso 1], [Refrão], [Ponte], [Final]). Nunca coloque colchetes à volta dos acordes.
7. FORMATO DE SAÍDA: Retorne a resposta obrigatoriamente num objeto JSON puro, sem blocos de código markdown extra, com exatamente estas chaves:
{
  "titulo": "Nome Oficial da Música",
  "artista": "Nome Correto do Artista",
  "tom": "Tom original da música (ex: G, C, Am)",
  "categoria": "Litúrgica ou Louvor ou Comum",
  "conteudo": "Letra coesa em PT-BR e cifras exatas formatadas em linhas clássicas, com secções entre colchetes ex: [Refrão]\n D    A\n Letra..."
}`;

    const apiKey = process.env.GEMINI_API_KEY;

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
