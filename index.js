require("dotenv").config();
const Airtable = require('airtable')
const { App } = require("@slack/bolt");
var base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE);
const getUrls = require('get-urls');
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: Boolean(process.env.PORT),
    appToken: process.env.SLACK_APP_TOKEN,
    port: process.env.PORT
});

Array.prototype.random = function () {
    return this[Math.floor(Math.random() * this.length)]
};

(async () => {
    app.action('undo', async ({ ack, say, body }) => {
        const json = JSON.parse(body.actions[0].value)
        const id = json.recordId
        base(process.env.AIRTABLE_TABLE).update([
            {
                id,
                fields: {
                    Status: "Unreviewed",
                    "Approved Minutes": "0"
                }
            },
        ])
        await app.client.chat.update({
            ts: body.message.ts,
            channel: process.env.SLACK_CHANNEL,
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Decision reversed by <@${body.user.id}>`
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Original thread: ${json.threadURL}`
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Undo Approval",
                                "emoji": true
                            },
                            "value": JSON.stringify(json),
                            "action_id": "undo"
                        },

                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Convert to Approval",
                                "emoji": true
                            },
                            "value": JSON.stringify(json),
                            "action_id": "approve"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Convert to Denial",
                                "emoji": true
                            },
                            "value": JSON.stringify(json),
                            "action_id": "deny"
                        }
                    ]
                }
            ]
        })
    })
    app.action('approve', async ({ ack, say, body }) => {
        const json = JSON.parse(body.actions[0].value)
        const id = json.recordId
        base(process.env.AIRTABLE_TABLE).update([
            {
                id,
                fields: {
                    Status: "Approved",
                    "Approved Minutes": json.minutes
                }
            },
        ])
        await ack();
        await app.client.chat.update({
            ts: body.message.ts,
            channel: process.env.SLACK_CHANNEL,
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Hour(s) *approved* by <@${body.user.id}>`
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Original thread: ${json.threadURL}`
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Undo Approval",
                                "emoji": true
                            },
                            "value": JSON.stringify(json),
                            "action_id": "undo"
                        },

                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Convert to Approval",
                                "emoji": true
                            },
                            "value": JSON.stringify(json),
                            "action_id": "approve"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Convert to Denial",
                                "emoji": true
                            },
                            "value": JSON.stringify(json),
                            "action_id": "deny"
                        }
                    ]
                }
            ]
        })
    });
    app.action('deny', async ({ ack, say, body }) => {
        const json = JSON.parse(body.actions[0].value)
        const id = json.recordId
        await ack();
        base(process.env.AIRTABLE_TABLE).update([
            {
                id,
                fields: {
                    Status: "Rejected",
                    "Approved Minutes": "0"
                }
            },
        ])
        await app.client.chat.update({
            ts: body.message.ts,
            channel: process.env.SLACK_CHANNEL,
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Hour(s) *rejected* by <@${body.user.id}>`
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Original thread: ${json.threadURL}`
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Undo Rejection",
                                "emoji": true
                            },
                            "value": JSON.stringify(json),
                            "action_id": "undo"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Convert to Approval",
                                "emoji": true
                            },
                            "value": JSON.stringify(json),
                            "action_id": "approve"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Convert to Denial",
                                "emoji": true
                            },
                            "value": JSON.stringify(json),
                            "action_id": "deny"
                        }
                    ]
                }
            ]
        })
    });
    app.action('skip', async ({ ack, say, body }) => {
        await ack();
        await app.client.chat.update({
            ts: body.message.ts,
            channel: process.env.SLACK_CHANNEL,
            text: `Skipped for now :thumbsup-dino:`
        })

    });
    app.message('gib', async ({ message, say }) => {
        if (message.channel != process.env.SLACK_CHANNEL) return
        base(process.env.AIRTABLE_TABLE).select({
            view: "Hour Review Bot View"
        }).firstPage(async function (err, records) {
            if (records.length == 0) return await say(":yay: All applications reviewed.")
            const record = records.random()
            const blocks = []
            if (err) { console.error(err); return; }
            var thread = null
            var threadFetchErr = false
            /* If thread lookup fails, this is done to supress the warning. */
            var urlsExist = true
            var imagesExist = true
            var userSpeechExist = true
            try {
                thread = await app.client.conversations.replies({
                    channel: new URL(record.get('Code URL')).searchParams.get("cid"),
                    ts: new URL(record.get('Code URL')).searchParams.get("thread_ts")
                })
            } catch (e) {
                console.warn(e)
                threadFetchErr = true

            }
            if (!threadFetchErr) {
                urlsExist = thread.messages.find(message => getUrls(message.text).size > 0)
                imagesExist = thread.messages.find(message => message.files?.length > 0)
                userSpeechExist = thread.messages.find(message => message.user != "U06TW2N6C5R" && !message.bot_id && !message.app_id)
            }

            blocks.push(
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Session URL: <${record.get('Code URL')}|Click here>`
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Working on: ${record.get('Work')}`
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Minutes: ${record.get('Minutes')} (${(parseInt(record.get('Minutes')) / 60).toFixed(1)} hour(s))`
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Started: ${new Date(record.get('Created At')).toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: "short", dateStyle: "long" })} (Eastern)`
                    }
                },
            )

            if (!urlsExist) {
                blocks.push({
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": `⚠️ No URLs were detected in the thread.`,
                        "emoji": true
                    }
                })
            }
            if (!imagesExist) {
                blocks.push({
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": `⚠️ No images were detected in the thread.`,
                        "emoji": true
                    }
                })
            }
            if (!userSpeechExist) {
                blocks.push({
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": `⚠️ The user did not speak in the thread at all.`,
                        "emoji": true
                    }
                })
            }
            if (threadFetchErr) {
                blocks.push({
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": `⚠️ The thread does not exist or is inaccessible to the Arcade Checker. No automatic checks were performed.`,
                        "emoji": true
                    }
                })
            }
            blocks.push(
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Approve",
                                "emoji": true
                            },
                            "value": JSON.stringify({
                                recordId: record.id,
                                threadURL: record.get('Code URL'),
                                minutes: record.get("Minutes")
                            }),
                            "action_id": "approve"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Deny",
                                "emoji": true
                            },
                            "value": JSON.stringify({
                                recordId: record.id,
                                threadURL: record.get('Code URL'),
                                minutes: record.get("Minutes")
                            }),
                            "action_id": "deny"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Skip",
                                "emoji": true
                            },
                            "value": JSON.stringify({
                                recordId: record.id,
                                threadURL: record.get('Code URL'),
                                minutes: record.get("Minutes")
                            }),
                            "action_id": "skip"
                        }
                    ]
                })
            await say({ blocks })

        });

    })
    await app.start(process.env.PORT || 3008);
    console.log('Hour Reviewer is running!');
})();
