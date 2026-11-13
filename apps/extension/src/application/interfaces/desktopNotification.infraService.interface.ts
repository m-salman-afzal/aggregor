import {Context} from "effect";

import type {Effect} from "effect";

export interface DesktopNotificationRequest {
  readonly agentIconPath?: string | undefined;
  readonly aggregorIconPath: string;
  readonly headline: string;
  readonly message: string;
  readonly openLink: string;
}

export class IDesktopNotificationInfraService extends Context.Service<
  IDesktopNotificationInfraService,
  {
    // Returns when the notification closes on Linux (GNOME can't tell a click from a dismissal), once it is shown elsewhere.
    readonly notifyOnDesktop: (desktopNotificationRequest: DesktopNotificationRequest) => Effect.Effect<void>;
  }
>()(
  "aggregor-app/application/interfaces/desktopNotification.infraService.interface/IDesktopNotificationInfraService"
) {}
