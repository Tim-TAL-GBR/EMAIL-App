export function extractSnippet(bodyHtml: string | null | undefined, bodyText: string | null | undefined): string {
  let cleanText = '';

  // 1. Try to extract from HTML first, as it's the truest representation and we can safely strip <style> blocks
  if (bodyHtml) {
    cleanText = bodyHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ') // Strip all remaining HTML tags
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  // 2. Fallback to bodyText, but clean it up if it looks polluted with CSS
  if (!cleanText && bodyText) {
    cleanText = bodyText
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ') // Sometimes HTML leaks into plain text
      .replace(/\{[^}]+\}/g, ' ') // Strip CSS blocks like ".button { color: red; }"
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Also remove common css selectors left over (e.g. .button__cell)
  if (cleanText) {
     cleanText = cleanText.replace(/(?:^|\s)\.[a-zA-Z0-9_-]+\s/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return cleanText.substring(0, 200).trim();
}
