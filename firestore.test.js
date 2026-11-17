const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const CREATOR_UID = "creator_101";
const ADMIN_UID = "admin_202";
const ADMIN2_UID = "admin_203";
const ORGANIZER_UID = "organizer_303";
const PARTICIPANT_UID = "participant_404";
const OUTSIDER_UID = "outsider_999";

const GROUP_ID = "group_rally_1";
const GROUP_CODE = "SUMMIT26";
const EVENT_ID = "event_opening_1";
const TASK_ID = "task_checkin_1";
const CH_ALL_ID = "ch_general";
const CH_ORG_ID = "ch_organizers";
const CH_ADMIN_ID = "ch_admins";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

function pastTime(offsetMs = 5000) {
  return new Date(Date.now() - offsetMs);
}

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

async function seedBaseGroup() {
  const ts = pastTime(15000);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection("groups").doc(GROUP_ID).set({
      name: "Annual Summit 2026",
      description: "Main event operations hub",
      groupCode: GROUP_CODE,
      ownerId: CREATOR_UID,
      createdAt: ts,
      updatedAt: ts,
    });
    await db.collection("groupCodes").doc(GROUP_CODE).set({
      groupId: GROUP_ID,
      groupName: "Annual Summit 2026",
      createdBy: CREATOR_UID,
      active: true,
      createdAt: ts,
      updatedAt: ts,
    });
    await db.collection("groups").doc(GROUP_ID).collection("members").doc(CREATOR_UID).set({
      uid: CREATOR_UID,
      displayName: "Clara Creator",
      role: "CREATOR",
      tasksSignedUpCount: 0,
      messagesSentCount: 0,
      joinedAt: ts,
      updatedAt: ts,
    });
    await db.collection("groups").doc(GROUP_ID).collection("members").doc(ADMIN_UID).set({
      uid: ADMIN_UID,
      displayName: "Alex Admin",
      role: "ADMIN",
      tasksSignedUpCount: 0,
      messagesSentCount: 0,
      joinedAt: ts,
      updatedAt: ts,
    });
    await db.collection("groups").doc(GROUP_ID).collection("members").doc(ORGANIZER_UID).set({
      uid: ORGANIZER_UID,
      displayName: "Omar Organizer",
      role: "ORGANIZER",
      tasksSignedUpCount: 0,
      messagesSentCount: 0,
      joinedAt: ts,
      updatedAt: ts,
    });
    await db.collection("groups").doc(GROUP_ID).collection("members").doc(PARTICIPANT_UID).set({
      uid: PARTICIPANT_UID,
      displayName: "Pat Participant",
      role: "PARTICIPANT",
      tasksSignedUpCount: 0,
      messagesSentCount: 0,
      joinedAt: ts,
      updatedAt: ts,
    });
  });
}

test("Unauthenticated requests are denied on all collections", async () => {
  await seedBaseGroup();
  const unauth = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauth.collection("groups").doc(GROUP_ID).get());
  await assertFails(unauth.collection("groupCodes").doc(GROUP_CODE).get());
  await assertFails(unauth.collection("groups").doc(GROUP_ID).collection("events").get());
  await assertFails(unauth.collection("users").doc(CREATOR_UID).get());
});

test("User PII isolation: user cannot read or write another user's profile or joinedGroups", async () => {
  const creatorDb = testEnv.authenticatedContext(CREATOR_UID).firestore();
  const ts = pastTime(5000);
  await assertSucceeds(
    creatorDb.collection("users").doc(CREATOR_UID).set({
      uid: CREATOR_UID,
      displayName: "Clara",
      email: "clara@example.com",
      createdAt: ts,
      updatedAt: ts,
    })
  );

  const partDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  await assertFails(partDb.collection("users").doc(CREATOR_UID).get());
  await assertFails(partDb.collection("users").doc(CREATOR_UID).collection("joinedGroups").get());
});

