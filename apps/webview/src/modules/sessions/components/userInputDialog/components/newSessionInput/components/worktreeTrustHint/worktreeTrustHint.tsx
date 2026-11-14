import {useWorktreeTrustHint} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/worktreeTrustHint/worktreeTrustHint.hook.ts";
import {WORKTREE_TRUST_LABELS} from "@pkg/constants/src/git.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";

interface WorktreeTrustHintProps {
  readonly folderPath: string;
}

export const WorktreeTrustHint = (props: WorktreeTrustHintProps) => {
  const worktreeTrustHintView = useWorktreeTrustHint(props);
  if (!worktreeTrustHintView.isShown) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl px-3 py-2 text-xs text-muted-foreground ring-1 ring-hairline ring-inset">
      <p>{WORKTREE_TRUST_LABELS.EXPLANATION}</p>
      <p className="break-all text-foreground-strong select-text">{props.folderPath}</p>
      {worktreeTrustHintView.isPathCopied && <p>{WORKTREE_TRUST_LABELS.PATH_COPIED}</p>}
      <div className="flex flex-wrap gap-1">
        <Button onClick={worktreeTrustHintView.trustFolder} size="xs" type="button" variant="soft">
          {WORKTREE_TRUST_LABELS.TRUST_FOLDER}
        </Button>
        <Button onClick={worktreeTrustHintView.hide} size="xs" type="button" variant="ghost">
          {WORKTREE_TRUST_LABELS.HIDE}
        </Button>
      </div>
    </div>
  );
};
