import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";

export interface KnowledgeHit { source: string; text: string }

/**
 * Policy / how-to documents for the bot: drop .md or .txt files into CHAT_KNOWLEDGE_DIR (default ./knowledge).
 * Files are split into short passages and searched by keyword overlap — no extra infrastructure needed for a first version.
 */
@Injectable()
export class ChatKnowledgeService {
  private readonly log = new Logger(ChatKnowledgeService.name);
  private chunks: KnowledgeHit[] | null = null;
  private static readonly STOP = new Set("the a an and or of to in on for is are was be how do i my me can what where when with from it this that at as by".split(" "));

  constructor(private readonly config: ConfigService) {}

  private load(): KnowledgeHit[] {
    if (this.chunks) return this.chunks;
    const dir = path.resolve(this.config.get<string>("CHAT_KNOWLEDGE_DIR") ?? "knowledge");
    const out: KnowledgeHit[] = [];
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!/\.(md|txt)$/i.test(f)) continue;
        const paras = fs.readFileSync(path.join(dir, f), "utf8").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        let buf = "";
        for (const p of paras) {
          if (buf && buf.length + p.length > 900) { out.push({ source: f, text: buf }); buf = ""; }
          buf += (buf ? "\n\n" : "") + p;
        }
        if (buf) out.push({ source: f, text: buf });
      }
    } catch { this.log.warn(`No knowledge folder at ${dir}; the bot will answer from the catalog and tickets only.`); }
    return (this.chunks = out);
  }

  /** Re-read the folder (call after documents change). */
  reload() { this.chunks = null; }

  search(query: string, limit = 4): KnowledgeHit[] {
    const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !ChatKnowledgeService.STOP.has(t));
    if (!terms.length) return [];
    return this.load()
      .map((c) => ({ c, score: terms.reduce((n, t) => n + (c.text.toLowerCase().includes(t) ? 1 : 0), 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.c);
  }
}
