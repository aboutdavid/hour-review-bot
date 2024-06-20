require("dotenv").config();
const Airtable = require('airtable')
const { App } = require("@slack/bolt");
var base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE);
const { humanReadableDiff } = require("./utils")
const getUrls = require('get-urls');
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: !Boolean(process.env.PORT),
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
                    "Percentage Approved": 0
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
                    "Percentage Approved": 1
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
                    "Percentage Approved": 0
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
        if (message.channel != process.env.SLACK_CHANNEL || !message.text || message.text.toLowerCase().trim() != "gib") return
        try {
            await app.client.conversations.join({
                channel: message.channel,
            });
        } catch (e) {
            // This should at least try joining the channel to make lookups work4
            // If checks fail, it does not 100% matter but would be nice :)
        }
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
            var r = null
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
                r = await base(process.env.AIRTABLE_TABLE).find(record.get("User"))
                urlsExist = thread.messages.find(message => getUrls(message.text).size > 0)
                imagesExist = thread.messages.find(message => message.files?.length > 0)
                userSpeechExist = thread.messages.find(message => message.user == r.get("Slack ID"))
            }

            var largeMessage = thread.messages.map(msg => msg.text).join("\n\n")

            var lines = ""
            const matches = largeMessage.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/commit\/([a-f0-9]{40})/gm)
            if (matches) {
                let promises = matches.map(async (url, i) => {
                    var newUrl = url.replace("https://github.com/", "")
                    var split = newUrl.split("/")
                    var username = split[0]
                    var repo = split[1]
                    var hash = split[3]

                    if (!username || !repo || !hash) return
                    const api = await (await fetch(`https://api.github.com/repos/${username}/${repo}/commits/${hash}`)).json()
                    return `Info about ${hash}:
${humanReadableDiff(new Date(new Date(record.get('Created At')).getTime() + (record.get("Minutes") * 60000)), new Date(api.commit.author.date))}
Lines modified: + ${api.stats.additions} / - ${api.stats.deletions} / ± ${api.stats.total}
URL: ${url}
${api.commit.committer.email == "noreply@github.com" ? "Done via the Web UI" : "Done via a client"}
${api.files.length} file(s) modified - ${api.files.filter(file => file.status == "added").length} added, ${api.files.filter(file => file.status == "modified").length} modified, ${api.files.filter(file => file.status == "deleted").length} deleted`
                })


                lines = (await Promise.all(promises)).join("\n\n")
            }

            blocks.push(
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `User: <@${r.get("Slack ID")}>`
                    }
                },
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

            blocks.push({
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": !urlsExist ? `⚠️ No URLs were detected in the thread.` : "✅ One or more URLs were detected in the thread.",
                    "emoji": true
                }
            })

            blocks.push({
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": !imagesExist ? `⚠️ No images were detected in the thread.` : "✅ One or more images were detected in the thread",
                    "emoji": true
                }
            })

            blocks.push({
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": !userSpeechExist ? `⛔ The user did not speak in the thread at all.` : "✅ The user did speak in the thread",
                    "emoji": true
                }
            })

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

            if (matches) {
                blocks.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `:github: Git Commit Info detected. Results are below:\n\n\`\`\`\n${lines}\n\`\`\``
                    }
                })
            }
            blocks.push(
                {
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": `⚠️ If you wish to modify the amount of approved minutes, please use the Airtable base directly until a UI is created,`,
                        "emoji": true
                    }
                },
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
            var thread = null
            var text = ""
            try {
                thread = await app.client.conversations.replies({
                    channel: new URL(record.get('Code URL')).searchParams.get("cid"),
                    ts: new URL(record.get('Code URL')).searchParams.get("thread_ts")
                })
            } catch (e) {
            }
            const msg = await say({ blocks })
            if (!thread || !thread?.messages?.length) return
            var r = await base(process.env.AIRTABLE_TABLE).find(record.get("User"))

            thread.messages.filter(message => message.user == r.get("Slack ID")).forEach(umsg => {
                text += `> ${umsg.text.replaceAll("> ", "")}\n\nA message by <@${umsg.user}> on ${new Date(Math.floor(umsg.ts * 1000.0)).toLocaleString('en-US', { timeZone: 'America/New_York', timeStyle: "short", dateStyle: "long" })} (EST)\n\n`
            })

            await app.client.chat.postMessage({
                thread_ts: msg.ts,
                channel: msg.channel,
                text: `Below are ${thread.messages.filter(message => message.user == r.get("Slack ID")).length} message(s) from the user:`,
                mrkdwn: true
            });
            let chunks = [];
            let i = 0;

            while (i < text.length) {
                let end = Math.min(i + 40000, text.length);
                if (end < text.length) {
                    end = text.lastIndexOf('\n', end);
                    if (end == -1) {
                        end = Math.min(i + 40000, text.length);
                    }
                }
                chunks.push(text.substring(i, end));
                i = end;
            }

            for (let chunk of chunks) {
                await app.client.chat.postMessage({
                    thread_ts: msg.ts,
                    channel: msg.channel,
                    text: chunk,
                    mrkdwn: true
                });
            }

        });

    })

    app.command('/reviewstats', async ({ ack, respond }) => {
        await ack()

        base(process.env.AIRTABLE_TABLE).select({
            view: "Hour Review Bot View"
        }).all(async function (err, r) {
            var total = 0
            var users = new Set()
            r.forEach(record => {
                total += record._rawJson.fields.Minutes
                users.add(record._rawJson.fields.User)
            })
            await respond(`Total minute(s) awaiting their fate: ${total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
Total session(s) awaiting their fate: ${r.length.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
Total user(s) awaiting their fate on their hours: ${users.size}`)
        })

    });
    await app.start(process.env.PORT || 3008);
    console.log('Hour Reviewer is running!');
})();

process.on("unhandledRejection", (error) => {
    console.error(error);
});
