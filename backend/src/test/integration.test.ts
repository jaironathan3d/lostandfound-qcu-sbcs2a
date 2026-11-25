import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { env } from '../config/env';
import { openClaimDocumentFile, removeStoredClaimDocuments } from '../lib/claimDocuments';
import { ClaimStatus, ItemReviewStatus, ItemStatus, LostItemStatus, prisma, ReportType, UserRole } from '../lib/prisma';
import { openItemMediaFile, removeItemMediaFile } from '../lib/itemMedia';

let server: Server;
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  const closed = new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  server.closeIdleConnections();
  server.closeAllConnections();
  await closed;
  await prisma.$disconnect();
});

test('health endpoint responds successfully', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('public categories come from PostgreSQL', async () => {
  const response = await fetch(`${baseUrl}/items/categories`);
  assert.equal(response.status, 200);
  const categories = await response.json() as unknown;
  assert.ok(Array.isArray(categories));
  assert.ok(categories.length > 0);
});

test('administrator category management enforces uniqueness and protects used categories', async () => {
  const adminLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-admin@qcu.test',
      password: 'QcuTest!2026',
    }),
  });
  assert.equal(adminLogin.status, 200);
  const { token: adminToken } = await adminLogin.json() as { token: string };
  const studentLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-student-1@qcu.test',
      password: 'QcuTest!2026',
    }),
  });
  assert.equal(studentLogin.status, 200);
  const { token: studentToken } = await studentLogin.json() as { token: string };

  const categoryName = `Integration Category ${Date.now()}`;
  const renamedCategory = `${categoryName} Updated`;
  let categoryId = '';
  let itemId = '';
  try {
    assert.equal((await fetch(`${baseUrl}/admin/categories`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/admin/categories`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    })).status, 403);

    const createResponse = await fetch(`${baseUrl}/admin/categories`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: ` ${categoryName} ` }),
    });
    assert.equal(createResponse.status, 201);
    const createdCategory = await createResponse.json() as { id: string; name: string };
    categoryId = createdCategory.id;
    assert.equal(createdCategory.name, categoryName);

    const duplicateResponse = await fetch(`${baseUrl}/admin/categories`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: categoryName }),
    });
    assert.equal(duplicateResponse.status, 409);

    const renameResponse = await fetch(`${baseUrl}/admin/categories/${categoryId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: renamedCategory }),
    });
    assert.equal(renameResponse.status, 200);
    const publicCategories = await fetch(`${baseUrl}/items/categories`);
    const categoryNames = await publicCategories.json() as string[];
    assert.ok(categoryNames.includes(renamedCategory));
    assert.ok(!categoryNames.includes(categoryName));

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'test-student-1@qcu.test' } });
    const item = await prisma.item.create({
      data: {
        title: 'Category protection integration test',
        description: 'Testing category deletion rules',
        hiddenDetail: '',
        building: 'Integration test',
        reporterId: user.id,
        categoryId,
      },
    });
    itemId = item.id;

    const adminCategoriesResponse = await fetch(`${baseUrl}/admin/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminCategories = await adminCategoriesResponse.json() as Array<{ id: string; itemCount: number }>;
    assert.equal(adminCategories.find((category) => category.id === categoryId)?.itemCount, 1);
    const usedDeleteResponse = await fetch(`${baseUrl}/admin/categories/${categoryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(usedDeleteResponse.status, 409);
  } finally {
    if (itemId) await prisma.item.deleteMany({ where: { id: itemId } });
    if (categoryId) {
      await prisma.category.deleteMany({ where: { id: categoryId } });
    }
  }
});

