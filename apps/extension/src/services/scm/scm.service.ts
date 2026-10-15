import {Context} from "effect";

import type {Effect} from "effect";
import type * as vsc from "vscode";

export class ScmService extends Context.Service<ScmService, {scm: Effect.Effect<vsc.SourceControl>}>()(
  "aggregor/services/git/scm.service/ScmService"
) {}
