import {SESSION_DROPDOWN_TOGGLE_LABEL} from "@/modules/sessions/components/sessionList/components/projectGroup/components/sessionRow/sessionRow.constant.ts";
import {CollapsibleTrigger} from "@pkg/ui/src/components/base/collapsible.tsx";
import {ChevronRightIcon} from "lucide-react";

// It lies over the row's button, under its status icon, rather than inside it, since a button can't hold one.
export const SessionDropdownToggle = () => (
  <CollapsibleTrigger
    aria-label={SESSION_DROPDOWN_TOGGLE_LABEL}
    className="group/toggle absolute top-8 left-5 z-10 flex size-4 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    title={SESSION_DROPDOWN_TOGGLE_LABEL}>
    <ChevronRightIcon
      aria-hidden
      className="size-3.5 group-data-panel-open/toggle:rotate-90 motion-ok:transition-transform motion-ok:duration-200"
    />
  </CollapsibleTrigger>
);
