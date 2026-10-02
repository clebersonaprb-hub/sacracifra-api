export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { query, musica, artista } = req.body || {};
  let termoPesquisa = (query || musica || "").toLowerCase();

  if (!termoPesquisa) {
    return res.status(400).json({ erro: 'Termo de busca é obrigatório' });
  }

  // 1. DICIONÁRIO DE SEGURANÇA PARA MÚSICAS CRÍTICAS (Evita gargalos e erros da IA)
  if (termoPesquisa.includes("como és lindo") || termoPesquisa.includes("vida reluz")) {
    return res.status(200).json({
      "titulo": "Como És Lindo",
      "artista": "Vida Reluz",
      "tom": "D",
      "categoria": "Litúrgica",
      "conteudo": "[Intro]\nD  A/C#  Bm  Bm/A  G  Em  A4  A\n\n[Verso 1]\nD          A/C#       Bm    Bm/A\nQue bom, Senhor, ir ao teu encontro\nG         Em          A4   A\nPoder chegar e adentrar à tua casa\nF#m       Bm        F#m       Bm\nSentar-me contigo e partilhar da mesma mesa\n   Em         D/F#\nTe olhar, te tocar\n     G               A4   A\nE dizer: Meu Deus, ó como és lindo!\n\n[Refrão]\n         D    A/C#       Bm  Bm/A\nÓ, como és lindo, Senhor!\n         G    Em         A4  A\nÓ, como és lindo, Senhor!\n         F#m  Bm         Em     A     D   A4  A\nÓ, como és lindo, Senhor, meu Deus!\n\n[Segunda Parte]\nD          A/C#          Bm  Bm/A\nÓ, meu Senhor, sei que não sou nada\nG         Em           A4   A\nSem merecer, te recebo em minha casa\nF#m           Bm           F#m         Bm\nMas já que quiseste entrar, tens inteira liberdade\n   Em        D/F#\nMe ama, me cura\n     G\nMe toca, me lava\n                 A4   A\nLiberta o meu coração!\n\n[Refrão]\n         D    A/C#       Bm  Bm/A\nÓ, como és lindo, Senhor!\n         G    Em         A4  A\nÓ, como és lindo, Senhor!\n         F#m  Bm         Em     A     D\nÓ, como és lindo, Senhor, meu Deus!"
    });
  }

  // 2. PARA AS DEMAIS MÚSICAS, SEGUE O FLUXO NORMAL DA IA
  try {
    const prompt = `Aja como um cifrista profissional e catalogador de cifras musicais para o Brasil.
O utilizador procura por: "${termoPesquisa}" ${artista ? `do artista "${artista}"` : ''}.
Retorne estritamente em formato JSON puro (sem markdown) contendo as chaves: "titulo", "artista", "tom", "categoria" e "conteudo" (com acordes em cima alinhados e letra em baixo, utilizando colchetes apenas nas secções ex: [Refrão]).`;

    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Erro na API');

    const jsonFinal = JSON.parse(data.candidates[0].content.parts[0].text.trim());
    return res.status(200).json(jsonFinal);

  } catch (erro) {
    return res.status(500).json({ erro: 'Falha ao buscar cifra', detalhes: erro.message });
  }
}
