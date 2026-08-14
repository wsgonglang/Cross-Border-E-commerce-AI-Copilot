const STOP_TERMS = new Set([
  'about',
  'and',
  'for',
  'the',
  'what',
  '商品',
  '平台',
  '怎么',
  '是否',
  '规则',
  '相关',
  '需要',
  '哪些',
])

export interface RuleChunkInput {
  sequence: number
  heading?: string
  content: string
  searchTerms: string[]
}

export interface RetrievalCandidate {
  id: string
  content: string
  heading: string | null
  searchTerms: string[]
  document: {
    id: string
    title: string
    platform: string
    market: string | null
    category: string | null
    version: string | null
    scope: 'GLOBAL' | 'MERCHANT'
    sourceUrl: string | null
  }
}

export interface RankedRuleChunk {
  candidate: RetrievalCandidate
  score: number
  matchedTerms: string[]
  coverage: number
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function buildSearchTerms(value: string): string[] {
  const normalized = normalize(value)
    .replaceAll('刊登', '发布')
    .replaceAll('上架', '发布')
    .replaceAll('法规', '规则')
  const terms: string[] = []
  for (const match of normalized.matchAll(/[\p{Script=Latin}\p{N}]+/gu)) {
    if (match[0].length > 1 && !STOP_TERMS.has(match[0])) terms.push(match[0])
  }
  for (const match of normalized.matchAll(/[\p{Script=Han}]+/gu)) {
    const text = match[0]
    if (text.length === 1 && !STOP_TERMS.has(text)) terms.push(text)
    for (let index = 0; index < text.length - 1; index += 1) {
      const term = text.slice(index, index + 2)
      if (!STOP_TERMS.has(term)) terms.push(term)
    }
  }
  return terms
}

function splitLongParagraph(paragraph: string, maxLength: number): string[] {
  if (paragraph.length <= maxLength) return [paragraph]
  const parts: string[] = []
  const overlap = 80
  for (let start = 0; start < paragraph.length; start += maxLength - overlap) {
    parts.push(paragraph.slice(start, start + maxLength))
    if (start + maxLength >= paragraph.length) break
  }
  return parts
}

export function chunkRuleContent(
  content: string,
  maxLength = 800,
): RuleChunkInput[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const sections: Array<{ heading?: string; paragraph: string }> = []
  let heading: string | undefined
  let paragraph: string[] = []
  const flush = () => {
    const text = paragraph.join(' ').replace(/\s+/g, ' ').trim()
    if (text) sections.push({ heading, paragraph: text })
    paragraph = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      flush()
      heading = headingMatch[1]!.trim().slice(0, 255)
    } else if (!line) {
      flush()
    } else {
      paragraph.push(line)
    }
  }
  flush()

  const chunks: RuleChunkInput[] = []
  let buffer = ''
  let bufferHeading: string | undefined
  const pushBuffer = () => {
    if (!buffer) return
    chunks.push({
      sequence: chunks.length,
      heading: bufferHeading,
      content: buffer,
      searchTerms: buildSearchTerms(`${bufferHeading ?? ''} ${buffer}`),
    })
    buffer = ''
  }

  for (const section of sections) {
    for (const part of splitLongParagraph(section.paragraph, maxLength)) {
      if (
        buffer &&
        (buffer.length + part.length + 1 > maxLength ||
          bufferHeading !== section.heading)
      ) {
        pushBuffer()
      }
      bufferHeading = section.heading
      buffer = buffer ? `${buffer}\n${part}` : part
    }
  }
  pushBuffer()
  return chunks
}

export function rankRuleChunks(
  query: string,
  candidates: RetrievalCandidate[],
  limit = 3,
): RankedRuleChunk[] {
  const queryTerms = [...new Set(buildSearchTerms(query))]
  if (queryTerms.length === 0 || candidates.length === 0) return []

  const documentFrequency = new Map<string, number>()
  for (const term of queryTerms) {
    documentFrequency.set(
      term,
      candidates.filter((candidate) => new Set(candidate.searchTerms).has(term))
        .length,
    )
  }

  const averageLength =
    candidates.reduce(
      (sum, candidate) => sum + Math.max(1, candidate.searchTerms.length),
      0,
    ) / candidates.length
  const ranked = candidates
    .map((candidate) => {
      const titleTerms = buildSearchTerms(
        `${candidate.document.title} ${candidate.document.platform}`,
      )
      const matchedTerms = queryTerms.filter(
        (term) =>
          candidate.searchTerms.includes(term) || titleTerms.includes(term),
      )
      const lexicalScore = matchedTerms.reduce((sum, term) => {
        const termFrequency = candidate.searchTerms.filter(
          (candidateTerm) => candidateTerm === term,
        ).length
        const titleBoost = titleTerms.includes(term) ? 0.75 : 0
        const frequency = documentFrequency.get(term) ?? 0
        const inverseFrequency = Math.log(
          1 + (candidates.length - frequency + 0.5) / (frequency + 0.5),
        )
        const k1 = 1.2
        const b = 0.75
        const lengthNormalization =
          k1 *
          (1 -
            b +
            (b * Math.max(1, candidate.searchTerms.length)) / averageLength)
        const bm25 =
          (termFrequency * (k1 + 1)) / (termFrequency + lengthNormalization)
        return sum + (bm25 + titleBoost) * inverseFrequency
      }, 0)
      const coverage = matchedTerms.length / queryTerms.length
      const exactPhraseBoost = normalize(candidate.content).includes(
        normalize(query),
      )
        ? 2
        : 0
      const rawScore = lexicalScore + exactPhraseBoost
      const score =
        1 - Math.exp(-rawScore / Math.max(2, Math.sqrt(queryTerms.length)))
      return {
        candidate,
        score: Number(score.toFixed(3)),
        matchedTerms,
        coverage: Number(coverage.toFixed(3)),
      }
    })
    .filter(
      (result) =>
        result.matchedTerms.length >= Math.min(2, queryTerms.length) &&
        result.coverage >= 0.25 &&
        result.score >= 0.2,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.document.id.localeCompare(right.candidate.document.id) ||
        left.candidate.id.localeCompare(right.candidate.id),
    )
  const diversified: RankedRuleChunk[] = []
  const usedDocuments = new Set<string>()
  for (const result of ranked) {
    if (usedDocuments.has(result.candidate.document.id)) continue
    diversified.push(result)
    usedDocuments.add(result.candidate.document.id)
    if (diversified.length === limit) return diversified
  }
  for (const result of ranked) {
    if (diversified.includes(result)) continue
    diversified.push(result)
    if (diversified.length === limit) break
  }
  return diversified
}

export function assessRuleRanking(ranked: RankedRuleChunk[]): {
  sufficient: boolean
  topScore?: number
  topCoverage?: number
  scoreGap?: number
} {
  const top = ranked[0]
  if (!top) return { sufficient: false }
  const scoreGap = Number((top.score - (ranked[1]?.score ?? 0)).toFixed(3))
  const confidence =
    top.score * 0.55 + top.coverage * 0.35 + Math.min(0.1, scoreGap * 0.5)
  return {
    sufficient: confidence >= 0.18,
    topScore: top.score,
    topCoverage: top.coverage,
    scoreGap,
  }
}
