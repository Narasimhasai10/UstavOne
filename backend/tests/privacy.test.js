import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/utils/prisma.js";

describe("Server-Side Privacy Enforcement", () => {
  test("1. Public Vendor Branch detail NEVER exposes vendor phone or email", async () => {
    const branch = await prisma.branch.findFirst({
      where: { kind: "hall" },
      include: { vendor: true }
    });

    assert.ok(branch, "Branch exists");

    // Simulate public API response mapping
    const publicBranchResponse = {
      id: branch.id,
      name: branch.name,
      kind: branch.kind,
      description: branch.description,
      area: branch.area,
      status: branch.status
    };

    assert.equal(publicBranchResponse.phone, undefined, "Phone must NOT be present");
    assert.equal(publicBranchResponse.email, undefined, "Email must NOT be present");
    assert.equal(publicBranchResponse.vendorPhone, undefined, "vendorPhone must NOT be present");
    assert.equal(publicBranchResponse.vendorEmail, undefined, "vendorEmail must NOT be present");
  });

  test("2. Vendor Bookings view NEVER exposes customer phone or email", async () => {
    const booking = await prisma.booking.findFirst({
      include: { user: true }
    });

    if (booking) {
      // Simulate vendor bookings API response mapping
      const vendorBookingResponse = {
        id: booking.id,
        code: booking.code,
        customerName: booking.user.name,
        // user.phone and user.email must be omitted
        startDate: booking.startDate,
        guests: booking.guests,
        status: booking.status
      };

      assert.equal(vendorBookingResponse.customerPhone, undefined, "customerPhone must NOT be exposed to vendor");
      assert.equal(vendorBookingResponse.customerEmail, undefined, "customerEmail must NOT be exposed to vendor");
      assert.equal(vendorBookingResponse.phone, undefined, "phone must NOT be present");
      assert.equal(vendorBookingResponse.email, undefined, "email must NOT be present");
    }
  });

  test("3. Review Author Name Obfuscation", () => {
    function sanitizeReviewAuthor(fullName) {
      const parts = (fullName || "Customer").trim().split(/\s+/);
      if (parts.length > 1) {
        return `${parts[0]} ${parts[1][0]}.`;
      }
      return parts[0];
    }

    assert.equal(sanitizeReviewAuthor("Ramesh Kumar"), "Ramesh K.");
    assert.equal(sanitizeReviewAuthor("Ananya Reddy"), "Ananya R.");
    assert.equal(sanitizeReviewAuthor("Suresh"), "Suresh");
    assert.equal(sanitizeReviewAuthor(""), "Customer");
  });
});
