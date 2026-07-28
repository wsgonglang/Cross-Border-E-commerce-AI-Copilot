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
    scope: 'GLOBAL' | 'MERCHANT'
    sourceUrl: string | null
  }
}

export interface RankedRuleChunk {
  candidate: RetrievalCandidate
  score: number
  matchedTerms: string[]
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function buildSearchTerms(value: string): string[] {
  const normalized = normalize(value)
  const terms = new Set<string>()
  for (const match of normalized.matchAll(/[\p{Script=Latin}\p{N}]+/gu)) {
    if (match[0].length > 1 && !STOP_TERMS.has(match[0])) terms.add(match[0])
  }
  for (const match of normalized.matchAll(/[\p{Script=Han}]+/gu)) {
    const text = match[0]
    if (text.length === 1 && !STOP_TERMS.has(text)) terms.add(text)
    for (let index = 0; index < text.length - 1; index += 1) {
      const term = text.slice(index, index + 2)
      if (!STOP_TERMS.has(term)) terms.add(term)
    }
  }
  return [...terms]
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
  const queryTerms = buildSearchTerms(query)
  if (queryTerms.length === 0 || candidates.length === 0) return []

  const documentFrequency = new Map<string, number>()
  for (const term of queryTerms) {
    documentFrequency.set(
      term,
      candidates.filter((candidate) => candidate.searchTerms.includes(term))
        .length,
    )
  }

  return candidates
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
        const inverseFrequency =
          Math.log((candidates.length + 1) / (frequency + 1)) + 1
        return (
          sum + (Math.max(1, termFrequency) + titleBoost) * inverseFrequency
        )
      }, 0)
      const coverage = matchedTerms.length / queryTerms.length
      const exactPhraseBoost = normalize(candidate.content).includes(
        normalize(query),
      )
        ? 2
        : 0
      const rawScore = lexicalScore + exactPhraseBoost
      const score = Math.min(
        1,
        rawScore / Math.max(4, queryTerms.length * 1.5) + coverage * 0.25,
      )
      return {
        candidate,
        score: Number(score.toFixed(3)),
        matchedTerms,
      }
    })
    .filter(
      (result) =>
        result.matchedTerms.length >= Math.min(2, queryTerms.length) &&
        result.score >= 0.15,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.document.id.localeCompare(right.candidate.document.id) ||
        left.candidate.id.localeCompare(right.candidate.id),
    )
    .slice(0, limit)
}