test("Group Creator can create group + custom groupCode + CREATOR member atomically; non-creator cannot edit groupCode", async () => {
  const creatorDb = testEnv.authenticatedContext(CREATOR_UID).firestore();
  const ts = pastTime(5000);
  const batch = creatorDb.batch();
  batch.set(creatorDb.collection("groups").doc(GROUP_ID), {
    name: "RallyHub Launch",
    description: "Community rally",
    groupCode: GROUP_CODE,
    ownerId: CREATOR_UID,
    createdAt: ts,
    updatedAt: ts,
  });
  batch.set(creatorDb.collection("groupCodes").doc(GROUP_CODE), {
    groupId: GROUP_ID,
    groupName: "RallyHub Launch",
    createdBy: CREATOR_UID,
    active: true,
    createdAt: ts,
    updatedAt: ts,
  });
  batch.set(creatorDb.collection("groups").doc(GROUP_ID).collection("members").doc(CREATOR_UID), {
    uid: CREATOR_UID,
    displayName: "Clara Creator",
    role: "CREATOR",
    tasksSignedUpCount: 0,
    messagesSentCount: 0,
    joinedAt: ts,
    updatedAt: ts,
  });
  batch.set(creatorDb.collection("users").doc(CREATOR_UID).collection("joinedGroups").doc(GROUP_ID), {
    groupId: GROUP_ID,
    groupName: "RallyHub Launch",
    groupCode: GROUP_CODE,
    role: "CREATOR",
    joinedAt: ts,
    updatedAt: ts,
  });
  batch.set(creatorDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ALL_ID), {
    name: "General Lobby",
    description: "Community announcements & participant Q&A",
    accessLevel: "ALL",
    createdBy: CREATOR_UID,
    messageCount: 0,
    createdAt: ts,
    updatedAt: ts,
  });
  batch.set(creatorDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ORG_ID), {
    name: "Event Organizers",
    description: "Shift leads, logistics & task coordination",
    accessLevel: "ORGANIZER",
    createdBy: CREATOR_UID,
    messageCount: 0,
    createdAt: ts,
    updatedAt: ts,
  });
  batch.set(creatorDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ADMIN_ID), {
    name: "Admin Command",
    description: "Private admin coordination & permissions",
    accessLevel: "ADMIN",
    createdBy: CREATOR_UID,
    messageCount: 0,
    createdAt: ts,
    updatedAt: ts,
  });
  await assertSucceeds(batch.commit());

  // Listing all groupCodes is forbidden
  const partDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  await assertFails(partDb.collection("groupCodes").get());
  // Exact lookup by code succeeds
  await assertSucceeds(partDb.collection("groupCodes").doc(GROUP_CODE).get());

  // Participant cannot update group metadata
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).update({
      name: "Hijacked Name",
      updatedAt: pastTime(1000),
    })
  );
  // Creator can update group metadata
  await assertSucceeds(
    creatorDb.collection("groups").doc(GROUP_ID).update({
      name: "RallyHub Launch Updated",
      updatedAt: pastTime(1000),
    })
  );
  // Admin can also edit group metadata & groupCode, but cannot delete the group
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(
    adminDb.collection("groups").doc(GROUP_ID).update({
      name: "Unauthorized Admin Update Before Join",
      updatedAt: pastTime(900),
    })
  );
});

test("Sequential group creation (group -> code+member -> channels -> joinedGroups) succeeds", async () => {
  const creatorDb = testEnv.authenticatedContext(CREATOR_UID).firestore();
  const ts = pastTime(5000);
  const seqGroupId = "grp_seq_1";
  const seqCode = "SEQ2026";

  await assertSucceeds(
    creatorDb.collection("groups").doc(seqGroupId).set({
      name: "Sequential Group",
      description: "",
      groupCode: seqCode,
      ownerId: CREATOR_UID,
      createdAt: ts,
      updatedAt: ts,
    })
  );

  const setupBatch = creatorDb.batch();
  setupBatch.set(creatorDb.collection("groupCodes").doc(seqCode), {
    groupId: seqGroupId,
    groupName: "Sequential Group",
    createdBy: CREATOR_UID,
    active: true,
    createdAt: ts,
    updatedAt: ts,
  });
  setupBatch.set(creatorDb.collection("groups").doc(seqGroupId).collection("members").doc(CREATOR_UID), {
    uid: CREATOR_UID,
    displayName: "Clara Creator",
    role: "CREATOR",
    tasksSignedUpCount: 0,
    messagesSentCount: 0,
    joinedAt: ts,
    updatedAt: ts,
  });
  await assertSucceeds(setupBatch.commit());

  const channelBatch = creatorDb.batch();
  channelBatch.set(creatorDb.collection("groups").doc(seqGroupId).collection("channels").doc(CH_ALL_ID), {
    name: "General Lobby",
    description: "Community announcements & participant Q&A",
    accessLevel: "ALL",
    createdBy: CREATOR_UID,
    messageCount: 0,
    createdAt: ts,
    updatedAt: ts,
  });
  channelBatch.set(creatorDb.collection("groups").doc(seqGroupId).collection("channels").doc(CH_ORG_ID), {
    name: "Event Organizers",
    description: "Shift leads, logistics & task coordination",
    accessLevel: "ORGANIZER",
    createdBy: CREATOR_UID,
    messageCount: 0,
    createdAt: ts,
    updatedAt: ts,
  });
  channelBatch.set(creatorDb.collection("groups").doc(seqGroupId).collection("channels").doc(CH_ADMIN_ID), {
    name: "Admin Command",
    description: "Private admin coordination & permissions",
    accessLevel: "ADMIN",
    createdBy: CREATOR_UID,
    messageCount: 0,
    createdAt: ts,
    updatedAt: ts,
  });
  await assertSucceeds(channelBatch.commit());

  await assertSucceeds(
    creatorDb.collection("users").doc(CREATOR_UID).collection("joinedGroups").doc(seqGroupId).set({
      groupId: seqGroupId,
      groupName: "Sequential Group",
      groupCode: seqCode,
      role: "CREATOR",
      joinedAt: ts,
      updatedAt: ts,
    })
  );
});

