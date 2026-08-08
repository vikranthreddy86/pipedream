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
  description: "Issues a new credential using the selected document and recipient details.",
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
        "Choose the Wauld workspace where the document to be issued is located.",

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
        "Choose the engagement within which the document to be issued is located.",

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
      description: "Choose the document that is to be issued as a credential.",
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
      description: "Enter the full name of the recipient that will receive the credential.",
    },

    recipientEmail: {
      type: "string",
      label: "Recipient Email",
      description: "Enter the email address of the recipient. Wauld will send the issued credential to this email address.",
    },

    expireTime: {
      type: "string",
      label: "Expiration Time",
      description:
        "Enter the expiry date for the credential to be issued. Leave this field blank if the credential should never expire. Optional credential expiration timestamp in RFC 3339 format, for example 2026-12-31T23:59:59Z.",
      optional: true,
    },

    sharable: {
      type: "boolean",
      label: "Sharable",
      description: "Choose whether recipients can share issued credentials externally.",
      optional: true,
      default: true,
    },

    linkedIn: {
      type: "boolean",
      label: "LinkedIn",
      description: "Choose whether recipients can add issued credentials to their LinkedIn profiles.",
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