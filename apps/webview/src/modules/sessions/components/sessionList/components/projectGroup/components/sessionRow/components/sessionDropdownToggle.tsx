import {ChevronRightIcon} from "lucide-react";

import {SESSION_DROPDOWN_TOGGLE_LABEL} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/sessionRow.constant.ts";
import {Button} from "@pkg/ui/src/components/base/button.tsx";
import {CollapsibleTrigger} from "@pkg/ui/src/components/base/collapsible.tsx";

// It lies over the row's button, under its status icon, rather than inside it, since a button can't hold one.
export const SessionDropdownToggle = () => (
  <CollapsibleTrigger
    render={
      <Button
        aria-label={SESSION_DROPDOWN_TOGGLE_LABEL}
        className="group/toggle absolute top-7 left-4 z-10 text-muted-foreground hover:text-foreground-strong aria-expanded:text-foreground-strong"
        size="icon-xs"
        title={SESSION_DROPDOWN_TOGGLE_LABEL}
        variant="soft"
      />
    }>
    <ChevronRightIcon
      aria-hidden
      className="size-3.5 group-data-panel-open/toggle:rotate-90 motion-ok:transition-transform motion-ok:duration-200"
    />
  </CollapsibleTrigger>
);
