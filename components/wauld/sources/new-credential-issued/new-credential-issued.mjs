import crypto from "node:crypto";

import app from "../../wauld.app.mjs";

import {
  createWebhook,
  deleteWebhook,
} from "../../common/api.mjs";

const getAccessToken = (component) =>
  component.app.$auth.access_token;

const getAccountId = (component) =>
  component.app.$auth.account_id;

export default {
  key: "wauld-new-credential-issued",
  name: "New Credential Issued",
  description: "Emit a new event when a credential is issued in Wauld.",
  version: "0.0.1",
  type: "source",
  dedupe: "unique",

  props: {
    app,
    db: "$.service.db",
    http: "$.interface.http",
  },

  hooks: {
    async activate() {
      const webhook = await createWebhook({
        $: this,
        accessToken: getAccessToken(this),
        accountId: getAccountId(this),
        url: this.http.endpoint,
        name: "Pipedream - New Credential Issued",
      });

      if (!webhook?.id) {
        throw new Error(
          "Wauld did not return a webhook ID while creating the webhook.",
        );
      }

      this.db.set("webhookId", webhook.id);
    },

    async deactivate() {
      const webhookId = this.db.get("webhookId");

      if (!webhookId) {
        return;
      }

      await deleteWebhook({
        $: this,
        accessToken: getAccessToken(this),
        webhookId,
      });

      this.db.delete("webhookId");
    },
  },

  methods: {
    getEventId(body) {
      return (
        body?.credential?.id ||
        body?.credentialId ||
        body?.id ||
        crypto.randomUUID()
      );
    },

    getEventTimestamp(body) {
      const timestamp =
        body?.credential?.publishTime ||
        body?.publishTime ||
        body?.createTime;

      if (!timestamp) {
        return Date.now();
      }

      const parsed = Date.parse(timestamp);

      return Number.isNaN(parsed)
        ? Date.now()
        : parsed;
    },

    getEventSummary(body) {
      const recipientEmail =
        body?.credential?.recipient?.email ||
        body?.recipient?.email;

      const documentName =
        body?.credential?.document?.name ||
        body?.document?.name;

      if (documentName && recipientEmail) {
        return `${documentName} issued to ${recipientEmail}`;
      }

      if (recipientEmail) {
        return `Credential issued to ${recipientEmail}`;
      }

      return "New credential issued";
    },
  },

  async run(event) {
    if (event.body === undefined) {
      console.log("Webhook event body is undefined. Skipping event.");
      return;
    }

    const body = event.body;

    this.$emit(body, {
      id: this.getEventId(body),
      summary: this.getEventSummary(body),
      ts: this.getEventTimestamp(body),
    });
  },
};