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
    const prompt = `Aja como um cifrista profissional e catalogador oficial de cifras musicais.
O utilizador está a procurar pela música: "${termoPesquisa}" ${artista ? `do artista "${artista}"` : ''}.

REGRAS ESTRITAS:
1. BUSCA EXATA E ANTI-ALUCINAÇÃO: Pesquise e retorne estritamente a versão oficial, popular e COMPLETA desta música. É estritamente proibido inventar, omitir estrofes ou misturar trechos de músicas diferentes. Traga exatamente a letra e os acordes reais do artista original.
2. FORMATO CLÁSSICO POR LINHAS: 
   - A cifra deve vir no formato clássico: uma linha contendo apenas os acordes alinhados (sem colchetes) e, logo abaixo, a respetiva linha com a letra da música.
   - Exemplo:
     D       A/C#     Bm
     Que bom, Senhor, ir ao teu encontro
3. ETIQUETAS DE SECÇÃO: Utilize colchetes APENAS para os títulos das secções/partes da música (ex: [Intro], [Verso 1], [Refrão], [Ponte], [Final]). Nunca coloque colchetes à volta dos acordes.
4. FORMATO DE SAÍDA: Retorne a resposta obrigatoriamente num objeto JSON puro, sem blocos de código markdown extra, com exatamente estas chaves:
{
  "titulo": "Nome da Música",
  "artista": "Nome do Artista",
  "tom": "Tom da música (ex: G, C, Am)",
  "categoria": "Litúrgica ou Louvor ou Comum",
  "conteudo": "Letra e cifras formatadas em linhas clássicas, com secções entre colchetes ex: [Refrão]\n D    A\n Letra..."
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
