import { Router } from "express";
import path from "node:path";
import { prisma } from "../../utils/prisma.js";
import { requireAuth, requireRole } from "../auth-users-admin/auth.middleware.js";
import { revenueService } from "./revenue.service.js";
import { config } from "../../config.js";
import { storageAdapter } from "../../adapters/storage/index.js";
import { uploadPhoto, getMagicMime, ALLOWED_PHOTO_MIMES } from "./upload.middleware.js";

let sharp = null;
try {
  const sharpModule = await import('sharp');
  sharp = sharpModule.default || sharpModule;
} catch (e) {
  // sharp not available in environment; will fall back to original buffer
}

async function processImage(buffer, mime) {
  if (!sharp) return { buffer, mime };
  try {
    const processed = await sharp(buffer)
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { buffer: processed, mime: 'image/jpeg' };
  } catch (err) {
    return { buffer, mime };
  }
}

function handlePhotoUpload(req, res, next) {
  uploadPhoto.array('photos', config.maxBranchPhotos || 12)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: { message: `File exceeds the maximum size limit of ${Math.round((config.maxPhotoSizeBytes || 8 * 1024 * 1024) / (1024 * 1024))} MB.` }
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: { message: `Maximum ${config.maxBranchPhotos || 12} photos can be uploaded at a time.` }
        });
      }
      return res.status(400).json({ error: { message: err.message || 'File upload error.' } });
    }
    next();
  });
}

const router = Router();

// Restrict all vendor routes to vendor or admin
router.use(requireAuth, requireRole(["vendor", "admin"]));

