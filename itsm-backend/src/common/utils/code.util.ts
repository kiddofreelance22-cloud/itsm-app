import { ObjectLiteral, Repository } from "typeorm";

/** "In Progress" -> "IN_PROGRESS" (max 40 chars). */
export function slugCode(name: string): string {
  return (name || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "CODE";
}

/** A code derived from `name`, made unique in `field` by appending _2, _3 … */
export async function uniqueCode<T extends ObjectLiteral>(repo: Repository<T>, field: keyof T & string, name: string): Promise<string> {
  const base = slugCode(name);
  let candidate = base;
  for (let n = 2; n < 1000; n++) {
    const hit = await repo.createQueryBuilder("e").where(`e.${field} = :c`, { c: candidate }).getCount();
    if (!hit) return candidate;
    candidate = `${base}_${n}`.slice(0, 50);
  }
  return `${base}_${Date.now()}`.slice(0, 50);
}
