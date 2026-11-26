import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { KnowledgeArticle } from "./entities/knowledge-article.entity";
import { KnowledgeArticleEvent } from "./entities/knowledge-article-event.entity";
import { KnowledgeService } from "./knowledge.service";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeArticleAttachment } from "./entities/knowledge-article-attachment.entity";
import { UploadsModule } from "../uploads/uploads.module";

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeArticle, KnowledgeArticleEvent, KnowledgeArticleAttachment]), UploadsModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
