import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";

export const reconcileWorkspace: Handler<Event.ReconcileWorkspace> = (_, ws) =>
  ws.selectorManager.reconcile();
