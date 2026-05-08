function cleanSegment(raw: string, fallback: string) {
  const cleaned = raw
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '')
    .slice(0, 18)
  return cleaned || fallback
}

function pickByPatterns(prompt: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const matched = prompt.match(pattern)
    if (matched?.[1]) return matched[1]
  }
  return ''
}

export function extractIndustryAndStyle(prompt: string) {
  const industryRaw = pickByPatterns(prompt, [
    /(?:所属)?行业(?:赛道)?(?:为|是|：|:)?\s*([^\n，。；;、]+)/i,
    /赛道(?:为|是|：|:)?\s*([^\n，。；;、]+)/i,
  ])
  const styleRaw = pickByPatterns(prompt, [
    /(?:画面)?风格(?:为|是|：|:)?\s*([^\n，。；;、]+)/i,
    /画风(?:为|是|：|:)?\s*([^\n，。；;、]+)/i,
  ])

  return {
    industry: cleanSegment(industryRaw, '通用'),
    style: cleanSegment(styleRaw, '默认风格'),
  }
}

export function buildCoverFilename(prompt: string, seq: number, ext: string) {
  const { industry, style } = extractIndustryAndStyle(prompt)
  return `${industry}-${style}-${String(seq).padStart(2, '0')}.${ext}`
}
