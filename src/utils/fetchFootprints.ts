import { ApiVersion } from "../types/types";

export const fetchFootprints = async (
  baseUrl: string,
  accessToken: string,
  version: ApiVersion
) => {
  const apiVersion = version.startsWith("V2") ? "2" : "3";

  const footprintsUrl = `${baseUrl}/${apiVersion}/footprints`;
  const response = await fetch(footprintsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    console.error(
      `Error fetching footprints from ${footprintsUrl}: ${response.status} ${response.statusText}`
    );
    throw new Error(
      `Error fetching footprints from ${footprintsUrl}: ${response.status} ${response.statusText}`
    );
  }

  const responseJson = await response.json();

  if (
    !responseJson.data ||
    !Array.isArray(responseJson.data) ||
    responseJson.data.length === 0
  ) {
    console.error(
      `No footprint data returned from the API. Called ${footprintsUrl}`,
      responseJson
    );
    throw new Error("No footprint data returned from the API");
  }

  return responseJson;
};

export const getLinksHeaderFromFootprints = async (
  baseUrl: string,
  accessToken: string,
  version: ApiVersion
) => {
  const apiVersion = version.startsWith("V2") ? "2" : "3";

  const response = await fetch(`${baseUrl}/${apiVersion}/footprints?limit=1`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const linksHeader = response.headers.get("Link");

  return parseLinkHeader(linksHeader);
};

const parseLinkHeader = (header: string | null): Record<string, string> => {
  if (!header) return {};

  return header.split(", ").reduce<Record<string, string>>((acc, link) => {
    const match = link.match(/<(.*)>;\s*rel="(.*)"/);
    if (match) {
      acc[match[2]] = match[1]; // Store links by their "rel" value
    }
    return acc;
  }, {});
};

export const sendCreateRequestEvent = async (
  baseUrl: string,
  accessToken: string,
  version: ApiVersion,
  productIds: string[],
  requestEventId: string,
  webhookUrl: string
) => {
  const apiVersion = version.startsWith("V2") ? "2" : "3";
  const eventsUrl = `${baseUrl}/${apiVersion}/events`;

  // Determine the event type based on the API version
  const eventType = version.startsWith("V2")
    ? "org.wbcsd.pathfinder.ProductFootprintRequest.Created.v1"
    : "org.wbcsd.pact.ProductFootprint.RequestCreatedEvent.3";

  // Create the event payload
  const eventPayload = {
    specversion: "1.0",
    id: requestEventId,
    source: webhookUrl, // In a real scenario, this would be your service URL
    time: new Date().toISOString(),
    type: eventType,
    data: version.startsWith("V2")
      ? {
          pf: {
            productIds: productIds,
          },
          comment: "Please send PCF data for this year.",
        }
      : {
          productId: productIds,
          comment: "Please send PCF data for this year.",
        },
  };

  try {
    const response = await fetch(eventsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/cloudevents+json; charset=UTF-8",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      console.error(
        `Error sending create request event to ${eventsUrl}: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.error(
      `Error sending create request event to ${eventsUrl}: ${error}`
    );
  }
};
