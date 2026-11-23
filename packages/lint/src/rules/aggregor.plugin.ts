import {definePlugin} from "@oxlint/plugins";

import {buildingBlockRule} from "@pkg/lint/src/rules/buildingBlock.rule.ts";
import {constantPlacementRule} from "@pkg/lint/src/rules/constantPlacement.rule.ts";
import {declaringFileRule} from "@pkg/lint/src/rules/declaringFile.rule.ts";
import {fileRoleRule} from "@pkg/lint/src/rules/fileRole.rule.ts";
import {kindFolderRule} from "@pkg/lint/src/rules/kindFolder.rule.ts";
import {maxLinesPerFunctionRule} from "@pkg/lint/src/rules/maxLinesPerFunction.rule.ts";
import {minimalScrollbarRule} from "@pkg/lint/src/rules/minimalScrollbar.rule.ts";
import {moduleBoundaryRule} from "@pkg/lint/src/rules/moduleBoundary.rule.ts";
import {noPassThroughRule} from "@pkg/lint/src/rules/noPassThrough.rule.ts";
import {oneLineCommentRule} from "@pkg/lint/src/rules/oneLineComment.rule.ts";
import {singleConsumerRule} from "@pkg/lint/src/rules/singleConsumer.rule.ts";
import {spanNameRule} from "@pkg/lint/src/rules/spanName.rule.ts";
import {stemFolderRule} from "@pkg/lint/src/rules/stemFolder.rule.ts";
import {typePlacementRule} from "@pkg/lint/src/rules/typePlacement.rule.ts";

export default definePlugin({
  meta: {name: "aggregor"},
  rules: {
    "building-block": buildingBlockRule,
    "constant-placement": constantPlacementRule,
    "declaring-file": declaringFileRule,
    "file-role": fileRoleRule,
    "kind-folder": kindFolderRule,
    "max-lines-per-function": maxLinesPerFunctionRule,
    "minimal-scrollbar": minimalScrollbarRule,
    "module-boundary": moduleBoundaryRule,
    "no-pass-through": noPassThroughRule,
    "one-line-comment": oneLineCommentRule,
    "single-consumer": singleConsumerRule,
    "span-name": spanNameRule,
    "stem-folder": stemFolderRule,
    "type-placement": typePlacementRule
  }
});
