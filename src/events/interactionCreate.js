const { Events } = require('discord.js');
const db = require('../services/database');

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
                // Global State Check (Locking)
                // This logic could be inside specific commands or here globally.
                // For "360-degree safety railguard", we should check state before execution.
                // However, different commands require different states.
                // Let the command handle its own state requirements or pass a state checker.

                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}`);
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followup({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        } else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
            // Handle interactive components
            // We can look up the command that owns this component or handle it generically if named conventionally
            // Or better, commands can export component handlers, or we use a separate handler system.
            // For simplicity in migration, I'll check customIds.

            // Example: "onboard_gender_male" -> Handle in onboard command logic?
            // A common pattern is `commandName:action:args`.

            // For this specific bot, the Python code used dynamic view callbacks.
            // In Node.js discord.js, we often need to route manually unless we keep a collector active (which is memory intensive for persistent bots).
            // We will route based on customId prefixes.

            const customId = interaction.customId;
            const chatService = require('../services/chat'); // Lazy load to avoid cycle issues if any

            if (customId.startsWith('onboard_') && interaction.client.commands.has('onboard')) {
                 await interaction.client.commands.get('onboard').handleInteraction(interaction);
            } else if (customId.startsWith('profile_') && interaction.client.commands.has('profile')) {
                 await interaction.client.commands.get('profile').handleInteraction(interaction);
            } else if (customId.startsWith('share_') && interaction.client.commands.has('share')) {
                await interaction.client.commands.get('share').handleInteraction(interaction);
            } else if (customId.startsWith('report_') && interaction.client.commands.has('report')) {
                await interaction.client.commands.get('report').handleInteraction(interaction);
            } else if (customId.startsWith('chat_') || customId.startsWith('feedback_') || customId.startsWith('unblock_')) {
                // Handle Chat Control & Feedback Buttons
                if (customId === 'chat_end') {
                    const db = require('../services/database');
                    const session = db.getActiveSessionForUser(interaction.user.id);
                    if (session) {
                        await interaction.deferReply({ ephemeral: true });
                        const success = await chatService.endChat(interaction.client, session.session_id, "User ended chat");
                        if (success) await interaction.editReply("✅ Chat ended successfully.");
                        else await interaction.editReply("❌ Could not end chat - session may already be ended.");
                    } else {
                        await interaction.reply({ content: "No active session.", ephemeral: true });
                    }
                } else if (customId === 'chat_report') {
                     // Open Modal
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
                        await interaction.editReply(`🚨 ${result}`);
                    } else {
                        await interaction.reply({ content: "No active session.", ephemeral: true });
                    }
                } else if (customId.startsWith('feedback_')) {
                    const [type, sessionId, otherUserId] = customId.split(':');

                    if (type === 'feedback_good') {
                        // Trigger Connection Request View
                        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                        const row = new ActionRowBuilder().addComponents(
                             new ButtonBuilder().setCustomId(`connect_yes:${sessionId}:${otherUserId}`).setLabel("Yes, I'd like to connect").setStyle(ButtonStyle.Primary).setEmoji('🤝'),
                             new ButtonBuilder().setCustomId(`connect_no`).setLabel("No thanks").setStyle(ButtonStyle.Secondary).setEmoji('👋')
                        );
                        await interaction.reply({ content: "✅ Thanks for the feedback! Would you like to connect with this person outside of anonymous chat?", components: [row], ephemeral: true });
                    } else if (type === 'feedback_bad') {
                         await interaction.reply({ content: "Sorry to hear that. Your feedback helps us improve the service.", ephemeral: true });
                    } else {
                         await interaction.reply({ content: "✅ Thanks for the feedback!", ephemeral: true });
                    }
                } else if (customId.startsWith('connect_')) {
                    if (customId === 'connect_no') {
                         const EmbedFactory = require('../utils/embeds');
                         const embed = EmbedFactory.createInfoEmbed("Privacy Preserved", "No problem! Your anonymity remains completely protected. Thanks for using our service!");
                         await interaction.update({ content: null, embeds: [embed], components: [] });
                    } else {
                         const [_, sessionId, targetUserId] = customId.split(':');
                         const db = require('../services/database');
                         const EmbedFactory = require('../utils/embeds');

                         // Check mutual
                         const mutual = db.checkMutualConnectionRequest(sessionId, interaction.user.id);
                         if (mutual) {
                              const [user1Id, user2Id] = mutual;
                              const user1 = await interaction.client.users.fetch(user1Id);
                              const user2 = await interaction.client.users.fetch(user2Id);

                              const embed1 = EmbedFactory.createSuccessEmbed("Connection Established!", `🎉 You both wanted to connect! Here's their Discord username: **${user2.username}**`);
                              const embed2 = EmbedFactory.createSuccessEmbed("Connection Established!", `🎉 You both wanted to connect! Here's their Discord username: **${user1.username}**`);

                              await interaction.update({ content: null, embeds: [embed1], components: [] });
                              await user2.send({ embeds: [embed2] }).catch(() => {});
                         } else {
                              const session = db.getChatSession(sessionId); // might be ended, so use getChatSession
                              if (!session) {
                                   await interaction.reply({ content: "Session data unavailable.", ephemeral: true });
                                   return;
                              }
                              // We need anonymous IDs for the record
                              // Assuming session stores them even if ended? Yes.
                              const requesterAnon = session.user1_id == interaction.user.id ? session.user1_anonymous_id : session.user2_anonymous_id;
                              const targetAnon = session.user1_id == interaction.user.id ? session.user2_anonymous_id : session.user1_anonymous_id;

                              db.createConnectionRequest(sessionId, interaction.user.id, targetUserId, requesterAnon, targetAnon);
                              const embed = EmbedFactory.createSuccessEmbed("Connection Request Sent", "Your request has been noted! If the other person also wants to connect, you'll both receive each other's usernames.");
                              await interaction.update({ content: null, embeds: [embed], components: [] });
                         }
                    }
                } else if (customId.startsWith('chat_block:')) {
                    const [_, blockedUserId, blockedAnon] = customId.split(':');
                    await interaction.deferReply({ ephemeral: true });
                    const result = await chatService.blockUser(interaction.client, interaction.user.id, blockedUserId, blockedAnon, false);
                    await interaction.editReply(`🚫 ${result}`);
                } else if (customId.startsWith('chat_report_end:')) {
                    const [_, reportedUserId] = customId.split(':');
                    // We need to trigger report modal but pre-fill or pass ID.
                    // Modals can't pass data easily except via CustomID?
                    // But report command opens a modal with fixed ID.
                    // We can't trigger command.execute because it checks for active session usually.
                    // Let's modify report command or handle here.
                    // Report command: "You can only report a user during an active chat session."
                    // Python code allows reporting after chat.
                    // I'll manually handle showing modal here.

                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                    const modal = new ModalBuilder()
                        .setCustomId(`report_modal_end:${reportedUserId}`)
                        .setTitle('Report User');

                    const reasonInput = new TextInputBuilder().setCustomId('report_reason').setLabel("Reason").setStyle(TextInputStyle.Short).setRequired(true);
                    const descInput = new TextInputBuilder().setCustomId('report_description').setLabel("Details").setStyle(TextInputStyle.Paragraph).setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput), new ActionRowBuilder().addComponents(descInput));
                    await interaction.showModal(modal);
                } else if (customId === 'unblock_select') {
                    // Blocklist command handler
                    const selectedId = interaction.values[0];
                    const db = require('../services/database');
                    db.removeBlock(interaction.user.id, selectedId);
                    await interaction.reply({ content: `✅ User \`${selectedId.substring(0, 8)}...\` has been unblocked.`, ephemeral: true });
                }
            } else if (customId.startsWith('report_modal_end:')) {
                // Handle the report modal submission from end-chat screen
                const [_, reportedUserId] = customId.split(':');
                const reason = interaction.fields.getTextInputValue('report_reason');
                const description = interaction.fields.getTextInputValue('report_description');
                const safety = require('../services/safety');
                const EmbedFactory = require('../utils/embeds');

                try {
                    const reportId = safety.createReport(interaction.user.id, reportedUserId, reason, description, []);
                    await interaction.reply({ embeds: [EmbedFactory.createSuccessEmbed("Report Filed", `Thank you for your report. ID: ${reportId}`)], ephemeral: true });
                } catch (e) {
                     await interaction.reply({ content: "Failed to file report.", ephemeral: true });
                }
            } else if (customId.startsWith('broaden_') || customId === 'leave_queue') {
                const matchmaking = require('../services/matchmaking');
                 if (customId === 'broaden_search') {
                     const success = await matchmaking.broadenSearch(interaction.user.id);
                     if (success) await interaction.reply({ content: "✅ Search criteria expanded!", ephemeral: true });
                     else await interaction.reply({ content: "❌ Could not broaden search (maybe you left the queue).", ephemeral: true });
                 } else if (customId === 'broaden_wait') {
                     await interaction.reply({ content: "⏳ We'll keep looking!", ephemeral: true });
                 } else if (customId === 'leave_queue') {
                     const success = await matchmaking.removeFromQueue(interaction.user.id);
                     if (success) await interaction.reply({ content: "✅ Left queue.", ephemeral: true });
                     else await interaction.reply({ content: "❌ Not in queue.", ephemeral: true });
                 }
            }
        }
    },
};
