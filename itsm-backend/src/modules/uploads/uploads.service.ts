import { Injectable } from "@nestjs/common";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

export const UPLOADS_ROOT = join(process.cwd(), "uploads");

/**
 * Thin wrapper around the disk-storage location used by Multer in
 * UploadsController. Kept as its own service (rather than inlining the path
 * logic in the controller) so other modules — CatalogAttachment today,
 * anything else that needs "give the user a persisted file" tomorrow — share
 * one definition of where files live and how their public URL is built,
 * instead of each reimplementing it.
 */
@Injectable()
export class UploadsService {
  constructor() {
    if (!existsSync(UPLOADS_ROOT)) {
      mkdirSync(UPLOADS_ROOT, { recursive: true });
    }
  }

  /** Public URL for a file saved under UPLOADS_ROOT with the given disk filename. */
  toPublicUrl(filename: string): string {
    return `/uploads/${filename}`;
  }
}
