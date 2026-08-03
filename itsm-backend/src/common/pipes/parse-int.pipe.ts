import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from "@nestjs/common";

/**
 * Usage: @Param('id', ParseIntPipe) id: number
 * Rejects non-numeric route params with a clear 400 instead of a silent NaN.
 */
@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new BadRequestException(
        `"${metadata.data}" must be a valid integer, received "${value}"`
      );
    }
    return parsed;
  }
}