test("Participant joins by group code as PARTICIPANT only; cannot self-promote", async () => {
  await seedBaseGroup();
  const outsiderDb = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
  const ts = pastTime(3000);

  // Self-assigning ADMIN on join fails
  await assertFails(
    outsiderDb.collection("groups").doc(GROUP_ID).collection("members").doc(OUTSIDER_UID).set({
      uid: OUTSIDER_UID,
      displayName: "Sneaky Admin",
      role: "ADMIN",
      tasksSignedUpCount: 0,
      messagesSentCount: 0,
      joinedAt: ts,
      updatedAt: ts,
    })
  );

  // Joining as PARTICIPANT succeeds
  await assertSucceeds(
    outsiderDb.collection("groups").doc(GROUP_ID).collection("members").doc(OUTSIDER_UID).set({
      uid: OUTSIDER_UID,
      displayName: "Olivia New",
      role: "PARTICIPANT",
      tasksSignedUpCount: 0,
      messagesSentCount: 0,
      joinedAt: ts,
      updatedAt: ts,
    })
  );

  // Self-promoting role fails
  await assertFails(
    outsiderDb.collection("groups").doc(GROUP_ID).collection("members").doc(OUTSIDER_UID).update({
      role: "ADMIN",
      updatedAt: pastTime(1000),
    })
  );
});

test("Admin can create multiple admins, but only Group Creator can demote an admin", async () => {
  await seedBaseGroup();
  const ts = pastTime(5000);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("groups").doc(GROUP_ID).collection("members").doc(ADMIN2_UID).set({
      uid: ADMIN2_UID,
      displayName: "New Member",
      role: "PARTICIPANT",
      tasksSignedUpCount: 0,
      messagesSentCount: 0,
      joinedAt: ts,
      updatedAt: ts,
    });
  });

  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  const creatorDb = testEnv.authenticatedContext(CREATOR_UID).firestore();

  // Admin can promote PARTICIPANT to ADMIN (creating multiple admins)
  await assertSucceeds(
    adminDb.collection("groups").doc(GROUP_ID).collection("members").doc(ADMIN2_UID).update({
      role: "ADMIN",
      updatedAt: pastTime(1000),
    })
  );

  // Admin CANNOT demote another ADMIN
  await assertFails(
    adminDb.collection("groups").doc(GROUP_ID).collection("members").doc(ADMIN2_UID).update({
      role: "PARTICIPANT",
      updatedAt: pastTime(500),
    })
  );

  // Admin CANNOT touch CREATOR's role
  await assertFails(
    adminDb.collection("groups").doc(GROUP_ID).collection("members").doc(CREATOR_UID).update({
      role: "PARTICIPANT",
      updatedAt: pastTime(500),
    })
  );

  // Group Creator HAS full control and CAN demote ADMIN2 back to ORGANIZER
  await assertSucceeds(
    creatorDb.collection("groups").doc(GROUP_ID).collection("members").doc(ADMIN2_UID).update({
      role: "ORGANIZER",
      updatedAt: pastTime(500),
    })
  );
});

