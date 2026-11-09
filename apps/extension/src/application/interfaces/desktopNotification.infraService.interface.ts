import {Context} from "effect";

import type {Effect} from "effect";

// A notification outside VS Code. The message is empty when there is none, and the agent's icon is missing when its
// agent is gone.
export interface DesktopNotificationRequest {
  readonly agentIconPath?: string | undefined;
  readonly aggregorIconPath: string;
  readonly headline: string;
  readonly message: string;
  readonly openLink: string;
}

// The system's own notifications, for when no VS Code window has focus.
export class IDesktopNotificationInfraService extends Context.Service<
  IDesktopNotificationInfraService,
  {
    // Returns once the notification closes on Linux, whether clicked or dismissed, which GNOME doesn't tell apart; once
    // it is shown elsewhere. Clicking it brings VS Code forward on Linux, and opens the link from WSL; macOS's does
    // neither. Best effort: a system that can't show it logs why.
    readonly notifyOnDesktop: (desktopNotificationRequest: DesktopNotificationRequest) => Effect.Effect<void>;
  }
>()(
  "aggregor-app/application/interfaces/desktopNotification.infraService.interface/IDesktopNotificationInfraService"
) {}