// GET /api/v1/vendor/profile - Vendor profile
router.get("/profile", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        vendorProfile: true,
        branches: {
          include: {
            city: true,
            hallDetails: true,
            catererDetails: true,
            documents: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: { message: "Vendor not found" } });
    }

    res.json({
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        username: user.username,
        city: user.city,
        state: user.state,
        vendorProfile: user.vendorProfile,
        branches: user.branches.map(b => ({
          id: b.id,
          name: b.name,
          kind: b.kind,
          status: b.status,
          city: b.city.city,
          ratingAvg: b.ratingAvg,
          ratingCount: b.ratingCount,
          bookingsCount: b.bookingsCount,
          documents: b.documents
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/vendor/profile - Update vendor profile
router.put("/profile", async (req, res, next) => {
  try {
    const { name, email, hallBusinessName, cateringBusinessName, city, state } = req.body;

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name || undefined,
        email: email || undefined,
        city: city || undefined,
        state: state || undefined
      }
    });

    if (hallBusinessName || cateringBusinessName) {
      await prisma.vendorProfile.upsert({
        where: { userId: req.user.id },
        update: {
          hallBusinessName: hallBusinessName || undefined,
          cateringBusinessName: cateringBusinessName || undefined
        },
        create: {
          userId: req.user.id,
          ownerType: "both",
          hallBusinessName,
          cateringBusinessName
        }
      });
    }

    res.json({ data: { message: "Profile updated successfully" } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/branches - List vendor branches
router.get("/branches", async (req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { vendorId: req.user.id },
      include: {
        city: true,
        hallDetails: true,
        catererDetails: true,
        plateRates: true,
        photos: true,
        works: {
          include: { photos: true },
          orderBy: { createdAt: "desc" }
        },
        blocks: true,
        documents: true
      }
    });

    // Fetch FileRecords for all branch photos, works photos, and coverPhotoIds
    const fileIds = new Set();
    for (const b of branches) {
      if (b.coverPhotoId) fileIds.add(b.coverPhotoId);
      for (const p of (b.photos || [])) {
        if (p.fileId) fileIds.add(p.fileId);
      }
      for (const w of (b.works || [])) {
        for (const wp of (w.photos || [])) {
          if (wp.fileId) fileIds.add(wp.fileId);
        }
      }
    }

    const fileRecords = await prisma.fileRecord.findMany({
      where: { id: { in: Array.from(fileIds) } }
    });
    const fileMap = new Map();
    for (const fr of fileRecords) {
      fileMap.set(fr.id, storageAdapter.getUrl(fr.path));
    }

    const items = branches.map(b => {
      const photos = (b.photos || []).map(p => {
        const resolvedUrl = fileMap.get(p.fileId) || (p.fileId?.startsWith('/uploads') ? p.fileId : null) || p.fileId;
        return {
          id: p.id,
          fileId: p.fileId,
          url: resolvedUrl,
          caption: p.caption,
          isCover: p.isCover,
          order: p.sortOrder
        };
      });

      const works = (b.works || []).map(w => ({
        id: w.id,
        title: w.title,
        eventType: w.eventType,
        eventDate: w.eventDate,
        guests: w.guests,
        caption: w.caption,
        photos: (w.photos || []).map(wp => ({
          id: wp.id,
          fileId: wp.fileId,
          url: fileMap.get(wp.fileId) || (wp.fileId?.startsWith('/uploads') ? wp.fileId : null) || wp.fileId,
          caption: wp.caption,
          order: wp.sortOrder
        }))
      }));

      const coverUrl = b.coverPhotoId
        ? (fileMap.get(b.coverPhotoId) || (b.coverPhotoId.startsWith('/uploads') ? b.coverPhotoId : null))
        : (photos.find(p => p.isCover)?.url || photos[0]?.url || null);

      return {
        id: b.id,
        name: b.name,
        kind: b.kind,
        description: b.description,
        addressLine: b.addressLine,
        area: b.area,
        city: b.city.city,
        state: b.city.state,
        pincode: b.pincode,
        status: b.status,
        ratingAvg: b.ratingAvg,
        ratingCount: b.ratingCount,
        bookingsCount: b.bookingsCount,
        amenities: b.amenities ? JSON.parse(b.amenities) : [],
        hallDetails: b.hallDetails,
        catererDetails: b.catererDetails ? {
          minPlates: b.catererDetails.minPlates,
          cuisines: b.catererDetails.cuisines ? JSON.parse(b.catererDetails.cuisines) : [],
          servingStyles: b.catererDetails.servingStyles ? JSON.parse(b.catererDetails.servingStyles) : [],
          foodTypes: b.catererDetails.foodTypes ? JSON.parse(b.catererDetails.foodTypes) : []
        } : null,
        plateRates: b.plateRates,
        coverPhotoId: b.coverPhotoId,
        coverPhotoUrl: coverUrl,
        photos,
        works,
        blocks: b.blocks,
        documents: b.documents
      };
    });

    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/branches - Create branch
router.post("/branches", async (req, res, next) => {
  try {
    const {
      kind,
      name,
      description,
      addressLine,
      area,
      city,
      state,
      pincode,
      lat,
      lon,
      amenities = [],
      hallDetails,
      catererDetails,
      plateRates = []
    } = req.body;

    if (!kind || !name || !city) {
      return res.status(400).json({ error: { message: "kind, name, and city are required" } });
    }

    // Resolve or create City
    let cityRecord = await prisma.city.findFirst({
      where: { city: { equals: city } }
    });

    if (!cityRecord) {
      cityRecord = await prisma.city.create({
        data: {
          city,
          state: state || "Andhra Pradesh",
          priceMultiplier: 1.0
        }
      });
    }

    const branch = await prisma.branch.create({
      data: {
        vendorId: req.user.id,
        kind,
        name,
        description: description || null,
        addressLine: addressLine || null,
        area: area || city,
        cityId: cityRecord.id,
        pincode: pincode || null,
        lat: lat ? parseFloat(lat) : null,
        lon: lon ? parseFloat(lon) : null,
        status: "under_review",
        amenities: JSON.stringify(amenities),
        hallDetails: kind === "hall" && hallDetails ? {
          create: {
            capacity: parseInt(hallDetails.capacity) || 500,
            acMode: hallDetails.acMode || "both",
            priceFullDayNonAc: parseInt(hallDetails.priceFullDayNonAc) || 40000,
            priceFullDayAc: parseInt(hallDetails.priceFullDayAc) || 60000,
            priceHalfDay: hallDetails.priceHalfDay ? parseInt(hallDetails.priceHalfDay) : null,
            parking: hallDetails.parking || "50 cars",
            rooms: parseInt(hallDetails.rooms) || 2
          }
        } : undefined,
        catererDetails: kind === "catering" && catererDetails ? {
          create: {
            minPlates: parseInt(catererDetails.minPlates) || 50,
            cuisines: JSON.stringify(catererDetails.cuisines || ["South Indian"]),
            servingStyles: JSON.stringify(catererDetails.servingStyles || ["Buffet"]),
            foodTypes: JSON.stringify(catererDetails.foodTypes || ["both"])
          }
        } : undefined,
        plateRates: kind === "catering" && plateRates.length > 0 ? {
          create: plateRates.map(pr => ({
            category: pr.category,
            foodType: pr.foodType,
            price: parseInt(pr.price)
          }))
        } : undefined
      },
      include: {
        hallDetails: true,
        catererDetails: true,
        plateRates: true
      }
    });

    res.status(201).json({ data: branch });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/vendor/branches/:id - Update branch
router.put("/branches/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const branch = await prisma.branch.findUnique({ where: { id } });

    if (!branch || (branch.vendorId !== req.user.id && req.user.role !== "admin")) {
      return res.status(404).json({ error: { message: "Branch not found" } });
    }

    const {
      name,
      description,
      addressLine,
      area,
      pincode,
      amenities,
      hallDetails,
      catererDetails
    } = req.body;

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        addressLine: addressLine || undefined,
        area: area || undefined,
        pincode: pincode || undefined,
        amenities: amenities ? JSON.stringify(amenities) : undefined
      }
    });

    if (branch.kind === "hall" && hallDetails) {
      await prisma.hallDetails.upsert({
        where: { branchId: id },
        update: {
          capacity: hallDetails.capacity ? parseInt(hallDetails.capacity) : undefined,
          acMode: hallDetails.acMode || undefined,
          priceFullDayNonAc: hallDetails.priceFullDayNonAc ? parseInt(hallDetails.priceFullDayNonAc) : undefined,
          priceFullDayAc: hallDetails.priceFullDayAc ? parseInt(hallDetails.priceFullDayAc) : undefined,
          priceHalfDay: hallDetails.priceHalfDay ? parseInt(hallDetails.priceHalfDay) : undefined,
          parking: hallDetails.parking || undefined,
          rooms: hallDetails.rooms ? parseInt(hallDetails.rooms) : undefined
        },
        create: {
          branchId: id,
          capacity: parseInt(hallDetails.capacity) || 500,
          acMode: hallDetails.acMode || "both",
          priceFullDayNonAc: parseInt(hallDetails.priceFullDayNonAc) || 40000,
          priceFullDayAc: parseInt(hallDetails.priceFullDayAc) || 60000,
          priceHalfDay: hallDetails.priceHalfDay ? parseInt(hallDetails.priceHalfDay) : null,
          parking: hallDetails.parking || "50 cars",
          rooms: parseInt(hallDetails.rooms) || 2
        }
      });
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/branches/:id/blocks - List blocks
router.get("/branches/:id/blocks", async (req, res, next) => {
  try {
    const { id } = req.params;
    const blocks = await prisma.availabilityBlock.findMany({
      where: { branchId: id },
      orderBy: { date: "asc" }
    });
    res.json({ data: blocks });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/branches/:id/blocks - Block date
router.post("/branches/:id/blocks", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, reason } = req.body;

    if (!date) {
      return res.status(400).json({ error: { message: "Date is required (YYYY-MM-DD)" } });
    }

    const block = await prisma.availabilityBlock.upsert({
      where: {
        branchId_date: {
          branchId: id,
          date
        }
      },
      update: { reason: reason || "Vendor blocked" },
      create: {
        branchId: id,
        date,
        reason: reason || "Vendor blocked"
      }
    });

    res.status(201).json({ data: block });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/vendor/branches/:id/blocks/:blockId - Unblock date
router.delete("/branches/:id/blocks/:blockId", async (req, res, next) => {
  try {
    const { blockId } = req.params;
    await prisma.availabilityBlock.delete({
      where: { id: blockId }
    });
    res.json({ data: { message: "Block removed successfully" } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/branches/:id/works - Add previous work
router.post("/branches/:id/works", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, eventType, eventDate, guests, caption, photoFileIds = [] } = req.body;

    if (!title) {
      return res.status(400).json({ error: { message: "title is required" } });
    }

    let branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      branch = await prisma.branch.findFirst({
        where: {
          vendorId: req.user.id,
          OR: [
            { id },
            { id: id === 'h-kad-1' ? 'branch-sai-hall-1' : (id === 'h-kad-sai-bypass' ? 'branch-sai-hall-2' : (id === 'c-kad-annapurna' ? 'branch-annapurna-cat-1' : id)) },
            { name: { contains: 'Sai' } }
          ]
        }
      });
      if (!branch) {
        branch = await prisma.branch.findFirst({ where: { vendorId: req.user.id } });
      }
    }

    if (!branch) {
      return res.status(404).json({ error: { message: "Branch not found" } });
    }

    if (req.user.role !== 'admin' && branch.vendorId !== req.user.id) {
      return res.status(403).json({ error: { message: "Unauthorized: You do not own this branch" } });
    }

    const resolvedPhotoCreates = [];
    for (let idx = 0; idx < photoFileIds.length; idx++) {
      const fid = photoFileIds[idx];
      let fileId = fid;
      const photoRec = await prisma.photo.findUnique({ where: { id: fid } });
      if (photoRec) fileId = photoRec.fileId;
      resolvedPhotoCreates.push({ fileId, sortOrder: idx });
    }

    const work = await prisma.previousWork.create({
      data: {
        branchId: branch.id,
        title,
        eventType,
        eventDate,
        guests: guests ? parseInt(guests) : null,
        caption,
        photos: resolvedPhotoCreates.length > 0 ? {
          create: resolvedPhotoCreates
        } : undefined
      },
      include: { photos: true }
    });

    res.status(201).json({ data: work });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/vendor/works/:workId - Delete previous work
router.delete("/works/:workId", async (req, res, next) => {
  try {
    const { workId } = req.params;
    const work = await prisma.previousWork.findUnique({
      where: { id: workId },
      include: { branch: true }
    });
    if (!work) {
      return res.status(404).json({ error: { message: "Previous work not found" } });
    }
    if (req.user.role !== 'admin' && work.branch.vendorId !== req.user.id) {
      return res.status(403).json({ error: { message: "Unauthorized: You do not own this work" } });
    }
    await prisma.previousWork.delete({
      where: { id: workId }
    });
    res.json({ data: { message: "Work deleted" } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/branches/:id/photos - Upload photos to branch
router.post("/branches/:id/photos", handlePhotoUpload, async (req, res, next) => {
  try {
    const { id } = req.params;
    let branch = await prisma.branch.findUnique({
      where: { id },
      include: { photos: { orderBy: { sortOrder: "asc" } } }
    });

    if (!branch) {
      branch = await prisma.branch.findFirst({
        where: {
          vendorId: req.user.id,
          OR: [
            { id },
            { id: id === 'h-kad-1' ? 'branch-sai-hall-1' : (id === 'h-kad-sai-bypass' ? 'branch-sai-hall-2' : (id === 'c-kad-annapurna' ? 'branch-annapurna-cat-1' : id)) },
            { name: { contains: 'Sai' } }
          ]
        },
        include: { photos: { orderBy: { sortOrder: "asc" } } }
      });
      if (!branch) {
        branch = await prisma.branch.findFirst({
          where: { vendorId: req.user.id },
          include: { photos: { orderBy: { sortOrder: "asc" } } }
        });
      }
    }

    if (!branch) {
      return res.status(404).json({ error: { message: "Branch not found" } });
    }

    if (req.user.role !== 'admin' && branch.vendorId !== req.user.id) {
      return res.status(403).json({ error: { message: "Unauthorized: You do not own this branch" } });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: { message: "No photos provided. Please attach at least one photo." } });
    }

    const maxPhotos = config.maxBranchPhotos || 12;
    const existingCount = branch.photos.length;
    if (existingCount + files.length > maxPhotos) {
      return res.status(400).json({
        error: {
          message: `Maximum ${maxPhotos} photos allowed per branch. This branch already has ${existingCount} photos; cannot add ${files.length} more.`
        }
      });
    }

    // Validate MIME types and file sizes
    const maxSizeBytes = config.maxPhotoSizeBytes || 8 * 1024 * 1024;
    for (const file of files) {
      const detectedMime = getMagicMime(file.buffer);
      if (!detectedMime || !ALLOWED_PHOTO_MIMES.includes(detectedMime)) {
        return res.status(400).json({
          error: {
            message: `Invalid file format for "${file.originalname}". Only JPEG, PNG, and WEBP image formats are supported.`
          }
        });
      }
      if (file.buffer.length > maxSizeBytes) {
        return res.status(400).json({
          error: {
            message: `File "${file.originalname}" exceeds the 8 MB maximum size limit.`
          }
        });
      }
    }

    const hasCover = branch.photos.some(p => p.isCover);
    const createdPhotos = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const detectedMime = getMagicMime(file.buffer);
      const { buffer: processedBuffer, mime: finalMime } = await processImage(file.buffer, detectedMime);

      const saved = await storageAdapter.save({
        buffer: processedBuffer,
        originalname: file.originalname,
        mime: finalMime,
        isPublic: true
      });

      const fileRecord = await prisma.fileRecord.create({
        data: {
          ownerId: req.user.id,
          purpose: 'photo',
          path: saved.path,
          mime: saved.mime,
          sizeBytes: saved.sizeBytes,
          isPublic: true
        }
      });

      const isCover = !hasCover && i === 0;
      const sortOrder = existingCount + i;
      const caption = file.originalname ? path.parse(file.originalname).name : null;

      const photo = await prisma.photo.create({
        data: {
          branchId: branch.id,
          fileId: fileRecord.id,
          caption,
          isCover,
          sortOrder
        }
      });

      if (isCover) {
        await prisma.branch.update({
          where: { id: branch.id },
          data: { coverPhotoId: fileRecord.id }
        });
      }

      createdPhotos.push({
        id: photo.id,
        url: saved.url,
        caption: photo.caption,
        isCover: photo.isCover,
        order: photo.sortOrder
      });
    }

    res.status(201).json({ data: createdPhotos });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/vendor/photos/:id - Update photo metadata (caption, isCover, order)
router.patch("/photos/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { caption, isCover, order, sortOrder } = req.body;

    const photo = await prisma.photo.findUnique({
      where: { id },
      include: {
        branch: true,
        work: { include: { branch: true } }
      }
    });

    if (!photo) {
      return res.status(404).json({ error: { message: "Photo not found" } });
    }

    const ownerId = photo.branch ? photo.branch.vendorId : photo.work?.branch?.vendorId;
    if (req.user.role !== 'admin' && ownerId !== req.user.id) {
      return res.status(403).json({ error: { message: "Unauthorized: You do not own this photo" } });
    }

    const targetOrder = order !== undefined ? Number(order) : (sortOrder !== undefined ? Number(sortOrder) : undefined);

    if (isCover === true && photo.branchId) {
      await prisma.photo.updateMany({
        where: { branchId: photo.branchId, id: { not: photo.id } },
        data: { isCover: false }
      });
      await prisma.branch.update({
        where: { id: photo.branchId },
        data: { coverPhotoId: photo.fileId }
      });
    }

    const updated = await prisma.photo.update({
      where: { id: photo.id },
      data: {
        caption: caption !== undefined ? caption : undefined,
        isCover: isCover !== undefined ? Boolean(isCover) : undefined,
        sortOrder: targetOrder !== undefined ? targetOrder : undefined
      }
    });

    const fileRec = await prisma.fileRecord.findUnique({ where: { id: photo.fileId } });
    const url = fileRec ? storageAdapter.getUrl(fileRec.path) : (photo.fileId?.startsWith('/uploads') ? photo.fileId : null) || photo.fileId;

    res.json({
      data: {
        id: updated.id,
        url,
        caption: updated.caption,
        isCover: updated.isCover,
        order: updated.sortOrder
      }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/vendor/photos/:id - Delete photo
router.delete("/photos/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const photo = await prisma.photo.findUnique({
      where: { id },
      include: {
        branch: true,
        work: { include: { branch: true } }
      }
    });

    if (!photo) {
      return res.status(404).json({ error: { message: "Photo not found" } });
    }

    const ownerId = photo.branch ? photo.branch.vendorId : photo.work?.branch?.vendorId;
    if (req.user.role !== 'admin' && ownerId !== req.user.id) {
      return res.status(403).json({ error: { message: "Unauthorized: You do not own this photo" } });
    }

    const fileRec = await prisma.fileRecord.findUnique({ where: { id: photo.fileId } });
    if (fileRec) {
      await storageAdapter.remove(fileRec.path);
      await prisma.fileRecord.delete({ where: { id: fileRec.id } }).catch(() => {});
    }

    await prisma.photo.delete({ where: { id: photo.id } });

    if (photo.branchId && photo.isCover) {
      const remainingPhoto = await prisma.photo.findFirst({
        where: { branchId: photo.branchId },
        orderBy: { sortOrder: "asc" }
      });
      if (remainingPhoto) {
        await prisma.photo.update({
          where: { id: remainingPhoto.id },
          data: { isCover: true }
        });
        await prisma.branch.update({
          where: { id: photo.branchId },
          data: { coverPhotoId: remainingPhoto.fileId }
        });
      } else {
        await prisma.branch.update({
          where: { id: photo.branchId },
          data: { coverPhotoId: null }
        });
      }
    }

    res.json({ data: { message: "Photo deleted successfully", id: photo.id } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/works/:id/photos - Upload photos to previous work
router.post("/works/:id/photos", handlePhotoUpload, async (req, res, next) => {
  try {
    const { id } = req.params;
    const work = await prisma.previousWork.findUnique({
      where: { id },
      include: {
        branch: true,
        photos: { orderBy: { sortOrder: "asc" } }
      }
    });

    if (!work) {
      return res.status(404).json({ error: { message: "Previous work not found" } });
    }

    if (req.user.role !== 'admin' && work.branch.vendorId !== req.user.id) {
      return res.status(403).json({ error: { message: "Unauthorized: You do not own this work" } });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: { message: "No photos provided. Please attach at least one photo." } });
    }

    const maxPhotos = config.maxBranchPhotos || 12;
    const existingCount = work.photos.length;
    if (existingCount + files.length > maxPhotos) {
      return res.status(400).json({
        error: {
          message: `Maximum ${maxPhotos} photos allowed per work item. Current: ${existingCount}, attempting to add: ${files.length}.`
        }
      });
    }

    const maxSizeBytes = config.maxPhotoSizeBytes || 8 * 1024 * 1024;
    for (const file of files) {
      const detectedMime = getMagicMime(file.buffer);
      if (!detectedMime || !ALLOWED_PHOTO_MIMES.includes(detectedMime)) {
        return res.status(400).json({
          error: {
            message: `Invalid file format for "${file.originalname}". Only JPEG, PNG, and WEBP image formats are supported.`
          }
        });
      }
      if (file.buffer.length > maxSizeBytes) {
        return res.status(400).json({
          error: {
            message: `File "${file.originalname}" exceeds the 8 MB maximum size limit.`
          }
        });
      }
    }

    const createdPhotos = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const detectedMime = getMagicMime(file.buffer);
      const { buffer: processedBuffer, mime: finalMime } = await processImage(file.buffer, detectedMime);

      const saved = await storageAdapter.save({
        buffer: processedBuffer,
        originalname: file.originalname,
        mime: finalMime,
        isPublic: true
      });

      const fileRecord = await prisma.fileRecord.create({
        data: {
          ownerId: req.user.id,
          purpose: 'work',
          path: saved.path,
          mime: saved.mime,
          sizeBytes: saved.sizeBytes,
          isPublic: true
        }
      });

      const sortOrder = existingCount + i;
      const caption = file.originalname ? path.parse(file.originalname).name : null;

      const photo = await prisma.photo.create({
        data: {
          workId: work.id,
          fileId: fileRecord.id,
          caption,
          sortOrder
        }
      });

      createdPhotos.push({
        id: photo.id,
        url: saved.url,
        caption: photo.caption,
        order: photo.sortOrder
      });
    }

    res.status(201).json({ data: createdPhotos });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/vendor/works/:workId/photos/:photoId - Delete work photo
router.delete("/works/:workId/photos/:photoId", async (req, res, next) => {
  try {
    const { photoId, workId } = req.params;
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: { work: { include: { branch: true } } }
    });

    if (!photo || photo.workId !== workId) {
      return res.status(404).json({ error: { message: "Photo not found for this work" } });
    }

    if (req.user.role !== 'admin' && photo.work?.branch?.vendorId !== req.user.id) {
      return res.status(403).json({ error: { message: "Unauthorized: You do not own this photo" } });
    }

    const fileRec = await prisma.fileRecord.findUnique({ where: { id: photo.fileId } });
    if (fileRec) {
      await storageAdapter.remove(fileRec.path);
      await prisma.fileRecord.delete({ where: { id: fileRec.id } }).catch(() => {});
    }

    await prisma.photo.delete({ where: { id: photo.id } });
    res.json({ data: { message: "Work photo deleted successfully", id: photo.id } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/bookings - List vendor bookings
router.get("/bookings", async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { vendorId: req.user.id },
      include: {
        branch: { select: { id: true, name: true, kind: true } },
        user: { select: { id: true, name: true } }, // PRIVACY: NEVER expose user phone/email
        bookingDates: true,
        payout: true
      },
      orderBy: { createdAt: "desc" }
    });

    const items = bookings.map(b => ({
      id: b.id,
      code: b.code,
      customerName: b.user.name,
      branchName: b.branch.name,
      kind: b.kind,
      eventType: b.eventType,
      startDate: b.startDate,
      endDate: b.endDate,
      slot: b.slot,
      guests: b.guests,
      gross: b.subtotal,
      commission: b.commission,
      vendorPayout: b.vendorPayout,
      status: b.status,
      paymentStatus: b.paymentStatus,
      payoutStatus: b.payout?.status || "pending",
      createdAt: b.createdAt
    }));

    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/vendor/bookings/:id/status - Update booking status
router.put("/bookings/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking || (booking.vendorId !== req.user.id && req.user.role !== "admin")) {
      return res.status(404).json({ error: { message: "Booking not found" } });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status }
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/requests - Inquiries summary
router.get("/requests", async (req, res, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { vendorId: req.user.id },
      include: {
        user: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { lastMessageAt: "desc" }
    });

    const requests = conversations.map(c => ({
      id: c.id,
      customerName: c.user.name,
      branchName: c.branch.name,
      branchId: c.branchId,
      lastMessage: c.messages[0]?.body || "Inquiry initiated",
      lastMessageAt: c.lastMessageAt
    }));

    res.json({ data: requests });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/revenue/summary
router.get("/revenue/summary", async (req, res, next) => {
  try {
    const summary = await revenueService.getRevenueSummary(req.user.id);
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/revenue/series
router.get("/revenue/series", async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const series = await revenueService.getRevenueSeries(req.user.id, months);
    res.json({ data: series });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/payouts
router.get("/payouts", async (req, res, next) => {
  try {
    const payouts = await prisma.payout.findMany({
      where: { vendorId: req.user.id },
      include: {
        booking: {
          select: {
            code: true,
            startDate: true,
            branch: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ data: payouts });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/payouts/request
router.post("/payouts/request", async (req, res, next) => {
  try {
    // In demo/mock, vendor requests release for completed bookings
    const updated = await prisma.payout.updateMany({
      where: {
        vendorId: req.user.id,
        status: "pending"
      },
      data: {
        status: "paid_out",
        paidAt: new Date()
      }
    });

    res.json({
      data: {
        message: `Payout of ${updated.count} bookings initiated successfully.`
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
