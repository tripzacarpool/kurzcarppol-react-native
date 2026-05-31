export const sendErrorResponse = (
  req,
  res,
  error,
  { fallbackCode, fallbackMessage, includeExtra = false } = {},
) =>
  res.status(error.status || 500).json({
    error: error.message || fallbackMessage || 'Request failed',
    details: error.details,
    code: error.code || fallbackCode,
    requestId: req.requestId,
    ...(includeExtra ? error.extra || {} : {}),
  });
