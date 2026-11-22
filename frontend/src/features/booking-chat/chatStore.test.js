import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAT_STORAGE_KEY,
  CHAT_MIGRATED_KEY,
  getOrCreateConversation,
  sendMessage,
  getMessages,
  listForVendor,
  listForCustomer,
  markRead,
  unreadCountForVendor,
  unreadCountForCustomer,
  migrateChatData,
  resolveVendorUsername,
  saveAllConversations,
  loadAllConversations
} from './chatStore.js';
import { containsContactInfo } from '../../shared/utils/contactGuard.js';

// Setup mock storage for Node environment if localStorage is not present
const mockStorage = new Map();
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (key) => mockStorage.get(key) || null,
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
    get length() { return mockStorage.size; },
    key: (i) => Array.from(mockStorage.keys())[i] || null
  };
}

describe('UstavOne Chat & Conversation Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    // Pre-populate mock vendors so resolveVendorUsername can find owner
    localStorage.setItem('vedika_vendors', JSON.stringify([
      { username: 'sri_convention', name: 'Sri Convention Admin' },
      { username: 'svpc_halls', name: 'SVPC Admin' },
      { username: 'sai_halls', name: 'Sai Halls Admin' }
    ]));
    localStorage.setItem('vedika_branches_sri_convention', JSON.stringify([
      { id: 'branch-bvr-hall', name: 'BVR Sri Convention', type: 'hall', city: 'Rajahmundry' }
    ]));
    localStorage.setItem('vedika_branches_svpc_halls', JSON.stringify([
      { id: 'branch-svpc-hall', name: 'SVPC Function Hall', type: 'hall', city: 'Rajahmundry' }
    ]));
  });

  test('1. Customer A sends message to BVR Sri Convention -> routed strictly to sri_convention', () => {
    const customerA = { phone: '9390075877', name: 'D L Narasimha sai' };
    const branch = {
      id: 'branch-bvr-hall',
      branchId: 'branch-bvr-hall',
      name: 'BVR Sri Convention',
      vendorUsername: 'sri_convention',
      type: 'hall'
    };

    const conv = getOrCreateConversation(customerA, branch);
    assert.equal(conv.vendorUsername, 'sri_convention');
    assert.equal(conv.id, '9390075877__branch-bvr-hall');

    const result = sendMessage(conv.id, 'customer', 'Is 25 December available for 600 guests?', 'c_test_1');
    assert.equal(result.message.sender, 'customer');
    assert.equal(result.message.text, 'Is 25 December available for 600 guests?');

    // Vendor sri_convention sees it
    const sriList = listForVendor('sri_convention');
    assert.equal(sriList.length, 1);
    assert.equal(sriList[0].customerName, 'D L Narasimha sai');
    assert.equal(sriList[0].unreadCount, 1);
    assert.equal(unreadCountForVendor('sri_convention'), 1);

    // Other vendors (svpc_halls, sai_halls) do NOT see it
    const svpcList = listForVendor('svpc_halls');
    assert.equal(svpcList.length, 0);
    assert.equal(unreadCountForVendor('svpc_halls'), 0);

    const saiList = listForVendor('sai_halls');
    assert.equal(saiList.length, 0);
    assert.equal(unreadCountForVendor('sai_halls'), 0);
  });

  test('2. Customer B sends to same hall -> separate conversation, no crosstalk', () => {
    const customerA = { phone: '9390075877', name: 'D L Narasimha sai' };
    const customerB = { phone: '6305729847', name: 'K V Chanikya' };
    const branch = {
      id: 'branch-bvr-hall',
      branchId: 'branch-bvr-hall',
      name: 'BVR Sri Convention',
      vendorUsername: 'sri_convention',
      type: 'hall'
    };

    const convA = getOrCreateConversation(customerA, branch);
    sendMessage(convA.id, 'customer', 'Message from Customer A', 'c_a_1');

    const convB = getOrCreateConversation(customerB, branch);
    sendMessage(convB.id, 'customer', 'Message from Customer B', 'c_b_1');

    assert.notEqual(convA.id, convB.id);

    const msgsA = getMessages(convA.id);
    const msgsB = getMessages(convB.id);
    assert.equal(msgsA.length, 1);
    assert.equal(msgsA[0].text, 'Message from Customer A');
    assert.equal(msgsB.length, 1);
    assert.equal(msgsB[0].text, 'Message from Customer B');

    // Vendor sees 2 separate conversations and 2 unread count
    const sriList = listForVendor('sri_convention');
    assert.equal(sriList.length, 2);
    assert.equal(unreadCountForVendor('sri_convention'), 2);
  });

  test('3. Vendor replies -> customer sees reply, read receipts update cleanly', () => {
    const customerA = { phone: '9390075877', name: 'D L Narasimha sai' };
    const branch = {
      id: 'branch-bvr-hall',
      branchId: 'branch-bvr-hall',
      name: 'BVR Sri Convention',
      vendorUsername: 'sri_convention',
      type: 'hall'
    };

    const conv = getOrCreateConversation(customerA, branch);
    sendMessage(conv.id, 'customer', 'Hello, looking for availability', 'msg_c1');

    // Vendor marks as read
    markRead(conv.id, 'vendor');
    assert.equal(unreadCountForVendor('sri_convention'), 0);

    // Vendor replies
    sendMessage(conv.id, 'vendor', 'Yes, 25 December is currently open!', 'msg_v1');

    // Customer side checks
    assert.equal(unreadCountForCustomer('9390075877', 'branch-bvr-hall'), 1);
    const custConvs = listForCustomer('9390075877');
    assert.equal(custConvs.length, 1);
    assert.equal(custConvs[0].unreadCount, 1);

    // Customer opens chat & marks read
    markRead(conv.id, 'customer');
    assert.equal(unreadCountForCustomer('9390075877', 'branch-bvr-hall'), 0);
  });

  test('4. Message sending is idempotent by clientId', () => {
    const customerA = { phone: '9390075877', name: 'D L Narasimha sai' };
    const branch = { id: 'branch-bvr-hall', name: 'BVR Sri Convention', vendorUsername: 'sri_convention' };
    const conv = getOrCreateConversation(customerA, branch);

    const first = sendMessage(conv.id, 'customer', 'Test idempotency', 'client_id_fixed_123');
    assert.equal(first.duplicate, false);

    const second = sendMessage(conv.id, 'customer', 'Test idempotency', 'client_id_fixed_123');
    assert.equal(second.duplicate, true);
    assert.equal(second.message.id, first.message.id);

    const msgs = getMessages(conv.id);
    assert.equal(msgs.length, 1);
  });

  test('5. Vendor with no conversations has unread count 0', () => {
    assert.equal(unreadCountForVendor('svpc_halls'), 0);
    assert.deepEqual(listForVendor('svpc_halls'), []);
  });

  test('6. Contact guard blocks leaks and allows valid inquiries', () => {
    // Blocked cases
    assert.equal(containsContactInfo('Call me on 9390075877').blocked, true);
    assert.equal(containsContactInfo('My email is test@example.com').blocked, true);
    assert.equal(containsContactInfo('Visit https://instagram.com/myhall').blocked, true);
    assert.equal(containsContactInfo('ping me on 9 3 9 0 0 7 5 8 7 7').blocked, true);

    // Allowed event queries
    assert.equal(containsContactInfo('Our guest count is around 600').blocked, false);
    assert.equal(containsContactInfo('Is 25 December available?').blocked, false);
    assert.equal(containsContactInfo('What is the per plate cost for south indian buffet?').blocked, false);
    assert.equal(containsContactInfo('Can we bring our own decorators?').blocked, false);
  });

  test('7. Migration converts old keys and drops fake seeded threads', () => {
    localStorage.removeItem(CHAT_MIGRATED_KEY);

    // Fake seeded thread that should be dropped
    const fakeThread = {
      id: 'chat_sai_halls_1',
      vendorUsername: 'sai_halls',
      customerName: 'Pooja Reddy',
      customerPhone: '9848012345',
      messages: [{ id: 'm1', text: 'Welcome to Sai Function Hall!', sender: 'vendor' }]
    };
    // Real thread that should be migrated
    const realThread = {
      id: 'chat_real_custom_99',
      vendorUsername: 'sri_convention',
      customerName: 'K V Chanikya',
      customerPhone: '6305729847',
      branchId: 'branch-bvr-hall',
      branchName: 'BVR Sri Convention',
      messages: [{ id: 'real_m_1', text: 'Real inquiry from Chanikya', sender: 'customer', createdAt: new Date().toISOString() }]
    };

    localStorage.setItem('vedika_vendor_chats_sri_convention', JSON.stringify([fakeThread, realThread]));

    migrateChatData();

    assert.equal(localStorage.getItem(CHAT_MIGRATED_KEY), '1');
    const migrated = loadAllConversations();
    assert.equal(migrated.some(c => c.id.includes('chat_sai_halls_1')), false);

    const migratedReal = migrated.find(c => c.id === '6305729847__branch-bvr-hall');
    assert.ok(migratedReal);
    assert.equal(migratedReal.messages.length, 1);
    assert.equal(migratedReal.messages[0].text, 'Real inquiry from Chanikya');
  });

  test('8. Demo listing without vendor allows sending and persistence', () => {
    const customer = { phone: '9390075877', name: 'D L Narasimha sai' };
    const demoBranch = { id: 'demo-hall-999', name: 'Demo Grand Hall' }; // No owner

    const conv = getOrCreateConversation(customer, demoBranch);
    assert.equal(conv.vendorUsername, null);

    sendMessage(conv.id, 'customer', 'Checking out demo hall', 'demo_client_1');
    const msgs = getMessages(conv.id);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].text, 'Checking out demo hall');

    const custConvs = listForCustomer('9390075877');
    assert.ok(custConvs.some(c => c.branchId === 'demo-hall-999'));
  });
});