test("Calendar events & task sign-ups enforce roles and slot capacity", async () => {
  await seedBaseGroup();
  const orgDb = testEnv.authenticatedContext(ORGANIZER_UID).firestore();
  const partDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  const ts = pastTime(5000);

  // Participant cannot create event
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("events").doc(EVENT_ID).set({
      title: "Rogue Event",
      description: "Desc",
      location: "Hall A",
      category: "Logistics",
      startEpochMs: Date.now() + 3600000,
      endEpochMs: Date.now() + 7200000,
      createdBy: PARTICIPANT_UID,
      organizerName: "Pat",
      createdAt: ts,
      updatedAt: ts,
    })
  );

  // Organizer creates event and task with capacity = 1
  await assertSucceeds(
    orgDb.collection("groups").doc(GROUP_ID).collection("events").doc(EVENT_ID).set({
      title: "Opening Keynote",
      description: "Main hall setup",
      location: "Main Auditorium",
      category: "Keynote",
      startEpochMs: Date.now() + 3600000,
      endEpochMs: Date.now() + 7200000,
      createdBy: ORGANIZER_UID,
      organizerName: "Omar Organizer",
      createdAt: ts,
      updatedAt: ts,
    })
  );

  await assertSucceeds(
    orgDb.collection("groups").doc(GROUP_ID).collection("events").doc(EVENT_ID).collection("tasks").doc(TASK_ID).set({
      eventId: EVENT_ID,
      title: "Badge Scanner",
      description: "Scan attendees at Gate A",
      deadlineEpochMs: Date.now() + 3000000,
      capacity: 1,
      assignedCount: 0,
      assignedUids: [],
      assignedNames: [],
      status: "OPEN",
      createdBy: ORGANIZER_UID,
      createdAt: ts,
      updatedAt: ts,
    })
  );

  // Participant signs up for task slot -> FILLED
  await assertSucceeds(
    partDb.collection("groups").doc(GROUP_ID).collection("events").doc(EVENT_ID).collection("tasks").doc(TASK_ID).update({
      assignedUids: [PARTICIPANT_UID],
      assignedNames: ["Pat Participant"],
      assignedCount: 1,
      status: "FILLED",
      updatedAt: pastTime(1000),
    })
  );

  // Another member cannot exceed capacity = 1
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await assertFails(
    adminDb.collection("groups").doc(GROUP_ID).collection("events").doc(EVENT_ID).collection("tasks").doc(TASK_ID).update({
      assignedUids: [PARTICIPANT_UID, ADMIN_UID],
      assignedNames: ["Pat Participant", "Alex Admin"],
      assignedCount: 2,
      status: "FILLED",
      updatedAt: pastTime(500),
    })
  );

  // Participant leaves slot -> OPEN
  await assertSucceeds(
    partDb.collection("groups").doc(GROUP_ID).collection("events").doc(EVENT_ID).collection("tasks").doc(TASK_ID).update({
      assignedUids: [],
      assignedNames: [],
      assignedCount: 0,
      status: "OPEN",
      updatedAt: pastTime(200),
    })
  );
});

