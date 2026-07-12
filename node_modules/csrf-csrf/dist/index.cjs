var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  doubleCsrf: () => doubleCsrf
});
module.exports = __toCommonJS(src_exports);
var import_node_crypto = require("crypto");
var import_http_errors = __toESM(require("http-errors"), 1);
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
  const invalidCsrfTokenError = (0, import_http_errors.default)(statusCode, message, {
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
    return (0, import_node_crypto.createHmac)(hmacAlgorithm, secret).update(message2).digest("hex");
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
    const randomValue = (0, import_node_crypto.randomBytes)(size).toString("hex");
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  doubleCsrf
});
