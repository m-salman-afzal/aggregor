import {BaseEntity} from "@entities/base/base.entity.ts";
import {Schema} from "effect";

export class ReviewCommentEntity extends BaseEntity.extend<ReviewCommentEntity>("ReviewComment")({
  body: Schema.String,
  endLine: Schema.Int,
  filePath: Schema.String,
  startLine: Schema.Int
}) {
  public get lineRange(): string {
    return this.startLine === this.endLine ? `${this.startLine}` : `${this.startLine}-${this.endLine}`;
  }
}
