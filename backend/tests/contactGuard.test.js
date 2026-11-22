import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { containsContactInfo } from "../src/modules/chat-calls/contactGuard.middleware.js";

describe("ContactGuard Middleware - Privacy Protection", () => {
  const blockedCases = [
    // 10-digit phone numbers in varied formats
    { input: "Call me at 9849012345", reason: "Standard 10-digit phone" },
    { input: "My number is +91 9390075877", reason: "+91 phone" },
    { input: "Reach out on 98490 12345", reason: "Spaced 5+5 phone" },
    { input: "Phone: 984-901-2345", reason: "Hyphenated phone" },
    { input: "Call (+91) 9849012345 please", reason: "Parenthesized code phone" },
    { input: "Phone no is 8765432109", reason: "8-prefix mobile" },
    { input: "Mobile: 7980123456", reason: "7-prefix mobile" },
    { input: "Reach me at 6281234567", reason: "6-prefix mobile" },

    // Spelled-out numbers and mixed tokens
    { input: "nine eight four nine zero one two three four five", reason: "Spelled out English numbers" },
    { input: "nine 8 four nine 0 1 2 3 4 5", reason: "Mixed words and digits" },
    { input: "nau aath chaar nau shunya ek do teen chaar paanch", reason: "Transliterated numbers" },

    // WhatsApp intents
    { input: "Please message me on whatsapp", reason: "Explicit WhatsApp" },
    { input: "Check your wa for photos", reason: "WA keyword" },
    { input: "Ping me on whatsapp for quotation", reason: "Ping on WhatsApp" },
    { input: "Whatsapp me the menu directly", reason: "Direct WA request" },

    // UPI IDs
    { input: "Send token advance to sai@oksbi", reason: "SBI UPI" },
    { input: "Pay to vendor.catering@ybl", reason: "YBL UPI" },
    { input: "My payment ID is book@okhdfcbank", reason: "HDFC UPI" },
    { input: "Use upi: booking@paytm", reason: "Paytm UPI" },
    { input: "Send 500 to myname@upi", reason: "General UPI" },

    // External links and socials
    { input: "View our portfolio at instagram.com/saihalls", reason: "Instagram link" },
    { input: "Visit http://saiweddings.com for packages", reason: "HTTP URL" },
    { input: "Check www.grandcaterers.in", reason: "WWW URL" },
    { input: "wa.me/919849012345", reason: "WA link" }
  ];

  blockedCases.forEach(({ input, reason }) => {
    test(`Blocks: "${input}" (${reason})`, () => {
      const res = containsContactInfo(input);
      assert.equal(res.blocked, true, `Expected "${input}" to be blocked`);
      assert.ok(res.reason, "Must provide a violation reason");
    });
  });

  const allowedCases = [
    { input: "The function hall has 500 seats capacity", reason: "Capacity numbers" },
    { input: "Advance payment required is 50000 rupees", reason: "Advance amount" },
    { input: "Room number 102 is complimentary", reason: "Room number" },
    { input: "Event scheduled for 25th December", reason: "Date reference" },
    { input: "We require 600 plates of veg lunch", reason: "Plate quantity" },
    { input: "Dinner will start at 8 pm sharp", reason: "Time reference" },
    { input: "The package cost is 450000 total", reason: "Budget cost" },
    { input: "Can you provide banana leaf service?", reason: "Normal inquiry text" },
    { input: "We are expecting 350 to 400 guests", reason: "Guest range" }
  ];

  allowedCases.forEach(({ input, reason }) => {
    test(`Allows: "${input}" (${reason})`, () => {
      const res = containsContactInfo(input);
      assert.equal(res.blocked, false, `Expected "${input}" to be allowed`);
    });
  });
});
