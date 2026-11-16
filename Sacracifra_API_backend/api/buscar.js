// /api/buscar  —  SacraCifra
// 1) Link do CifraClub  -> lê o HTML direto (grátis, instantâneo, sem IA)
// 2) Outro link / busca  -> Gemini (como antes)
// 3) Se o leitor falhar  -> Gemini como reserva
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   GEMINI_API_KEY  (obrigatória só para o caminho com IA)
//   GEMINI_MODEL    (opcional; padrão = o modelo que você já usava)

// ───────── AJUSTES ─────────
const AUTOR_PREFERE_COMPOSITOR = false; // true: usa o compositor quando a página tiver
const CATEGORIA_DO_SITE = false;        // true: usa o gênero do site (ex.: "Gospel/Religioso")
const SIMPLIFICAR_ACORDES = true;       // F7M(9) -> F7M, Dm7(9) -> Dm7 (mesma regra que o prompt da IA)
const MODELO_PADRAO = 'gemini-3.8-flash';
const CACHE_MAX = 300;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// ────────────────────────────

// ---- caracteres invisíveis (montados por código para evitar problemas de escape)
function classe(faixas) {
  return '[' + faixas.map(([a, b]) =>
    b === undefined ? String.fromCharCode(a) : String.fromCharCode(a) + '-' + String.fromCharCode(b)
  ).join('') + ']';
}
const INVISIVEIS = new RegExp(classe([
  [0x200B, 0x200F], [0x202A, 0x202E], [0x2060, 0x2064], [0xFEFF], [0x00AD], [0x180E],
]), 'g');
const ESPACOS_ESTRANHOS = new RegExp(classe([
  [0x00A0], [0x0085], [0x1680], [0x2000, 0x200A], [0x2028], [0x2029],
  [0x202F], [0x205F], [0x3000], [0x2800], [0x3164],
]), 'g');

function limpar(s) {
  return s.replace(INVISIVEIS, '').replace(ESPACOS_ESTRANHOS, ' ');
}

function decodificar(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function semTags(s) {
  return decodificar(s.replace(/<[^>]+>/g, '')).trim();
}

// ---- acordes: separar rótulo e simplificar
const TOKEN_ACORDE = /^\(?[A-G](#|b)?[^\s]*$/;

function ehLinhaDeAcordes(trecho) {
  const t = trecho.trim().split(/\s+/).filter(Boolean);
  return t.length > 0 && t.every((x) => TOKEN_ACORDE.test(x) && x.length <= 14);
}

// "[Intro] D9 Dm"  ->  "[Intro]\nD9 Dm"   (rótulo sozinho na linha, como o app espera)
function separarRotulos(linhas) {
  const saida = [];
  for (const l of linhas) {
    const m = l.match(/^(\s*\[[^\]]+\])\s+(\S.*)$/);
    if (m && ehLinhaDeAcordes(m[2])) {
      saida.push(m[1].trim());
      // mantém a coluna original dos acordes (alinha com as linhas seguintes)
      saida.push(' '.repeat(l.length - m[2].length) + m[2]);
    } else {
      saida.push(l);
    }
  }
  return saida;
}

function simplificarLinhaDeAcordes(l) {
  if (!ehLinhaDeAcordes(l)) return l;
  // remove extensões entre parênteses, preservando o espaçamento original
  return l.replace(/(\S+?)\(([^)]*)\)/g, (m, base) => base + ' '.repeat(m.length - base.length));
}

// ---- leitor do CifraClub
function extrairCifraClub(html) {
  const ini = html.search(/<pre[^>]*data-chord-content/i);
  if (ini < 0) return null;
  const fim = html.indexOf('</pre>', ini);
  if (fim < 0) return null;

  let texto = html.slice(ini, fim)
    .replace(/^<pre[^>]*>/i, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  texto = limpar(decodificar(texto)).replace(/\r/g, '');

  let linhas = texto.split('\n').map((l) => l.replace(/\s+$/, ''));
  linhas = separarRotulos(linhas);
  if (SIMPLIFICAR_ACORDES) linhas = linhas.map(simplificarLinhaDeAcordes);
  const conteudo = linhas.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  if (!conteudo) return null;

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const ha = html.match(/<\/h1>\s*<a[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>/i);
  let titulo = h1 ? semTags(h1[1]) : '';
  let artista = ha ? semTags(ha[1]) : '';
  let compositor = '';
  let genero = '';

  const reLd = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = reLd.exec(html))) {
    let d;
    try { d = JSON.parse(m[1]); } catch (_) { continue; }
    const tipos = [].concat(d['@type'] || []);
    if (tipos.includes('MusicComposition') && Array.isArray(d.composer) && d.composer[0]) {
      compositor = d.composer[0].name || '';
    }
    if (tipos.includes('BreadcrumbList') && d.itemListElement && d.itemListElement[1]) {
      genero = d.itemListElement[1].name || '';
    }
    if (!artista && d.byArtist && d.byArtist.name) artista = d.byArtist.name;
  }
  if (!titulo) {
    const t = html.match(/<title>([^<]+)<\/title>/i);
    if (t) titulo = decodificar(t[1]).split(' - ')[0].trim();
  }

  // vídeo (só existe em algumas cifras): aparece como youtubeID no JSON da página
  const yt = html.match(/youtubeID\\?":\\?"([A-Za-z0-9_-]{11})/);
  const youtube = yt ? 'https://www.youtube.com/watch?v=' + yt[1] : '';

  return {
    titulo,
    artista: AUTOR_PREFERE_COMPOSITOR && compositor ? compositor : artista,
    tom: '',
    categoria: CATEGORIA_DO_SITE ? genero : '',
    youtube,
    conteudo,
  };
}

function ehCifraClub(link) {
  try {
    const u = new URL(link);
    return /^https?:$/.test(u.protocol) && /(^|\.)cifraclub\.com(\.br)?$/i.test(u.hostname);
  } catch (_) {
    return false;
  }
}

async function lerCifraClub(link) {
  const resp = await fetch(link, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SacraCifra/1.0)',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error('CifraClub respondeu ' + resp.status);
  const r = extrairCifraClub(await resp.text());
  if (!r) throw new Error('Cifra não encontrada na página');
  return { ...r, fonte: link };
}

// ---- cache em memória (vale enquanto a função da Vercel estiver "quente")
const cache = new Map();
function cacheGet(k) {
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.t > CACHE_TTL_MS) { cache.delete(k); return null; }
  return e.v;
}
function cacheSet(k, v) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(k, { t: Date.now(), v });
}

