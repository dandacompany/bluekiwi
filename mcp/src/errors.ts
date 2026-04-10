export class BlueKiwiAuthError extends Error {
  constructor(message = "Invalid or expired API key") {
    super(message);
    this.name = "BlueKiwiAuthError";
  }
}

export class BlueKiwiApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`BlueKiwi API error ${status}: ${body}`);
    this.name = "BlueKiwiApiError";
  }
}

export class BlueKiwiNetworkError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BlueKiwiNetworkError";
  }
}