test('public search combines filters, stable pagination, and excludes unapproved or resolved reports', async () => {
  const marker = `Search-${Date.now()}`;
  const blueCategory = await prisma.category.create({ data: { name: `${marker}-Blue` } });
  const redCategory = await prisma.category.create({ data: { name: `${marker}-Red` } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'test-student-1@qcu.test' } });
  const itemIds: string[] = [];

  const createFixture = async (data: {
    title: string;
    categoryId: string;
    reportType: ReportType;
    reviewStatus: ItemReviewStatus;
    status?: ItemStatus;
    lostItemStatus?: LostItemStatus;
    building: string;
    occurredAt: string;
  }) => {
    const item = await prisma.item.create({
      data: {
        title: data.title,
        description: `Fixture ${marker}`,
        hiddenDetail: '',
        building: data.building,
        reporterId: user.id,
        categoryId: data.categoryId,
        reportType: data.reportType,
        reviewStatus: data.reviewStatus,
        status: data.status ?? ItemStatus.REPORTED,
        lostItemStatus: data.lostItemStatus ?? LostItemStatus.OPEN,
        occurredAt: new Date(`${data.occurredAt}T12:00:00.000Z`),
      },
    });
    itemIds.push(item.id);
    return item;
  };

  let oldestItemId = '';
  let newestItemId = '';
  try {
    const oldestItem = await createFixture({
      title: `${marker} Found ID`,
      categoryId: redCategory.id,
      reportType: ReportType.FOUND,
      reviewStatus: ItemReviewStatus.APPROVED,
      building: 'Science Annex',
      occurredAt: '2026-03-10',
    });
    oldestItemId = oldestItem.id;
    const newestItem = await createFixture({
      title: `${marker} Blue Wallet`,
      categoryId: blueCategory.id,
      reportType: ReportType.LOST,
      reviewStatus: ItemReviewStatus.APPROVED,
      building: 'Library East',
      occurredAt: '2026-03-15',
    });
    newestItemId = newestItem.id;
    await createFixture({
      title: `${marker} Pending Wallet`,
      categoryId: blueCategory.id,
      reportType: ReportType.LOST,
      reviewStatus: ItemReviewStatus.PENDING,
      building: 'Library East',
      occurredAt: '2026-03-16',
    });
    await createFixture({
      title: `${marker} Returned Wallet`,
      categoryId: blueCategory.id,
      reportType: ReportType.LOST,
      reviewStatus: ItemReviewStatus.APPROVED,
      status: ItemStatus.RETURNED,
      lostItemStatus: LostItemStatus.RETURNED,
      building: 'Library East',
      occurredAt: '2026-03-17',
    });

    const search = async (params: Record<string, string>) => {
      const response = await fetch(`${baseUrl}/items?${new URLSearchParams(params)}`);
      assert.equal(response.status, 200);
      return await response.json() as {
        items: Array<{ id: string; type: 'Lost' | 'Found' }>;
        page: number;
        pageSize: number;
        total: number;
      };
    };

    const allMatching = await search({ q: marker });
    assert.deepEqual(new Set(allMatching.items.map((item) => item.id)), new Set([oldestItemId, newestItemId]));
    assert.equal(allMatching.total, 2);

    const foundOnly = await search({ q: marker, type: 'Found' });
    assert.deepEqual(foundOnly.items.map((item) => item.id), [oldestItemId]);

    const blueCategoryOnly = await search({ category: blueCategory.name });
    assert.deepEqual(blueCategoryOnly.items.map((item) => item.id), [newestItemId]);

    const locationOnly = await search({ q: marker, location: 'library east' });
    assert.deepEqual(locationOnly.items.map((item) => item.id), [newestItemId]);

    const dateRange = await search({ q: marker, dateFrom: '2026-03-11', dateTo: '2026-03-15' });
    assert.deepEqual(dateRange.items.map((item) => item.id), [newestItemId]);

    const newestFirstPage = await search({ q: marker, page: '1', pageSize: '1' });
    assert.deepEqual(newestFirstPage.items.map((item) => item.id), [newestItemId]);
    const oldestFirstPage = await search({ q: marker, sort: 'oldest', page: '1', pageSize: '1' });
    assert.deepEqual(oldestFirstPage.items.map((item) => item.id), [oldestItemId]);
    const secondPage = await search({ q: marker, page: '2', pageSize: '1' });
    assert.deepEqual(secondPage.items.map((item) => item.id), [oldestItemId]);

    assert.equal((await fetch(`${baseUrl}/items?type=Invalid`)).status, 400);
    assert.equal((await fetch(`${baseUrl}/items?dateFrom=2026-02-30`)).status, 400);
    assert.equal((await fetch(`${baseUrl}/items?dateFrom=2026-04-01&dateTo=2026-03-01`)).status, 400);
    assert.equal((await fetch(`${baseUrl}/items?page=999999999999999999999999`)).status, 400);
  } finally {
    await prisma.item.deleteMany({ where: { id: { in: itemIds } } });
    await prisma.category.deleteMany({ where: { id: { in: [blueCategory.id, redCategory.id] } } });
  }
});

test('login rejects missing credentials', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
});

test('seeded student login creates a session', async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-student-1@qcu.test',
      password: 'QcuTest!2026',
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { token?: string; user?: { role?: string } };
  assert.ok(body.token);
  assert.equal(body.user?.role, 'student');
});

test('editing a pending report retains existing media unless explicitly removed', async () => {
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-student-1@qcu.test',
      password: 'QcuTest!2026',
    }),
  });
  assert.equal(loginResponse.status, 200);
  const { token } = await loginResponse.json() as { token: string };
  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'test-student-1@qcu.test' } });
  const category = await prisma.category.findUniqueOrThrow({ where: { name: 'others' } });
  const item = await prisma.item.create({
    data: {
      title: 'Integration media retention test',
      description: 'Testing retained report media attachments',
      hiddenDetail: '',
      building: 'Integration test',
      reporterId: user.id,
      categoryId: category.id,
      images: {
        create: [
          { imageUrl: 'data:image/png;base64,AAAA', fileName: 'retained.png' },
          { imageUrl: 'data:image/png;base64,BBBB', fileName: 'removed.png' },
        ],
      },
    },
    include: { images: { select: { id: true } } },
  });

  try {
    const mineResponse = await fetch(`${baseUrl}/items/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(mineResponse.status, 200);
    const mine = await mineResponse.json() as Array<{ id: string; media: Array<{ id: string }> }>;
    assert.equal(mine.find((entry) => entry.id === item.id)?.media.length, 2);

    const patch = (retainedMediaIds: string[]) => fetch(`${baseUrl}/items/${item.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'Lost',
        title: 'Integration media retention test',
        category: 'others',
        location: 'Integration test',
        occurredAt: new Date().toISOString().slice(0, 10),
        description: 'Testing retained report media attachments',
        privateDetails: '',
        retainedMediaIds,
        media: [],
      }),
    });

    const retainResponse = await patch([item.images[0].id]);
    assert.equal(retainResponse.status, 200);
    let media = await prisma.itemImage.findMany({ where: { itemId: item.id } });
    assert.deepEqual(media.map((entry) => entry.id), [item.images[0].id]);

    const invalidMediaResponse = await patch(['not-attached-to-this-report']);
    assert.equal(invalidMediaResponse.status, 400);
    media = await prisma.itemImage.findMany({ where: { itemId: item.id } });
    assert.deepEqual(media.map((entry) => entry.id), [item.images[0].id]);

    const removeResponse = await patch([]);
    assert.equal(removeResponse.status, 200);
    media = await prisma.itemImage.findMany({ where: { itemId: item.id } });
    assert.equal(media.length, 0);
  } finally {
    await prisma.item.delete({ where: { id: item.id } });
  }
});