// ---- Gemini (igual ao que você já tinha)
function montarPrompt(linkOuBusca, artista) {
  if (linkOuBusca.startsWith('http://') || linkOuBusca.startsWith('https://')) {
    return `Acesse e leia o conteúdo exato da página web contida neste link: "${linkOuBusca}".
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
  }
  return `Aja como um catalogador musical. Encontre na web a cifra exata para: "${linkOuBusca}" ${artista ? `do artista "${artista}"` : ''}.

BUSCA OBRIGATÓRIA DO YOUTUBE:
Faça uma pesquisa na web utilizando o operador "site:youtube.com" junto com o nome da música e do artista para encontrar e retornar o link direto de um vídeo de referência no campo "youtube".

Simplifique acordes excessivamente complexos ou extensões avançadas entre parênteses (como F7M(9) para F7M e Dm7(9) vira Dm7), mantendo acordes básicos e sétimas comuns.

REGRAS DE FORMATAÇÃO:
- Nunca coloque rótulos de seção ou arranjo (como [Intro], [Solo], [Refrão]) na mesma linha que os acordes. Deixe-os em linhas separadas.

Retorne exclusivamente em formato JSON puro, contendo as chaves: "titulo", "artista", "tom", "categoria", "youtube", "conteudo" e "fonte", preservando rigorosamente o layout e as quebras de linha originais da cifra.`;
}

async function viaGemini(linkOuBusca, artista) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const e = new Error('GEMINI_API_KEY não definida.');
    e.http = 500; e.titulo = 'Configuração incorreta';
    throw e;
  }
  const modelo = process.env.GEMINI_MODEL || MODELO_PADRAO;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: montarPrompt(linkOuBusca, artista) }] }],
        tools: [{ google_search: {} }],
      }),
    }
  );
  const bruto = await response.text();
  if (!response.ok) {
    const e = new Error('Rejeitado pela API do Google (' + response.status + ')');
    e.http = 500; e.titulo = 'Rejeitado pela API do Google'; e.extra = { statusHttp: response.status, respostaGoogle: bruto };
    throw e;
  }
  const data = JSON.parse(bruto);
  const texto = data.candidates && data.candidates[0] && data.candidates[0].content &&
    data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text;
  if (!texto) {
    const e = new Error('Estrutura de resposta inesperada');
    e.http = 500; e.titulo = 'Estrutura de resposta inesperada'; e.extra = { dados: data };
    throw e;
  }
  let t = texto.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  const json = JSON.parse(t);
  if (typeof json.conteudo === 'string') json.conteudo = limpar(json.conteudo);
  return json;
}

// ---- rota
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { url, query, musica, artista } = req.body || {};
  const linkOuBusca = String(url || query || musica || '').trim();
  if (!linkOuBusca) {
    return res.status(400).json({ erro: 'Link ou termo de busca é obrigatório' });
  }

  const chaveCache = linkOuBusca.toLowerCase() + '|' + String(artista || '').toLowerCase();
  const guardado = cacheGet(chaveCache);
  if (guardado) return res.status(200).json({ ...guardado, origem: 'cache' });

  let motivoLeitor = '';
  try {
    let resultado;

    if (ehCifraClub(linkOuBusca)) {
      try {
        resultado = { ...(await lerCifraClub(linkOuBusca)), origem: 'leitor' };
      } catch (erroLeitor) {
        motivoLeitor = erroLeitor.message;
        console.warn('Leitor do CifraClub falhou, usando IA:', erroLeitor.message);
      }
    }

    if (!resultado) {
      resultado = { ...(await viaGemini(linkOuBusca, artista)), origem: 'ia' };
    }

    cacheSet(chaveCache, resultado);
    return res.status(200).json(resultado);
  } catch (erro) {
    return res.status(erro.http || 500).json({
      erro: erro.titulo || 'Exceção capturada no catch',
      detalhes: erro.message,
      leitorCifraClub: ehCifraClub(linkOuBusca)
        ? (motivoLeitor || 'não foi usado') : 'link não é do CifraClub',
      ...(erro.extra || {}),
    });
  }
}