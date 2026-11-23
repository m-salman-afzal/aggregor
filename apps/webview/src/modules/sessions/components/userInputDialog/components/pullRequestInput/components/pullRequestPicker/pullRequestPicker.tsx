import {FormButtons} from "@/modules/sessions/components/userInputDialog/components/formButtons.tsx";
import {OptionPicker} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/components/optionPicker/optionPicker.tsx";
import {usePullRequestPicker} from "@/modules/sessions/components/userInputDialog/components/pullRequestInput/components/pullRequestPicker/pullRequestPicker.hook.ts";
import {GITHUB_CLI_LABELS} from "@pkg/constants/src/gitHubCli.constant.ts";

import type {ListedPullRequestDto} from "@/dtos/pullRequest.dto.ts";
import type {SessionListItemDto} from "@/dtos/session.dto.ts";

interface PullRequestPickerProps {
  readonly linkedSession: SessionListItemDto;
  readonly onCancel: () => void;
  readonly pullRequests: readonly ListedPullRequestDto[];
}

export const PullRequestPicker = (props: PullRequestPickerProps) => {
  const pullRequestPickerView = usePullRequestPicker(props);

  return (
    <form className="flex flex-col gap-4" onSubmit={pullRequestPickerView.link}>
      <OptionPicker
        chosenOptionId={pullRequestPickerView.chosenPullRequestId}
        legend={GITHUB_CLI_LABELS.PULL_REQUEST_SECTION}
        onChoose={pullRequestPickerView.chooseOption}
        options={pullRequestPickerView.pullRequestOptions}
      />
      <FormButtons onCancel={props.onCancel} submitLabel={GITHUB_CLI_LABELS.LINK} />
    </form>
  );
};
