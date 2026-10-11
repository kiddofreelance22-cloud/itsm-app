import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DirectorySource } from "./entities/directory-source.entity";
import { DirectoryService } from "./directory.service";

/** Nightly sync of every active directory. Disable with DIRECTORY_SYNC_ENABLED=false; change the time with DIRECTORY_SYNC_CRON. */
@Injectable()
export class DirectoryScheduler {
  private readonly logger = new Logger(DirectoryScheduler.name);
  constructor(@InjectRepository(DirectorySource) private sources: Repository<DirectorySource>, private directory: DirectoryService) {}

  @Cron(process.env.DIRECTORY_SYNC_CRON || "0 2 * * *")
  async nightly(): Promise<void> {
    if ((process.env.DIRECTORY_SYNC_ENABLED ?? "true").toLowerCase() === "false") return;
    for (const s of await this.sources.find({ where: { isActive: true } })) {
      try { const r = await this.directory.syncNow(s.sourceId, "schedule"); this.logger.log(`Scheduled sync of "${s.name}": ${r.status} (${r.created} created, ${r.updated} updated, ${r.failed} failed)`); }
      catch (e) { this.logger.warn(`Scheduled sync of "${s.name}" skipped: ${(e as Error).message}`); }
    }
  }
}
