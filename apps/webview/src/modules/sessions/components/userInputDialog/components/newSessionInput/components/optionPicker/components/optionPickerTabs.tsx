import {LoaderCircleIcon} from "lucide-react";

import {SESSION_LABELS} from "@pkg/constants/src/session.constant.ts";
import {Tabs, TabsList, TabsTrigger} from "@pkg/ui/src/components/base/tabs.tsx";

import type {NewSessionOptionTab} from "@/modules/sessions/components/userInputDialog/components/newSessionInput/newSessionInput.type.ts";

interface OptionPickerTabsProps {
  readonly onShowTab: (tabLabel: string) => void;
  readonly optionTabs: readonly NewSessionOptionTab[];
  readonly shownTabLabel: string;
}

export const OptionPickerTabs = (props: OptionPickerTabsProps) => (
  <Tabs
    className="mx-1.5 mt-1.5"
    onValueChange={(tabLabel: string) => {
      props.onShowTab(tabLabel);
    }}
    value={props.shownTabLabel}>
    <TabsList className="w-full">
      {props.optionTabs.map((optionTab) => (
        <TabsTrigger key={optionTab.label} value={optionTab.label}>
          {optionTab.label}
          {optionTab.isLoading && (
            <LoaderCircleIcon
              aria-label={SESSION_LABELS.FETCHING_REMOTE_BRANCHES}
              className="size-3.5 motion-ok:animate-spin"
              role="status"
            />
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);
