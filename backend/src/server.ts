import "dotenv/config";

interface ErrorDetails {
  name: string;
  message: string;
  stack?: string;
  code?: unknown;
  syscall?: unknown;
  address?: unknown;
  port?: unknown;
  causes?: ErrorDetails[];
}

let closeDatabase: (() => Promise<void>) | undefined;

function getErrorDetails(error: unknown): ErrorDetails {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      message: String(error)
    };
  }

  const extendedError = error as Error & {
    code?: unknown;
    syscall?: unknown;
    address?: unknown;
    port?: unknown;
  };

  return {
    name: error.name,
    message: error.message || "No error message was provided",
    ...(error.stack ? { stack: error.stack } : {}),
    ...(extendedError.code !== undefined
      ? { code: extendedError.code }
      : {}),
    ...(extendedError.syscall !== undefined
      ? { syscall: extendedError.syscall }
      : {}),
    ...(extendedError.address !== undefined
      ? { address: extendedError.address }
      : {}),
    ...(extendedError.port !== undefined
      ? { port: extendedError.port }
      : {}),
    ...(error instanceof AggregateError
      ? { causes: error.errors.map(getErrorDetails) }
      : {})
  };
}

async function startServer(): Promise<void> {
  // dotenv has completed before these modules validate or consume the config.
  const [{ app }, databaseModule, { env }] = await Promise.all([
    import("./app.js"),
    import("./config/database.js"),
    import("./config/env.js")
  ]);
  const closeActiveDatabase = databaseModule.closeDatabase;
  closeDatabase = closeActiveDatabase;

  const server = app.listen(env.port, () => {
    console.info(
      JSON.stringify({
        level: "info",
        message: "Courtify-Badminton API started",
        port: env.port,
        environment: env.nodeEnv
      })
    );
  });

  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    console.info(
      JSON.stringify({
        level: "info",
        message: "Graceful shutdown started",
        signal
      })
    );

    const forceExitTimer = setTimeout(() => {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Graceful shutdown timed out"
        })
      );
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    server.close(async (error) => {
      try {
        await closeActiveDatabase();
      } finally {
        if (error) {
          console.error(error);
          process.exit(1);
        }
        process.exit(0);
      }
    });
  };

  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
}

startServer().catch((error: unknown) => {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const details = getErrorDetails(error);

  console.error(
    JSON.stringify(
      {
        level: "error",
        message: "Failed to start Courtify-Badminton API",
        error: isDevelopment ? details : details.message
      },
      null,
      isDevelopment ? 2 : 0
    )
  );

  if (closeDatabase) {
    void closeDatabase().finally(() => process.exit(1));
    return;
  }

  process.exit(1);
});
