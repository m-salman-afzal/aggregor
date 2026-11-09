import {NotifyOnDesktopRequestDtoSchema} from "@dtos/sessionAlert.dto.ts";
import {decodeVsCodeArgument} from "@pkg/vscode/src/vsCodeArgument.utils.ts";
import {notifyOnDesktop, watchSessionAlerts} from "@services/sessionAlert.service.ts";
import {Effect} from "effect";

export const watchSessionAlertsForSessionAlertsView = Effect.fn(
  "SessionAlertController.watchSessionAlertsForSessionAlertsView"
)(function* () {
  return yield* watchSessionAlerts();
});

export const notifyOnDesktopForSessionAlertsView = Effect.fn(
  "SessionAlertController.notifyOnDesktopForSessionAlertsView"
)(function* (desktopNotification: unknown) {
  const request = yield* decodeVsCodeArgument(NotifyOnDesktopRequestDtoSchema, desktopNotification);

  yield* notifyOnDesktop(request);
});
