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
            const prompt = `Aja como um cifrista profissional, catalogador e pesquisador oficial de cifras musicais.
O utilizador introduziu um termo de busca que pode ser o título, o nome do artista ou um **trecho/frase da letra** da música: "${termoPesquisa}" ${artista ? `do artista "${artista}"` : ''}.

REGRAS ESTRITAS DE BUSCA E IDENTIFICAÇÃO:
1. IDENTIFICAÇÃO POR TRECHO: Se o termo fornecido for uma frase ou verso, identifique primeiro qual é a música e o artista correspondentes às fontes oficiais brasileiras.
2. VARIANTE LINGUÍSTICA (PT-BR): A letra deve estar estritamente na variante do Português do Brasil (PT-BR) exatamente como cantada e gravada pelo artista original brasileiro, proibindo o uso de termos ou pronomes de português europeu (ex: usar "chegar e adentrar à tua casa", "sentar comigo", etc.).
3. FONTES OFICIAIS DE REFERÊNCIA: Baseie a sua busca estritamente nas versões reais publicadas em portais brasileiros (Cifra Club, Cifras, SuperCifras, Letras.mus.br).
4. PROIBIDO ALTERAR OU INVENTAR: É estritamente proibido alterar versos, inventar estrofes ou trocar palavras da letra original. Traga a cifra 100% fiel à gravação de estúdio original.
5. FORMATO CLÁSSico POR LINHAS: 
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
  "conteudo": "Letra em PT-BR e cifras exatas formatadas em linhas clássicas, com secções entre colchetes ex: [Refrão]\n D    A\n Letra..."
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
