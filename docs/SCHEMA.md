# Database Schemas

## User
`name, email(unique,lowercase), password(hash,select:false), avatar, avatarPublicId, statusText(140), role(user|admin), isOnline, lastSeen, blockedUsers[User], resetPasswordToken, resetPasswordExpire, timestamps`
Indexes: `email unique`.

## Conversation (DM)
`participants[User×2], lastMessage(Message), lastMessageAt, unreadCounts Map<userId→count>, isArchivedBy[], timestamps`
Indexes: `participants`, `lastMessageAt -1`.

## Message
`sender, conversation?, group? (exactly one), text(4000), attachments[{url,publicId,fileName,mimeType,size,resourceType}], replyTo(Message), reactions[{user,emoji}], readBy[], deliveredTo[], isEdited, editedAt, isDeleted, deletedAt, mentions[User], timestamps`
Indexes: `(conversation,createdAt -1)`, `(group,createdAt -1)`, `text:text`.

## Group
`name(80), description(500), photo, photoPublicId, createdBy, members[{user, role:admin|member, joinedAt}], onlyAdminsCanPost, lastMessage, lastMessageAt, inviteCode(unique sparse), timestamps`
Indexes: `members.user`, `lastMessageAt -1`.

## Notification
`recipient(indexed), sender?, type(new_message|group_invite|mention|reaction|team_invite|system), title, body, data{conversationId,groupId,messageId}, isRead, readAt, timestamps`
Index: `(recipient, createdAt -1)`.

## File
`owner, message?, url, publicId, fileName, mimeType, size, resourceType, timestamps`
Index: `(owner, createdAt -1)`.

## Relations diagram
User 1—N Conversation(N via participants) —1 Message(N) • Group N—M User(members) —1 Message(N) • Message 0—1 replyTo • User 1—N Notification • User 1—N File.
