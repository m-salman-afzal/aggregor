import {PullRequestPicker} from "@/modules/sessions/components/userInputDialog/components/pullRequestInput/components/pullRequestPicker/pullRequestPicker.tsx";
import {findPullRequestNotice} from "@/modules/sessions/components/userInputDialog/components/pullRequestInput/pullRequestInput.utils.ts";
import {APP_LABELS} from "@pkg/constants/src/app.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";
import {DialogDescription} from "@pkg/ui/src/components/base/dialog.tsx";

import type {USER_INPUT_TAGS} from "@/modules/sessions/sessions.constant.ts";
import type {UserInput} from "@/modules/sessions/sessions.type.ts";

interface PullRequestInputProps {
  readonly onCancel: () => void;
  readonly userInput: Extract<UserInput, {readonly _tag: typeof USER_INPUT_TAGS.PULL_REQUEST}>;
}

export const PullRequestInput = (props: PullRequestInputProps) => {
  const pullRequestNotice = findPullRequestNotice(props.userInput.pullRequests);
  if (pullRequestNotice === undefined && props.userInput.pullRequests !== undefined)
    return (
      <PullRequestPicker
        linkedSession={props.userInput.linkedSession}
        onCancel={props.onCancel}
        pullRequests={props.userInput.pullRequests.pullRequests}
      />
    );

  return (
    <>
      <DialogDescription className="text-foreground/80">{pullRequestNotice}</DialogDescription>
      <div className="flex justify-end">
        <Button onClick={props.onCancel} size="sm" variant="soft">
          {APP_LABELS.CANCEL}
        </Button>
      </div>
    </>
  );
};
