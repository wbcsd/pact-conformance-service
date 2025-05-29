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
  baseUrl: string,
  clientId: string,
  clientSecret: string,
  customAuthUrl?: string,
  scope?: string,
  audience?: string,
  resource?: string
): Promise<string> => {
  const url = customAuthUrl || `${baseUrl}/auth/token`;

  const encodedCredentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  // Add scope, audience and resource to the body
  // Make sure to url encode things, otherwise it will not work
  // Only include scope, audience and resource if they are provided
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    ...(scope && { scope }),
    ...(audience && { audience }),
    ...(resource && { resource })
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${encodedCredentials}`,
    },
    body: body.toString()
  });

  if (!response.ok) {
    console.error(
      `Failed to obtain access token from ${url}. Status: ${response.status}`
    );

    throw new Error(
      `Failed to obtain access token from ${url}. Status: ${response.status}`
    );
  }

  const data: TokenResponse = await response.json();
  if (!data.access_token) {
    throw new Error("Access token not present in response");
  }
  return data.access_token;
};

// Get token_endpoint from .well-known endpoint
export const getOidAuthUrl = async (
  baseUrl: string
): Promise<string | undefined> => {
  try {
    const response = await fetch(`${baseUrl}/.well-known/openid-configuration`);
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    return data.token_endpoint;
  } catch (error) {
    return;
  }
};