test("Role-based chat channels & messages enforce accessLevel isolation", async () => {
  await seedBaseGroup();
  const ts = pastTime(5000);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const chRef = ctx.firestore().collection("groups").doc(GROUP_ID).collection("channels");
    await chRef.doc(CH_ALL_ID).set({
      name: "General",
      description: "Everyone",
      accessLevel: "ALL",
      createdBy: CREATOR_UID,
      messageCount: 0,
      createdAt: ts,
      updatedAt: ts,
    });
    await chRef.doc(CH_ORG_ID).set({
      name: "Stage Leads",
      description: "Organizers & Admins",
      accessLevel: "ORGANIZER",
      createdBy: CREATOR_UID,
      messageCount: 0,
      createdAt: ts,
      updatedAt: ts,
    });
    await chRef.doc(CH_ADMIN_ID).set({
      name: "Admin War Room",
      description: "Admins & Creator only",
      accessLevel: "ADMIN",
      createdBy: CREATOR_UID,
      messageCount: 0,
      createdAt: ts,
      updatedAt: ts,
    });
  });

  const partDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  const orgDb = testEnv.authenticatedContext(ORGANIZER_UID).firestore();
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();

  // Participant filtered query for ["ALL"] succeeds; ["ALL", "ADMIN"] or unfiltered fails
  await assertSucceeds(
    partDb.collection("groups").doc(GROUP_ID).collection("channels").where("accessLevel", "in", ["ALL"]).get()
  );
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("channels").where("accessLevel", "in", ["ALL", "ADMIN"]).get()
  );
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("channels").get()
  );

  // Participant cannot read or send in ORGANIZER or ADMIN channels
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ORG_ID).collection("messages").get()
  );
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ADMIN_ID).collection("messages").doc("m1").set({
      channelId: CH_ADMIN_ID,
      senderId: PARTICIPANT_UID,
      senderName: "Pat",
      senderRole: "PARTICIPANT",
      text: "Hello?",
      messageType: "TEXT",
      createdAt: pastTime(1000),
    })
  );

  // Organizer can list ["ALL", "ORGANIZER"] and message CH_ORG_ID, but not CH_ADMIN_ID
  await assertSucceeds(
    orgDb.collection("groups").doc(GROUP_ID).collection("channels").where("accessLevel", "in", ["ALL", "ORGANIZER"]).get()
  );
  await assertSucceeds(
    orgDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ORG_ID).collection("messages").doc("m2").set({
      channelId: CH_ORG_ID,
      senderId: ORGANIZER_UID,
      senderName: "Omar",
      senderRole: "ORGANIZER",
      text: "Check-in desks ready",
      messageType: "TEXT",
      createdAt: pastTime(1000),
    })
  );
  await assertFails(
    orgDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ADMIN_ID).collection("messages").get()
  );

  // Admin can list all three levels and message CH_ADMIN_ID
  await assertSucceeds(
    adminDb.collection("groups").doc(GROUP_ID).collection("channels").where("accessLevel", "in", ["ALL", "ORGANIZER", "ADMIN"]).get()
  );
  await assertSucceeds(
    adminDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ADMIN_ID).collection("messages").doc("m3").set({
      channelId: CH_ADMIN_ID,
      senderId: ADMIN_UID,
      senderName: "Alex",
      senderRole: "ADMIN",
      text: "Security cleared",
      messageType: "ANNOUNCEMENT",
      createdAt: pastTime(1000),
    })
  );
});

test("Targeted notifications enforce Admin broadcast vs Organizer task update rules", async () => {
  await seedBaseGroup();
  const partDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  const orgDb = testEnv.authenticatedContext(ORGANIZER_UID).firestore();
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();

  // Organizer CANNOT send an immediately APPROVED global ANNOUNCEMENT (must be PENDING + ADMIN target)
  await assertFails(
    orgDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n1").set({
      title: "Global Alert",
      body: "Everyone listen",
      notificationType: "ANNOUNCEMENT",
      targetScope: "ALL",
      targetRole: "ALL",
      approvalStatus: "APPROVED",
      senderId: ORGANIZER_UID,
      senderName: "Omar",
      createdAt: pastTime(1000),
    })
  );

  // Organizer CAN send TASK_UPDATE to a channel/group
  await assertSucceeds(
    orgDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n2").set({
      title: "Shift Update",
      body: "Gate A needs 2 more volunteers",
      notificationType: "TASK_UPDATE",
      targetScope: "CHANNEL",
      targetRole: "ALL",
      targetChannelId: CH_ALL_ID,
      targetChannelName: "General",
      senderId: ORGANIZER_UID,
      senderName: "Omar",
      createdAt: pastTime(1000),
    })
  );

  // Admin CAN send ANNOUNCEMENT to ALL
  await assertSucceeds(
    adminDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n3").set({
      title: "Schedule Shift",
      body: "Keynote moved to Hall B",
      notificationType: "ANNOUNCEMENT",
      targetScope: "ALL",
      targetRole: "ALL",
      senderId: ADMIN_UID,
      senderName: "Alex",
      createdAt: pastTime(1000),
    })
  );

  // Participant can query notifications targeting ["ALL", "PARTICIPANT"], cannot query ["ADMIN"]
  await assertSucceeds(
    partDb.collection("groups").doc(GROUP_ID).collection("notifications").where("targetRole", "in", ["ALL", "PARTICIPANT"]).get()
  );
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("notifications").where("targetRole", "in", ["ADMIN"]).get()
  );
});

