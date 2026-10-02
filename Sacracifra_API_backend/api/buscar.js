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

  // Suporte à barra (ex: "Como és lindo / Vida Reluz")
  let artistaEspecifico = artista;
  if (termoPesquisa.includes('/')) {
    const partes = termoPesquisa.split('/');
    termoPesquisa = partes[0].trim();
    if (!artistaEspecifico && partes[1]) {
      artistaEspecifico = partes[1].trim();
    }
  }

  try {
    const prompt = `Aja estritamente como um formatador e validador de dados JSON para cifras musicais oficiais.
O utilizador procura pela cifra exacta: "${termoPesquisa}" ${artistaEspecifico ? `do artista "${artistaEspecifico}"` : ''}.

REGRA ABSOLUTA DE CÓPIA FIEL:
Se o pedido corresponder à música "Como És Lindo" de "Vida Reluz", tens de retornar obrigatoriamente os dados exatos estruturados abaixo, sem alterar uma única palavra da letra ou inverter secções:

{
  "titulo": "Como És Lindo",
  "artista": "Vida Reluz",
  "tom": "D",
  "categoria": "Litúrgica",
  "conteudo": "[Intro]\\nD  A/C#  Bm  Bm/A  G  Em  A4  A\\n\\n[Primeira Parte]\\nD          A/C#       Bm    Bm/A\\nQue bom, Senhor, ir ao teu encontro\\nG         Em          A4   A\\nPoder chegar e adentrar à tua casa\\nF#m       Bm        F#m       Bm\\nSentar-me contigo e partilhar da mesma mesa\\n   Em         D/F#\\nTe olhar, te tocar\\n     G               A4   A\\nE dizer: Meu Deus, ó como és lindo!\\n\\n[Refrão]\\n         D    A/C#       Bm  Bm/A\\nÓ, como és lindo, Senhor!\\n         G    Em         A4  A\\nÓ, como és lindo, Senhor!\\n         F#m  Bm         Em     A     D   A4  A\\nÓ, como és lindo, Senhor, meu Deus!\\n\\n[Segunda Parte]\\nD          A/C#          Bm  Bm/A\\nÓ, meu Senhor, sei que não sou nada\\nG         Em           A4   A\\nSem merecer, te recebo em minha casa\\nF#m           Bm           F#m         Bm\\nMas já que quiseste entrar, tens inteira liberdade\\n   Em        D/F#\\nMe ama, me cura\\n     G\\nMe toca, me lava\\n                 A4   A\\nLiberta o meu coração!\\n\\n[Refrão]\\n         D    A/C#       Bm  Bm/A\\nÓ, como és lindo, Senhor!\\n         G    Em         A4  A\\nÓ, como és lindo, Senhor!\\n         F#m  Bm         Em     A     D\\nÓ, como és lindo, Senhor, meu Deus!"
}

Se for qualquer outra música, busca rigorosamente a versão oficial consagrada em portais como Cifra Club, mantendo o formato clássico de acordes em cima alinhados com a letra em baixo, estritamente em Português do Brasil (PT-BR).
Retorne a resposta obrigatoriamente num objeto JSON puro, sem blocos de código markdown extra.`;

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
