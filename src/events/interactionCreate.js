const { Events, MessageFlags, TextDisplayBuilder, SeparatorBuilder, SectionBuilder } = require('discord.js');
const db = require('../services/database');
const EmbedFactory = require('../utils/embeds');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}`);
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followup({
                        components: [EmbedFactory.createErrorEmbed("Error", "There was an error while executing this command!")],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        components: [EmbedFactory.createErrorEmbed("Error", "There was an error while executing this command!")],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: true
                    });
                }
            }
        } else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
            const customId = interaction.customId;
            const chatService = require('../services/chat');

            if (customId.startsWith('onboard_') && interaction.client.commands.has('onboard')) {
                 await interaction.client.commands.get('onboard').handleInteraction(interaction);
            } else if (customId.startsWith('profile_') && interaction.client.commands.has('profile')) {
                 await interaction.client.commands.get('profile').handleInteraction(interaction);
            } else if (customId.startsWith('share_') && interaction.client.commands.has('share')) {
                await interaction.client.commands.get('share').handleInteraction(interaction);
            } else if (customId.startsWith('report_') && interaction.client.commands.has('report')) {
                await interaction.client.commands.get('report').handleInteraction(interaction);
            } else if (customId.startsWith('chat_') || customId.startsWith('feedback_') || customId.startsWith('unblock_')) {

                if (customId === 'chat_end') {
                    const db = require('../services/database');
                    const session = db.getActiveSessionForUser(interaction.user.id);
                    if (session) {
                        await interaction.deferReply({ ephemeral: true });
                        const success = await chatService.endChat(interaction.client, session.session_id, "User ended chat");
                        if (success) await interaction.editReply({
                            components: [EmbedFactory.createSuccessEmbed("Success", "✅ Chat ended successfully.")],
                            flags: MessageFlags.IsComponentsV2
                        });
                        else await interaction.editReply({
                            components: [EmbedFactory.createErrorEmbed("Error", "❌ Could not end chat - session may already be ended.")],
                            flags: MessageFlags.IsComponentsV2
                        });
                    } else {
                        await interaction.reply({
                            components: [EmbedFactory.createErrorEmbed("Error", "No active session.")],
                            flags: MessageFlags.IsComponentsV2,
                            ephemeral: true
                        });
                    }
                } else if (customId === 'chat_report') {
                     const command = interaction.client.commands.get('report');
                     if (command) await command.execute(interaction);
                } else if (customId === 'chat_emergency') {
                    const db = require('../services/database');
                    const session = db.getActiveSessionForUser(interaction.user.id);
                    if (session) {
                        await interaction.deferReply({ ephemeral: true });
                        const partnerId = session.user1_id === interaction.user.id ? session.user2_id : session.user1_id;
                        const partnerAnon = session.user1_id === interaction.user.id ? session.user2_anonymous_id : session.user1_anonymous_id;
                        const result = await chatService.blockUser(interaction.client, interaction.user.id, partnerId, partnerAnon, true);

                        const container = EmbedFactory.createContainer(EmbedFactory.ERROR_COLOR);
                        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`🚨 ${result}`));

                        await interaction.editReply({
                            components: [container],
                            flags: MessageFlags.IsComponentsV2
                        });
                    } else {
                        await interaction.reply({
                            components: [EmbedFactory.createErrorEmbed("Error", "No active session.")],
                            flags: MessageFlags.IsComponentsV2,
                            ephemeral: true
                        });
                    }
                } else if (customId.startsWith('feedback_')) {
                    const [type, sessionId, otherUserId] = customId.split(':');

                    if (type === 'feedback_good') {
                        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                        const row = new ActionRowBuilder().addComponents(
                             new ButtonBuilder().setCustomId(`connect_yes:${sessionId}:${otherUserId}`).setLabel("Yes, I'd like to connect").setStyle(ButtonStyle.Primary).setEmoji('🤝'),
                             new ButtonBuilder().setCustomId(`connect_no`).setLabel("No thanks").setStyle(ButtonStyle.Secondary).setEmoji('👋')
                        );

                        const container = EmbedFactory.createContainer(EmbedFactory.SUCCESS_COLOR);
                        container.addTextDisplayComponents(new TextDisplayBuilder().setContent("✅ Thanks for the feedback! Would you like to connect with this person outside of anonymous chat?"));
                        container.addActionRowComponents(row);

                        await interaction.reply({
                            components: [container],
                            flags: MessageFlags.IsComponentsV2,
                            ephemeral: true
                        });
                    } else if (type === 'feedback_bad') {
                         await interaction.reply({
                             components: [EmbedFactory.createInfoEmbed("Feedback Received", "Sorry to hear that. Your feedback helps us improve the service.")],
                             flags: MessageFlags.IsComponentsV2,
                             ephemeral: true
                        });
                    } else {
                         await interaction.reply({
                             components: [EmbedFactory.createSuccessEmbed("Feedback Received", "✅ Thanks for the feedback!")],
                             flags: MessageFlags.IsComponentsV2,
                             ephemeral: true
                        });
                    }
                } else if (customId.startsWith('connect_')) {
                    if (customId === 'connect_no') {
                         const container = EmbedFactory.createInfoEmbed("Privacy Preserved", "No problem! Your anonymity remains completely protected. Thanks for using our service!");
                         await interaction.update({
                             components: [container],
                             flags: MessageFlags.IsComponentsV2
                        });
                    } else {
                         const [_, sessionId, targetUserId] = customId.split(':');
                         const db = require('../services/database');

                         const mutual = db.checkMutualConnectionRequest(sessionId, interaction.user.id);
                         if (mutual) {
                              const [user1Id, user2Id] = mutual;
                              const user1 = await interaction.client.users.fetch(user1Id);
                              const user2 = await interaction.client.users.fetch(user2Id);

                              const container1 = EmbedFactory.createSuccessEmbed("Connection Established!", `🎉 You both wanted to connect! Here's their Discord username: **${user2.username}**`);
                              const container2 = EmbedFactory.createSuccessEmbed("Connection Established!", `🎉 You both wanted to connect! Here's their Discord username: **${user1.username}**`);

                              await interaction.update({
                                  components: [container1],
                                  flags: MessageFlags.IsComponentsV2
                             });
                              await user2.send({
                                  components: [container2],
                                  flags: MessageFlags.IsComponentsV2
                             }).catch(() => {});
                         } else {
                              const session = db.getChatSession(sessionId);
                              if (!session) {
                                   await interaction.reply({
                                       components: [EmbedFactory.createErrorEmbed("Error", "Session data unavailable.")],
                                       flags: MessageFlags.IsComponentsV2,
                                       ephemeral: true
                                    });
                                   return;
                              }
                              const requesterAnon = session.user1_id == interaction.user.id ? session.user1_anonymous_id : session.user2_anonymous_id;
                              const targetAnon = session.user1_id == interaction.user.id ? session.user2_anonymous_id : session.user1_anonymous_id;

                              db.createConnectionRequest(sessionId, interaction.user.id, targetUserId, requesterAnon, targetAnon);
                              const container = EmbedFactory.createSuccessEmbed("Connection Request Sent", "Your request has been noted! If the other person also wants to connect, you'll both receive each other's usernames.");
                              await interaction.update({
                                  components: [container],
                                  flags: MessageFlags.IsComponentsV2
                            });
                         }
                    }
                } else if (customId.startsWith('chat_block:')) {
                    const [_, blockedUserId, blockedAnon] = customId.split(':');
                    await interaction.deferReply({ ephemeral: true });
                    const result = await chatService.blockUser(interaction.client, interaction.user.id, blockedUserId, blockedAnon, false);

                    const container = EmbedFactory.createContainer(EmbedFactory.ERROR_COLOR);
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`🚫 ${result}`));

                    await interaction.editReply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2
                    });
                } else if (customId.startsWith('chat_report_end:')) {
                    const [_, reportedUserId] = customId.split(':');
                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                    const modal = new ModalBuilder()
                        .setCustomId(`report_modal_end:${reportedUserId}`)
                        .setTitle('Report User');

                    const reasonInput = new TextInputBuilder().setCustomId('report_reason').setLabel("Reason").setStyle(TextInputStyle.Short).setRequired(true);
                    const descInput = new TextInputBuilder().setCustomId('report_description').setLabel("Details").setStyle(TextInputStyle.Paragraph).setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput), new ActionRowBuilder().addComponents(descInput));
                    await interaction.showModal(modal);
                } else if (customId === 'unblock_select') {
                    const selectedId = interaction.values[0];
                    const db = require('../services/database');
                    db.removeBlock(interaction.user.id, selectedId);
                    await interaction.reply({
                        components: [EmbedFactory.createSuccessEmbed("Unblocked", `✅ User \`${selectedId.substring(0, 8)}...\` has been unblocked.`)],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: true
                    });
                }
            } else if (customId.startsWith('report_modal_end:')) {
                const [_, reportedUserId] = customId.split(':');
                const reason = interaction.fields.getTextInputValue('report_reason');
                const description = interaction.fields.getTextInputValue('report_description');
                const safety = require('../services/safety');

                try {
                    const reportId = safety.createReport(interaction.user.id, reportedUserId, reason, description, []);
                    await interaction.reply({
                        components: [EmbedFactory.createSuccessEmbed("Report Filed", `Thank you for your report. ID: ${reportId}`)],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: true
                    });
                } catch (e) {
                     await interaction.reply({
                         components: [EmbedFactory.createErrorEmbed("Error", "Failed to file report.")],
                         flags: MessageFlags.IsComponentsV2,
                         ephemeral: true
                    });
                }
            } else if (customId.startsWith('broaden_') || customId === 'leave_queue') {
                const matchmaking = require('../services/matchmaking');
                 if (customId === 'broaden_search') {
                     const success = await matchmaking.broadenSearch(interaction.user.id);
                     if (success) await interaction.reply({
                         components: [EmbedFactory.createSuccessEmbed("Success", "✅ Search criteria expanded!")],
                         flags: MessageFlags.IsComponentsV2,
                         ephemeral: true
                    });
                     else await interaction.reply({
                         components: [EmbedFactory.createErrorEmbed("Error", "❌ Could not broaden search (maybe you left the queue).")],
                         flags: MessageFlags.IsComponentsV2,
                         ephemeral: true
                    });
                 } else if (customId === 'broaden_wait') {
                     await interaction.reply({
                         components: [EmbedFactory.createInfoEmbed("Waiting", "⏳ We'll keep looking!")],
                         flags: MessageFlags.IsComponentsV2,
                         ephemeral: true
                    });
                 } else if (customId === 'leave_queue') {
                     const success = await matchmaking.removeFromQueue(interaction.user.id);
                     if (success) await interaction.reply({
                         components: [EmbedFactory.createSuccessEmbed("Left Queue", "✅ Left queue.")],
                         flags: MessageFlags.IsComponentsV2,
                         ephemeral: true
                    });
                     else await interaction.reply({
                         components: [EmbedFactory.createErrorEmbed("Error", "❌ Not in queue.")],
                         flags: MessageFlags.IsComponentsV2,
                         ephemeral: true
                    });
                 }
            }
        }
    },
};
