import {NotifyOnDesktopRequestDtoSchema} from "@dtos/sessionAlert.dto.ts";
import {ownSpans} from "@pkg/trace/src/ownSpans.utils.ts";
import {VscodeUtils} from "@pkg/vscode/src/vscode.utils.ts";
import {SessionAlertService} from "@services/sessionAlert.service.ts";
import {Context, Effect, Layer} from "effect";

export class SessionAlertController extends Context.Service<SessionAlertController>()(
  "aggregor-app/presentation/controllers/sessionAlert.controller/SessionAlertController",
  {
    make: Effect.fn("make")(function* () {
      const sessionAlertService = yield* SessionAlertService;
      const vscodeUtils = yield* VscodeUtils;

      const watchSessionAlertsForSessionAlertsView = Effect.fn("watchSessionAlertsForSessionAlertsView")(function* () {
        return yield* sessionAlertService.watchSessionAlerts;
      });

      const notifyOnDesktopForSessionAlertsView = Effect.fn("notifyOnDesktopForSessionAlertsView")(function* (
        desktopNotification: unknown
      ) {
        const request = yield* vscodeUtils.decodeVsCodeArgument(NotifyOnDesktopRequestDtoSchema, desktopNotification);

        yield* sessionAlertService.notifyOnDesktop(request);
      });

      return {
        notifyOnDesktopForSessionAlertsView,
        watchSessionAlertsForSessionAlertsView: watchSessionAlertsForSessionAlertsView()
      };
    })
  }
) {
  public static readonly layer = Layer.effect(this, ownSpans("SessionAlertController", this.make()));
}
