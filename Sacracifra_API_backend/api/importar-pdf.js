export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { pdfBase64, textoPdf } = req.body || {};

  if (!pdfBase64 && !textoPdf) {
    return res.status(400).json({ erro: 'O arquivo PDF ou texto é obrigatório' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("ERRO: GEMINI_API_KEY não definida no Vercel.");
      return res.status(500).json({ erro: 'Configuração incorreta', detalhes: 'GEMINI_API_KEY não definida.' });
    }

    const promptInstrucao = `Aja como um catalogador musical especialista em cifras litúrgicas. Analise o documento/texto fornecido e estruture-o no formato JSON do aplicativo SacraCif.

REGRAS ABSOLUTAS DE FORMATAÇÃO PARA O CAMPO "CONTEUDO":
1. FORMATO DE LINHAS CURTAS: Quebre os versos e estrofes longas em linhas curtas (máximo de 32 a 38 caracteres por linha).
2. Cada linha curta de letra deve ter obrigatoriamente a sua própria linha de acordes logo acima. O padrão final deve ser sempre intercalado: uma linha de acordes e uma linha de letra curta.
3. SIMPLIFICAÇÃO DE ACORDES: Simplifique extensões avançadas entre parênteses (ex: F7M(9) vira F7M, Dm7(9) vira Dm7).
4. Preserve estritamente as seções originais ([Intro], [Primeira Parte], [Refrão], etc.).

Retorne exclusivamente em formato JSON puro (sem markdown, blocos de código ou acentos de formatação), contendo exatamente as chaves:
- "titulo": Nome da música extraído
- "artista": Nome do autor ou banda (se houver, senão "Desconhecido")
- "tom": Tom principal da música (se identificável, senão "")
- "categoria": Momento litúrgico adequado (ex: "Entrada", "Salmo", "Comunhão", etc.)
- "conteudo": A cifra formatada rigidamente com linhas curtas e acordes emparelhados`;

    let parts = [{ text: promptInstrucao }];

    if (pdfBase64) {
      parts.push({
        inline_data: {
          mime_type: "application/pdf",
          data: pdfBase64
        }
      });
    } else if (textoPdf) {
      parts[0].text += `\n\nTEXTO BRUTO:\n"""\n${textoPdf}\n"""`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: parts }] })
    });

    const respostaTextoBruto = await response.text();
    
    if (!response.ok) {
      console.error("ERRO DO GOOGLE GEMINI:", respostaTextoBruto);
      return res.status(500).json({ erro: 'Rejeitado pela API do Google', statusHttp: response.status, respostaGoogle: respostaTextoBruto });
    }

    const data = JSON.parse(respostaTextoBruto);
    
    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      console.error("ERRO: Estrutura inesperada do Gemini:", JSON.stringify(data));
      return res.status(500).json({ erro: 'Estrutura de resposta inesperada', dados: data });
    }

    let textoResposta = data.candidates[0].content.parts[0].text.trim();
    textoResposta = textoResposta.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");

    const jsonFinal = JSON.parse(textoResposta);
    return res.status(200).json(jsonFinal);

  } catch (erro) {
    console.error("EXCEÇÃO NO CATCH:", erro.message, erro.stack);
    return res.status(500).json({ erro: 'Exceção capturada no catch', detalhes: erro.message });
  }
}
