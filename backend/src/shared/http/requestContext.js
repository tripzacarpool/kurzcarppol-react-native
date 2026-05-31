import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

const REQUEST_ID_HEADER = 'x-request-id';
const requestContextStorage = new AsyncLocalStorage();

export const getCurrentRequestId = () =>
  requestContextStorage.getStore()?.requestId;

export const requestContext = (req, res, next) => {
  const incomingRequestId = req.get(REQUEST_ID_HEADER);
  const requestId =
    typeof incomingRequestId === 'string' && incomingRequestId.trim()
      ? incomingRequestId.trim().slice(0, 128)
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  requestContextStorage.run({ requestId }, next);
};