test("Email spoofing guard: unverified admin email token is rejected on /admins", async () => {
  const spoofedDb = testEnv.authenticatedContext("spoof_uid", {
    email: "isaiahhuber2002@gmail.com",
    email_verified: false,
  }).firestore();
  await assertFails(spoofedDb.collection("admins").get());

  const verifiedDb = testEnv.authenticatedContext("real_admin_uid", {
    email: "isaiahhuber2002@gmail.com",
    email_verified: true,
  }).firestore();
  await assertSucceeds(verifiedDb.collection("admins").get());
});

test("Only Admin or Creator can delete messages and announcements/notifications", async () => {
  await seedBaseGroup();
  const ts = pastTime(5000);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const grp = ctx.firestore().collection("groups").doc(GROUP_ID);
    await grp.collection("channels").doc(CH_ALL_ID).set({
      name: "General",
      description: "Everyone",
      accessLevel: "ALL",
      createdBy: CREATOR_UID,
      messageCount: 2,
      createdAt: ts,
      updatedAt: ts,
    });
    await grp.collection("channels").doc(CH_ALL_ID).collection("messages").doc("m_part").set({
      channelId: CH_ALL_ID,
      senderId: PARTICIPANT_UID,
      senderName: "Pat Participant",
      senderRole: "PARTICIPANT",
      text: "Participant message",
      messageType: "TEXT",
      createdAt: ts,
    });
    await grp.collection("channels").doc(CH_ALL_ID).collection("messages").doc("m_org").set({
      channelId: CH_ALL_ID,
      senderId: ORGANIZER_UID,
      senderName: "Omar Organizer",
      senderRole: "ORGANIZER",
      text: "Organizer message",
      messageType: "TEXT",
      createdAt: ts,
    });
    await grp.collection("notifications").doc("n_org").set({
      title: "Task Update",
      body: "Updated shift",
      notificationType: "TASK_UPDATE",
      targetScope: "ALL",
      targetRole: "ALL",
      senderId: ORGANIZER_UID,
      senderName: "Omar Organizer",
      createdAt: ts,
    });
    await grp.collection("notifications").doc("n_admin").set({
      title: "Announcement",
      body: "Main stage opens at 9 AM",
      notificationType: "ANNOUNCEMENT",
      targetScope: "ALL",
      targetRole: "ALL",
      senderId: ADMIN_UID,
      senderName: "Alex Admin",
      createdAt: ts,
    });
  });

  const partDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  const orgDb = testEnv.authenticatedContext(ORGANIZER_UID).firestore();
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  const creatorDb = testEnv.authenticatedContext(CREATOR_UID).firestore();

  // Participant & Organizer CANNOT delete even their own messages or notifications
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ALL_ID).collection("messages").doc("m_part").delete()
  );
  await assertFails(
    orgDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ALL_ID).collection("messages").doc("m_org").delete()
  );
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_admin").delete()
  );
  await assertFails(
    orgDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_org").delete()
  );

  // Admin CAN delete messages and announcements/notifications
  await assertSucceeds(
    adminDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ALL_ID).collection("messages").doc("m_part").delete()
  );
  await assertSucceeds(
    adminDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_org").delete()
  );

  // Creator CAN also delete messages and announcements/notifications
  await assertSucceeds(
    creatorDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ALL_ID).collection("messages").doc("m_org").delete()
  );
  await assertSucceeds(
    creatorDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_admin").delete()
  );
});

test("Admin and Creator can edit groups and group codes while Organizer and Participant cannot", async () => {
  await seedBaseGroup();
  const partDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  const orgDb = testEnv.authenticatedContext(ORGANIZER_UID).firestore();
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();
  const creatorDb = testEnv.authenticatedContext(CREATOR_UID).firestore();

  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).update({
      name: "Participant Edit",
      updatedAt: pastTime(1000),
    })
  );
  await assertFails(
    orgDb.collection("groups").doc(GROUP_ID).update({
      name: "Organizer Edit",
      updatedAt: pastTime(1000),
    })
  );

  // Admin CAN edit group name, description, and code
  await assertSucceeds(
    adminDb.collection("groups").doc(GROUP_ID).update({
      name: "Summit Edited By Admin",
      description: "Updated by admin",
      groupCode: "ADMIN26",
      updatedAt: pastTime(900),
    })
  );
  await assertSucceeds(
    adminDb.collection("groupCodes").doc("ADMIN26").set({
      groupId: GROUP_ID,
      groupName: "Summit Edited By Admin",
      createdBy: ADMIN_UID,
      active: true,
      createdAt: pastTime(900),
      updatedAt: pastTime(900),
    })
  );

  // Admin CANNOT delete the group itself (Creator-only)
  await assertFails(adminDb.collection("groups").doc(GROUP_ID).delete());

  // Creator CAN edit and delete
  await assertSucceeds(
    creatorDb.collection("groups").doc(GROUP_ID).update({
      name: "Summit Final",
      updatedAt: pastTime(500),
    })
  );
});

