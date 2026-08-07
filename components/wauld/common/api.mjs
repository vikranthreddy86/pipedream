import { axios } from "@pipedream/platform";

export const BASE_URL = "https://wauld.com";

export async function request({
  $,
  accessToken,
  path,
  data = {},
  method = "POST",
}) {
  return axios($, {
    method,
    url: `${BASE_URL}${path}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Connect-Protocol-Version": "1",
      "Content-Type": "application/json",
    },
    data,
  });
}

async function paginate({
  $,
  accessToken,
  path,
  data = {},
  resultKey,
  pageSize,
}) {
  const results = [];
  let pageToken;

  do {
    const response = await request({
      $,
      accessToken,
      path,
      data: {
        ...data,
        pageSize,
        ...(pageToken
          ? {
              pageToken,
            }
          : {}),
      },
    });

    results.push(...(response[resultKey] ?? []));
    pageToken = response.nextPageToken;
  } while (pageToken);

  return results;
}

export async function listWorkspaces({
  $,
  accessToken,
  accountId,
}) {
  return paginate({
    $,
    accessToken,
    path: "/wauld.WorkspaceService/ListWorkspaces",
    data: {
      parent: accountId,
    },
    resultKey: "workspaces",
    pageSize: 25,
  });
}

export async function listEngagements({
  $,
  accessToken,
  workspaceId,
}) {
  return paginate({
    $,
    accessToken,
    path: "/wauld.EngagementService/ListEngagements",
    data: {
      parent: workspaceId,
    },
    resultKey: "engagements",
    pageSize: 10,
  });
}

export async function listDocuments({
  $,
  accessToken,
  engagementId,
}) {
  return paginate({
    $,
    accessToken,
    path: "/wauld.DocumentService/ListDocuments",
    data: {
      parent: engagementId,
    },
    resultKey: "documents",
    pageSize: 10,
  });
}

export async function getDocument({
  $,
  accessToken,
  documentId,
}) {
  return request({
    $,
    accessToken,
    path: "/wauld.DocumentService/GetDocument",
    data: {
      id: documentId,
    },
  });
}

export async function listCredentials({
  $,
  accessToken,
  documentId,
  pageSize = 3,
}) {
  return request({
    $,
    accessToken,
    path: "/wauld.CredentialService/ListCredentials",
    data: {
      parent: documentId,
      pageSize,
      orderBy: "PUBLISH_TIME",
      orderDirection: "DESCENDING",
      includeVoid: false,
      excludeRevoked: true,
      draft: false,
    },
  });
}

export async function publishCredential({
  $,
  accessToken,
  data,
}) {
  return request({
    $,
    accessToken,
    path: "/wauld.CredentialService/PublishAdhocCredential",
    data,
  });
}

export async function createWebhook({
  $,
  accessToken,
  accountId,
  url,
  name,
}) {
  return request({
    $,
    accessToken,
    path: "/wauld.WebhookService/CreateWebhook",
    data: {
      parent: accountId,
      url,
      events: [
        "CREDENTIAL_ISSUED",
      ],
      name,
    },
  });
}

export async function deleteWebhook({
  $,
  accessToken,
  webhookId,
}) {
  return request({
    $,
    accessToken,
    path: "/wauld.WebhookService/DeleteWebhook",
    data: {
      id: webhookId,
    },
  });
}