test('multipart uploads accept multiple large files and protect pending media', async () => {
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-student-1@qcu.test',
      password: 'QcuTest!2026',
    }),
  });
  assert.equal(loginResponse.status, 200);
  const { token } = await loginResponse.json() as { token: string };

  const invalidForm = new FormData();
  invalidForm.set('type', 'Lost');
  invalidForm.set('title', 'Invalid media integration test');
  invalidForm.set('category', 'others');
  invalidForm.set('location', 'Integration test');
  invalidForm.set('occurredAt', new Date().toISOString().slice(0, 10));
  invalidForm.set('description', 'Reject a mismatched media signature');
  invalidForm.append('media', new Blob(['not a png'], { type: 'image/png' }), 'invalid.png');
  const invalidResponse = await fetch(`${baseUrl}/items`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: invalidForm,
  });
  assert.equal(invalidResponse.status, 400);

  const tooManyForm = new FormData();
  tooManyForm.set('type', 'Lost');
  tooManyForm.set('title', 'Too many media integration test');
  tooManyForm.set('category', 'others');
  tooManyForm.set('location', 'Integration test');
  tooManyForm.set('occurredAt', new Date().toISOString().slice(0, 10));
  tooManyForm.set('description', 'Reject more than four files');
  for (let index = 0; index < 5; index += 1) {
    tooManyForm.append('media', new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' }), `${index}.png`);
  }
  const tooManyResponse = await fetch(`${baseUrl}/items`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: tooManyForm,
  });
  assert.equal(tooManyResponse.status, 400);

  const oversizedForm = new FormData();
  oversizedForm.set('type', 'Lost');
  oversizedForm.set('title', 'Oversized media integration test');
  oversizedForm.set('category', 'others');
  oversizedForm.set('location', 'Integration test');
  oversizedForm.set('occurredAt', new Date().toISOString().slice(0, 10));
  oversizedForm.set('description', 'Reject an image over the configured limit');
  const oversizedPng = new Uint8Array(10 * 1024 * 1024 + 1);
  oversizedPng.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  oversizedForm.append('media', new Blob([oversizedPng], { type: 'image/png' }), 'oversized.png');
  const oversizedResponse = await fetch(`${baseUrl}/items`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: oversizedForm,
  });
  assert.equal(oversizedResponse.status, 400);

  const largePng = new Uint8Array(1_100_000);
  largePng.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const mp4 = new Uint8Array(16);
  mp4.set([0x00, 0x00, 0x00, 0x10], 0);
  mp4.set([0x66, 0x74, 0x79, 0x70], 4);
  const form = new FormData();
  form.set('type', 'Lost');
  form.set('title', 'Multipart media integration test');
  form.set('category', 'others');
  form.set('location', 'Integration test');
  form.set('occurredAt', new Date().toISOString().slice(0, 10));
  form.set('description', 'Verify multiple file upload and access');
  form.append('media', new Blob([largePng], { type: 'image/png' }), 'large.png');
  form.append('media', new Blob([jpeg], { type: 'image/jpeg' }), 'small.jpg');
  form.append('media', new Blob([mp4], { type: 'video/mp4' }), 'sample.mp4');

  let itemId = '';
  try {
    const createResponse = await fetch(`${baseUrl}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    assert.equal(createResponse.status, 201);
    itemId = (await createResponse.json() as { id: string }).id;
    const media = await prisma.itemImage.findMany({ where: { itemId } });
    assert.equal(media.length, 3);
    assert.ok(media.every((entry) => entry.imageUrl.startsWith('storage:')));
    assert.ok(media.some((entry) => entry.mediaType === 'IMAGE' && entry.fileName === 'large.png'));

    const mineResponse = await fetch(`${baseUrl}/items/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const mine = await mineResponse.json() as Array<{ id: string; media: Array<{ id: string; url: string }> }>;
    const pendingMedia = mine.find((item) => item.id === itemId)?.media;
    assert.equal(pendingMedia?.length, 3);
    const privatePath = pendingMedia?.[0].url;
    assert.ok(privatePath?.includes('access='));

    const blockedResponse = await fetch(`${baseUrl}${privatePath!.split('?')[0]}`);
    assert.equal(blockedResponse.status, 404);
    const authorizedResponse = await fetch(`${baseUrl}${privatePath}`);
    assert.equal(authorizedResponse.status, 200);
    await authorizedResponse.arrayBuffer();

    const adminLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-admin@qcu.test',
        password: 'QcuTest!2026',
      }),
    });
    assert.equal(adminLogin.status, 200);
    const { token: adminToken } = await adminLogin.json() as { token: string };
    const approveResponse = await fetch(`${baseUrl}/admin/items/${itemId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ decision: 'approve' }),
    });
    assert.equal(approveResponse.status, 200);

    const duplicateReview = await fetch(`${baseUrl}/admin/items/${itemId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ decision: 'approve' }),
    });
    assert.equal(duplicateReview.status, 404);
    const editApproved = await fetch(`${baseUrl}/items/${itemId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(editApproved.status, 409);
    const deleteApproved = await fetch(`${baseUrl}/items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(deleteApproved.status, 409);

    const publicResponse = await fetch(`${baseUrl}/items`);
    const publicBody = await publicResponse.json() as { items: Array<{ id: string; media: Array<{ url: string }> }> };
    const publicMedia = publicBody.items.find((item) => item.id === itemId)?.media;
    assert.equal(publicMedia?.length, 3);
    const publicPath = publicMedia?.[0].url;
    assert.ok(publicPath && !publicPath.includes('access='));
    const publicFileResponse = await fetch(`${baseUrl}${publicPath}`);
    assert.equal(publicFileResponse.status, 200);
    await publicFileResponse.arrayBuffer();
    const missingFile = media.find((entry) => publicPath.endsWith(`/${entry.id}`));
    assert.ok(missingFile);
    await removeItemMediaFile(missingFile.imageUrl);
    assert.equal((await fetch(`${baseUrl}${publicPath}`)).status, 404);
  } finally {
    if (itemId) {
      const media = await prisma.itemImage.findMany({ where: { itemId } });
      await prisma.item.delete({ where: { id: itemId } });
      await Promise.all(media.map((entry) => removeItemMediaFile(entry.imageUrl)));
    }
  }
});

