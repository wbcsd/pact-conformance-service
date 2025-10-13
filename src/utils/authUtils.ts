import logger from "./logger";

// See https://docs.carbon-transparency.org/v2/#authresponsebody
export interface TokenResponse {
  access_token: string;
}

export const randomString = (length: number) => {
  let variation =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let string = "";
  for (let i = 0; i < length; i++) {
    string += variation[Math.floor(Math.random() * variation.length)];
  }
  return string;
};

export const getIncorrectAuthHeaders = (url: string) => {
  const incorrectUserName = randomString(16);
  const incorrectPassword = randomString(16);
  const host = new URL(url).hostname;
  const incorrectAuthHeaders = {
    host: host,
    accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization:
      "Basic " +
      Buffer.from(incorrectUserName + ":" + incorrectPassword).toString(
        "base64"
      ),
  };
  return incorrectAuthHeaders;
};

export const getCorrectAuthHeaders = (
  url: string,
  clientId: string,
  clientSecret: string
) => {
  const host = new URL(url).hostname;
  let authHeaders = {
    host: host,
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization:
      "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
  };
  return authHeaders;
};

/**
 * Retrieves an access token from the authentication endpoint.
 */
export const getAccessToken = async (
  authTokenEndPointUrl: string,
  clientId: string,
  clientSecret: string,
  authRequestData: string
): Promise<string> => {

  const encodedCredentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  logger.info(`Requesting access token from ${authTokenEndPointUrl} with clientId: ${clientId}`);

  const response = await fetch(authTokenEndPointUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${encodedCredentials}`,
    },
    body: authRequestData,
  });

  if (!response.ok) {
    logger.error(
      `Failed to obtain access token from ${authTokenEndPointUrl}. Status: ${response.status}`
    );

    throw new Error(
      `Failed to obtain access token from ${authTokenEndPointUrl}. Status: ${
        response.status
      }. Response: ${await response.text()}`
    );
  }

  const data: TokenResponse = await response.json();
  if (!data.access_token) {
    throw new Error("Access token not present in response");
  }
  return data.access_token;
};

// Get OpenID token_endpoint from .well-known configureation lookup
export const fetchOpenIdTokenEndpoint = async (authBaseUrl: string): Promise<string | undefined> => {
  try {
    const response = await fetch(`${authBaseUrl}/.well-known/openid-configuration`);
    if (response.ok) {
      const data = await response.json();
      return data.token_endpoint;
    }
  } catch {
    // No OpenID configuration available, ignore error and return undefined
  }
  logger.info(`No OpenID configuration found at ${authBaseUrl}/.well-known/openid-configuration`);
  return undefined;
};


