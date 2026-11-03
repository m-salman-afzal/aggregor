import * as RepoService from "@/application/repo/repo.service.ts";
import {Repo} from "@/domain/entities/repo/repo.entity.ts";
import {decodeCommandArgument} from "@/presentation/utils/command-arguments.utils.ts";
import {Effect} from "effect";

export const addRepo = Effect.fn("RepoController.addRepo")(function* () {
  yield* RepoService.addRepo();
});

// The repo row's … menu passes the Repo itself.
export const removeRepo = Effect.fn("RepoController.removeRepo")(function* (clickedRow: unknown) {
  yield* RepoService.removeRepo(yield* decodeCommandArgument(Repo, clickedRow));
});
