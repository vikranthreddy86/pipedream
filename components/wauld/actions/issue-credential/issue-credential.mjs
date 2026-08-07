import { ConfigurationError } from "@pipedream/platform";
import app from "../../wauld.app.mjs";

import {
  getDocument,
  listDocuments,
  listEngagements,
  listWorkspaces,
  publishCredential,
} from "../../common/api.mjs";

const ATTRIBUTE_PREFIX = "attribute_";

const getAccessToken = (component) =>
  component.app.$auth.access_token;

const getAccountId = (component) =>
  component.app.$auth.account_id;

const getAttributeNames = (document = {}) => [
  ...new Set([
    ...(document.customAttributes ?? []),
    ...(document.imageAttributes ?? []),
  ]),
];

export default {
  key: "wauld-issue-credential",
  name: "Issue Credential",
  description: "Issue a credential to a recipient using a Wauld document.",
  version: "0.0.1",
  type: "action",

  annotations: {
    destructiveHint: false,
    openWorldHint: true,
    readOnlyHint: false,
  },

  props: {
    app,

    workspaceId: {
      type: "string",
      label: "Workspace",
      description:
        "Select the Wauld workspace containing the credential document.",

      async options() {
        const workspaces = await listWorkspaces({
          $: this,
          accessToken: getAccessToken(this),
          accountId: getAccountId(this),
        });

        return workspaces
          .filter((workspace) => !workspace.archived)
          .map((workspace) => ({
            label: workspace.name || workspace.id,
            value: workspace.id,
          }));
      },
    },

    engagementId: {
      type: "string",
      label: "Engagement",
      description:
        "Select the engagement containing the credential document.",

      async options() {
        if (!this.workspaceId) {
          return [];
        }

        const engagements = await listEngagements({
          $: this,
          accessToken: getAccessToken(this),
          workspaceId: this.workspaceId,
        });

        return engagements.map((engagement) => ({
          label: engagement.name || engagement.id,
          value: engagement.id,
        }));
      },
    },

    documentId: {
      type: "string",
      label: "Document",
      description: "Select the document to use for the credential.",
      reloadProps: true,

      async options() {
        if (!this.engagementId) {
          return [];
        }

        const documents = await listDocuments({
          $: this,
          accessToken: getAccessToken(this),
          engagementId: this.engagementId,
        });

        return documents.map((document) => ({
          label: document.name || document.id,
          value: document.id,
        }));
      },
    },

    recipientName: {
      type: "string",
      label: "Recipient Name",
      description: "Enter the name of the credential recipient.",
    },

    recipientEmail: {
      type: "string",
      label: "Recipient Email",
      description: "Enter the email address of the credential recipient.",
    },

    expireTime: {
      type: "string",
      label: "Expiration Time",
      description:
        "Optional credential expiration timestamp in RFC 3339 format, for example 2026-12-31T23:59:59Z.",
      optional: true,
    },

    sharable: {
      type: "boolean",
      label: "Sharable",
      description: "Allow the recipient to share the credential.",
      optional: true,
      default: true,
    },

    wallet: {
      type: "boolean",
      label: "Wallet",
      description:
        "Allow the recipient to add the credential to a supported wallet.",
      optional: true,
      default: true,
    },

    linkedIn: {
      type: "boolean",
      label: "LinkedIn",
      description: "Allow LinkedIn sharing for the credential.",
      optional: true,
      default: true,
    },
  },

  async additionalProps() {
    if (!this.documentId) {
      return {};
    }

    const document = await getDocument({
      $: this,
      accessToken: getAccessToken(this),
      documentId: this.documentId,
    });

    const attributeNames = getAttributeNames(document);

    const props = {};

    attributeNames.forEach((attributeName, index) => {
      const key = `${ATTRIBUTE_PREFIX}${index
        .toString()
        .padStart(4, "0")}`;

      props[key] = {
        type: "string",
        label: attributeName,
        description: `Enter a value for the "${attributeName}" credential attribute.`,
        optional: true,
      };
    });

    return props;
  },

  async run({ $ }) {
    if (
      this.expireTime &&
      Number.isNaN(Date.parse(this.expireTime))
    ) {
      throw new ConfigurationError(
        "Expiration Time must be a valid RFC 3339 timestamp.",
      );
    }

    const document = await getDocument({
      $,
      accessToken: getAccessToken(this),
      documentId: this.documentId,
    });

    const attributeNames = getAttributeNames(document);

    const attributes = attributeNames
      .map((name, index) => {
        const key = `${ATTRIBUTE_PREFIX}${index
          .toString()
          .padStart(4, "0")}`;

        const value = this[key];

        if (
          value === undefined ||
          value === null ||
          value === ""
        ) {
          return null;
        }

        return {
          name,
          value: String(value),
        };
      })
      .filter(Boolean);

    const data = {
      parent: this.documentId,

      recipient: {
        name: this.recipientName,
        email: this.recipientEmail,
      },

      attributes,

      sharable: this.sharable ?? true,
      wallet: this.wallet ?? true,
      linkedIn: this.linkedIn ?? true,
    };

    if (this.expireTime) {
      data.expireTime = this.expireTime;
    }

    const response = await publishCredential({
      $,
      accessToken: getAccessToken(this),
      data,
    });

    $.export(
      "$summary",
      `Successfully issued a credential to ${this.recipientEmail}.`,
    );

    return response;
  },
};