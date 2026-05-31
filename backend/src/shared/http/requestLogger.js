export const requestLogger = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.log(
      JSON.stringify({
        type: 'http_request',
        method: req.method,
        path: req.originalUrl || req.path,
        requestId: req.requestId,
        statusCode: res.statusCode,
        durationMs,
      }),
    );
  });

  next();
};
