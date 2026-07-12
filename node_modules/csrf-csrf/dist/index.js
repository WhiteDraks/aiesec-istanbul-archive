// src/index.ts
import { createHmac, randomBytes } from "crypto";
import createHttpError from "http-errors";
function doubleCsrf({
  getSecret,
  getSessionIdentifier,
  cookieName = "__Host-psifi.x-csrf-token",
  cookieOptions: { sameSite = "strict", path = "/", secure = true, httpOnly = true, ...remainingCookieOptions } = {},
  messageDelimiter = "!",
  csrfTokenDelimiter = ".",
  size = 32,
  hmacAlgorithm = "sha256",
  ignoredMethods = ["GET", "HEAD", "OPTIONS"],
  getCsrfTokenFromRequest = (req) => req.headers["x-csrf-token"],
  errorConfig: { statusCode = 403, message = "invalid csrf token", code = "EBADCSRFTOKEN" } = {},
  skipCsrfProtection
}) {
  const ignoredMethodsSet = new Set(ignoredMethods);
  const defaultCookieOptions = {
    sameSite,
    path,
    secure,
    httpOnly,
    ...remainingCookieOptions
  };
  const requiresCsrfProtection = (req) => {
    const shouldSkip = typeof skipCsrfProtection === "function" && skipCsrfProtection(req);
    return !(ignoredMethodsSet.has(req.method) || typeof shouldSkip === "boolean" && shouldSkip);
  };
  const invalidCsrfTokenError = createHttpError(statusCode, message, {
    code
  });
  const constructMessage = (req, randomValue) => {
    const uniqueIdentifier = getSessionIdentifier(req);
    const messageValues = [uniqueIdentifier.length, uniqueIdentifier, randomValue.length, randomValue];
    return messageValues.join(messageDelimiter);
  };
  const getPossibleSecrets = (req) => {
    const getSecretResult = getSecret(req);
    return Array.isArray(getSecretResult) ? getSecretResult : [getSecretResult];
  };
  const generateHmac = (secret, message2) => {
    return createHmac(hmacAlgorithm, secret).update(message2).digest("hex");
  };
  const generateCsrfTokenInternal = (req, { overwrite, validateOnReuse }) => {
    const possibleSecrets = getPossibleSecrets(req);
    if (cookieName in req.cookies && !overwrite) {
      if (validateCsrfTokenCookie(req, possibleSecrets)) {
        return getCsrfTokenFromCookie(req);
      }
      if (validateOnReuse) {
        throw invalidCsrfTokenError;
      }
    }
    const secret = possibleSecrets[0];
    const randomValue = randomBytes(size).toString("hex");
    const message2 = constructMessage(req, randomValue);
    const hmac = generateHmac(secret, message2);
    const csrfToken = `${hmac}${csrfTokenDelimiter}${randomValue}`;
    return csrfToken;
  };
  const generateCsrfToken = (req, res, { cookieOptions = defaultCookieOptions, overwrite = false, validateOnReuse = false } = {}) => {
    const csrfToken = generateCsrfTokenInternal(req, {
      overwrite,
      validateOnReuse
    });
    res.cookie(cookieName, csrfToken, {
      ...defaultCookieOptions,
      ...cookieOptions
    });
    return csrfToken;
  };
  const getCsrfTokenFromCookie = (req) => req.cookies[cookieName] ?? "";
  const validateHmac = ({
    expectedHmac,
    req,
    randomValue,
    possibleSecrets
  }) => {
    const message2 = constructMessage(req, randomValue);
    for (const secret of possibleSecrets) {
      const hmacForSecret = generateHmac(secret, message2);
      if (expectedHmac === hmacForSecret) return true;
    }
    return false;
  };
  const validateCsrfTokenCookie = (req, possibleSecrets) => {
    const csrfTokenFromCookie = getCsrfTokenFromCookie(req);
    const [expectedHmac, randomValue] = csrfTokenFromCookie.split(csrfTokenDelimiter);
    if (typeof expectedHmac !== "string" || expectedHmac === "" || typeof randomValue !== "string" || randomValue === "") {
      return false;
    }
    return validateHmac({ expectedHmac, possibleSecrets, randomValue, req });
  };
  const validateCsrfToken = (req, possibleSecrets) => {
    const csrfTokenFromCookie = getCsrfTokenFromCookie(req);
    const csrfTokenFromRequest = getCsrfTokenFromRequest(req);
    if (typeof csrfTokenFromCookie !== "string" || typeof csrfTokenFromRequest !== "string") return false;
    if (csrfTokenFromCookie === "" || csrfTokenFromRequest === "" || csrfTokenFromCookie !== csrfTokenFromRequest)
      return false;
    const [receivedHmac, randomValue] = csrfTokenFromCookie.split(csrfTokenDelimiter);
    if (typeof receivedHmac !== "string" || typeof randomValue !== "string" || randomValue === "") return false;
    return validateHmac({ expectedHmac: receivedHmac, req, possibleSecrets, randomValue });
  };
  const validateRequest = (req) => {
    const possibleSecrets = getPossibleSecrets(req);
    return validateCsrfToken(req, possibleSecrets);
  };
  const doubleCsrfProtection = (req, res, next) => {
    req.csrfToken = (options) => generateCsrfToken(req, res, options);
    if (!requiresCsrfProtection(req)) {
      next();
    } else if (validateRequest(req)) {
      next();
    } else {
      next(invalidCsrfTokenError);
    }
  };
  return {
    invalidCsrfTokenError,
    generateCsrfToken,
    validateRequest,
    doubleCsrfProtection
  };
}
export {
  doubleCsrf
};