test('item lifecycle enforces ownership, pending deletion, media cleanup, and report rejection', async () => {
  const studentLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-student-1@qcu.test',
      password: 'QcuTest!2026',
    }),
  });
  assert.equal(studentLogin.status, 200);
  const { token: studentToken } = await studentLogin.json() as { token: string };
  const adminLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-admin@qcu.test',
      password: 'QcuTest!2026',
    }),
  });
  assert.equal(adminLogin.status, 200);
  const { token: adminToken } = await adminLogin.json() as { token: string };

  const marker = `Lifecycle ${Date.now()}`;
  const pendingForm = new FormData();
  pendingForm.set('type', 'Lost');
  pendingForm.set('title', `${marker} pending image`);
  pendingForm.set('category', 'others');
  pendingForm.set('location', 'Integration test');
  pendingForm.set('occurredAt', new Date().toISOString().slice(0, 10));
  pendingForm.set('description', 'Verify pending report deletion');
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  pendingForm.append('media', new Blob([png], { type: 'image/png' }), 'lifecycle.png');

  const rejectedTitle = `${marker} rejected report`;
  const reportIds: string[] = [];
  let storedMediaUrl = '';
  try {
    const pendingResponse = await fetch(`${baseUrl}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: pendingForm,
    });
    assert.equal(pendingResponse.status, 201);
    const pendingItem = await pendingResponse.json() as { id: string };
    reportIds.push(pendingItem.id);
    const storedMedia = await prisma.itemImage.findFirstOrThrow({ where: { itemId: pendingItem.id } });
    storedMediaUrl = storedMedia.imageUrl;

    const nonOwnerDelete = await fetch(`${baseUrl}/items/${pendingItem.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(nonOwnerDelete.status, 404);
    assert.ok(await prisma.item.findUnique({ where: { id: pendingItem.id } }));

    const ownerDelete = await fetch(`${baseUrl}/items/${pendingItem.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(ownerDelete.status, 204);
    assert.equal(await prisma.item.findUnique({ where: { id: pendingItem.id } }), null);
    const remainingFile = await openItemMediaFile(storedMediaUrl);
    if (remainingFile) await remainingFile.close();
    assert.equal(remainingFile, null);

    const rejectedCreate = await fetch(`${baseUrl}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'Lost',
        title: rejectedTitle,
        category: 'others',
        location: 'Integration test',
        occurredAt: new Date().toISOString().slice(0, 10),
        description: 'Verify rejected report moderation',
        privateDetails: '',
        media: [],
      }),
    });
    assert.equal(rejectedCreate.status, 201);
    const rejectedItem = await rejectedCreate.json() as { id: string };
    reportIds.push(rejectedItem.id);

    const rejectResponse = await fetch(`${baseUrl}/admin/items/${rejectedItem.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ decision: 'reject' }),
    });
    assert.equal(rejectResponse.status, 200);
    assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: rejectedItem.id } })).reviewStatus, ItemReviewStatus.REJECTED);

    const publicResponse = await fetch(`${baseUrl}/items?q=${encodeURIComponent(rejectedTitle)}`);
    const publicResults = await publicResponse.json() as { items: Array<{ id: string }> };
    assert.ok(!publicResults.items.some((item) => item.id === rejectedItem.id));

    const editRejected = await fetch(`${baseUrl}/items/${rejectedItem.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(editRejected.status, 409);
    const deleteRejected = await fetch(`${baseUrl}/items/${rejectedItem.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(deleteRejected.status, 409);
  } finally {
    const media = await prisma.itemImage.findMany({ where: { itemId: { in: reportIds } } });
    await prisma.item.deleteMany({ where: { id: { in: reportIds } } });
    await Promise.all([
      ...media.map((entry) => removeItemMediaFile(entry.imageUrl)),
      ...(storedMediaUrl ? [removeItemMediaFile(storedMediaUrl)] : []),
    ]);
  }
});

test('claim supporting documents stay private and are deleted after approval or rejection', async () => {
  const studentLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-student-1@qcu.test',
      password: 'QcuTest!2026',
    }),
  });
  assert.equal(studentLogin.status, 200);
  const { token: studentToken } = await studentLogin.json() as { token: string };
  const adminLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-admin@qcu.test',
      password: 'QcuTest!2026',
    }),
  });
  assert.equal(adminLogin.status, 200);
  const { token: adminToken } = await adminLogin.json() as { token: string };
  const reporter = await prisma.user.findUniqueOrThrow({ where: { email: 'test-admin@qcu.test' } });
  const category = await prisma.category.findUniqueOrThrow({ where: { name: 'others' } });
  const itemIds: string[] = [];
  const storedKeys: string[] = [];
  const marker = `Claim document ${Date.now()}`;

  const createFoundItem = async (suffix: string) => {
    const item = await prisma.item.create({
      data: {
        title: `${marker} ${suffix}`,
        description: 'Found item for private document integration test',
        hiddenDetail: 'Private owner detail',
        building: 'Integration test',
        reportType: ReportType.FOUND,
        status: ItemStatus.REPORTED,
        reviewStatus: ItemReviewStatus.APPROVED,
        reporterId: reporter.id,
        categoryId: category.id,
      },
    });
    itemIds.push(item.id);
    return item;
  };
  const createClaimForm = (itemId: string) => {
    const form = new FormData();
    form.set('itemId', itemId);
    form.set('hiddenDetailAnswer', 'Distinct mark and contents confirm ownership');
    form.set('lastSeen', 'Library on the afternoon of the event');
    form.set('proofImageDataUrl', 'data:image/png;base64,AAAA');
    return form;
  };

  try {
    const firstItem = await createFoundItem('rejected');
    const secondItem = await createFoundItem('approved');

    const invalidForm = createClaimForm(firstItem.id);
    invalidForm.append('corDocument', new Blob(['not a PDF'], { type: 'application/pdf' }), 'invalid.pdf');
    const invalidResponse = await fetch(`${baseUrl}/claims`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: invalidForm,
    });
    assert.equal(invalidResponse.status, 400);
    assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: firstItem.id } })).status, ItemStatus.REPORTED);

    const duplicateForm = createClaimForm(firstItem.id);
    const pdf = new Blob(['%PDF-1.7\nprivate registration'], { type: 'application/pdf' });
    duplicateForm.append('corDocument', pdf, 'registration.pdf');
    duplicateForm.append('corDocument', pdf, 'registration-copy.pdf');
    const duplicateResponse = await fetch(`${baseUrl}/claims`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: duplicateForm,
    });
    assert.equal(duplicateResponse.status, 400);
    assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: firstItem.id } })).status, ItemStatus.REPORTED);

    const oversizedForm = createClaimForm(firstItem.id);
    const oversizedPdf = new Uint8Array(10 * 1024 * 1024 + 1);
    oversizedPdf.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    oversizedForm.append('corDocument', new Blob([oversizedPdf], { type: 'application/pdf' }), 'oversized.pdf');
    const oversizedResponse = await fetch(`${baseUrl}/claims`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: oversizedForm,
    });
    assert.equal(oversizedResponse.status, 413);

    const rejectedForm = createClaimForm(firstItem.id);
    rejectedForm.append('corDocument', pdf, 'registration.pdf');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    rejectedForm.append('scheduleDocument', new Blob([png], { type: 'image/png' }), 'schedule.png');
    const rejectedClaimResponse = await fetch(`${baseUrl}/claims`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: rejectedForm,
    });
    assert.equal(rejectedClaimResponse.status, 201);
    const rejectedClaim = await rejectedClaimResponse.json() as { id: string; status: ClaimStatus };
    assert.equal(rejectedClaim.status, ClaimStatus.PENDING);

    const rejectedDocuments = await prisma.claimDocument.findMany({ where: { claimId: rejectedClaim.id } });
    assert.equal(rejectedDocuments.length, 2);
    assert.ok(rejectedDocuments.every((document) => document.storageKey.startsWith('storage:')));
    storedKeys.push(...rejectedDocuments.map((document) => document.storageKey));
    assert.equal(await prisma.claimProofImage.count({ where: { claimId: rejectedClaim.id } }), 1);

    const mineResponse = await fetch(`${baseUrl}/claims/mine`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const mine = await mineResponse.json() as {
      claims: Array<{
        id: string;
        documents: Array<{ id: string; documentType: string; fileName: string; url: string }>;
      }>;
    };
    const claimantDocuments = mine.claims.find((claim) => claim.id === rejectedClaim.id)?.documents;
    assert.equal(claimantDocuments?.length, 2);
    const ownerDocument = claimantDocuments?.find((document) => document.documentType === 'COR');
    assert.ok(ownerDocument);
    assert.ok(ownerDocument.url.includes('access='));
    assert.equal((await fetch(`${baseUrl}${ownerDocument.url.split('?')[0]}`)).status, 404);
    const ownerDownload = await fetch(`${baseUrl}${ownerDocument.url}`);
    assert.equal(ownerDownload.status, 200);
    assert.match(ownerDownload.headers.get('content-disposition') ?? '', /attachment/);
    assert.equal((await ownerDownload.arrayBuffer()).byteLength, pdf.size);

    const adminClaimsResponse = await fetch(`${baseUrl}/admin/claims?status=PENDING`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminClaimsResponse.status, 200);
    const adminClaims = await adminClaimsResponse.json() as {
      claims: Array<{ id: string; documents: Array<{ documentType: string; url: string }> }>;
    };
    const adminDocuments = adminClaims.claims.find((claim) => claim.id === rejectedClaim.id)?.documents;
    assert.ok(adminDocuments);
    assert.equal(adminDocuments?.length, 2);
    const adminDownload = await fetch(`${baseUrl}${adminDocuments[0].url}`);
    assert.equal(adminDownload.status, 200);
    await adminDownload.arrayBuffer();

    const approvedForm = createClaimForm(secondItem.id);
    approvedForm.append('corDocument', pdf, 'approved-registration.pdf');
    const approvedClaimResponse = await fetch(`${baseUrl}/claims`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: approvedForm,
    });
    assert.equal(approvedClaimResponse.status, 201);
    const approvedClaim = await approvedClaimResponse.json() as { id: string };
    const approvedDocuments = await prisma.claimDocument.findMany({ where: { claimId: approvedClaim.id } });
    assert.equal(approvedDocuments.length, 1);
    storedKeys.push(...approvedDocuments.map((document) => document.storageKey));

    const rejectResponse = await fetch(`${baseUrl}/admin/claims/${rejectedClaim.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ decision: 'reject' }),
    });
    assert.equal(rejectResponse.status, 200);
    const approveResponse = await fetch(`${baseUrl}/admin/claims/${approvedClaim.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ decision: 'approve' }),
    });
    assert.equal(approveResponse.status, 200);

    assert.equal(await prisma.claimDocument.count({ where: { claimId: { in: [rejectedClaim.id, approvedClaim.id] } } }), 0);
    assert.equal((await prisma.claim.findUniqueOrThrow({ where: { id: rejectedClaim.id } })).status, ClaimStatus.REJECTED);
    assert.equal((await prisma.claim.findUniqueOrThrow({ where: { id: approvedClaim.id } })).status, ClaimStatus.VERIFIED);
    for (const storageKey of storedKeys) {
      const file = await openClaimDocumentFile(storageKey);
      if (file) await file.close();
      assert.equal(file, null);
    }
    assert.equal((await fetch(`${baseUrl}${ownerDocument.url}`)).status, 404);
  } finally {
    const claims = await prisma.claim.findMany({ where: { itemId: { in: itemIds } }, select: { id: true } });
    const documents = await prisma.claimDocument.findMany({
      where: { claimId: { in: claims.map((claim) => claim.id) } },
      select: { storageKey: true },
    });
    await prisma.claim.deleteMany({ where: { id: { in: claims.map((claim) => claim.id) } } });
    await prisma.item.deleteMany({ where: { id: { in: itemIds } } });
    await removeStoredClaimDocuments([
      ...documents,
      ...storedKeys.map((storageKey) => ({ storageKey })),
    ]);
  }
});

test('conversation reports are participant-only, admin-investigated, and notifications are private and readable', async () => {
  const adminLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-admin@qcu.test', password: 'QcuTest!2026' }),
  });
  assert.equal(adminLogin.status, 200);
  const { token: adminToken } = await adminLogin.json() as { token: string };
  const studentLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-student-1@qcu.test', password: 'QcuTest!2026' }),
  });
  assert.equal(studentLogin.status, 200);
  const { token: studentToken } = await studentLogin.json() as { token: string };

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'test-admin@qcu.test' } });
  const outsider = await prisma.user.create({
    data: {
      email: `message-participant-${Date.now()}@qcu.test`,
      fullName: 'Integration Message Participant',
      role: UserRole.STUDENT,
    },
  });
  const participantToken = jwt.sign({}, env.JWT_SECRET, { subject: outsider.id, expiresIn: '1h' });
  const item = await prisma.item.create({
    data: {
      title: `Conversation reporting ${Date.now()}`,
      description: 'Approved item for private conversation integration coverage',
      hiddenDetail: 'Private item detail',
      building: 'Integration test',
      reportType: ReportType.FOUND,
      status: ItemStatus.REPORTED,
      reviewStatus: ItemReviewStatus.APPROVED,
      reporterId: admin.id,
    },
  });
  let conversationId = '';

  try {
    assert.equal((await fetch(`${baseUrl}/notifications`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/admin/conversation-reports`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    })).status, 403);

    const startResponse = await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${participantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ itemId: item.id, content: 'I may have found this item.' }),
    });
    assert.equal(startResponse.status, 201);
    conversationId = (await startResponse.json() as { id: string }).id;

    const replyResponse = await fetch(`${baseUrl}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Please describe the item.' }),
    });
    assert.equal(replyResponse.status, 201);

    assert.equal((await fetch(`${baseUrl}/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    })).status, 404);
    const nonParticipantReport = await fetch(`${baseUrl}/conversations/${conversationId}/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'OTHER' }),
    });
    assert.equal(nonParticipantReport.status, 404);

    const invalidReport = await fetch(`${baseUrl}/conversations/${conversationId}/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${participantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'INVALID' }),
    });
    assert.equal(invalidReport.status, 400);

    const reportResponse = await fetch(`${baseUrl}/conversations/${conversationId}/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${participantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'SCAM_OR_FRAUD', details: 'The sender requested money.' }),
    });
    assert.equal(reportResponse.status, 201);
    const report = await reportResponse.json() as { id: string; status: string };
    assert.equal(report.status, 'PENDING');

    const duplicateReport = await fetch(`${baseUrl}/conversations/${conversationId}/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${participantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'OTHER' }),
    });
    assert.equal(duplicateReport.status, 409);

    const pendingResponse = await fetch(`${baseUrl}/admin/conversation-reports?status=PENDING`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(pendingResponse.status, 200);
    const pendingReports = await pendingResponse.json() as {
      counts: { PENDING: number };
      reports: Array<{
        id: string;
        details: string;
        conversation: { messages: Array<{ content: string }> };
      }>;
    };
    const pendingReport = pendingReports.reports.find((entry) => entry.id === report.id);
    assert.ok(pendingReport);
    assert.equal(pendingReport.details, 'The sender requested money.');
    assert.equal(pendingReport.conversation.messages.length, 2);
    assert.equal(pendingReports.counts.PENDING >= 1, true);

    const reviewResponse = await fetch(`${baseUrl}/admin/conversation-reports/${report.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ decision: 'reviewed' }),
    });
    assert.equal(reviewResponse.status, 200);
    assert.equal((await reviewResponse.json() as { status: string }).status, 'REVIEWED');

    const repeatedReview = await fetch(`${baseUrl}/admin/conversation-reports/${report.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ decision: 'dismiss' }),
    });
    assert.equal(repeatedReview.status, 409);

    const adminNotificationsResponse = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminNotificationsResponse.status, 200);
    const adminNotifications = await adminNotificationsResponse.json() as {
      notifications: Array<{ id: string; href: string | null; readAt: string | null }>;
    };
    const incomingMessageNotification = adminNotifications.notifications.find((entry) => entry.href === `/messages?conversation=${conversationId}`);
    assert.ok(incomingMessageNotification);

    const forbiddenRead = await fetch(`${baseUrl}/notifications/${incomingMessageNotification.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${participantToken}` },
    });
    assert.equal(forbiddenRead.status, 404);
    const markAdminNotificationRead = await fetch(`${baseUrl}/notifications/${incomingMessageNotification.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(markAdminNotificationRead.status, 200);
    assert.ok((await markAdminNotificationRead.json() as { readAt: string }).readAt);

    const participantNotificationsResponse = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${participantToken}` },
    });
    assert.equal(participantNotificationsResponse.status, 200);
    const participantNotifications = await participantNotificationsResponse.json() as {
      notifications: Array<{ href: string | null; message: string; readAt: string | null }>;
      unreadCount: number;
    };
    assert.equal(participantNotifications.unreadCount >= 3, true);
    assert.ok(participantNotifications.notifications.some((entry) => entry.message.includes('has been reviewed')));
    assert.ok(participantNotifications.notifications.some((entry) => entry.message.includes('New message')));

    const markAllResponse = await fetch(`${baseUrl}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${participantToken}` },
    });
    assert.equal(markAllResponse.status, 200);
    const afterReadAll = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${participantToken}` },
    });
    assert.equal((await afterReadAll.json() as { unreadCount: number }).unreadCount, 0);
  } finally {
    if (conversationId) {
      await prisma.notification.deleteMany({
        where: {
          userId: { in: [admin.id, outsider.id] },
          href: { contains: conversationId },
        },
      });
      await prisma.conversation.deleteMany({ where: { id: conversationId } });
    }
    await prisma.item.deleteMany({ where: { id: item.id } });
    await prisma.user.deleteMany({ where: { id: outsider.id } });
  }
});

test('vault intake and code-verified handovers enforce ownership and preserve item lifecycle', async () => {
  const adminLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-admin@qcu.test', password: 'QcuTest!2026' }),
  });
  assert.equal(adminLogin.status, 200);
  const { token: adminToken } = await adminLogin.json() as { token: string };
  const studentLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-student-1@qcu.test', password: 'QcuTest!2026' }),
  });
  assert.equal(studentLogin.status, 200);
  const { token: studentToken } = await studentLogin.json() as { token: string };

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'test-admin@qcu.test' } });
  const student = await prisma.user.findUniqueOrThrow({ where: { email: 'test-student-1@qcu.test' } });
  const owner = await prisma.user.create({
    data: {
      email: `vault-owner-${Date.now()}@qcu.test`,
      fullName: 'Integration Vault Owner',
      role: UserRole.STUDENT,
    },
  });
  const ownerToken = jwt.sign({}, env.JWT_SECRET, { subject: owner.id, expiresIn: '1h' });
  const marker = `Vault phase 8 ${Date.now()}`;
  const itemIds: string[] = [];

  const createItem = async (type: ReportType, status: ItemStatus, reporterId: string, lostStatus = LostItemStatus.OPEN) => {
    const item = await prisma.item.create({
      data: {
        title: `${marker} ${type} ${itemIds.length}`,
        description: 'Integration item for vault intake and handover',
        hiddenDetail: 'Private item detail',
        building: 'Integration test',
        reportType: type,
        status,
        reviewStatus: ItemReviewStatus.APPROVED,
        lostItemStatus: lostStatus,
        reporterId,
      },
    });
    itemIds.push(item.id);
    return item;
  };

  try {
    assert.equal((await fetch(`${baseUrl}/vault`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/vault`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    })).status, 403);

    const claimedFoundItem = await createItem(ReportType.FOUND, ItemStatus.VERIFIED, admin.id);
    const verifiedClaim = await prisma.claim.create({
      data: {
        itemId: claimedFoundItem.id,
        claimerId: owner.id,
        hiddenDetailAnswer: 'Distinct ownership detail',
        lastSeen: 'Library',
        status: ClaimStatus.VERIFIED,
      },
    });

    const missingLocation = await fetch(`${baseUrl}/vault`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ itemId: claimedFoundItem.id, storageLocation: 'x' }),
    });
    assert.equal(missingLocation.status, 400);

    const intakeResponse = await fetch(`${baseUrl}/vault`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ itemId: claimedFoundItem.id, storageLocation: 'Campus security office' }),
    });
    assert.equal(intakeResponse.status, 201);
    const vaultRecord = await intakeResponse.json() as { id: string };
    const storedEntry = await prisma.vaultEntry.findUniqueOrThrow({ where: { id: vaultRecord.id } });
    assert.match(storedEntry.referenceCode, /^QCU-[A-F0-9]{16}$/);

    const duplicateIntake = await fetch(`${baseUrl}/vault`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ itemId: claimedFoundItem.id, storageLocation: 'Campus security office' }),
    });
    assert.equal(duplicateIntake.status, 409);

    const vaultResponse = await fetch(`${baseUrl}/vault?status=ACTIVE`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(vaultResponse.status, 200);
    const vaultData = await vaultResponse.json() as {
      counts: { ACTIVE: number };
      entries: Array<{ id: string; eligibleRecipients: Array<{ id: string }> }>;
    };
    const activeRecord = vaultData.entries.find((entry) => entry.id === vaultRecord.id);
    assert.ok(activeRecord);
    assert.ok(activeRecord.eligibleRecipients.some((recipient) => recipient.id === owner.id));
    assert.equal('referenceCode' in (activeRecord as object), false);
    assert.equal(vaultData.counts.ACTIVE >= 1, true);

    const ownerClaims = await fetch(`${baseUrl}/claims/mine`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const ownerHistory = await ownerClaims.json() as {
      claims: Array<{
        id: string;
        handover: { code: string; storageLocation: string | null } | null;
        handoverCompleted: boolean;
      }>;
    };
    const ownerClaim = ownerHistory.claims.find((claim) => claim.id === verifiedClaim.id);
    assert.equal(ownerClaim?.handover?.code, storedEntry.referenceCode);
    assert.equal(ownerClaim?.handover?.storageLocation, 'Campus security office');
    assert.equal(ownerClaim?.handoverCompleted, false);

    const invalidCode = await fetch(`${baseUrl}/vault/${vaultRecord.id}/handovers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipientId: owner.id, referenceCode: 'QCU-WRONG-CODE' }),
    });
    assert.equal(invalidCode.status, 400);
    const invalidRecipient = await fetch(`${baseUrl}/vault/${vaultRecord.id}/handovers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipientId: admin.id, referenceCode: storedEntry.referenceCode }),
    });
    assert.equal(invalidRecipient.status, 409);

    const handoverResponse = await fetch(`${baseUrl}/vault/${vaultRecord.id}/handovers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipientId: owner.id, referenceCode: storedEntry.referenceCode.toLowerCase() }),
    });
    assert.equal(handoverResponse.status, 200);
    const handover = await handoverResponse.json() as { id: string; recipient: { id: string } };
    assert.equal(handover.recipient.id, owner.id);
    assert.equal((await prisma.handover.findUniqueOrThrow({ where: { id: handover.id } })).releasedToId, owner.id);
    assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: claimedFoundItem.id } })).status, ItemStatus.RETURNED);
    assert.ok((await prisma.vaultEntry.findUniqueOrThrow({ where: { id: vaultRecord.id } })).releasedAt);

    const repeatedHandover = await fetch(`${baseUrl}/vault/${vaultRecord.id}/handovers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipientId: owner.id, referenceCode: storedEntry.referenceCode }),
    });
    assert.equal(repeatedHandover.status, 409);

    const completedClaimResponse = await fetch(`${baseUrl}/claims/mine`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const completedClaims = await completedClaimResponse.json() as {
      claims: Array<{ id: string; handover: unknown; handoverCompleted: boolean }>;
    };
    const completedClaim = completedClaims.claims.find((claim) => claim.id === verifiedClaim.id);
    assert.equal(completedClaim?.handover, null);
    assert.equal(completedClaim?.handoverCompleted, true);

    const notificationResponse = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const notifications = await notificationResponse.json() as {
      notifications: Array<{ message: string }>;
    };
    assert.ok(notifications.notifications.some((notification) => notification.message.includes(storedEntry.referenceCode)));
    const releasedEntriesResponse = await fetch(`${baseUrl}/vault?status=RELEASED`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const releasedEntries = await releasedEntriesResponse.json() as {
      entries: Array<{ id: string; handovers: Array<{ recipient: { id: string } }> }>;
    };
    const releasedEntry = releasedEntries.entries.find((entry) => entry.id === vaultRecord.id);
    assert.equal(releasedEntry?.handovers[0].recipient.id, owner.id);

    const intakeCandidate = await createItem(ReportType.FOUND, ItemStatus.REPORTED, admin.id);
    const candidateIntake = await fetch(`${baseUrl}/vault`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ itemId: intakeCandidate.id, storageLocation: 'Campus security office' }),
    });
    assert.equal(candidateIntake.status, 201);
    assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: intakeCandidate.id } })).status, ItemStatus.IN_VAULT);
    const visibleVaultItem = await fetch(`${baseUrl}/items?q=${encodeURIComponent(intakeCandidate.title)}`);
    const visibleItems = await visibleVaultItem.json() as { items: Array<{ id: string }> };
    assert.ok(visibleItems.items.some((entry) => entry.id === intakeCandidate.id));

    const claimResponse = await fetch(`${baseUrl}/claims`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemId: intakeCandidate.id,
        hiddenDetailAnswer: 'A distinctive mark and contents confirm ownership',
        lastSeen: 'Library on the afternoon of the event',
      }),
    });
    assert.equal(claimResponse.status, 201);
    const pendingClaim = await claimResponse.json() as { id: string };
    const rejectClaim = await fetch(`${baseUrl}/admin/claims/${pendingClaim.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ decision: 'reject' }),
    });
    assert.equal(rejectClaim.status, 200);
    assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: intakeCandidate.id } })).status, ItemStatus.IN_VAULT);

    const lostReport = await createItem(ReportType.LOST, ItemStatus.REPORTED, owner.id);
    const markFound = await fetch(`${baseUrl}/admin/items/${lostReport.id}/resolution`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'mark-found', resolutionLocation: 'Campus security office' }),
    });
    assert.equal(markFound.status, 200);
    const lostReportEntry = await prisma.vaultEntry.findUniqueOrThrow({ where: { itemId: lostReport.id } });
    assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: lostReport.id } })).status, ItemStatus.IN_VAULT);
    const lostReportHandover = await fetch(`${baseUrl}/vault/${lostReportEntry.id}/handovers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipientId: owner.id, referenceCode: lostReportEntry.referenceCode }),
    });
    assert.equal(lostReportHandover.status, 200);
    const returnedLostReport = await prisma.item.findUniqueOrThrow({ where: { id: lostReport.id } });
    assert.equal(returnedLostReport.lostItemStatus, LostItemStatus.RETURNED);
    assert.equal(returnedLostReport.status, ItemStatus.RETURNED);

    const bypassHandover = await fetch(`${baseUrl}/admin/items/${lostReport.id}/resolution`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'mark-returned' }),
    });
    assert.equal(bypassHandover.status, 409);
  } finally {
    await prisma.notification.deleteMany({
      where: {
        userId: { in: [admin.id, student.id, owner.id] },
        message: { contains: marker },
      },
    });
    const claims = await prisma.claim.findMany({ where: { itemId: { in: itemIds } }, select: { id: true } });
    await prisma.claim.deleteMany({ where: { id: { in: claims.map((claim) => claim.id) } } });
    await prisma.vaultEntry.deleteMany({ where: { itemId: { in: itemIds } } });
    await prisma.item.deleteMany({ where: { id: { in: itemIds } } });
    await prisma.user.deleteMany({ where: { id: owner.id } });
  }
});
