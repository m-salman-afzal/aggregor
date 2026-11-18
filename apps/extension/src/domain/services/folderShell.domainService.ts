import {toNamePart} from "@domainServices/worktree.domainService.ts";
import {Array, Effect, String} from "effect";

import type {ProjectPathValueObject} from "@valueObjects/projectPath.valueObject.ts";

const FOLDER_SHELL_NAME_PREFIX = "shell-";
const PATH_HASH_MULTIPLIER = 31;
const PATH_HASH_HEX_LENGTH = 6;
const PATH_HASH_MODULUS = 16 ** PATH_HASH_HEX_LENGTH;

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

// "/code/My.App" becomes "shell-my-app-1a2b3c": tmux takes no dots or colons, and the hash keeps same-named folders apart.
export const getFolderShellName = Effect.fn("FolderShellDomainService.getFolderShellName")(function* (
  folderName: string,
  folderPath: ProjectPathValueObject
) {
  return `${FOLDER_SHELL_NAME_PREFIX}${yield* toNamePart(folderName)}-${yield* hashFolderPath(folderPath)}`;
});