test("Editing messages and announcements/notifications enforces ownership and RBAC", async () => {
  await seedBaseGroup();
  const ts = pastTime(5000);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const grp = ctx.firestore().collection("groups").doc(GROUP_ID);
    await grp.collection("channels").doc(CH_ALL_ID).set({
      name: "General",
      description: "Everyone",
      accessLevel: "ALL",
      createdBy: CREATOR_UID,
      messageCount: 1,
      createdAt: ts,
      updatedAt: ts,
    });
    await grp.collection("channels").doc(CH_ALL_ID).collection("messages").doc("m_part").set({
      channelId: CH_ALL_ID,
      senderId: PARTICIPANT_UID,
      senderName: "Pat Participant",
      senderRole: "PARTICIPANT",
      text: "Original text",
      messageType: "TEXT",
      createdAt: ts,
    });
    await grp.collection("notifications").doc("n_org").set({
      title: "Shift Update",
      body: "Starts at 2pm",
      notificationType: "TASK_UPDATE",
      targetScope: "ALL",
      targetRole: "ALL",
      senderId: ORGANIZER_UID,
      senderName: "Omar Organizer",
      createdAt: ts,
    });
    await grp.collection("notifications").doc("n_admin").set({
      title: "Admin Announcement",
      body: "Original body",
      notificationType: "ANNOUNCEMENT",
      targetScope: "ALL",
      targetRole: "ALL",
      senderId: ADMIN_UID,
      senderName: "Alex Admin",
      createdAt: ts,
    });
  });

  const partDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  const orgDb = testEnv.authenticatedContext(ORGANIZER_UID).firestore();
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();

  // Sender can edit own message text; Organizer cannot edit someone else's message; Admin can edit any message
  await assertSucceeds(
    partDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ALL_ID).collection("messages").doc("m_part").update({
      text: "Edited by Pat",
      updatedAt: pastTime(1000),
    })
  );
  await assertFails(
    orgDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ALL_ID).collection("messages").doc("m_part").update({
      text: "Edited by Org",
      updatedAt: pastTime(900),
    })
  );
  await assertSucceeds(
    adminDb.collection("groups").doc(GROUP_ID).collection("channels").doc(CH_ALL_ID).collection("messages").doc("m_part").update({
      text: "Moderated by Admin",
      updatedAt: pastTime(800),
    })
  );

  // Organizer can edit TASK_UPDATE title/body/scheduledForEpochMs, cannot edit ANNOUNCEMENT
  await assertSucceeds(
    orgDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_org").update({
      title: "Shift Time Moved",
      body: "Starts at 3pm",
      scheduledForEpochMs: Date.now() + 7200000,
      updatedAt: pastTime(700),
    })
  );
  await assertFails(
    orgDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_admin").update({
      body: "Hacked announcement",
      updatedAt: pastTime(600),
    })
  );

  // Participant cannot edit notifications
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_org").update({
      body: "Nope",
      updatedAt: pastTime(500),
    })
  );

  // Admin can edit announcements
  await assertSucceeds(
    adminDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_admin").update({
      title: "Updated Announcement",
      body: "New date and time",
      scheduledForEpochMs: Date.now() + 3600000,
      updatedAt: pastTime(400),
    })
  );
});

