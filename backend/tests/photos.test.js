import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Socket } from "node:net";
import { prisma } from "../src/utils/prisma.js";
import app from "../src/app.js";
import { signAccessToken } from "../src/utils/jwt.js";

// Helper 1x1 valid PNG buffer
const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Helper 1x1 valid JPEG buffer
const VALID_JPG_BUFFER = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

// Invalid file buffer (Fake PDF pretending to be JPG)
const FAKE_JPG_PDF_BUFFER = Buffer.from('%PDF-1.4 Fake PDF Content pretending to be an image', 'utf8');

/**
 * In-memory request runner executing Express app without TCP sockets (sandbox-compatible)
 */
function requestApp(appInstance, { method = "GET", url, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = { host: "localhost", ...headers };

    const res = new http.ServerResponse(req);
    res.assignSocket(socket);

    const chunks = [];
    res.write = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      return true;
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const resBuffer = Buffer.concat(chunks);
      const text = resBuffer.toString("utf8");
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        text,
        json
      });
    };

    appInstance(req, res);

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.push(body);
      } else if (typeof body === "string") {
        req.push(Buffer.from(body));
      } else {
        req.push(Buffer.from(JSON.stringify(body)));
      }
    }
    req.push(null);
  });
}

function createMultipartPayload(files = [], fields = {}) {
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }

  for (const f of files) {
    const fieldName = f.fieldName || "photos";
    const filename = f.filename || "image.png";
    const contentType = f.contentType || "image/png";
    const buffer = f.buffer;
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`));
    parts.push(buffer);
    parts.push(Buffer.from("\r\n"));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  return {
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "content-length": String(body.length)
    },
    body
  };
}

describe("Photo Endpoints & Security Checks", () => {
  let vendor1 = null;
  let vendor2 = null;
  let vendor1Token = "";
  let vendor2Token = "";
  let vendor1Branch = null;
  let vendor2Branch = null;

  before(async () => {
    // Get 2 vendors and their branches from seeded database
    const vendors = await prisma.user.findMany({
      where: { role: "vendor" },
      include: { branches: true },
      take: 2
    });

    assert.ok(vendors.length >= 2, "Requires at least 2 vendors in test database");
    vendor1 = vendors[0];
    vendor2 = vendors[1];
    vendor1Branch = vendor1.branches[0];
    vendor2Branch = vendor2.branches[0];

    vendor1Token = signAccessToken({ userId: vendor1.id, role: "vendor" });
    vendor2Token = signAccessToken({ userId: vendor2.id, role: "vendor" });
  });

  test("1. Ownership: Vendor A cannot upload photos to Vendor B's branch", async () => {
    const { headers, body } = createMultipartPayload([
      { fieldName: "photos", filename: "test-hall.png", contentType: "image/png", buffer: VALID_PNG_BUFFER }
    ]);

    const res = await requestApp(app, {
      method: "POST",
      url: `/api/v1/vendor/branches/${vendor2Branch.id}/photos`,
      headers: {
        authorization: `Bearer ${vendor1Token}`,
        ...headers
      },
      body
    });

    assert.equal(res.status, 403, "Must return 403 Forbidden when uploading to another vendor's branch");
    assert.ok(res.json?.error?.message);
    assert.match(res.json.error.message, /unauthorized|do not own/i);
  });

  test("2. Wrong File Type: Uploading non-image (PDF renamed .jpg) is rejected via magic bytes", async () => {
    const { headers, body } = createMultipartPayload([
      { fieldName: "photos", filename: "fake-photo.jpg", contentType: "image/jpeg", buffer: FAKE_JPG_PDF_BUFFER }
    ]);

    const res = await requestApp(app, {
      method: "POST",
      url: `/api/v1/vendor/branches/${vendor1Branch.id}/photos`,
      headers: {
        authorization: `Bearer ${vendor1Token}`,
        ...headers
      },
      body
    });

    assert.equal(res.status, 400, "Must return 400 Bad Request for invalid magic bytes");
    assert.ok(res.json?.error?.message);
    assert.match(res.json.error.message, /invalid file format|supported/i);
  });

  test("3. 12-Photo Limit: Uploading exceeding the 12-photo limit is rejected", async () => {
    // Clean branch photos to a known state of 11 photos
    await prisma.photo.deleteMany({ where: { branchId: vendor1Branch.id } });

    // Seed 11 photos
    for (let i = 0; i < 11; i++) {
      const fr = await prisma.fileRecord.create({
        data: {
          ownerId: vendor1.id,
          purpose: "photo",
          path: `/uploads/public/dummy-${i}.jpg`,
          mime: "image/jpeg",
          sizeBytes: 100,
          isPublic: true
        }
      });
      await prisma.photo.create({
        data: {
          branchId: vendor1Branch.id,
          fileId: fr.id,
          sortOrder: i,
          isCover: i === 0
        }
      });
    }

    // Try uploading 2 photos (11 + 2 = 13 > 12)
    const { headers, body } = createMultipartPayload([
      { fieldName: "photos", filename: "p1.png", contentType: "image/png", buffer: VALID_PNG_BUFFER },
      { fieldName: "photos", filename: "p2.png", contentType: "image/png", buffer: VALID_PNG_BUFFER }
    ]);

    const res = await requestApp(app, {
      method: "POST",
      url: `/api/v1/vendor/branches/${vendor1Branch.id}/photos`,
      headers: {
        authorization: `Bearer ${vendor1Token}`,
        ...headers
      },
      body
    });

    assert.equal(res.status, 400, "Must return 400 Bad Request when exceeding 12 photos");
    assert.ok(res.json?.error?.message);
    assert.match(res.json.error.message, /maximum 12 photos/i);
  });

  test("4. Successful upload, cover setting, and deletion with cover promotion", async () => {
    // Clear branch photos
    await prisma.photo.deleteMany({ where: { branchId: vendor1Branch.id } });
    await prisma.branch.update({ where: { id: vendor1Branch.id }, data: { coverPhotoId: null } });

    // Upload 2 valid photos
    const { headers, body } = createMultipartPayload([
      { fieldName: "photos", filename: "photo-one.png", contentType: "image/png", buffer: VALID_PNG_BUFFER },
      { fieldName: "photos", filename: "photo-two.jpg", contentType: "image/jpeg", buffer: VALID_JPG_BUFFER }
    ]);

    const res = await requestApp(app, {
      method: "POST",
      url: `/api/v1/vendor/branches/${vendor1Branch.id}/photos`,
      headers: {
        authorization: `Bearer ${vendor1Token}`,
        ...headers
      },
      body
    });

    assert.equal(res.status, 201, "Should successfully upload photos");
    assert.equal(res.json?.data?.length, 2);
    assert.equal(res.json.data[0].isCover, true, "First photo should automatically become cover");
    assert.ok(res.json.data[0].url.startsWith("/uploads/public/"), "Should return public /uploads/ URL");

    const photo1Id = res.json.data[0].id;
    const photo2Id = res.json.data[1].id;

    // Vendor 2 tries to delete Vendor 1's photo: test ownership on delete
    const forbiddenDelRes = await requestApp(app, {
      method: "DELETE",
      url: `/api/v1/vendor/photos/${photo1Id}`,
      headers: {
        authorization: `Bearer ${vendor2Token}`
      }
    });
    assert.equal(forbiddenDelRes.status, 403, "Vendor 2 cannot delete Vendor 1's photo");

    // Vendor 1 deletes photo 1 (which is cover)
    const delRes = await requestApp(app, {
      method: "DELETE",
      url: `/api/v1/vendor/photos/${photo1Id}`,
      headers: {
        authorization: `Bearer ${vendor1Token}`
      }
    });
    assert.equal(delRes.status, 200, "Should delete photo successfully");

    // Verify photo 2 was promoted to cover
    const remaining = await prisma.photo.findUnique({ where: { id: photo2Id } });
    assert.equal(remaining.isCover, true, "Remaining photo should be promoted to cover");
  });

  test("5. Public endpoints (GET /vendors and GET /vendors/:id) return photo URLs", async () => {
    // Check public detail
    const detailRes = await requestApp(app, {
      method: "GET",
      url: `/api/v1/vendors/${vendor1Branch.id}`
    });
    assert.equal(detailRes.status, 200);
    assert.ok(detailRes.json?.data?.photos?.length > 0, "Should have photos");
    assert.ok(detailRes.json.data.photos[0].url, "Photo must have usable url property");
    assert.ok(detailRes.json.data.coverPhotoUrl, "Branch must have coverPhotoUrl");

    // Check browse
    const browseRes = await requestApp(app, {
      method: "GET",
      url: "/api/v1/vendors?limit=10"
    });
    assert.equal(browseRes.status, 200);
    assert.ok(browseRes.json?.data?.length > 0);
    const target = browseRes.json.data.find(b => b.id === vendor1Branch.id);
    if (target) {
      assert.ok(target.coverPhotoUrl, "Browse item must include coverPhotoUrl");
      assert.ok(target.photos[0].url, "Browse item photos must include url");
    }
  });
});
