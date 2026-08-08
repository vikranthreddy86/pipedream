import { createHash } from "node:crypto";

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

    http: {
      type: "$.interface.http",
      customResponse: true,
    },
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

      this.db.set("hookId", webhook.id);
    },

    async deactivate() {
      const hookId = this.db.get("hookId");

      if (!hookId) {
        return;
      }

      await deleteWebhook({
        $: this,
        accessToken: getAccessToken(this),
        webhookId: hookId,
      });

      this.db.delete("hookId");
    },
  },

  methods: {
    getEventId(body) {
      if (body?.id) {
        return String(body.id);
      }

      return createHash("sha256")
        .update(JSON.stringify(body))
        .digest("hex");
    },

    getEventTimestamp(body) {
      if (!body?.issueTime) {
        return Date.now();
      }

      const timestamp = Date.parse(body.issueTime);

      return Number.isNaN(timestamp)
        ? Date.now()
        : timestamp;
    },

    getEventSummary(body) {
      const documentName = body?.document?.name;
      const recipientEmail = body?.recipient?.email;

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
    const body = event.body ?? {};

    this.http.respond({
      status: 200,
      body: {
        received: true,
      },
    });

    this.$emit(body, {
      id: this.getEventId(body),
      summary: this.getEventSummary(body),
      ts: this.getEventTimestamp(body),
    });
  },
};