import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { query, musica, artista } = req.body || {};
  const termoPesquisa = query || musica;

  if (!termoPesquisa) {
    return res.status(400).json({ erro: 'Termo de busca é obrigatório' });
  }

  try {
    const prompt = `Gere os dados completos da música/termo "${termoPesquisa}" ${artista ? `do artista "${artista}"` : ''} preenchendo os campos abaixo em formato JSON puro:

    {
      "titulo": "Nome da Música",
      "artista": "Nome do Artista",
      "tom": "Tom da música (ex: G, C, Am)",
      "categoria": "Litúrgica ou Louvor ou Comum",
      "conteudo": "Letra completa com as cifras entre colchetes ex: [G] [C] Letra..."
    }`;

    // Usando o modelo gemini-2.5-flash standard
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const textoResposta = response.text ? response.text.trim() : '';
    const jsonFinal = JSON.parse(textoResposta);
    return res.status(200).json(jsonFinal);

  } catch (erro) {
    console.error("Erro interno no backend:", erro);
    return res.status(500).json({ 
      erro: 'Falha ao gerar música com a IA', 
      detalhes: erro.message 
    });
  }
}
