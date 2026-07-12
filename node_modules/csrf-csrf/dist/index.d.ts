import { CookieOptions, Request, Response, NextFunction } from 'express';
import { HttpError } from 'http-errors';

type SameSiteType = boolean | "lax" | "strict" | "none";
type TokenRetriever = (req: Request) => string | null | undefined;
type CsrfTokenCookieOptions = Omit<CookieOptions, "signed">;
type CsrfTokenGeneratorRequestUtil = (options?: GenerateCsrfTokenOptions) => ReturnType<CsrfTokenGenerator>;
declare module "http" {
    interface IncomingHttpHeaders {
        "x-csrf-token"?: string | undefined;
    }
}
declare module "express-serve-static-core" {
    interface Request {
        csrfToken?: CsrfTokenGeneratorRequestUtil;
    }
}
type CsrfSecretRetriever = (req?: Request) => string | Array<string>;
type DoubleCsrfConfigOptions = Partial<DoubleCsrfConfig> & {
    getSecret: CsrfSecretRetriever;
    getSessionIdentifier: (req: Request) => string;
};
type DoubleCsrfProtection = (req: Request, res: Response, next: NextFunction) => void;
type CsrfRequestMethod = "GET" | "HEAD" | "PATCH" | "PUT" | "POST" | "DELETE" | "CONNECT" | "OPTIONS" | "TRACE";
type CsrfIgnoredRequestMethods = Array<CsrfRequestMethod>;
type CsrfRequestValidator = (req: Request) => boolean;
type CsrfTokenValidator = (req: Request, possibleSecrets: Array<string>) => boolean;
type CsrfCookieSetter = (res: Response, name: string, value: string, options: CookieOptions) => void;
type CsrfTokenGenerator = (req: Request, res: Response, options?: GenerateCsrfTokenOptions) => string;
type CsrfErrorConfig = {
    statusCode: number;
    message: string;
    code: string | undefined;
};
type CsrfErrorConfigOptions = Partial<CsrfErrorConfig>;
type GenerateCsrfTokenConfig = {
    overwrite: boolean;
    validateOnReuse: boolean;
    cookieOptions: CsrfTokenCookieOptions;
};
type GenerateCsrfTokenOptions = Partial<GenerateCsrfTokenConfig>;
interface DoubleCsrfConfig {
    getSecret: CsrfSecretRetriever;
    getSessionIdentifier: (req: Request) => string;
    cookieName: string;
    cookieOptions: CsrfTokenCookieOptions;
    messageDelimiter: string;
    csrfTokenDelimiter: string;
    size: number;
    hmacAlgorithm: string;
    ignoredMethods: CsrfIgnoredRequestMethods;
    getCsrfTokenFromRequest: TokenRetriever;
    errorConfig: CsrfErrorConfigOptions;
    skipCsrfProtection: (req: Request) => boolean;
}
interface DoubleCsrfUtilities {
    invalidCsrfTokenError: HttpError;
    generateCsrfToken: CsrfTokenGenerator;
    validateRequest: CsrfRequestValidator;
    doubleCsrfProtection: DoubleCsrfProtection;
}

declare function doubleCsrf({ getSecret, getSessionIdentifier, cookieName, cookieOptions: { sameSite, path, secure, httpOnly, ...remainingCookieOptions }, messageDelimiter, csrfTokenDelimiter, size, hmacAlgorithm, ignoredMethods, getCsrfTokenFromRequest, errorConfig: { statusCode, message, code }, skipCsrfProtection, }: DoubleCsrfConfigOptions): DoubleCsrfUtilities;

export { type CsrfCookieSetter, type CsrfErrorConfig, type CsrfErrorConfigOptions, type CsrfIgnoredRequestMethods, type CsrfRequestMethod, type CsrfRequestValidator, type CsrfSecretRetriever, type CsrfTokenCookieOptions, type CsrfTokenGenerator, type CsrfTokenGeneratorRequestUtil, type CsrfTokenValidator, type DoubleCsrfConfig, type DoubleCsrfConfigOptions, type DoubleCsrfProtection, type DoubleCsrfUtilities, type GenerateCsrfTokenConfig, type GenerateCsrfTokenOptions, type SameSiteType, type TokenRetriever, doubleCsrf };
