import { contentTermPairs } from '../text/tokens';

export interface IndexedDoc {
  id: string;
  vector: Map<string, number>;
  norm: number;
  terms: Set<string>;
}

export class TermIndex {
  private readonly docs = new Map<string, IndexedDoc>();
  private readonly docFrequency = new Map<string, number>();
  private readonly surfaces = new Map<string, string>();

  constructor(entries: Array<{ id: string; text: string }>) {
    const rawTerms = new Map<string, string[]>();
    for (const entry of entries) {
      const terms = this.collect(entry.text);
      rawTerms.set(entry.id, terms);
      for (const term of new Set(terms)) {
        this.docFrequency.set(term, (this.docFrequency.get(term) ?? 0) + 1);
      }
    }
    for (const [id, terms] of rawTerms) this.docs.set(id, this.vectorize(terms, id));
  }

  private collect(text: string): string[] {
    return contentTermPairs(text).map(({ term, surface }) => {
      if (!this.surfaces.has(term)) this.surfaces.set(term, surface);
      return term;
    });
  }

  get size(): number {
    return this.docs.size;
  }

  surface(term: string): string {
    return this.surfaces.get(term) ?? term;
  }

  idf(term: string): number {
    const df = this.docFrequency.get(term) ?? 0;
    return Math.log((this.docs.size + 1) / (df + 0.5)) + 1;
  }

  private vectorize(terms: string[], id: string): IndexedDoc {
    const counts = new Map<string, number>();
    for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
    const vector = new Map<string, number>();
    let sum = 0;
    for (const [term, count] of counts) {
      const weight = (1 + Math.log(count)) * this.idf(term);
      vector.set(term, weight);
      sum += weight * weight;
    }
    return { id, vector, norm: Math.sqrt(sum) || 1, terms: new Set(counts.keys()) };
  }

  queryVector(text: string): IndexedDoc {
    return this.vectorize(this.collect(text), '__query__');
  }

  doc(id: string): IndexedDoc | undefined {
    return this.docs.get(id);
  }

  cosine(a: IndexedDoc, b: IndexedDoc): number {
    let dot = 0;
    const [small, large] = a.vector.size < b.vector.size ? [a, b] : [b, a];
    for (const [term, weight] of small.vector) {
      const other = large.vector.get(term);
      if (other) dot += weight * other;
    }
    return dot / (a.norm * b.norm);
  }

  coverage(query: IndexedDoc, doc: IndexedDoc): number {
    let total = 0;
    let covered = 0;
    for (const term of query.terms) {
      const weight = this.idf(term);
      total += weight;
      if (doc.terms.has(term)) covered += weight;
    }
    return total ? covered / total : 0;
  }

  similarity(query: IndexedDoc, doc: IndexedDoc): number {
    return 0.4 * this.cosine(query, doc) + 0.6 * this.coverage(query, doc);
  }

  search(text: string, limit = 10): Array<{ id: string; score: number; shared: string[] }> {
    const query = this.queryVector(text);
    const results: Array<{ id: string; score: number; shared: string[] }> = [];
    for (const doc of this.docs.values()) {
      const score = this.cosine(query, doc);
      if (score <= 0) continue;
      results.push({ id: doc.id, score, shared: this.distinctiveShared(query, doc) });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  distinctiveShared(a: IndexedDoc, b: IndexedDoc, limit = 6): string[] {
    return [...a.terms]
      .filter((term) => b.terms.has(term))
      .sort((x, y) => this.idf(y) - this.idf(x))
      .slice(0, limit)
      .map((term) => this.surface(term));
  }
}
