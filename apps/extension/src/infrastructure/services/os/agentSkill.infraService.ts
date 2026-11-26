import {homedir} from "node:os";

import {NodeServices} from "@effect/platform-node";
import {Array, Config, Context, Effect, Layer} from "effect";
import {FileSystem} from "effect/FileSystem";
import {Path} from "effect/Path";

import {IAgentSkillInfraService} from "@/interfaces/agentSkill.infraService.interface.ts";
import {AGENT_SKILL} from "@pkg/constants/src/agentApi.constant.ts";
import {CLAUDE_HISTORY} from "@pkg/constants/src/agentHistory.constant.ts";

export class AgentSkillInfraService extends Context.Service<AgentSkillInfraService>()(
  "aggregor-app/infrastructure/services/os/agentSkill.infraService/AgentSkillInfraService",
  {
    make: Effect.fn("AgentSkillInfraService.make")(function* () {
      const fileSystem = yield* FileSystem;
      const path = yield* Path;
      const homeFolderPath = homedir();

      // Claude Code reads its skills from its config folder; the other agents read ~/.agents/skills.
      const listSkillFilePaths = Effect.fn("AgentSkillInfraService.listSkillFilePaths")(function* () {
        const configuredClaudeFolder = yield* Config.withDefault(Config.String(CLAUDE_HISTORY.CONFIG_FOLDER_ENV), "");
        const claudeFolderPath =
          configuredClaudeFolder === ""
            ? path.join(homeFolderPath, CLAUDE_HISTORY.DEFAULT_CONFIG_FOLDER)
            : configuredClaudeFolder;
        const agentsFolderPath = path.join(homeFolderPath, AGENT_SKILL.AGENTS_FOLDER_NAME);

        return Array.map([claudeFolderPath, agentsFolderPath], (agentFolderPath) =>
          path.join(agentFolderPath, AGENT_SKILL.SKILLS_FOLDER_NAME, AGENT_SKILL.FOLDER_NAME, AGENT_SKILL.FILE_NAME)
        );
      }, Effect.orDie);

      const writeSkillFileWhenChanged = Effect.fn("AgentSkillInfraService.writeSkillFileWhenChanged")(
        function* (skillFilePath: string, skillText: string) {
          yield* Effect.annotateCurrentSpan({skillFilePath});
          const writtenSkillText = yield* Effect.orElseSucceed(fileSystem.readFileString(skillFilePath), () => "");
          if (writtenSkillText === skillText) return;
          yield* fileSystem.makeDirectory(path.dirname(skillFilePath), {recursive: true});
          yield* fileSystem.writeFileString(skillFilePath, skillText);
        },
        Effect.catch((writeError) => Effect.logWarning("Could not write the agent skill", writeError))
      );

      const writeAgentSkill = Effect.fn("AgentSkillInfraService.writeAgentSkill")(function* (skillText: string) {
        const skillFilePaths = yield* listSkillFilePaths();

        yield* Effect.forEach(skillFilePaths, (skillFilePath) => writeSkillFileWhenChanged(skillFilePath, skillText), {
          discard: true
        });
      });

      return {writeAgentSkill};
    })
  }
) {
  public static readonly layer = Layer.effect(IAgentSkillInfraService, this.make()).pipe(
    Layer.provide(NodeServices.layer)
  );
}
