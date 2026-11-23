import {Array, Context, Effect, Layer, String} from "effect";

import {WorktreeDomainService} from "@/domainServices/worktree.domainService.ts";

import type {ProjectPathValueObject} from "@/valueObjects/projectPath.valueObject.ts";

const FOLDER_SHELL_NAME_PREFIX = "shell-";
const PATH_HASH_MULTIPLIER = 31;
const PATH_HASH_HEX_LENGTH = 6;
const PATH_HASH_MODULUS = 16 ** PATH_HASH_HEX_LENGTH;

export class FolderShellDomainService extends Context.Service<FolderShellDomainService>()(
  "aggregor-app/domain/services/folderShell.domainService/FolderShellDomainService",
  {
    make: Effect.fn("FolderShellDomainService.make")(function* () {
      const worktreeDomainService = yield* WorktreeDomainService;

      // Written out here, so no library update gives a shell that is still running another name.
      const hashFolderPath = Effect.fn("FolderShellDomainService.hashFolderPath")(function* (
        folderPath: ProjectPathValueObject
      ) {
        const pathHash = Array.reduce(
          [...new TextEncoder().encode(folderPath)],
          0,
          (hash, pathByte) => (hash * PATH_HASH_MULTIPLIER + pathByte) % PATH_HASH_MODULUS
        );

        return String.padStart(PATH_HASH_HEX_LENGTH, "0")(pathHash.toString(16));
      });

      // tmux takes no dots or colons in a session name, and the hash keeps same-named folders apart.
      const getFolderShellName = Effect.fn("FolderShellDomainService.getFolderShellName")(function* (
        folderName: string,
        folderPath: ProjectPathValueObject
      ) {
        return `${FOLDER_SHELL_NAME_PREFIX}${yield* worktreeDomainService.formatTextAsNamePart(folderName)}-${yield* hashFolderPath(folderPath)}`;
      });

      return {getFolderShellName};
    })
  }
) {
  public static readonly layer = Layer.effect(this, this.make()).pipe(Layer.provide(WorktreeDomainService.layer));
}