test("Regular members can message and submit PENDING announcements, but only Admin can approve them to post", async () => {
  await seedBaseGroup();
  const partDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  const orgDb = testEnv.authenticatedContext(ORGANIZER_UID).firestore();
  const adminDb = testEnv.authenticatedContext(ADMIN_UID).firestore();

  // Participant CANNOT create channels or events or TASK_UPDATE alerts
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("channels").doc("ch_part").set({
      name: "Member Channel",
      description: "Desc",
      accessLevel: "ALL",
      createdBy: PARTICIPANT_UID,
      messageCount: 0,
      createdAt: pastTime(2000),
      updatedAt: pastTime(2000),
    })
  );
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_task_fail").set({
      title: "Task Alert",
      body: "Unauthorized task update",
      notificationType: "TASK_UPDATE",
      targetScope: "ALL",
      targetRole: "ALL",
      approvalStatus: "APPROVED",
      senderId: PARTICIPANT_UID,
      senderName: "Pat",
      createdAt: pastTime(2000),
    })
  );

  // Participant CANNOT post an APPROVED announcement directly
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_ann_direct").set({
      title: "Direct Announcement",
      body: "Should fail",
      notificationType: "ANNOUNCEMENT",
      targetScope: "ALL",
      targetRole: "ALL",
      approvalStatus: "APPROVED",
      senderId: PARTICIPANT_UID,
      senderName: "Pat",
      createdAt: pastTime(2000),
    })
  );

  // Participant CAN submit an ANNOUNCEMENT as PENDING (gated to ADMIN queue)
  await assertSucceeds(
    partDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_ann_pending").set({
      title: "Carpool Leaving Early",
      body: "Van B leaves from Gate 2 at 5pm",
      notificationType: "ANNOUNCEMENT",
      targetScope: "ALL",
      targetRole: "ADMIN",
      approvalStatus: "PENDING",
      senderId: PARTICIPANT_UID,
      senderName: "Pat Participant",
      createdAt: pastTime(1500),
    })
  );

  // Author can view own pending submission via senderId query, but Organizer CANNOT see or approve it
  await assertSucceeds(
    partDb.collection("groups").doc(GROUP_ID).collection("notifications").where("senderId", "==", PARTICIPANT_UID).get()
  );
  await assertFails(
    orgDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_ann_pending").get()
  );
  await assertFails(
    partDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_ann_pending").update({
      approvalStatus: "APPROVED",
      targetRole: "ALL",
      updatedAt: pastTime(1000),
    })
  );
  await assertFails(
    orgDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_ann_pending").update({
      approvalStatus: "APPROVED",
      targetRole: "ALL",
      updatedAt: pastTime(1000),
    })
  );

  // Admin CAN approve and publish it to ALL members
  await assertSucceeds(
    adminDb.collection("groups").doc(GROUP_ID).collection("notifications").doc("n_ann_pending").update({
      approvalStatus: "APPROVED",
      targetRole: "ALL",
      updatedAt: pastTime(500),
    })
  );

  // Once approved, regular members can read it in the group feed
  await assertSucceeds(
    partDb.collection("groups").doc(GROUP_ID).collection("notifications").where("targetRole", "in", ["ALL", "PARTICIPANT"]).get()
  );
});

test("Joined participant can view Creator/Admins in members roster and update own displayName on re-join", async () => {
  await seedBaseGroup();
  const partDb = testEnv.authenticatedContext(PARTICIPANT_UID).firestore();
  const ts = pastTime(2000);

  await assertSucceeds(
    partDb.collection("users").doc(PARTICIPANT_UID).collection("joinedGroups").doc(GROUP_ID).set({
      groupId: GROUP_ID,
      groupName: "Annual Summit 2026",
      groupCode: GROUP_CODE,
      role: "PARTICIPANT",
      joinedAt: ts,
      updatedAt: ts,
    })
  );

  // Joined participant can list members and see CREATOR & ADMIN
  const membersSnap = await assertSucceeds(
    partDb.collection("groups").doc(GROUP_ID).collection("members").get()
  );
  const rolesByUid = Object.fromEntries(membersSnap.docs.map((d) => [d.id, d.data().role]));
  if (rolesByUid[CREATOR_UID] !== "CREATOR" || rolesByUid[ADMIN_UID] !== "ADMIN") {
    throw new Error(`Expected CREATOR and ADMIN in roster, got: ${JSON.stringify(rolesByUid)}`);
  }

  // Re-joining with a new displayName via batch update succeeds
  const rejoinBatch = partDb.batch();
  rejoinBatch.update(partDb.collection("groups").doc(GROUP_ID).collection("members").doc(PARTICIPANT_UID), {
    displayName: "Patty Custom",
    updatedAt: pastTime(500),
  });
  rejoinBatch.update(partDb.collection("users").doc(PARTICIPANT_UID).collection("joinedGroups").doc(GROUP_ID), {
    groupName: "Annual Summit 2026",
    groupCode: GROUP_CODE,
    role: "PARTICIPANT",
    updatedAt: pastTime(500),
  });
  await assertSucceeds(rejoinBatch.commit());
});
