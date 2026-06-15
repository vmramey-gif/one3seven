/**
 * Beta non-delivery stubs — no email, push, or external notifications are sent.
 * Call sites may await these for future wiring; `delivered` is always false.
 */

export type NotifyStubResult = { delivered: false; stub: true };

export type FirmPreviewNotifyArgs = {
  firmId: string;
  intakeId: string;
  routeId: string;
  firmEmail?: string;
  intakeNumber?: string;
};

export type WorkerFirmInterestNotifyArgs = {
  workerEmail?: string;
  workerId?: string;
  firmName?: string;
  intakeId?: string;
};

export type WorkerRoutingExpansionNotifyArgs = {
  workerEmail?: string;
  workerId?: string;
  intakeId?: string;
  firmCount?: number;
};

/** @deprecated Beta stub — does not email the firm. */
export async function notifyFirmOfPreview(args: FirmPreviewNotifyArgs): Promise<NotifyStubResult> {
  console.info('[o3s-notify-stub] notifyFirmOfPreview skipped (beta; no external delivery)', args);
  return { delivered: false, stub: true };
}

/** @deprecated Beta stub — does not email the worker. */
export async function notifyWorkerOfFirmInterest(args: WorkerFirmInterestNotifyArgs): Promise<NotifyStubResult> {
  console.info('[o3s-notify-stub] notifyWorkerOfFirmInterest skipped (beta; no external delivery)', args);
  return { delivered: false, stub: true };
}

/** @deprecated Beta stub — does not email the worker. */
export async function notifyWorkerOfRoutingExpansion(
  args: WorkerRoutingExpansionNotifyArgs
): Promise<NotifyStubResult> {
  console.info('[o3s-notify-stub] notifyWorkerOfRoutingExpansion skipped (beta; no external delivery)', args);
  return { delivered: false, stub: true };
}
